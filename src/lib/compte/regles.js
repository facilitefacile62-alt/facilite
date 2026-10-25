// « Informations du compte » — règles PURES (aucune base, aucun réseau) : durées et limites, normalisation, masquage, méthodes de connexion restantes.
// Elles servent de source unique aux routes /api/compte/*, appelées de la même façon par le site, Facilité et Locaux.

export const CODE_DUREE_MS = 10 * 60 * 1000; // un code expire en 10 minutes
export const AUTORISATION_DUREE_MS = 10 * 60 * 1000; // après une preuve, 10 minutes pour agir
export const ESSAIS_MAX = 5; // essais par code
export const CONNEXION_RECENTE_MS = 5 * 60 * 1000; // une connexion de moins de 5 minutes vaut preuve
export const ENVOIS_PAR_HEURE_UTILISATEUR = 3; // envois de codes par heure et par personne
export const ENVOIS_PAR_HEURE_IP = 10; // envois de codes par heure et par adresse IP
export const VERIFICATIONS_PAR_HEURE_UTILISATEUR = 15; // essais de code par heure et par personne
export const CHANGEMENTS_PAR_24H = 3; // changements ou dissociations par 24 heures

export const CANAUX = ["email", "telephone"];

/** E-mail propre (minuscules, sans espaces) ou null s'il n'a pas la forme d'une adresse. */
export function normaliserEmail(valeur) {
  const e = String(valeur ?? "").trim().toLowerCase();
  if (e.length < 5 || e.length > 254) return null;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e) ? e : null;
}

const MOBILE_SENEGAL = /^(70|75|76|77|78)\d{7}$/;

/**
 * Numéro au format international « +221771234567 », ou null. Accepte « 77 123 45 67 », « +221 77 123 45 67 », « 00221… », « 221… ».
 * Numéros sénégalais : mobile seulement (70, 75, 76, 77, 78 + 7 chiffres), seul type capable de recevoir un SMS. Autres pays : format international simple.
 */
export function normaliserTelephone(valeur) {
  let s = String(valeur ?? "").trim().replace(/[\s().-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!/^\+?\d+$/.test(s)) return null;
  if (s.startsWith("+")) {
    const d = s.slice(1);
    if (d.startsWith("221")) return MOBILE_SENEGAL.test(d.slice(3)) ? `+${d}` : null;
    return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;
  }
  if (/^221\d{9}$/.test(s)) return MOBILE_SENEGAL.test(s.slice(3)) ? `+${s}` : null;
  return MOBILE_SENEGAL.test(s) ? `+221${s}` : null;
}

/** Chiffres seuls : forme utilisée par l'authentification (« 221771234567 », sans « + »). */
export const chiffresTelephone = (valeur) => String(valeur ?? "").replace(/\D/g, "");

/** « m*****@gmail.com » (première lettre, cinq étoiles, domaine). */
export function masquerEmail(email) {
  const e = String(email ?? "");
  const arobase = e.lastIndexOf("@");
  if (arobase < 1) return "";
  return `${e[0]}*****${e.slice(arobase)}`;
}

/** « +221*****632 » (indicatif, cinq étoiles, trois derniers chiffres). Valide avec ou sans « + » au départ. */
export function masquerTelephone(telephone) {
  const d = chiffresTelephone(telephone);
  if (d.length < 8) return "";
  if (d.startsWith("221") && d.length === 12) return `+221*****${d.slice(-3)}`;
  return `+${d.slice(0, 2)}*****${d.slice(-3)}`;
}

/** Méthodes de connexion encore disponibles : e-mail et téléphone VÉRIFIÉS, plus les connexions par un fournisseur (Google, Apple…). */
export function methodesDeConnexion(utilisateur) {
  const u = utilisateur ?? {};
  const fournisseurs = (Array.isArray(u.identities) ? u.identities : []).filter((i) => i && i.provider !== "email" && i.provider !== "phone").length;
  return {
    email: Boolean(u.email) && Boolean(u.email_confirmed_at),
    telephone: Boolean(u.phone) && Boolean(u.phone_confirmed_at),
    fournisseurs,
  };
}

/**
 * Peut-on retirer ce moyen de connexion ? Jamais la dernière méthode : il doit en rester une autre VÉRIFIÉE (l'autre moyen, ou un fournisseur).
 * Retourne { ok: true } ou { ok: false, raison: "rien_a_dissocier" | "derniere_methode" }.
 */
export function peutDissocier(utilisateur, canal) {
  const u = utilisateur ?? {};
  const m = methodesDeConnexion(u);
  if (canal === "telephone") {
    if (!u.phone) return { ok: false, raison: "rien_a_dissocier" };
    return m.email || m.fournisseurs > 0 ? { ok: true } : { ok: false, raison: "derniere_methode" };
  }
  if (canal === "email") {
    if (!u.email) return { ok: false, raison: "rien_a_dissocier" };
    return m.telephone || m.fournisseurs > 0 ? { ok: true } : { ok: false, raison: "derniere_methode" };
  }
  return { ok: false, raison: "canal_invalide" };
}

/** Valeur actuelle du moyen (e-mail en minuscules, ou chiffres du téléphone) pour comparer sans se soucier de la forme. */
export const valeurActuelle = (utilisateur, canal) => (canal === "email" ? String(utilisateur?.email ?? "").toLowerCase() : chiffresTelephone(utilisateur?.phone));

/** La connexion est-elle assez récente (moins de 5 minutes) pour tenir lieu de preuve ? */
export function connexionRecente(utilisateur, maintenantMs) {
  const t = Date.parse(utilisateur?.last_sign_in_at ?? "");
  return Number.isFinite(t) && maintenantMs - t >= 0 && maintenantMs - t <= CONNEXION_RECENTE_MS;
}
