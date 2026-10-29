// Télécharge TOUS les fichiers de tous les buckets du stockage Supabase vers un dossier local (lecture seule : aucune écriture sur Supabase).
//
//   node --env-file=.env.local scripts/export-production/stockage.mjs <dossier> [--liste] [--objets=<fichier.json>]
//     --liste   : compte seulement (n'écrit rien sur le disque, ne télécharge rien).
//     --objets  : liste déjà relevée (tableau { bucket_id, name, size }) au lieu de la requête SQL (essais).
// La liste des fichiers vient d'UNE requête sur storage.objects (EXPORT_DB_URL) : parcourir les dossiers par l'API de Supabase (un appel par dossier
// d'utilisateur) sature les connexions de la base. Les téléchargements, eux, passent par l'API, 4 à la fois, avec reprise en cas de refus.
//
// Écrit <dossier>/<bucket>/<chemin> et <dossier>/manifeste-stockage.json (bucket, chemin, octets, sha256 de chaque fichier ; reste dans l'archive chiffrée).
// La console n'affiche que des nombres et des noms de buckets : jamais un nom de fichier, jamais une adresse, jamais une clé.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const [, , dossier, ...options] = process.argv;
const seulementListe = options.includes("--liste");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dossier || !url || !cle) {
  console.error("Usage : node --env-file=.env.local stockage.mjs <dossier> [--liste]  (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY requises)");
  process.exit(1);
}
const admin = createClient(url, cle, { auth: { persistSession: false } });
const PARALLELE = 4;

async function relever() {
  const fichierObjets = options.find((o) => o.startsWith("--objets="))?.split("=")[1];
  let lignes;
  if (fichierObjets) {
    lignes = JSON.parse(fs.readFileSync(fichierObjets, "utf8"));
  } else {
    if (!process.env.EXPORT_DB_URL) throw new Error("EXPORT_DB_URL absente (adresse de connexion à la base).");
    const client = new pg.Client({ connectionString: process.env.EXPORT_DB_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    ({ rows: lignes } = await client.query("SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint, 0) AS size FROM storage.objects ORDER BY bucket_id, name"));
    await client.end();
  }
  const parBucket = new Map();
  for (const l of lignes) {
    if (!parBucket.has(l.bucket_id)) parBucket.set(l.bucket_id, []);
    parBucket.get(l.bucket_id).push({ chemin: l.name, octets: Number(l.size) });
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

async function telecharger(bucket, chemin) {
  for (let essai = 1; essai <= 5; essai++) {
    const { data, error } = await admin.storage.from(bucket).download(chemin);
    if (!error && data) return Buffer.from(await data.arrayBuffer());
    if (essai === 5) throw new Error(error?.message || "téléchargement vide");
    await new Promise((r) => setTimeout(r, 1000 * essai));
  }
}

const parBucket = await relever();
const manifeste = [];
let echecs = 0;
for (const [bucket, fichiers] of parBucket) {
  const b = { id: bucket };
  const octetsListes = fichiers.reduce((s, f) => s + f.octets, 0);
  if (seulementListe) {
    console.log(`${b.id.padEnd(22)} ${String(fichiers.length).padStart(5)} fichier(s) ${(octetsListes / 1048576).toFixed(1).padStart(8)} Mo`);
    manifeste.push(...fichiers.map((f) => ({ bucket: b.id, ...f })));
    continue;
  }
  let fait = 0;
  const file = [...fichiers];
  await Promise.all(
    Array.from({ length: PARALLELE }, async () => {
      for (let f = file.shift(); f; f = file.shift()) {
        try {
          const contenu = await telecharger(b.id, f.chemin);
          const cible = cheminLocal(b.id, f.chemin);
          fs.mkdirSync(path.dirname(cible), { recursive: true });
          fs.writeFileSync(cible, contenu);
          manifeste.push({ bucket: b.id, chemin: f.chemin, octets: contenu.length, sha256: crypto.createHash("sha256").update(contenu).digest("hex") });
        } catch (e) {
          echecs += 1;
          manifeste.push({ bucket: b.id, chemin: f.chemin, octets: f.octets, erreur: String(e.message).slice(0, 120) });
        }
        fait += 1;
      }
    }),
  );
  console.log(`${b.id.padEnd(22)} ${String(fichiers.length).padStart(5)} fichier(s) ${(octetsListes / 1048576).toFixed(1).padStart(8)} Mo — ${fait} traité(s)`);
}
if (!seulementListe) {
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, "manifeste-stockage.json"), JSON.stringify(manifeste));
}
const total = manifeste.length;
console.log(`${seulementListe ? "LISTE" : "TÉLÉCHARGEMENT"} : ${total} fichier(s), ${echecs} échec(s).`);
process.exit(echecs > 0 ? 2 : 0);
