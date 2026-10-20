/**
 * Prépare une image choisie par l'utilisateur avant son envoi : redimensionnée (1280 px maximum sur le grand côté) et
 * convertie en WebP (JPEG si le navigateur ne sait pas encoder le WebP). Une affiche de téléphone fait 2 à 5 Mo ; envoyée
 * telle quelle, elle était resservie à chaque visiteur du fil (plusieurs Mo sur l'accueil mobile). Le résultat tient en
 * général entre 80 et 250 Ko, sans perte visible à l'écran d'un téléphone.
 *
 * Ne lève jamais d'erreur : si l'image ne peut pas être décodée ou si le résultat n'est pas plus léger, le fichier
 * d'origine est renvoyé tel quel (l'envoi ne doit pas échouer à cause de l'optimisation).
 *
 * @param {File} fichier
 * @param {{largeurMax?: number, qualite?: number, poidsVise?: number}} [options]
 * @returns {Promise<File>}
 */
export async function preparerImagePourEnvoi(fichier, { largeurMax = 1280, qualite = 0.8, poidsVise = 250 * 1024 } = {}) {
  try {
    if (typeof window === "undefined" || !(fichier instanceof Blob)) return fichier;
    const type = (fichier.type || "").toLowerCase();
    // Les GIF animés et les SVG ne passent pas par un canvas sans perdre leur nature.
    if (!type.startsWith("image/") || type === "image/gif" || type === "image/svg+xml") return fichier;

    let source = null;
    let largeur = 0;
    let hauteur = 0;
    if (typeof createImageBitmap === "function") {
      try {
        source = await createImageBitmap(fichier, { imageOrientation: "from-image" });
        largeur = source.width;
        hauteur = source.height;
      } catch {
        source = null;
      }
    }
    if (!source) return fichier;

    const ratio = Math.min(1, largeurMax / Math.max(largeur, hauteur));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(largeur * ratio));
    canvas.height = Math.max(1, Math.round(hauteur * ratio));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    if (source.close) source.close();

    const encoder = (format, q) => new Promise((resolve) => canvas.toBlob(resolve, format, q));
    let blob = await encoder("image/webp", qualite);
    // Safari ancien : toBlob ignore « image/webp » et renvoie du PNG — on retombe alors sur du JPEG.
    if (!blob || blob.type !== "image/webp") blob = await encoder("image/jpeg", qualite);
    let q = qualite;
    for (let essai = 0; blob && blob.size > poidsVise && q > 0.5 && essai < 3; essai++) {
      q -= 0.1;
      blob = await encoder(blob.type, q);
    }
    if (!blob || blob.size >= fichier.size) return fichier;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const base = (fichier.name || "image").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.${extension}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return fichier;
  }
}
