// Télécharge TOUS les fichiers de tous les buckets du stockage Supabase vers un dossier local (lecture seule : aucune écriture sur Supabase).
//
//   node --env-file=.env.local scripts/export-production/stockage.mjs <dossier> [--liste] [--reprendre] [--objets=<fichier.json>]
//                                        [--portee=prives|tous] [--baseline=<etat.json>] [--archive-id=<id>]
//     --portee    : prives = tous les buckets SAUF les 3 publics déjà copiés dans R2 (job-offers, marketplace-photos, stories-media) ; tous = y compris ces 3 buckets.
//                   Absent : tous les buckets (comportement d'origine).
//     --baseline  : état du dernier export (fichier JSON { fichiers: [{ bucket, chemin, octets, sha256, updated_at, etag, archive }] }). Un fichier de la portée identique à l'état (même
//                   taille, même date de modification, même etag) n'est PAS téléchargé : il est « inchange » dans le manifeste, avec l'archive qui le contient. Seuls les fichiers
//                   nouveaux ou modifiés sont téléchargés (limite l'egress). Sans baseline : tout est téléchargé.
//     --archive-id: identifiant de l'archive en cours (inscrit dans portee.json).
//     --liste     : compte seulement (n'écrit rien sur le disque, ne télécharge rien).
//     --reprendre : reprend dans un dossier existant : un fichier déjà téléchargé, de même taille et de même empreinte SHA-256 que le manifeste précédent,
//                   n'est PAS retéléchargé ; seuls les fichiers manquants, échoués ou « absents à la source » sont redemandés.
//     --objets    : liste déjà relevée (tableau { bucket_id, name, size }) au lieu de la requête SQL (essais).
// La liste des fichiers vient d'UNE requête sur storage.objects (EXPORT_DB_URL) : parcourir les dossiers par l'API de Supabase (un appel par dossier
// d'utilisateur) sature les connexions de la base. Les téléchargements passent par l'API, EXPORT_PARALLELE à la fois (2 par défaut).
//
// Erreurs classées, jamais contournées en silence :
//   - transitoire (« Too many connections », délai dépassé, 429, 5xx…) : réessayé avec une attente croissante (1, 2, 4, 8, 16, 30 s) et une pause commune à tous
//     les téléchargements ; si cela échoue encore : « échec », à reprendre avec --reprendre ;
//   - absent à la source (le fichier est LISTÉ par la base mais Supabase répond « introuvable », confirmé deux fois) : inscrit « absent_source » dans le manifeste
//     et dans absents-source.json ; l'export n'avance qu'après un choix explicite de la personne (voir exporter.ps1) ;
//   - taille reçue différente de la taille listée, ou fichier vide alors que la base en annonce un contenu : échec (jamais accepté tel quel).
//
// Écrit <dossier>/<bucket>/<chemin>, <dossier>/manifeste-stockage.json (bucket, chemin, octets, sha256 ; reste dans l'archive chiffrée) et absents-source.json.
// La console n'affiche que des nombres, des noms de buckets et, pour les fichiers NON récupérés, un chemin masqué (identifiants raccourcis, nom réduit à sa
// forme, référence courte) : jamais une adresse, jamais une clé.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import pg from "pg";
import { empreinteAbsents, exigerMemeProjet, masquerChemin, refDepuisAdresseDb, refDepuisUrlApi } from "./projet.mjs";
import fs from "node:fs";
import path from "node:path";
import { bucketsDansLaPortee, calculerDelta } from "./delta.mjs";

const [, , dossier, ...options] = process.argv;
const seulementListe = options.includes("--liste");
const reprendre = options.includes("--reprendre");
const valeurOption = (nom) => options.find((o) => o.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const portee = valeurOption("portee"); // undefined | "prives" | "tous"
if (portee !== undefined && !["prives", "tous"].includes(portee)) {
  console.error("--portee doit valoir « prives » ou « tous ».");
  process.exit(1);
}
const fichierBaseline = valeurOption("baseline");
const archiveId = valeurOption("archive-id") || null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dossier || !url || !cle) {
  console.error("Usage : node --env-file=.env.local stockage.mjs <dossier> [--liste] [--reprendre]  (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY requises)");
  process.exit(1);
}
// Garde-fou : les fichiers sont téléchargés par l'API de CE projet ; la liste vient de la base de l'adresse EXPORT_DB_URL. Les deux doivent être le même projet.
if (process.env.EXPORT_DB_URL) {
  try {
    exigerMemeProjet(refDepuisAdresseDb(process.env.EXPORT_DB_URL), refDepuisUrlApi(url));
  } catch (e) {
    console.error(e.message);
    process.exit(3);
  }
}
const admin = createClient(url, cle, { auth: { persistSession: false } });
const PARALLELE = Math.max(1, Number(process.env.EXPORT_PARALLELE || 2));
const ATTENTE_MS = Math.max(0, Number(process.env.EXPORT_ATTENTE_MS ?? 1000));
const ESSAIS = 7;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let pauseJusqua = 0; // pause commune : quand la base est saturée, tous les téléchargements ralentissent ensemble

/** « absent » (introuvable), « transitoire » (à réessayer) ou « autre ». */
function genreErreur(erreur) {
  const msg = String(erreur?.message ?? erreur ?? "");
  const statut = String(erreur?.statusCode ?? erreur?.status ?? "");
  if (/not.?found|object not found|does not exist|no such/i.test(msg) || statut === "404") return "absent";
  if (/too many connections|timeout|timed out|fetch failed|econn|etimedout|socket|rate limit|temporar|gateway|unavailable|reset/i.test(msg) || ["429", "500", "502", "503", "504"].includes(statut)) return "transitoire";
  return "autre";
}

async function relever() {
  const fichierObjets = options.find((o) => o.startsWith("--objets="))?.split("=")[1];
  let lignes;
  if (fichierObjets) {
    lignes = JSON.parse(fs.readFileSync(fichierObjets, "utf8"));
  } else {
    if (!process.env.EXPORT_DB_URL) throw new Error("EXPORT_DB_URL absente (adresse de connexion à la base).");
    const client = new pg.Client({ connectionString: process.env.EXPORT_DB_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    ({ rows: lignes } = await client.query("SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint, 0) AS size, updated_at, metadata->>'eTag' AS etag FROM storage.objects ORDER BY bucket_id, name"));
    await client.end();
  }
  const parBucket = new Map();
  for (const l of lignes) {
    if (!parBucket.has(l.bucket_id)) parBucket.set(l.bucket_id, []);
    parBucket.get(l.bucket_id).push({ chemin: l.name, octets: Number(l.size), updated_at: l.updated_at ? new Date(l.updated_at).toISOString() : null, etag: l.etag ?? null });
  }
  // Portée : buckets privés seulement (ou tous). Les buckets hors portée ne sont ni listés ni téléchargés.
  if (portee) {
    const retenus = new Set(bucketsDansLaPortee([...parBucket.keys()], { mode: "Complet", avecImagesPubliques: portee === "tous" }));
    for (const b of [...parBucket.keys()]) if (!retenus.has(b)) parBucket.delete(b);
  }
  return parBucket;
}

// Refuse tout chemin qui sortirait du dossier de destination (« .. », chemin absolu).
function cheminLocal(bucket, chemin) {
  const racine = path.resolve(dossier, bucket);
  const cible = path.resolve(racine, ...chemin.split("/"));
  if (cible !== racine && !cible.startsWith(racine + path.sep)) throw new Error("chemin refusé");
  return cible;
}

/** Télécharge un fichier ; lève une erreur portant .genre ('absent' | 'transitoire' | 'autre' | 'taille'). */
async function telecharger(bucket, chemin, octetsListes) {
  let derniere = null;
  for (let essai = 1; essai <= ESSAIS; essai++) {
    const attente = pauseJusqua - Date.now();
    if (attente > 0) await dormir(attente);
    const { data, error } = await admin.storage.from(bucket).download(chemin);
    if (!error && data) {
      const contenu = Buffer.from(await data.arrayBuffer());
      if (contenu.length === octetsListes) return contenu;
      derniere = Object.assign(new Error(`taille reçue ${contenu.length} o, taille annoncée ${octetsListes} o`), { genre: "taille" });
    } else {
      const genre = genreErreur(error);
      derniere = Object.assign(new Error(String(error?.message ?? "téléchargement vide").slice(0, 160)), { genre });
      // « Introuvable » n'est cru qu'après une seconde demande (une erreur passagère peut y ressembler) ; jamais plus : c'est un état de la source.
      if (genre === "absent" && essai >= 2) throw derniere;
      if (genre === "autre" && essai >= 3) throw derniere;
    }
    if (essai === ESSAIS) break;
    const delai = Math.min(30000, ATTENTE_MS * 2 ** (essai - 1));
    if (derniere.genre === "transitoire" || derniere.genre === "taille") pauseJusqua = Math.max(pauseJusqua, Date.now() + delai);
    await dormir(delai);
  }
  throw derniere;
}

const parBucket = await relever();

// Différences avec l'état du dernier export (mode Complet incrémental).
let baseline = null;
if (fichierBaseline) {
  try {
    baseline = JSON.parse(fs.readFileSync(fichierBaseline, "utf8"));
  } catch (e) {
    console.error(`Etat du dernier export illisible (${String(e.message).slice(0, 80)}) : arret par prudence, rien n'est telecharge.`);
    process.exit(1);
  }
}
const inchanges = new Map();
if (baseline && !seulementListe) {
  const objets = [...parBucket].flatMap(([bucket, l]) => l.map((f) => ({ bucket, chemin: f.chemin, octets: f.octets, updated_at: f.updated_at, etag: f.etag })));
  for (const i of calculerDelta(objets, baseline).inchanges) inchanges.set(`${i.bucket}\0${i.chemin}`, i);
}

// Reprise : manifeste précédent, indexé par bucket + chemin.
const ancien = new Map();
if (reprendre) {
  try {
    for (const e of JSON.parse(fs.readFileSync(path.join(dossier, "manifeste-stockage.json"), "utf8"))) ancien.set(`${e.bucket}\0${e.chemin}`, e);
  } catch {
    // pas de manifeste : rien à reprendre, tout sera téléchargé
  }
}
/** Entrée du manifeste précédent encore valable (fichier présent, même taille que la base, même empreinte), sinon null. */
function dejaBon(bucket, f) {
  const e = ancien.get(`${bucket}\0${f.chemin}`);
  if (!e || !e.sha256 || e.octets !== f.octets) return null;
  try {
    const contenu = fs.readFileSync(cheminLocal(bucket, f.chemin));
    return contenu.length === e.octets && crypto.createHash("sha256").update(contenu).digest("hex") === e.sha256 ? e : null;
  } catch {
    return null;
  }
}

const manifeste = [];
let echecs = 0;
let absents = 0;
let gardes = 0;
let references = 0;
for (const [bucket, fichiers] of parBucket) {
  const octetsListes = fichiers.reduce((s, f) => s + f.octets, 0);
  if (seulementListe) {
    console.log(`${bucket.padEnd(22)} ${String(fichiers.length).padStart(5)} fichier(s) ${(octetsListes / 1048576).toFixed(1).padStart(8)} Mo`);
    manifeste.push(...fichiers.map((f) => ({ bucket, ...f })));
    continue;
  }
  let traites = 0;
  let reutilises = 0;
  const file = [...fichiers];
  await Promise.all(
    Array.from({ length: PARALLELE }, async () => {
      for (let f = file.shift(); f; f = file.shift()) {
        const inchange = inchanges.get(`${bucket}\0${f.chemin}`);
        const bon = inchange ? null : reprendre ? dejaBon(bucket, f) : null;
        if (inchange) {
          manifeste.push({ bucket, chemin: f.chemin, octets: f.octets, sha256: inchange.base.sha256, statut: "inchange", archive: inchange.base.archive ?? null, updated_at: f.updated_at, etag: f.etag });
          references += 1;
        } else if (bon) {
          manifeste.push(bon);
          reutilises += 1;
          gardes += 1;
        } else {
          try {
            const contenu = await telecharger(bucket, f.chemin, f.octets);
            const cible = cheminLocal(bucket, f.chemin);
            fs.mkdirSync(path.dirname(cible), { recursive: true });
            fs.writeFileSync(cible, contenu);
            manifeste.push({ bucket, chemin: f.chemin, octets: contenu.length, sha256: crypto.createHash("sha256").update(contenu).digest("hex"), updated_at: f.updated_at ?? null, etag: f.etag ?? null });
          } catch (e) {
            const absent = e.genre === "absent";
            if (absent) absents += 1;
            else echecs += 1;
            manifeste.push({ bucket, chemin: f.chemin, octets: f.octets, statut: absent ? "absent_source" : "echec", genre: e.genre ?? "autre", erreur: String(e.message).slice(0, 160) });
          }
        }
        traites += 1;
      }
    }),
  );
  console.log(`${bucket.padEnd(22)} ${String(fichiers.length).padStart(5)} fichier(s) ${(octetsListes / 1048576).toFixed(1).padStart(8)} Mo - ${traites} traite(s)${reprendre ? `, dont ${reutilises} deja present(s) et verifie(s)` : ""}${baseline ? `, dont ${manifeste.filter((e) => e.bucket === bucket && e.statut === "inchange").length} inchange(s) (references, non telecharges)` : ""}`);
}

if (!seulementListe) {
  fs.mkdirSync(dossier, { recursive: true });
  // Écriture par fichier temporaire : un arrêt en cours d'écriture ne laisse jamais un manifeste coupé.
  const final = path.join(dossier, "manifeste-stockage.json");
  fs.writeFileSync(`${final}.tmp`, JSON.stringify(manifeste));
  fs.renameSync(`${final}.tmp`, final);
  // Portée de cet export : lue par etat.mjs (nouvel état du dernier export) et par verifier.mjs.
  fs.writeFileSync(path.join(dossier, "portee.json"), JSON.stringify({ portee: portee ?? "tous-les-buckets", buckets: [...parBucket.keys()].sort(), baseline: Boolean(baseline), archive: archiveId }));
  const absentsListe = manifeste.filter((e) => e.statut === "absent_source");
  fs.writeFileSync(
    path.join(dossier, "absents-source.json"),
    JSON.stringify({ nombre: absentsListe.length, empreinte: empreinteAbsents(absentsListe), fichiers: absentsListe.map(({ bucket, chemin, octets, erreur }) => ({ bucket, chemin, octets_listes: octets, erreur })) }, null, 1),
  );
  const listes = new Set([...parBucket].flatMap(([b, fs_]) => fs_.map((f) => `${b}\0${f.chemin}`)));
  const retires = [...ancien.keys()].filter((k) => !listes.has(k)).length;
  if (retires > 0) console.log(`${retires} fichier(s) du manifeste precedent ne sont plus dans la production : ignores (fichiers locaux laisses en place, non inscrits).`);
}

const recuperes = manifeste.filter((e) => e.sha256 && e.statut !== "inchange").length;
console.log(`${seulementListe ? "LISTE" : "TELECHARGEMENT"} : ${manifeste.length} fichier(s), ${recuperes} recupere(s)${reprendre ? ` (dont ${gardes} deja present(s))` : ""}, ${echecs} echec(s), ${absents} absent(s) a la source${baseline ? `, ${references} inchange(s) (references)` : ""}.`);
const montrer = (titre, genre) => {
  const lignes = manifeste.filter((e) => (genre === "absent" ? e.statut === "absent_source" : e.statut === "echec"));
  if (lignes.length === 0) return;
  console.log(`\n${titre} (${lignes.length}) :`);
  for (const e of lignes) console.log(`  ${e.bucket}/${masquerChemin(e.chemin)} - ${e.octets} octets annonces - ${e.erreur}`);
};
montrer("Fichiers NON recuperes (echec)", "echec");
montrer("Fichiers LISTES par la base mais INTROUVABLES dans le stockage (absents a la source)", "absent");
if (echecs > 0) console.log("\nRelancez avec -Reprendre : seuls les fichiers manquants ou echoues seront retelecharges.");
// 0 : tout est là ; 2 : au moins un échec (à reprendre) ; 4 : seulement des absents à la source (choix explicite requis) ; 3 : projets différents (plus haut).
process.exit(echecs > 0 ? 2 : absents > 0 ? 4 : 0);
