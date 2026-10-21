// Variantes plus petites des images publiées (affiches d'offres, visuels de stories) : pour chaque « <nom>-w1280.webp » il
// existe « <nom>-w960.webp » et « <nom>-w480.webp » (créés par scripts/creer-variantes-images.mjs et par l'enregistrement
// des nouvelles affiches). Le navigateur choisit la taille adaptée à son écran grâce à `srcSet` + `sizes`.
//
// Une adresse qui ne suit pas ce nommage (image externe, ancienne image, envoi direct du recruteur) n'a pas de variantes :
// la fonction renvoie {} et l'image s'affiche comme avant, sans risque de 404.
const MOTIF = /^(.*)-w1280\.webp$/i;

export function variantesImage(url) {
  const m = typeof url === "string" ? MOTIF.exec(url) : null;
  if (!m) return {};
  return { srcSet: `${m[1]}-w480.webp 480w, ${m[1]}-w960.webp 960w, ${url} 1280w` };
}
