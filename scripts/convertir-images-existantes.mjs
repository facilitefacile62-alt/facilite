// Convertit en WebP (1280 px max) les images publiées les plus lourdes : affiches d'offres (job_offers.image_url) et
// visuels de stories (stories.image_url) hébergés sur Supabase Storage.
//
// Les affiches brutes pesaient 1 à 4 Mo (49,8 Mo pour 187 images) et étaient resservies telles quelles aux visiteurs du fil.
// Principe, sans rien détruire :
//   1. chaque image > 100 Ko est téléchargée, redimensionnée et encodée en WebP ;
//   2. le WebP est téléversé À CÔTÉ de l'original (nouvel objet « <nom>-w1280.webp ») : l'original n'est jamais modifié
//      ni supprimé, le retour arrière est donc possible à tout moment ;
//   3. chaque nouveau fichier est relu sur son adresse publique avant d'être retenu ;
//   4. le script écrit la liste « ancienne adresse → nouvelle adresse » et une migration SQL qui remplace les adresses.
// Rien n'est modifié en base par ce script : c'est la migration (commitée, puis appliquée) qui bascule les adresses.
//
// Usage : node --env-file=.env.local scripts/convertir-images-existantes.mjs [--ecrire] [--seuil-ko=100]
//   sans --ecrire : essai à blanc (calcule les tailles, ne téléverse rien).
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "node:fs";

const ecrire = process.argv.includes("--ecrire");
const seuilKo = Number((process.argv.find((a) => a.startsWith("--seuil-ko=")) || "--seuil-ko=100").split("=")[1]);
const SORTIE = process.env.SORTIE_CONVERSION || "images-converties";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes (lancer avec --env-file=.env.local).");
  process.exit(1);
}
const admin = createClient(url, cle, { auth: { persistSession: false } });
const PREFIXE = `${url}/storage/v1/object/public/`;

// Adresses distinctes (une affiche peut servir plusieurs offres ; image_url peut aussi contenir une liste d'adresses).
const adresses = new Set();
const extraire = (valeur) => {
  for (const m of String(valeur || "").matchAll(/https?:\/\/[^\s"',\]\[]+/g)) adresses.add(m[0]);
};
const { data: offres } = await admin.from("job_offers").select("image_url").not("image_url", "is", null);
for (const o of offres || []) extraire(o.image_url);
const { data: stories } = await admin.from("stories").select("image_url").not("image_url", "is", null);
for (const s of stories || []) extraire(s.image_url);

const correspondances = [];
let totalAvant = 0;
let totalApres = 0;
for (const adresse of adresses) {
  if (!adresse.startsWith(PREFIXE)) continue; // images du dépôt (/public) ou d'ailleurs : hors périmètre
  const chemin = decodeURIComponent(adresse.slice(PREFIXE.length)); // « bucket/dossier/fichier.ext »
  const [bucket, ...reste] = chemin.split("/");
  const objet = reste.join("/");
  if (/-w1280\.webp$/i.test(objet)) continue;
  const reponse = await fetch(adresse);
  if (!reponse.ok) continue;
  const original = Buffer.from(await reponse.arrayBuffer());
  if (original.length < seuilKo * 1024) continue;
  let converti;
  try {
    converti = await sharp(original).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
  } catch (e) {
    console.warn("  ignorée (illisible) :", objet, e.message);
    continue;
  }
  if (converti.length > original.length * 0.85) continue; // gain trop faible : on garde l'original
  const nouvelObjet = objet.replace(/\.[^./]+$/, "") + "-w1280.webp";
  const nouvelleAdresse = `${PREFIXE}${bucket}/${nouvelObjet.split("/").map(encodeURIComponent).join("/")}`;
  if (ecrire) {
    const { error } = await admin.storage.from(bucket).upload(nouvelObjet, converti, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (error && !/already exists|Duplicate/i.test(error.message)) {
      console.warn("  échec du téléversement :", nouvelObjet, error.message);
      continue;
    }
    const verif = await fetch(nouvelleAdresse);
    const octets = Buffer.from(await verif.arrayBuffer());
    if (!verif.ok || !(verif.headers.get("content-type") || "").includes("image/webp") || octets.length !== converti.length) {
      console.warn("  relecture incorrecte, ignorée :", nouvelObjet);
      continue;
    }
  }
  totalAvant += original.length;
  totalApres += converti.length;
  correspondances.push({ ancienne: adresse, nouvelle: nouvelleAdresse, avant: original.length, apres: converti.length });
}

fs.mkdirSync(SORTIE, { recursive: true });
fs.writeFileSync(`${SORTIE}/correspondances.json`, JSON.stringify(correspondances, null, 1));
const q = (t) => `'${t.replace(/'/g, "''")}'`;
const lignes = correspondances.flatMap((c) => [
  `UPDATE public.job_offers SET image_url = replace(image_url, ${q(c.ancienne)}, ${q(c.nouvelle)}) WHERE image_url LIKE ${q("%" + c.ancienne + "%")};`,
  `UPDATE public.stories SET image_url = replace(image_url, ${q(c.ancienne)}, ${q(c.nouvelle)}) WHERE image_url LIKE ${q("%" + c.ancienne + "%")};`,
]);
const inverse = correspondances.flatMap((c) => [
  `UPDATE public.job_offers SET image_url = replace(image_url, ${q(c.nouvelle)}, ${q(c.ancienne)}) WHERE image_url LIKE ${q("%" + c.nouvelle + "%")};`,
  `UPDATE public.stories SET image_url = replace(image_url, ${q(c.nouvelle)}, ${q(c.ancienne)}) WHERE image_url LIKE ${q("%" + c.nouvelle + "%")};`,
]);
fs.writeFileSync(`${SORTIE}/bascule.sql`, lignes.join("\n") + "\n");
fs.writeFileSync(`${SORTIE}/retour-arriere.sql`, inverse.join("\n") + "\n");
const mo = (n) => (n / 1048576).toFixed(1);
console.log(`${ecrire ? "ÉCRIT" : "ESSAI À BLANC"} : ${correspondances.length} image(s) à convertir, ${mo(totalAvant)} Mo → ${mo(totalApres)} Mo (−${totalAvant ? Math.round((1 - totalApres / totalAvant) * 100) : 0} %)`);
