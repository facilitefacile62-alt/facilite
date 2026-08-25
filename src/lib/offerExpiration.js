/**
 * Helper de vérification d'expiration des offres d'emploi (Logique FOMO & Cycle de vie).
 *
 * Une offre est considérée comme expirée si :
 * 1. Son statut est explicitement 'expired', 'closed', 'archive' ou 'expiree'
 * 2. OU sa date limite (deadline) est dépassée par rapport à l'instant présent
 * 3. OU son statut is_active === false
 *
 * @param {Object} offer - Objet d'offre d'emploi
 * @returns {boolean} - true si l'offre est expirée, false si elle est active et disponible
 */
export function isOfferExpired(offer) {
  if (!offer) return false;

  // 1. Statut explicite
  const status = (offer.status || "").toLowerCase().trim();
  if (
    status === "expired" ||
    status === "closed" ||
    status === "archive" ||
    status === "archived" ||
    status === "expiree" ||
    status === "expirée"
  ) {
    return true;
  }

  // 2. Désactivation manuelle
  if (offer.is_active === false && status !== "draft") {
    return true;
  }

  // 3. Vérification de la deadline
  if (offer.deadline) {
    const deadlineDate = new Date(offer.deadline);
    if (!isNaN(deadlineDate.getTime())) {
      // Si la chaîne est au format YYYY-MM-DD sans heure, on accorde toute la journée (jusqu'à 23h59m59s)
      if (typeof offer.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(offer.deadline.trim())) {
        deadlineDate.setHours(23, 59, 59, 999);
      }
      return deadlineDate.getTime() < Date.now();
    }
  }

  return false;
}
