/**
 * Utilitaire de gestion des médias et affiches d'offres d'emploi pour Facilité Mobile.
 * Gère les URLs absolues Supabase, les URLs relatives, les tableaux JSON et les délimiteurs.
 */

export function parseOfferImages(input: unknown): string[] {
  if (!input) return [];

  const resolveUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'none' || trimmed === 'false') {
      return '';
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('data:image')) return trimmed;
    if (trimmed.startsWith('/storage/')) return `https://ocfhzwwjvljintabxxlg.supabase.co${trimmed}`;
    if (trimmed.startsWith('/')) return `https://ffacilite.com${trimmed}`;
    return `https://ffacilite.com/${trimmed}`;
  };

  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === 'string' ? resolveUrl(item) : parseOfferImages(item)))
      .flat()
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
  }

  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.photos) && obj.photos.length > 0) {
      return parseOfferImages(obj.photos);
    }
    if (Array.isArray(obj.images) && obj.images.length > 0) {
      return parseOfferImages(obj.images);
    }
    const raw = (obj.image_url || obj.image || obj.posterUri || '') as string;
    return parseOfferImages(raw);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'none') return [];

    // Format JSON array: ["https://...", "https://..."]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parseOfferImages(parsed);
        }
      } catch {}
    }

    // Format délimité par triple pipe "|||"
    if (trimmed.includes('|||')) {
      return trimmed
        .split('|||')
        .map((s) => resolveUrl(s))
        .filter((s) => s.length > 0);
    }

    // Format délimité par retour à la ligne
    if (trimmed.includes('\n')) {
      const lines = trimmed
        .split('\n')
        .map((s) => resolveUrl(s))
        .filter((s) => s.length > 0);
      if (lines.length > 1) return lines;
    }

    const resolved = resolveUrl(trimmed);
    return resolved ? [resolved] : [];
  }

  return [];
}

export function getPrimaryOfferImage(input: unknown): string | undefined {
  const images = parseOfferImages(input);
  return images.length > 0 ? images[0] : undefined;
}
