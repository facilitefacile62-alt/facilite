import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Codes à 6 chiffres et jetons d'autorisation. On ne garde JAMAIS un code ou un jeton en clair : seulement son empreinte (HMAC-SHA-256), liée à la personne.
// Clé de l'empreinte : COMPTE_CODE_SECRET, sinon la clé serveur existante (jamais exposée) — l'empreinte ne la révèle pas.

export const secretCodes = () => process.env.COMPTE_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Code à 6 chiffres (zéros devant conservés), tiré au hasard par le générateur cryptographique du système. */
export const genererCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Jeton d'autorisation : 32 octets au hasard, en base64url. */
export const genererJeton = () => randomBytes(32).toString("base64url");

export function hacher(valeur, userId, secret = secretCodes()) {
  return createHmac("sha256", secret).update(`${userId}:${String(valeur)}`).digest("hex");
}

/** Comparaison en temps constant entre une valeur saisie et l'empreinte enregistrée. */
export function correspond(valeur, empreinte, userId, secret = secretCodes()) {
  const a = Buffer.from(hacher(valeur, userId, secret), "hex");
  const b = Buffer.from(String(empreinte ?? ""), "hex");
  return a.length === b.length && b.length > 0 && timingSafeEqual(a, b);
}

/** Empreinte d'une adresse IP pour le journal (jamais l'adresse en clair). */
export const empreinteIp = (ip, secret = secretCodes()) => (ip ? createHmac("sha256", secret).update(`ip:${ip}`).digest("hex").slice(0, 32) : null);
