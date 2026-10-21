// Crée des variantes plus petites (480 px et 960 px) des images déjà converties en « <nom>-w1280.webp » (affiches d'offres et
// visuels de stories hébergés sur Supabase Storage), pour que le navigateur télécharge la taille adaptée à son écran
// (attribut srcset, voir src/lib/variantesImage.js). Avant : une carte de ~500 px recevait une image de 1280 px.
//
// Sans rien détruire ni modifier en base : chaque variante est un NOUVEL objet « <nom>-w480.webp » / « <nom>-w960.webp »
// téléversé à côté du « -w1280.webp », qui reste intact. Aucune adresse enregistrée en base ne change.
//
// Usage : node --env-file=.env.local scripts/creer-variantes-images.mjs [--ecrire]
//   sans --ecrire : essai à blanc (calcule les tailles, ne téléverse rien).
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const ecrire = process.argv.includes("--ecrire");
const LARGEURS = [480, 960];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes (lancer avec --env-file=.env.local).");
  process.exit(1);
}
const admin = createClient(url, cle, { auth: { persistSession: false } });
const PREFIXE = `${url}/storage/v1/object/public/`;

const adresses = new Set();
const extraire = (valeur) => {
  for (const m of String(valeur || "").matchAll(/https?:\/\/[^\s"',\]\[]+/g)) adresses.add(m[0]);
};
const { data: offres } = await admin.from("job_offers").select("image_url").not("image_url", "is", null);
for (const o of offres || []) extraire(o.image_url);
const { data: stories } = await admin.from("stories").select("image_url").not("image_url", "is", null);
for (const s of stories || []) extraire(s.image_url);

let sources = 0;
let crees = 0;
let ignores = 0;
let octets1280 = 0;
const octetsVariante = { 480: 0, 960: 0 };
for (const adresse of adresses) {
  if (!adresse.startsWith(PREFIXE) || !/-w1280\.webp$/i.test(adresse)) continue;
  const chemin = decodeURIComponent(adresse.slice(PREFIXE.length));
  const [bucket, ...reste] = chemin.split("/");
  const objet = reste.join("/");
  const reponse = await fetch(adresse);
  if (!reponse.ok) {
    console.warn("  source illisible :", objet);
    ignores++;
    continue;
  }
  const source = Buffer.from(await reponse.arrayBuffer());
  sources++;
  octets1280 += source.length;
  for (const largeur of LARGEURS) {
    let variante;
    try {
      variante = await sharp(source).resize({ width: largeur, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer();
    } catch (e) {
      console.warn("  illisible :", objet, e.message);
      ignores++;
      continue;
    }
    octetsVariante[largeur] += variante.length;
    const nouvelObjet = objet.replace(/-w1280\.webp$/i, `-w${largeur}.webp`);
    if (!ecrire) continue;
    const { error } = await admin.storage.from(bucket).upload(nouvelObjet, variante, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (error && !/already exists|Duplicate/i.test(error.message)) {
      console.warn("  échec du téléversement :", nouvelObjet, error.message);
      ignores++;
      continue;
    }
    const nouvelleAdresse = `${PREFIXE}${bucket}/${nouvelObjet.split("/").map(encodeURIComponent).join("/")}`;
    const verif = await fetch(nouvelleAdresse);
    if (!verif.ok || !(verif.headers.get("content-type") || "").includes("image/webp")) {
      console.warn("  relecture incorrecte :", nouvelObjet);
      ignores++;
      continue;
    }
    crees++;
  }
}
const ko = (n) => Math.round(n / 1024);
console.log(`${ecrire ? "ÉCRIT" : "ESSAI À BLANC"} : ${sources} image(s) -w1280.webp (${ko(octets1280)} Ko au total) ; 480 px : ${ko(octetsVariante[480])} Ko, 960 px : ${ko(octetsVariante[960])} Ko ; variantes créées : ${crees} ; ignorées : ${ignores}`);
