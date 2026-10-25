import { createHmac, timingSafeEqual } from "node:crypto";

// Signature des appels du « Send SMS Hook » de Supabase Auth : norme « Standard Webhooks ».
//   en-têtes : webhook-id, webhook-timestamp (secondes), webhook-signature (« v1,<base64> », plusieurs séparées par une espace)
//   contenu signé : `${id}.${timestamp}.${corps brut}`, HMAC-SHA-256, clé = secret décodé de base64 (secret affiché « v1,whsec_<base64> »)
// Sans signature valide, RIEN n'est envoyé : cette route est publique, c'est la seule barrière contre quelqu'un qui voudrait faire envoyer des SMS à nos frais.

export const TOLERANCE_HORLOGE_S = 300;

function cleDuSecret(secret) {
  const brut = String(secret ?? "").replace(/^v1,/, "").replace(/^whsec_/, "");
  return Buffer.from(brut, "base64");
}

/** Calcule la signature attendue (utilisée aussi par les tests pour fabriquer un appel valide). */
export function signerWebhook({ id, timestamp, corps, secret }) {
  return `v1,${createHmac("sha256", cleDuSecret(secret)).update(`${id}.${timestamp}.${corps}`).digest("base64")}`;
}

/** Retourne { ok: true } ou { ok: false, raison }. Le corps doit être le texte BRUT reçu (pas un JSON relu puis réécrit). */
export function verifierSignatureWebhook({ corps, entetes, secret, maintenantMs = Date.now() }) {
  if (!secret) return { ok: false, raison: "secret_absent" };
  const id = entetes.get("webhook-id");
  const timestamp = entetes.get("webhook-timestamp");
  const signatures = entetes.get("webhook-signature");
  if (!id || !timestamp || !signatures) return { ok: false, raison: "entetes_absents" };
  const secondes = Number(timestamp);
  if (!Number.isFinite(secondes)) return { ok: false, raison: "horodatage_invalide" };
  if (Math.abs(maintenantMs / 1000 - secondes) > TOLERANCE_HORLOGE_S) return { ok: false, raison: "horodatage_hors_delai" };

  const attendue = Buffer.from(signerWebhook({ id, timestamp, corps, secret }).slice(3), "base64");
  let valide = false;
  for (const candidate of signatures.split(" ")) {
    const [version, valeur] = candidate.split(",");
    if (version !== "v1" || !valeur) continue;
    const recue = Buffer.from(valeur, "base64");
    // Toutes les candidates sont comparées en temps constant (pas de sortie anticipée).
    if (recue.length === attendue.length && timingSafeEqual(recue, attendue)) valide = true;
  }
  return valide ? { ok: true } : { ok: false, raison: "signature_invalide" };
}
