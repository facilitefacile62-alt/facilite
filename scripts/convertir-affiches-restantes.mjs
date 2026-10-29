// Convertit les 31 affiches d'offres encore servies en JPEG d'origine (liste : scripts/donnees/affiches-restantes.json) : pour chacune, trois fichiers WebP
// « <nom>-w1280.webp », « <nom>-w960.webp » et « <nom>-w480.webp » déposés À CÔTÉ de l'original, avec un cache d'un an.
//
// Ce que le script ne fait JAMAIS : supprimer ou modifier un original, écrire en base. Les adresses ne changent qu'avec la migration
// supabase/migrations/20261029120000_affiches_restantes_webp.sql (commitée, puis appliquée séparément), et seulement pour les offres dont les trois fichiers existent.
//
// Usage : node --env-file=.env.local scripts/convertir-affiches-restantes.mjs [--ecrire]
//   sans --ecrire : essai à blanc (télécharge et calcule les tailles, ne téléverse rien).
// Aucune adresse ni clé n'est affichée : seulement l'identifiant (8 premiers caractères) et les tailles.
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "node:fs";

const ecrire = process.argv.includes("--ecrire");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes (lancer avec --env-file=.env.local).");
  process.exit(1);
}
const admin = createClient(url, cle, { auth: { persistSession: false } });
const BUCKET = "job-offers";
const PREFIXE = `${url}/storage/v1/object/public/${BUCKET}/`;
const CACHE_UN_AN = "31536000";
const LARGEURS = [1280, 960, 480];

const liste = JSON.parse(fs.readFileSync(new URL("./donnees/affiches-restantes.json", import.meta.url), "utf8"));
const ko = (n) => Math.round(n / 1024);
let total = { avant: 0, apres: 0 };
let prets = 0;

for (const { offre_id: id, ancienne } of liste) {
  const court = id.slice(0, 8);
  if (!ancienne.startsWith(PREFIXE)) {
    console.warn(`${court} : adresse hors du bucket « ${BUCKET} », ignorée.`);
    continue;
  }
  const objet = decodeURIComponent(ancienne.slice(PREFIXE.length)).replace(/\.[^./]+$/, "");
  const reponse = await fetch(ancienne);
  if (!reponse.ok) {
    console.warn(`${court} : original illisible (HTTP ${reponse.status}), ignoré.`);
    continue;
  }
  const original = Buffer.from(await reponse.arrayBuffer());
  let principal;
  try {
    principal = await sharp(original).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
  } catch (e) {
    console.warn(`${court} : image illisible (${e.message}), ignorée.`);
    continue;
  }
  // Les variantes sont toujours produites (le navigateur n'a aucun repli sur un srcset en 404), même si l'image est déjà plus étroite que 960 ou 480 px.
  const fichiers = { 1280: principal };
  for (const largeur of [960, 480]) fichiers[largeur] = await sharp(principal).resize({ width: largeur, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer();

  let ok = true;
  if (ecrire) {
    // Variantes d'abord, principal en dernier : un -w1280 présent signifie que ses variantes existent.
    for (const largeur of [480, 960, 1280]) {
      const { error } = await admin.storage.from(BUCKET).upload(`${objet}-w${largeur}.webp`, fichiers[largeur], { contentType: "image/webp", cacheControl: CACHE_UN_AN, upsert: false });
      if (error && !/already exists|Duplicate/i.test(error.message)) {
        console.warn(`${court} : échec du dépôt -w${largeur} (${error.message}).`);
        ok = false;
        break;
      }
    }
    if (ok) {
      for (const largeur of LARGEURS) {
        const adresse = `${PREFIXE}${`${objet}-w${largeur}.webp`.split("/").map(encodeURIComponent).join("/")}`;
        const relu = await fetch(adresse);
        const ctype = relu.headers.get("content-type") || "";
        if (!relu.ok || !ctype.includes("image/webp")) {
          console.warn(`${court} : relecture incorrecte de -w${largeur}.`);
          ok = false;
        }
      }
    }
  }
  if (!ok) continue;
  prets += 1;
  total.avant += original.length;
  total.apres += fichiers[960].length;
  console.log(`${court} : ${ko(original.length)} Ko → 1280 : ${ko(fichiers[1280].length)} Ko · 960 : ${ko(fichiers[960].length)} Ko · 480 : ${ko(fichiers[480].length)} Ko`);
}
console.log(`${ecrire ? "ÉCRIT" : "ESSAI À BLANC"} : ${prets}/${liste.length} affiche(s) prête(s). Original total ${ko(total.avant)} Ko → variante 960 px ${ko(total.apres)} Ko. Aucun original touché, aucune base écrite.`);
