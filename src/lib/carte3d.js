// Carte 3D (prototype) — interrupteur et contrôles d'appareil.
//
// INTERRUPTEUR : la carte 3D est ÉTEINTE par défaut en production. Elle s'allume si la variable NEXT_PUBLIC_CARTE_3D vaut « 1 » (à retirer / remettre à 0 sur Vercel pour la couper SANS redéployer
// le code), ou automatiquement sur les aperçus Vercel (NEXT_PUBLIC_VERCEL_ENV = « preview », variable posée par Vercel lui-même) pour que le prototype soit montrable sans réglage.
// La variable est lue au moment de la compilation : changer sa valeur demande un nouveau déploiement de la même version (pas de modification du code).
export function carte3dActive() {
  return process.env.NEXT_PUBLIC_CARTE_3D === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
}

/** Adresse de la carte 2D actuelle (Explorer de Locaux) : repli quand la 3D n'est pas possible. */
export const ADRESSE_CARTE_2D = "/marketplace?explorer=1&vue=carte";

/**
 * L'appareil peut-il afficher la 3D ? Refus si : pas de WebGL, mémoire de 2 Go ou moins, 2 cœurs ou moins, mode économie de données, connexion 2G.
 * Renvoie { ok: true } ou { ok: false, raison }. Les mesures absentes (Safari n'expose ni deviceMemory ni connection) ne bloquent jamais.
 */
export function peutAfficher3D() {
  if (typeof window === "undefined") return { ok: false, raison: "serveur" };
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { ok: false, raison: "Votre appareil ne gère pas la 3D (WebGL absent)." };
  } catch {
    return { ok: false, raison: "Votre appareil ne gère pas la 3D (WebGL absent)." };
  }
  const nav = navigator;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return { ok: false, raison: "Appareil trop léger pour la 3D." };
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return { ok: false, raison: "Appareil trop léger pour la 3D." };
  const c = nav.connection;
  if (c && c.saveData) return { ok: false, raison: "Mode économie de données activé : la carte reste en 2D." };
  if (c && /(^|-)2g$/.test(String(c.effectiveType || ""))) return { ok: false, raison: "Connexion trop lente pour la 3D." };
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// VUE 3D PHOTO (prototype) : tuiles photoréalistes de Google (Map Tiles API), chargées par le NAVIGATEUR directement chez Google, seulement quand l'utilisateur appuie sur « Vue 3D photo ».
// INTERRUPTEUR SÉPARÉ : NEXT_PUBLIC_CARTE_3D_PHOTO = « 1 » ET une clé NEXT_PUBLIC_GOOGLE_TILES_KEY présente, et jamais en production (NEXT_PUBLIC_VERCEL_ENV = « production » => fermé).
// Éteint par défaut : le prototype gris gratuit reste le rendu normal et la solution de secours.
export function cartePhotoActive() {
  if (!carte3dActive()) return false;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_CARTE_3D_PHOTO === "1" && Boolean(process.env.NEXT_PUBLIC_GOOGLE_TILES_KEY);
}

/** Racine des tuiles photoréalistes de Google. La clé est ajoutée au moment de la requête, jamais écrite dans le code. */
export const RACINE_TUILES_GOOGLE = "https://tile.googleapis.com/v1/3dtiles/root.json";
/** Une requête racine ouvre une session de « au moins 3 heures » (documentation Google). On coupe la vue photo avant, pour ne jamais travailler avec une session expirée. */
export const DUREE_MAX_VUE_PHOTO_MS = 2 * 60 * 60 * 1000 + 45 * 60 * 1000;
/** Au plus 2 requêtes racine par chargement de la page : une par appui sur « Vue 3D photo » (la quitter libère tout, la relancer demande une nouvelle session). Au-delà, il faut recharger la page. */
export const MAX_RACINES_PAR_PAGE = 2;

/**
 * Réglages de qualité de la vue photo selon l'appareil. « Modeste » = peu de mémoire (4 Go ou moins), 4 cœurs ou moins, économie de données, ou connexion 3G ou moins.
 *  - erreurEcranMax : erreur d'écran maximale tolérée par le moteur de tuiles (plus grande = tuiles moins fines = moins de données et de mémoire) ;
 *  - memoireMaxMo : mémoire GPU maximale allouée aux tuiles ;
 *  - ratioPixelMax : résolution de rendu (1 = pixels CSS) ;
 *  - inclinaisonMax : inclinaison maximale de la caméra (degrés) ;
 *  - requetesSimultanees : nombre de tuiles demandées en même temps.
 */
export function profilPhoto(env) {
  const nav = env?.navigator ?? (typeof navigator !== "undefined" ? navigator : {});
  const c = nav.connection;
  const modeste =
    (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) ||
    (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) ||
    Boolean(c && c.saveData) ||
    Boolean(c && /(^|-)(2g|3g)$/.test(String(c.effectiveType || "")));
  return modeste
    ? { modeste: true, erreurEcranMax: 48, memoireMaxMo: 256, ratioPixelMax: 1, inclinaisonMax: 55, requetesSimultanees: 6 }
    : { modeste: false, erreurEcranMax: 16, memoireMaxMo: 768, ratioPixelMax: 2, inclinaisonMax: 65, requetesSimultanees: 12 };
}

/** Mentions de sources de données : agrège les « copyright » des tuiles affichées (séparés par « ; »), sans doublon, triés par fréquence puis par ordre alphabétique, en une seule ligne. */
export function creditsAgreges(copyrights) {
  const compte = new Map();
  for (const brut of copyrights || []) {
    for (const part of String(brut || "").split(";")) {
      const t = part.trim();
      if (t) compte.set(t, (compte.get(t) || 0) + 1);
    }
  }
  return [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t).join("; ");
}

/** Statuts qui signifient « quota atteint ou clé refusée » : la vue photo se coupe et le prototype gris reste affiché. */
export function statutQuotaOuCle(status) {
  return status === 403 || status === 429;
}

/**
 * Décalage vertical (en mètres) appliqué aux tuiles photo : les tuiles de Google sont placées à leur hauteur réelle au-dessus de l'ellipsoïde WGS84 (le sol de Dakar est à environ 52 m, mesuré par le test de couverture :
 * « hauteur 52,5 m »), alors que nos épingles et la carte MapLibre sont à 0 m. Sans correction, le sol photo passerait AU-DESSUS des épingles. Les tuiles sont donc ABAISSÉES de cette valeur.
 * RÉGLAGE : changer cette constante (valeur de départ 52), ou poser NEXT_PUBLIC_CARTE_3D_PHOTO_DECALAGE_M sur Vercel (redéploiement de la même version) pour essayer une autre valeur sans toucher au code.
 * Trop faible : le sol monte sur les épingles. Trop forte : les épingles flottent au-dessus du sol. Hors de Dakar, le sol n'est pas à 52 m (Paris : environ 50 à 80 m) : valeur propre à cette zone.
 */
export const DECALAGE_VERTICAL_PHOTO_M = (() => {
  const brut = process.env.NEXT_PUBLIC_CARTE_3D_PHOTO_DECALAGE_M;
  const v = Number(brut);
  return brut !== undefined && brut !== "" && Number.isFinite(v) ? v : 52;
})();
