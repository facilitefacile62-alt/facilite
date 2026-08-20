const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

/**
 * Métadonnées minimales pour une page statique (pas de données par
 * instance, contrairement à offres/[id] ou in/[username]) : juste une
 * balise canonical, en `export const metadata` plutôt qu'un
 * `generateMetadata` async — pas de fetch nécessaire ici. Path avec ou
 * sans "/" initial, jamais de double slash.
 */
export function canonicalMetadata(path) {
  const normalized = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return { alternates: { canonical: `${SITE_URL}${normalized}` } };
}
