/**
 * Utilitaire de gestion des médias et photos multiples pour les offres et publications Facilité.
 */

export function parseOfferImages(input) {
  if (!input) return [];

  // Si c'est déjà un tableau
  if (Array.isArray(input)) {
    return input.filter((item) => typeof item === "string" && item.trim().length > 0);
  }

  // Si c'est un objet (ex: job_offer)
  if (typeof input === "object") {
    if (Array.isArray(input.photos) && input.photos.length > 0) {
      return input.photos.filter((p) => typeof p === "string" && p.trim().length > 0);
    }
    if (Array.isArray(input.images) && input.images.length > 0) {
      return input.images.filter((p) => typeof p === "string" && p.trim().length > 0);
    }
    const raw = input.image_url || input.image || "";
    return parseOfferImages(raw);
  }

  // Si c'est une chaîne de caractères
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return [];

    // Format JSON array: ["https://...", "https://..."]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
        }
      } catch {}
    }

    // Format délimité par triple pipe "|||" (standard robuste)
    if (trimmed.includes("|||")) {
      return trimmed
        .split("|||")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    // Format délimité par retour à la ligne
    if (trimmed.includes("\n")) {
      const lines = trimmed
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.startsWith("http"));
      if (lines.length > 1) return lines;
    }

    return [trimmed];
  }

  return [];
}

/**
 * Combine un tableau d'URLs en une chaîne standardisée pour stockage dans image_url
 */
export function serializeOfferImages(imagesList) {
  if (!Array.isArray(imagesList) || imagesList.length === 0) return "";
  const valid = imagesList.filter((url) => typeof url === "string" && url.trim().length > 0);
  if (valid.length === 0) return "";
  if (valid.length === 1) return valid[0];
  return valid.join("|||");
}
