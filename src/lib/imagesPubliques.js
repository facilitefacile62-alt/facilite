// Images publiques du site servies par le Worker Cloudflare « facilite-images » (cloudflare/worker-images) au lieu de Supabase Storage.
//
// INTERRUPTEUR : la variable NEXT_PUBLIC_IMAGES_HOTE (adresse du Worker, sans barre finale, ex. https://facilite-images.ffacilite.workers.dev).
// Absente ou invalide = interrupteur FERMÉ : toutes les fonctions rendent leur entrée inchangée, le site se comporte exactement comme avant.
//
// RÈGLE : ces fonctions ne servent qu'à l'AFFICHAGE. Une adresse remplacée ne doit jamais être réécrite en base (les offres modifiées par un recruteur ou un
// administrateur gardent leurs adresses Supabase) : on les applique dans les composants d'affichage, jamais sur des données que l'on enregistre. Un test le garde.
//
// Seuls les trois buckets publics déplacés et SEULEMENT le projet de production sont concernés ; avatars, covers, banque-cv, etc. ne sont jamais touchés.
const REF_PRODUCTION = "ocfhzwwjvljintabxxlg";
const BUCKETS = "job-offers|marketplace-photos|stories-media";
const MOTIF_SUPABASE = new RegExp(`https://${REF_PRODUCTION}\\.supabase\\.co/storage/v1/object/public/(${BUCKETS})/`, "g");

/** Adresse du Worker valide (https, sans chemin) ou "" (interrupteur fermé). */
export function lireHote(valeur) {
  const v = String(valeur || "").trim().replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(v) ? v : "";
}
export const HOTE_IMAGES = lireHote(process.env.NEXT_PUBLIC_IMAGES_HOTE);
export const imagesWorkerActives = (hote = HOTE_IMAGES) => lireHote(hote) !== "";

/** Remplace, dans une chaîne ou une liste de chaînes (adresse seule, liste JSON, séparateurs « ||| »), l'adresse Supabase des 3 buckets par celle du Worker. */
export function adresseImage(valeur, hote = HOTE_IMAGES) {
  const h = lireHote(hote);
  if (!h) return valeur;
  if (typeof valeur === "string") return valeur.replace(MOTIF_SUPABASE, (_, bucket) => `${h}/${bucket}/`);
  if (Array.isArray(valeur)) return valeur.map((v) => adresseImage(v, h));
  return valeur;
}

/** Opération inverse (repli) : adresse du Worker → adresse Supabase d'origine. */
export function adresseSupabase(valeur, hote = HOTE_IMAGES) {
  const h = lireHote(hote);
  if (!h) return valeur;
  if (typeof valeur !== "string") return valeur;
  const motif = new RegExp(`${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(${BUCKETS})/`, "g");
  return valeur.replace(motif, (_, bucket) => `https://${REF_PRODUCTION}.supabase.co/storage/v1/object/public/${bucket}/`);
}

/**
 * Propriétés d'un AVATAR de carte (40 px) qui affiche l'affiche d'une offre (job.logo = image_url) : interrupteur FERMÉ = { src } inchangé, comme avant.
 * Ouvert : adresse du Worker, variante 480 px choisie par le navigateur (srcSet : le petit rond n'a pas besoin des 1280 px de l'affiche) et chargement différé
 * (les cartes hors écran ne chargent rien). Les variantes -w480 / -w960 existent pour chaque affiche nommée « -w1280.webp » (même hypothèse que ImageAdaptative).
 */
export function proprietesAvatar(url, taille = 40, hote = HOTE_IMAGES) {
  const src = adresseImage(url, hote);
  const h = lireHote(hote);
  if (!h) return { src };
  // Variantes seulement pour une affiche réellement servie par le Worker (jamais pour une image externe qui porterait le même suffixe).
  const v = typeof src === "string" && src.startsWith(`${h}/`) ? /^(.*)-w1280\.webp$/i.exec(src) : null;
  return {
    src,
    ...(v ? { srcSet: `${v[1]}-w480.webp 480w, ${v[1]}-w960.webp 960w, ${src} 1280w`, sizes: `${taille}px` } : {}),
    loading: "lazy",
    decoding: "async",
  };
}

/**
 * Repli automatique : un élément <img>, <audio>, <video> ou <source> servi par le Worker a échoué (Worker indisponible, quota dépassé, fichier introuvable) :
 * on le remet sur Supabase, UNE seule fois. Renvoie true si l'élément a été corrigé. Fonction pure sur l'élément (testable sans navigateur).
 */
export function reparerElement(el, hote = HOTE_IMAGES) {
  const h = lireHote(hote);
  if (!h || !el || !["IMG", "AUDIO", "VIDEO", "SOURCE"].includes(el.tagName)) return false;
  if (el.dataset && el.dataset.repliSupabase) return false;
  const src = el.getAttribute ? el.getAttribute("src") : el.src;
  const srcset = el.getAttribute ? el.getAttribute("srcset") : el.srcset;
  const nouveauSrc = src ? adresseSupabase(src, h) : src;
  const nouveauSrcset = srcset ? adresseSupabase(srcset, h) : srcset;
  if (nouveauSrc === src && nouveauSrcset === srcset) return false;
  if (el.dataset) el.dataset.repliSupabase = "1";
  if (srcset && nouveauSrcset !== srcset) el.srcset = nouveauSrcset;
  if (src && nouveauSrc !== src) el.src = nouveauSrc;
  if (typeof el.load === "function" && el.tagName !== "IMG") el.load();
  return true;
}
