// Vérifie un export (étape 3) : lignes de chaque table et fichiers du stockage comparés à la production, fichiers relus, structure lisible. Lecture seule.
//
//   node scripts/export-production/verifier.mjs <dossier-export> [--mode=Leger|Complet] [--portee=prives|tous]
//     --mode=Leger : base seulement, aucun fichier de stockage à vérifier. --mode=Complet --portee=prives|tous : seuls les buckets de la portée sont comparés ;
//     les autres sont indiqués « hors portée » (ce n'est pas un problème). Les fichiers « inchange » (référencés, non retéléchargés) comptent comme présents par référence.
//   Variables : EXPORT_DB_URL (adresse de connexion, jamais affichée), EXPORT_PG_BIN (dossier de pg_restore ; sinon pg_restore du PATH).
//
// Dossier attendu : donnees.dump (pg_dump --format=custom), structure.sql (pg_dump --schema-only), stockage/<bucket>/..., stockage/manifeste-stockage.json.
// Sortie : un rapport lisible dans la console + rapport-verification.json (nombres et noms de tables/buckets seulement : aucune donnée personnelle, aucun nom de fichier).
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pg from "pg";
import { bucketsDansLaPortee } from "./delta.mjs";
import { empreinteAbsents, masquerChemin } from "./projet.mjs";

// Tables qui bougent en continu pendant l'export (sessions, jetons, présence, journaux) : un petit écart est normal, pas une perte.
export const TABLES_VIVANTES = new Set([
  "auth.refresh_tokens", "auth.sessions", "auth.mfa_amr_claims", "auth.one_time_tokens", "auth.flow_state", "auth.audit_log_entries",
  "public.presence_heartbeats", "public.security_logs", "public.rate_limits", "storage.objects",
]);

/** Compte les lignes de chaque bloc « COPY schema.table (...) FROM stdin; … \. » d'un flux de dump en texte. */
export async function compterCopy(flux, octets = null) {
  const comptes = new Map();
  let courant = null;
  for await (const ligne of readline.createInterface({ input: flux, crlfDelay: Infinity })) {
    if (courant === null) {
      const m = /^COPY ([^\s(]+) /.exec(ligne);
      if (m) {
        courant = m[1].replace(/"/g, "");
        comptes.set(courant, 0);
      }
    } else if (ligne === "\\.") {
      courant = null;
    } else {
      comptes.set(courant, comptes.get(courant) + 1);
      if (octets) octets.set(courant, (octets.get(courant) ?? 0) + Buffer.byteLength(ligne) + 1);
    }
  }
  return comptes;
}

/**
 * Compare le manifeste du stockage à la production (fonction pure, testable). `buckets` = portée du mode (null : tous). `lireFichier(entrée)` dit si le fichier téléchargé est
 * présent et conforme sur le disque. Un fichier « inchange » n'est pas relu : il est présent PAR RÉFÉRENCE (archive précédente) et compte pour sa taille.
 */
export function evaluerStockage({ manifeste, objetsProd, buckets = null, lireFichier, decisionValide = false, masquer = masquerChemin }) {
  const vide = () => ({ n: 0, octets: 0, erreurs: 0, relus: 0, references: 0, absents: 0, octetsAbsents: 0, octetsTelecharges: 0, octetsReferences: 0 });
  const parBucket = new Map();
  const absentsALaSource = [];
  for (const f of manifeste) {
    if (buckets && !buckets.includes(f.bucket)) continue;
    if (!parBucket.has(f.bucket)) parBucket.set(f.bucket, vide());
    const b = parBucket.get(f.bucket);
    b.n += 1;
    if (f.statut === "absent_source") {
      b.absents += 1;
      b.octetsAbsents += f.octets;
      absentsALaSource.push({ bucket: f.bucket, chemin_masque: masquer(f.chemin), octets_listes: f.octets, erreur: f.erreur });
    } else if (f.statut === "inchange") {
      b.references += 1;
      b.octets += f.octets;
      b.octetsReferences += f.octets;
    } else if (f.erreur) {
      b.erreurs += 1;
    } else if (lireFichier(f)) {
      b.relus += 1;
      b.octets += f.octets;
      b.octetsTelecharges += f.octets;
    } else {
      b.erreurs += 1;
    }
  }
  const lignes = [];
  const problemes = [];
  for (const o of objetsProd) {
    if (buckets && !buckets.includes(o.bucket_id)) {
      lignes.push({ bucket: o.bucket_id, production: o.n, octets_production: Number(o.octets), etat: "hors portée de ce mode (non exporté ici)" });
      continue;
    }
    const b = parBucket.get(o.bucket_id) || vide();
    const egal = b.n === o.n && b.octets + b.octetsAbsents === Number(o.octets) && b.erreurs === 0 && b.relus + b.references + b.absents === o.n && (b.absents === 0 || decisionValide);
    lignes.push({
      bucket: o.bucket_id,
      production: o.n,
      fichiers_relus: b.relus,
      fichiers_references: b.references,
      absents_a_la_source: b.absents,
      erreurs: b.erreurs,
      octets_production: Number(o.octets),
      octets_exportes: b.octetsTelecharges,
      octets_references: b.octetsReferences,
      etat: egal ? (b.absents > 0 ? "égal, avec absents acceptés" : b.references > 0 ? "égal (dont fichiers inchangés référencés)" : "égal") : "ÉCART",
    });
    if (!egal) problemes.push(`bucket ${o.bucket_id} : production ${o.n} fichier(s) / ${o.octets} o, export ${b.relus} relu(s) + ${b.references} référencé(s) / ${b.octets} o, ${b.erreurs} erreur(s), ${b.absents} absent(s) à la source`);
  }
  const volumes = { telecharge: 0, references: 0 };
  for (const b of parBucket.values()) {
    volumes.telecharge += b.octetsTelecharges;
    volumes.references += b.octetsReferences;
  }
  return { lignes, problemes, absentsALaSource, volumes };
}

function lireCopyDuDump(dossier) {
  const bin = process.env.EXPORT_PG_BIN ? path.join(process.env.EXPORT_PG_BIN, "pg_restore") : "pg_restore";
  const p = spawn(bin, ["--data-only", "--file=-", path.join(dossier, "donnees.dump")], { stdio: ["ignore", "pipe", "pipe"] });
  let erreurs = "";
  p.stderr.on("data", (d) => (erreurs += d));
  const fin = new Promise((resolve) => p.on("close", (code) => resolve({ code, erreurs })));
  return { flux: p.stdout, fin };
}

const SQL_LIGNES = `SELECT n.nspname || '.' || c.relname AS t,
  (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint AS n
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','auth','storage')`;

async function main() {
  const dossier = process.argv[2];
  if (!dossier || !process.env.EXPORT_DB_URL) {
    console.error("Usage : EXPORT_DB_URL=… node verifier.mjs <dossier-export>");
    process.exit(1);
  }
  const valeur = (nom) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
  const mode = valeur("mode"); // undefined (comportement d'origine : tout le stockage) | Leger | Complet
  const portee = valeur("portee"); // undefined | prives | tous
  if (mode !== undefined && !["Leger", "Complet"].includes(mode)) {
    console.error("--mode doit valoir Leger ou Complet.");
    process.exit(1);
  }
  const rapport = { mode: mode ?? "complet-d-origine", portee: mode === "Leger" ? null : portee ?? "tous-les-buckets", tables: [], stockage: [], structure: {}, absents_a_la_source: [], decision_absents: null, volumes: {}, problemes: [] };
  const client = new pg.Client({ connectionString: process.env.EXPORT_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Lignes : production (maintenant) contre contenu du dump.
  const prod = new Map((await client.query(SQL_LIGNES)).rows.map((r) => [r.t, Number(r.n)]));
  const lecture = lireCopyDuDump(dossier);
  const volumeParTable = new Map();
  const dump = await compterCopy(lecture.flux, volumeParTable);
  rapport.volumes.base_non_compressee_octets = [...volumeParTable.values()].reduce((a, b) => a + b, 0);
  const retour = await lecture.fin;
  if (retour.code !== 0) rapport.problemes.push(`pg_restore a échoué (code ${retour.code}) : dump illisible ou pg_restore absent.`);
  for (const [t, n] of [...prod].sort()) {
    const d = dump.get(t);
    let etat = "égal";
    if (d === undefined) etat = "ABSENT du dump";
    else if (d !== n) etat = TABLES_VIVANTES.has(t) ? "écart toléré (table vivante)" : "ÉCART";
    if (etat === "ABSENT du dump" || etat === "ÉCART") rapport.problemes.push(`${t} : production ${n}, dump ${d ?? "—"} (${etat})`);
    rapport.tables.push({ table: t, production: n, dump: d ?? null, etat });
  }
  for (const t of dump.keys()) if (!prod.has(t)) rapport.problemes.push(`${t} : présente dans le dump mais pas dans la production`);

  // 2. Stockage : manifeste contre storage.objects, puis relecture des fichiers téléchargés. Mode Leger : aucun fichier exporté, rien à comparer.
  if (mode === "Leger") {
    rapport.stockage_note = "mode léger : aucun fichier de stockage exporté (comptes et données dans la base seulement)";
    rapport.volumes.stockage_telecharge_octets = 0;
    rapport.volumes.stockage_references_octets = 0;
  } else {
    const manifeste = JSON.parse(fs.readFileSync(path.join(dossier, "stockage", "manifeste-stockage.json"), "utf8"));
    const objets = (await client.query("SELECT bucket_id, count(*)::int AS n, COALESCE(sum((metadata->>'size')::bigint),0)::bigint AS octets FROM storage.objects GROUP BY bucket_id")).rows;
    const buckets = portee ? bucketsDansLaPortee(objets.map((o) => o.bucket_id), { mode: "Complet", avecImagesPubliques: portee === "tous" }) : null;
    // Fichiers LISTÉS par la base mais introuvables dans le stockage (« absents à la source ») : jamais acceptés en silence. Ils ne comptent comme
    // conformes que si la personne a confirmé explicitement son choix (decision-absents.json, écrit par exporter.ps1) pour CETTE liste de fichiers.
    let decision = null;
    try {
      decision = JSON.parse(fs.readFileSync(path.join(dossier, "stockage", "decision-absents.json"), "utf8"));
    } catch {}
    const absentsManifeste = manifeste.filter((f) => f.statut === "absent_source" && (!buckets || buckets.includes(f.bucket)));
    const nbAbsents = absentsManifeste.length;
    const decisionValide = decision?.accepte === true && Number(decision.nombre) === nbAbsents && decision.empreinte === empreinteAbsents(absentsManifeste);
    rapport.decision_absents = nbAbsents === 0 ? null : decisionValide ? { accepte: true, nombre: nbAbsents, date: decision.date } : { accepte: false, nombre: nbAbsents };
    if (nbAbsents > 0 && !decisionValide) rapport.problemes.push(`${nbAbsents} fichier(s) absent(s) à la source : choix explicite de la personne requis (decision-absents.json absent, ou donné pour une autre liste de fichiers).`);
    const lireFichier = (f) => {
      try {
        const contenu = fs.readFileSync(path.join(dossier, "stockage", f.bucket, ...f.chemin.split("/")));
        return contenu.length === f.octets && crypto.createHash("sha256").update(contenu).digest("hex") === f.sha256;
      } catch {
        return false;
      }
    };
    const ev = evaluerStockage({ manifeste, objetsProd: objets, buckets, lireFichier, decisionValide });
    rapport.stockage = ev.lignes;
    rapport.absents_a_la_source = ev.absentsALaSource;
    rapport.problemes.push(...ev.problemes);
    rapport.volumes.stockage_telecharge_octets = ev.volumes.telecharge;
    rapport.volumes.stockage_references_octets = ev.volumes.references;
  }

  // 3. Structure : lisible, et autant de tables / politiques / fonctions / déclencheurs que la production.
  const sql = fs.readFileSync(path.join(dossier, "structure.sql"), "utf8");
  const compte = (re) => (sql.match(re) || []).length;
  const prodStructure = (
    await client.query(`SELECT
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','auth','storage'))::int AS tables,
      (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','auth','storage'))::int AS politiques,
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e'))::int AS fonctions,
      (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage'))::int AS declencheurs`)
  ).rows[0];
  const dansSql = {
    tables: compte(/^CREATE TABLE /gm),
    politiques: compte(/^CREATE POLICY /gm),
    fonctions: compte(/^CREATE (OR REPLACE )?FUNCTION public\./gm),
    declencheurs: compte(/^CREATE (CONSTRAINT )?TRIGGER /gm),
  };
  for (const k of Object.keys(dansSql)) {
    const egal = dansSql[k] === prodStructure[k];
    rapport.structure[k] = { production: prodStructure[k], structure_sql: dansSql[k], etat: egal ? "égal" : "ÉCART" };
    if (!egal) rapport.problemes.push(`structure.sql : ${k} — production ${prodStructure[k]}, fichier ${dansSql[k]}`);
  }
  await client.end();

  // 4. Résumé
  const nT = rapport.tables.length;
  console.log(`Tables : ${nT} (${rapport.tables.filter((t) => t.etat === "égal").length} égales, ${rapport.tables.filter((t) => t.etat.startsWith("écart toléré")).length} écart toléré, ${rapport.tables.filter((t) => t.etat === "ÉCART" || t.etat === "ABSENT du dump").length} en problème) — ${rapport.tables.reduce((s, t) => s + (t.dump ?? 0), 0)} lignes dans le dump.`);
  for (const t of rapport.tables.filter((t) => t.etat.startsWith("écart toléré"))) console.log(`  écart toléré : ${t.table} production ${t.production} / dump ${t.dump}`);
  const mo = (n) => (n / 1048576).toFixed(1);
  console.log(`Mode : ${rapport.mode}${rapport.portee ? ` (portée : ${rapport.portee})` : ""}`);
  if (rapport.stockage_note) console.log(`Stockage : ${rapport.stockage_note}`);
  for (const b of rapport.stockage) console.log(`Stockage ${b.bucket.padEnd(20)} production ${String(b.production).padStart(5)} · ${b.fichiers_relus === undefined ? "" : `relus ${String(b.fichiers_relus).padStart(5)}${b.fichiers_references ? ` · référencés ${b.fichiers_references}` : ""}`}${b.absents_a_la_source ? ` · absents à la source ${b.absents_a_la_source}` : ""} · ${b.etat}`);
  console.log(`Volumes mesurés de CET export (à comparer à la page Usage de Supabase) : base non compressée ${mo(rapport.volumes.base_non_compressee_octets)} Mo, fichiers téléchargés ${mo(rapport.volumes.stockage_telecharge_octets)} Mo, fichiers référencés (non retéléchargés) ${mo(rapport.volumes.stockage_references_octets)} Mo.`);
  for (const [k, v] of Object.entries(rapport.structure)) console.log(`Structure ${k.padEnd(13)} production ${String(v.production).padStart(4)} · fichier ${String(v.structure_sql).padStart(4)} · ${v.etat}`);
  fs.writeFileSync(path.join(dossier, "rapport-verification.json"), JSON.stringify(rapport, null, 1));
  if (rapport.problemes.length > 0) {
    console.log(`\nPROBLÈME(S) : ${rapport.problemes.length}`);
    for (const p of rapport.problemes) console.log("  - " + p);
    process.exit(2);
  }
  console.log("\nVÉRIFICATION RÉUSSIE : lignes, fichiers et structure conformes à la production.");
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) await main();
