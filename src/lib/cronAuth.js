import crypto from "node:crypto";

/**
 * Vérifie un en-tête « Authorization: Bearer <secret> » contre une liste de secrets acceptés (ceux qui ne sont pas
 * configurés sont ignorés). Comparaison en temps constant : chaque secret est ramené à une empreinte SHA-256 de longueur
 * fixe, et TOUS les secrets sont comparés (pas de sortie anticipée), la durée ne dépend donc ni de la longueur du secret
 * reçu ni du rang du bon secret.
 */
export function bearerValide(enteteAuthorization, secretsAcceptes) {
  const secrets = (secretsAcceptes || []).filter((s) => typeof s === "string" && s.length > 0);
  if (secrets.length === 0) return false;
  const entete = typeof enteteAuthorization === "string" ? enteteAuthorization : "";
  if (!entete.startsWith("Bearer ")) return false;
  const recu = crypto.createHash("sha256").update(entete.slice(7)).digest();
  let correspond = false;
  for (const secret of secrets) {
    const attendu = crypto.createHash("sha256").update(secret).digest();
    if (crypto.timingSafeEqual(recu, attendu)) correspond = true;
  }
  return correspond;
}
