import { preparerImagePourEnvoi } from "./imageUpload.js";

/**
 * Envoi d'une image PUBLIQUE (affiche d'offre, logo, bannière) vers un bucket public : convertie en WebP, déposée avec un cache d'un an,
 * et — pour les affiches — accompagnée des variantes 480 et 960 px que le fil choisit selon l'écran (src/lib/variantesImage.js).
 *
 * Pourquoi : un envoi direct du navigateur n'indique aucune durée de cache, donc Supabase répond « max-age=3600 » (une heure) et chaque
 * visiteur retélécharge l'image toutes les heures. Le nom de chaque fichier contient déjà un horodatage : une image modifiée est un
 * NOUVEAU fichier, jamais un remplacement, donc un cache d'un an ne peut pas servir une ancienne version.
 */
export const CACHE_UN_AN = "31536000";
const LARGEURS_VARIANTES = [480, 960];

/** Redimensionne en WebP (largeur max donnée, jamais agrandie). Renvoie un Blob WebP, ou null si le navigateur ne sait pas l'encoder. */
export async function redimensionnerEnWebp(fichier, largeurMax, qualite = 0.78) {
  try {
    if (typeof window === "undefined" || typeof createImageBitmap !== "function") return null;
    const source = await createImageBitmap(fichier, { imageOrientation: "from-image" });
    const ratio = Math.min(1, largeurMax / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * ratio));
    canvas.height = Math.max(1, Math.round(source.height * ratio));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    if (source.close) source.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", qualite));
    return blob && blob.type === "image/webp" ? blob : null;
  } catch {
    return null;
  }
}

const extensionDe = (fichier) => {
  if (fichier?.type === "image/webp") return "webp";
  if (fichier?.type === "image/jpeg") return "jpg";
  if (fichier?.type === "image/png") return "png";
  return ((fichier?.name || "image.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
};

/**
 * @param supabase  client Supabase de l'utilisateur connecté (les règles du bucket s'appliquent : dossier = identifiant de l'utilisateur)
 * @param bucket    bucket public (« job-offers »)
 * @param base      chemin SANS extension ni suffixe, déjà unique (ex. « <user>/offers-<horodatage>-0 »)
 * @param fichier   image choisie par la personne
 * @param options   largeurMax (1280 par défaut) ; variantes (true par défaut : crée les fichiers -w480 et -w960) ;
 *                  preparer / redimensionner : remplaçables pour les tests
 * @returns {{ url: string|null, chemin: string|null }}  url null si l'envoi du fichier principal échoue
 */
export async function televerserImagePubliee(supabase, bucket, base, fichier, options = {}) {
  const { largeurMax = 1280, variantes = true, preparer = preparerImagePourEnvoi, redimensionner = redimensionnerEnWebp } = options;
  const depot = (chemin, corps, type) => supabase.storage.from(bucket).upload(chemin, corps, { contentType: type, cacheControl: CACHE_UN_AN });
  const adresse = (chemin) => supabase.storage.from(bucket).getPublicUrl(chemin).data?.publicUrl || null;

  const prepare = await preparer(fichier, { largeurMax });

  // Variantes : seulement si l'image principale est en WebP ET que toutes les variantes ont pu être produites. Le nom « -w1280.webp » annonce
  // que -w480 et -w960 existent (le navigateur n'a aucun repli en cas de 404 sur un srcset) : on ne l'emploie donc jamais à moitié.
  if (variantes && prepare?.type === "image/webp") {
    const blobs = [];
    for (const largeur of LARGEURS_VARIANTES) blobs.push(await redimensionner(prepare, largeur));
    if (blobs.every(Boolean)) {
      const deposes = [];
      let complet = true;
      for (let i = 0; i < LARGEURS_VARIANTES.length; i++) {
        const chemin = `${base}-w${LARGEURS_VARIANTES[i]}.webp`;
        const { error } = await depot(chemin, blobs[i], "image/webp");
        if (error) {
          complet = false;
          break;
        }
        deposes.push(chemin);
      }
      if (complet) {
        const principal = `${base}-w1280.webp`;
        const { error } = await depot(principal, prepare, "image/webp");
        if (!error) return { url: adresse(principal), chemin: principal };
      }
      // Échec en cours de route : on retire les variantes déjà déposées (leurs propres fichiers, jamais ceux d'un autre) puis on enchaîne sur un dépôt simple.
      if (deposes.length > 0) await supabase.storage.from(bucket).remove(deposes).catch(() => {});
    }
  }

  const chemin = `${base}.${extensionDe(prepare)}`;
  const { error } = await depot(chemin, prepare, prepare?.type || "image/jpeg");
  if (error) return { url: null, chemin: null };
  return { url: adresse(chemin), chemin };
}
