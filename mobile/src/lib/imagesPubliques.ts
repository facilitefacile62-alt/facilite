// Images publiques de l'application servies par le Worker Cloudflare « facilite-images » (R2) au lieu de Supabase Storage.
// Miroir de src/lib/imagesPubliques.js (site) : les deux projets sont séparés, la règle est donc copiée — à garder identique des deux côtés.
//
// INTERRUPTEUR : EXPO_PUBLIC_IMAGES_HOTE (adresse du Worker, sans barre finale). Absente ou invalide = FERMÉ : toutes les fonctions rendent
// leur entrée inchangée, l'application se comporte exactement comme avant. La valeur est figée dans l'application au moment de sa fabrication.
//
// RÈGLE : ces fonctions ne servent qu'à l'AFFICHAGE. Une adresse remplacée n'est jamais enregistrée en base ni dans la mémoire du téléphone
// (les offres gardent leurs adresses Supabase). Seuls les trois buckets publics déplacés et SEULEMENT le projet de production sont concernés ;
// avatars, covers, banque-cv, pièces jointes, etc. ne sont jamais touchés.
const REF_PRODUCTION = 'ocfhzwwjvljintabxxlg';
const BUCKETS = 'job-offers|marketplace-photos|stories-media';
const MOTIF_SUPABASE = new RegExp(`https://${REF_PRODUCTION}\\.supabase\\.co/storage/v1/object/public/(${BUCKETS})/`, 'g');

/** Adresse du Worker valide (https, sans chemin) ou "" (interrupteur fermé). */
export function lireHote(valeur: unknown): string {
  const v = String(valeur ?? '').trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(v) ? v : '';
}

export const HOTE_IMAGES = lireHote(process.env.EXPO_PUBLIC_IMAGES_HOTE);

/** Adresse Supabase des 3 buckets publics -> adresse du Worker (interrupteur fermé : inchangée). */
export function adresseImage(url: string, hote: string = HOTE_IMAGES): string {
  const h = lireHote(hote);
  if (!h || typeof url !== 'string') return url;
  return url.replace(MOTIF_SUPABASE, (_, bucket: string) => `${h}/${bucket}/`);
}

/** Opération inverse (repli) : adresse du Worker -> adresse Supabase d'origine. */
export function adresseSupabase(url: string, hote: string = HOTE_IMAGES): string {
  const h = lireHote(hote);
  if (!h || typeof url !== 'string') return url;
  const motif = new RegExp(`${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(${BUCKETS})/`, 'g');
  return url.replace(motif, (_, bucket: string) => `https://${REF_PRODUCTION}.supabase.co/storage/v1/object/public/${bucket}/`);
}

/**
 * Variante réduite d'une affiche servie par le Worker. Les variantes -w480 / -w960 n'existent que pour les affiches nommées « -w1280.webp »
 * (envois récents) ; pour toute autre image la fonction renvoie null (on garde l'image entière).
 */
export function adresseVariante(url: string, largeur: 480 | 960, hote: string = HOTE_IMAGES): string | null {
  const h = lireHote(hote);
  if (!h || typeof url !== 'string' || !url.startsWith(`${h}/`)) return null;
  const v = /^(.*)-w1280\.webp$/i.exec(url);
  return v ? `${v[1]}-w${largeur}.webp` : null;
}

/**
 * Adresses à essayer, dans l'ordre : variante réduite (si demandée et possible), image entière sur le Worker, puis Supabase en dernier recours.
 * Interrupteur fermé ou image hors des 3 buckets : une seule adresse, l'originale.
 */
export function candidatsImage(url: string, largeur?: 480 | 960, hote: string = HOTE_IMAGES): string[] {
  if (typeof url !== 'string' || !url) return [];
  const h = lireHote(hote);
  if (!h) return [url];
  const worker = adresseImage(url, h);
  if (worker === url) return [url];
  const liste: string[] = [];
  const variante = largeur ? adresseVariante(worker, largeur, h) : null;
  if (variante) liste.push(variante);
  liste.push(worker, url);
  return liste;
}
