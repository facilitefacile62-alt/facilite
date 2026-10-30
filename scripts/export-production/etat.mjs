// État du dernier export Complet (liste des fichiers de stockage connus : nom, taille, date de modification, empreinte, archive qui contient le fichier). Sert de RÉFÉRENCE au
// prochain export Complet, qui ne télécharge que les fichiers nouveaux ou modifiés. Le fichier contient des noms de fichiers : il n'est conservé que CHIFFRÉ (etat-dernier-export.json.enc).
//
//   node etat.mjs depuis-manifeste <manifeste-stockage.json> <sortie.json> --archive=<id>      (référence d'après un ancien export)
//   node etat.mjs fusionner <ancien-etat.json|-> <dossier stockage> <sortie.json> --archive=<id>  (nouvel état après un export réussi ; lit portee.json et manifeste-stockage.json)
import fs from "node:fs";
import path from "node:path";
import { etatDepuisManifeste, fusionnerEtat } from "./delta.mjs";

function main() {
  const [, , commande, ...reste] = process.argv;
  const positionnels = reste.filter((a) => !a.startsWith("--"));
  const archive = reste.find((a) => a.startsWith("--archive="))?.slice(10);
  if (!archive) {
    console.error("--archive=<identifiant de l'archive> obligatoire.");
    process.exit(1);
  }
  if (commande === "depuis-manifeste") {
    const [manifeste, sortie] = positionnels;
    const etat = etatDepuisManifeste(JSON.parse(fs.readFileSync(manifeste, "utf8")), { archive: `reference:${archive}` });
    fs.writeFileSync(sortie, JSON.stringify(etat));
    console.log(`Référence : ${etat.fichiers.length} fichier(s) connu(s) d'après l'ancien export.`);
  } else if (commande === "fusionner") {
    const [ancien, dossierStockage, sortie] = positionnels;
    const etatAncien = ancien === "-" ? null : JSON.parse(fs.readFileSync(ancien, "utf8"));
    const manifeste = JSON.parse(fs.readFileSync(path.join(dossierStockage, "manifeste-stockage.json"), "utf8"));
    const { buckets } = JSON.parse(fs.readFileSync(path.join(dossierStockage, "portee.json"), "utf8"));
    const etat = fusionnerEtat(etatAncien, manifeste, { archive, buckets });
    fs.writeFileSync(sortie, JSON.stringify(etat));
    console.log(`Nouvel état : ${etat.fichiers.length} fichier(s) connu(s) (${buckets.length} bucket(s) dans la portée de cet export).`);
  } else {
    console.error("Commande : depuis-manifeste | fusionner");
    process.exit(1);
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) main();
