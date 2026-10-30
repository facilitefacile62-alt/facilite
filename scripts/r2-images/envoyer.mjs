// Envoi des images publiques vers R2 « facilite-images » puis vérification SHA-256. Voir envoyer.ps1 (saisie masquée des clés) et LISEZMOI.md.
//
//   node scripts/r2-images/envoyer.mjs --source <dossier stockage de l'export> [--essai] [--verifier-seulement]
//     --essai              : AUCUN accès réseau ; relit les fichiers locaux, compare au manifeste, affiche ce qui serait envoyé.
//     --verifier-seulement : n'envoie rien ; relit R2 et compare.
//   Variables (jamais affichées, jamais écrites) : R2IMG_ENDPOINT, R2IMG_KEY_ID, R2IMG_SECRET. Noms volontairement différents des variables R2_* du projet, que ce script ne lit pas.
import { S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";
import { BUCKET_R2, BUCKETS_SUPABASE, envoyer, planifier, verifierR2, verifierSource } from "./envoi.mjs";

const args = process.argv.slice(2);
const valeur = (nom) => args.find((a) => a.startsWith(`--${nom}=`))?.split("=").slice(1).join("=") ?? (args.includes(`--${nom}`) ? args[args.indexOf(`--${nom}`) + 1] : undefined);
const essai = args.includes("--essai");
const verifierSeulement = args.includes("--verifier-seulement");
const source = valeur("source");
if (!source) {
  console.error("Usage : node envoyer.mjs --source <dossier stockage de l'export> [--essai] [--verifier-seulement]");
  process.exit(1);
}
const mo = (n) => (n / 1048576).toFixed(1);

const manifeste = JSON.parse(fs.readFileSync(path.join(source, "manifeste-stockage.json"), "utf8"));
const plan = planifier(source, manifeste);
console.log(`Plan : ${plan.fichiers.length} fichier(s) à envoyer vers le bucket « ${BUCKET_R2} » (${BUCKETS_SUPABASE.join(", ")}), ${plan.sansEmpreinte} ignoré(s) faute d'empreinte.`);
for (const b of BUCKETS_SUPABASE) {
  const l = plan.fichiers.filter((f) => f.bucket === b);
  console.log(`  ${b.padEnd(20)} ${String(l.length).padStart(4)} fichier(s) ${mo(l.reduce((s, f) => s + f.octets, 0)).padStart(7)} Mo`);
}

// 1. Les fichiers LOCAUX doivent respecter le manifeste (empreintes de l'export vérifié) avant tout envoi.
const ecartsLocaux = verifierSource(plan);
console.log(`Fichiers locaux relus : ${plan.fichiers.length - ecartsLocaux.length}/${plan.fichiers.length} conformes au manifeste.`);
if (ecartsLocaux.length > 0) {
  console.error(`ARRET : ${ecartsLocaux.length} fichier(s) local(aux) ne respectent pas le manifeste ; rien n'est envoyé.`);
  process.exit(2);
}
if (essai) {
  console.log("ESSAI : aucun accès réseau, rien n'a été envoyé.");
  process.exit(0);
}

const endpoint = process.env.R2IMG_ENDPOINT;
const accessKeyId = process.env.R2IMG_KEY_ID;
const secretAccessKey = process.env.R2IMG_SECRET;
if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error("R2IMG_ENDPOINT / R2IMG_KEY_ID / R2IMG_SECRET manquantes (lancez via envoyer.ps1).");
  process.exit(1);
}
if (!/^https:\/\/[0-9a-f]{32}(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(endpoint)) {
  console.error("Adresse R2 invalide : elle doit ressembler à https://<identifiant de compte>.r2.cloudflarestorage.com (sans le nom du bucket).");
  process.exit(1);
}
// Les contrôles de somme de AWS SDK v3 récent (CRC32 par défaut) ne sont pas demandés : R2 n'en a pas besoin ici, la vérification se fait par SHA-256 à la relecture.
const client = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });

let envoi = null;
if (!verifierSeulement) {
  envoi = await envoyer({ client, plan });
  console.log(`Envoi : ${envoi.deposes} déposé(s), ${envoi.sautes} déjà présent(s) et identique(s), ${envoi.echecs.length} échec(s).`);
  for (const e of envoi.echecs.slice(0, 10)) console.log(`  échec : ${e.erreur}`);
}
const verif = await verifierR2({ client, plan });
for (const [b, s] of Object.entries(verif.parBucket)) {
  console.log(`Vérification ${b.padEnd(20)} attendus ${String(s.attendus).padStart(4)} · identiques (SHA-256) ${String(s.identiques).padStart(4)} · différents ${s.differents} · manquants ${s.manquants} · en trop ${s.en_trop}`);
}
const rapport = {
  date: new Date().toISOString(),
  bucket_r2: BUCKET_R2,
  envoi: envoi && { deposes: envoi.deposes, sautes: envoi.sautes, echecs: envoi.echecs.length },
  verification: verif.parBucket,
  conforme: verif.conforme && (!envoi || envoi.echecs.length === 0),
  problemes: verif.problemes.length,
};
const sortie = path.join(path.dirname(path.resolve(source, "..")), `rapport-r2-images-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
fs.writeFileSync(sortie, JSON.stringify(rapport, null, 1));
console.log(rapport.conforme ? "\nVERIFICATION REUSSIE : chaque fichier de R2 a le même SHA-256 que dans l'export vérifié." : `\nPROBLEME(S) : ${verif.problemes.length} fichier(s) à revoir (relancez la même commande : seuls les fichiers manquants ou différents seront redéposés).`);
console.log(`Rapport (nombres seulement) : ${sortie}`);
process.exit(rapport.conforme ? 0 : 3);
