// Ouverture automatique de l'application de paiement (MAXIT / Orange Money) sur téléphone — logique PURE, testable sans navigateur.
//
// Règles : téléphone seulement ; UNE seule tentative automatique par commande (mémorisée avant l'ouverture, jamais de boucle) ; le QR et les
// boutons restent la solution de repli ; aucun message d'erreur si l'ouverture échoue. Sur iPhone, un lien qui n'est pas en https n'est jamais
// ouvert automatiquement (Safari affiche alors une alerte « adresse invalide ») : le bouton reste disponible.

/** « android » | « ios » | « autre » à partir du user-agent. */
export function plateformeAppareil({ userAgent = "", maxTouchPoints = 0 } = {}) {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS se présente comme un Mac : seul le tactile le distingue d'un ordinateur.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  return "autre";
}

/**
 * Vrai pour un téléphone (ou une tablette mobile), faux pour un ordinateur. userAgentDataMobile (Chromium) prime quand il est connu ;
 * sinon le user-agent. Un ordinateur n'ouvre jamais rien : le QR reste affiché.
 */
export function estTelephone({ userAgent = "", userAgentDataMobile, maxTouchPoints = 0 } = {}) {
  if (typeof userAgentDataMobile === "boolean") {
    if (userAgentDataMobile) return true;
    // Chromium dit « pas mobile » : un ordinateur, sauf Android en mode « version pour ordinateur » (le user-agent le trahit encore).
    return plateformeAppareil({ userAgent, maxTouchPoints }) === "android" && /Mobile/i.test(userAgent);
  }
  return plateformeAppareil({ userAgent, maxTouchPoints }) !== "autre";
}

/** Adresse sûre à ouvrir : un schéma d'application ou http(s), jamais javascript:, data:, file: ni vbscript:. */
export function lienValide(url) {
  if (typeof url !== "string") return false;
  const lien = url.trim();
  if (lien.length < 8 || lien.length > 2000) return false;
  // Un schéma, « :// », puis au moins un caractère visible et aucun espace dans le lien.
  const schema = /^([a-z][a-z0-9+.-]*):\/\/[^\s/]\S*$/i.exec(lien)?.[1]?.toLowerCase();
  if (!schema) return false;
  return !["javascript", "data", "file", "vbscript", "blob", "about"].includes(schema);
}

/**
 * Lien à ouvrir automatiquement : MAXIT d'abord, puis Orange Money, puis le lien générique ; null si aucun n'est utilisable.
 * Sur iOS seuls les liens https sont retenus.
 */
export function choisirLien({ deepLinkMaxit, deepLinkOm, deepLink } = {}, plateforme = "android") {
  const candidats = [
    ["maxit", deepLinkMaxit],
    ["om", deepLinkOm],
    ["autre", deepLink],
  ];
  for (const [type, brut] of candidats) {
    if (!lienValide(brut)) continue;
    const url = brut.trim();
    if (plateforme === "ios" && !/^https:\/\//i.test(url)) continue;
    return { type, url };
  }
  return null;
}

// Repli en mémoire si sessionStorage est indisponible (navigation privée, stockage bloqué) : au pire une tentative par chargement de page.
const tentativesEnMemoire = new Set();
const cleTentative = (commandeId) => `ouverture-app-paiement:${commandeId}`;

function stockageSession() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function dejaTentee(commandeId, stockage = stockageSession()) {
  if (tentativesEnMemoire.has(commandeId)) return true;
  try {
    return stockage?.getItem(cleTentative(commandeId)) === "1";
  } catch {
    return false;
  }
}

export function marquerTentee(commandeId, stockage = stockageSession()) {
  tentativesEnMemoire.add(commandeId);
  try {
    stockage?.setItem(cleTentative(commandeId), "1");
  } catch {
    // Stockage indisponible : le repli en mémoire suffit pour la page en cours.
  }
}

/** Pour les tests : oublie les tentatives gardées en mémoire. */
export function reinitialiserTentatives() {
  tentativesEnMemoire.clear();
}

/**
 * Une seule tentative automatique par commande. La tentative est notée AVANT d'ouvrir : un rafraîchissement, un retour dans le navigateur
 * ou une nouvelle interrogation du statut ne rouvrent jamais l'application. `ouvrir(url)` est fourni par l'appelant (navigation du navigateur).
 * Retourne { ouvert, raison, type? }.
 */
export function tenterOuvertureAuto({ commandeId, liens, appareil, stockage = stockageSession(), ouvrir }) {
  if (!commandeId) return { ouvert: false, raison: "commande_inconnue" };
  if (!estTelephone(appareil)) return { ouvert: false, raison: "ordinateur" };
  if (dejaTentee(commandeId, stockage)) return { ouvert: false, raison: "deja_tentee" };
  const choix = choisirLien(liens, plateformeAppareil(appareil));
  if (!choix) return { ouvert: false, raison: "aucun_lien" };
  marquerTentee(commandeId, stockage);
  try {
    ouvrir(choix.url);
  } catch {
    return { ouvert: false, raison: "ouverture_bloquee", type: choix.type };
  }
  return { ouvert: true, raison: "ok", type: choix.type };
}

/** Évite d'interroger deux fois de suite quand « visibilitychange » et « focus » se déclenchent ensemble au retour dans le navigateur. */
export function doitInterroger(maintenant, derniere, minimumMs = 1500) {
  return !derniere || maintenant - derniere >= minimumMs;
}
