// Mémoire du téléphone pour la liste des offres (« stale-while-revalidate ») : logique pure, sans réseau ni stockage, donc testable.
//
// Principe : à l'ouverture on montre aussitôt la copie enregistrée ; on ne la recharge depuis Supabase que si elle a plus de DUREE_FRAICHE_MS ;
// et quand une offre change (temps réel) on applique CE changement à la copie au lieu de relire toute la liste.
// Seules des offres PUBLIQUES y sont enregistrées (les mêmes que celles que n'importe quel visiteur voit) : aucune donnée privée.

export type EtatOffres = 'disponibles' | 'expirees';
export type LigneOffre = Record<string, any>;

/** Une copie plus récente que cela n'est pas rechargée à l'ouverture d'un écran. */
export const DUREE_FRAICHE_MS = 5 * 60_000;
/** Une copie plus vieille que cela n'est plus montrée (trop périmée pour être utile). */
export const DUREE_MAX_MS = 7 * 24 * 3_600_000;

/** Colonnes demandées à Supabase ET conservées sur le téléphone (jamais le reste d'une ligne reçue en temps réel). */
export const COLONNES_OFFRES = [
  'id', 'title', 'company', 'location', 'contract_type', 'salary_range', 'description', 'contact_email', 'contact_phone', 'contact_whatsapp',
  'external_link', 'application_url', 'application_email', 'deadline', 'image_url', 'audio_url', 'created_at', 'listing_type', 'view_count', 'status',
] as const;

const STATUTS_CLOS = ['expired', 'closed', 'archive', 'archived', 'expiree', 'expirée'];

export function statutClos(statut: unknown): boolean {
  return STATUTS_CLOS.includes(String(statut ?? '').toLowerCase().trim());
}

export const cleCacheOffres = (etat: EtatOffres, limite: number) => `FACILITE_OFFRES_V1_${etat}_${limite}`;

/** Garde les seules colonnes utiles d'une ligne. */
export function projeter(ligne: LigneOffre): LigneOffre {
  const out: LigneOffre = {};
  for (const c of COLONNES_OFFRES) if (ligne[c] !== undefined) out[c] = ligne[c];
  return out;
}

/** Même règle que la requête serveur (is_active et date limite) puis que l'écran (brouillon et statut clos). */
export function correspondEtat(o: LigneOffre, etat: EtatOffres, aujourdhui: string): boolean {
  if (String(o.status ?? '').toLowerCase().trim() === 'draft') return false;
  const dl = typeof o.deadline === 'string' && o.deadline ? o.deadline.slice(0, 10) : null;
  if (etat === 'disponibles') return o.is_active !== false && (dl === null || dl >= aujourdhui) && !statutClos(o.status);
  return o.is_active === false || (dl !== null && dl < aujourdhui);
}

export type CopieListe = { enregistreLe: number; lignes: LigneOffre[] };

/** Lit la copie enregistrée ; renvoie null si elle est absente, illisible, vide de sens ou trop vieille. */
export function lireCopie(brut: string | null | undefined, maintenant: number): CopieListe | null {
  if (!brut) return null;
  try {
    const c = JSON.parse(brut);
    if (!c || typeof c.enregistreLe !== 'number' || !Array.isArray(c.lignes)) return null;
    if (maintenant - c.enregistreLe > DUREE_MAX_MS || c.enregistreLe > maintenant + 60_000) return null;
    const lignes = c.lignes.filter((l: unknown) => l && typeof l === 'object' && typeof (l as LigneOffre).id === 'string');
    return { enregistreLe: c.enregistreLe, lignes };
  } catch {
    return null;
  }
}

export const serialiser = (lignes: LigneOffre[], maintenant: number): string => JSON.stringify({ enregistreLe: maintenant, lignes });

export const estFraiche = (c: CopieListe, maintenant: number, duree = DUREE_FRAICHE_MS) => maintenant - c.enregistreLe < duree;

export type Changement = { type: 'INSERT' | 'UPDATE' | 'DELETE'; nouveau?: LigneOffre | null; ancien?: LigneOffre | null };

function trier(lignes: LigneOffre[], limite: number): LigneOffre[] {
  return [...lignes].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))).slice(0, limite);
}

/**
 * Applique UN changement reçu en temps réel à la copie. Renvoie `recharger: true` quand la ligne reçue ne permet pas de décider
 * (offre inconnue de la copie et incomplète : Supabase n'envoie pas les grosses colonnes inchangées) : l'appelant relit alors la liste.
 */
export function appliquerChangement(
  lignes: LigneOffre[],
  ch: Changement,
  etat: EtatOffres,
  aujourdhui: string,
  limite: number,
): { lignes: LigneOffre[]; recharger: boolean } {
  if (ch.type === 'DELETE') {
    const id = ch.ancien?.id;
    if (typeof id !== 'string') return { lignes, recharger: true };
    return { lignes: lignes.filter((l) => l.id !== id), recharger: false };
  }
  const recu = ch.nouveau;
  if (!recu || typeof recu.id !== 'string') return { lignes, recharger: true };
  const connue = lignes.find((l) => l.id === recu.id);
  // Une ligne inconnue doit être complète pour être ajoutée ; sinon on relit.
  if (!connue && !(typeof recu.title === 'string' && 'created_at' in recu)) return { lignes, recharger: true };
  const fusion = projeter({ ...(connue ?? {}), ...recu });
  const autres = lignes.filter((l) => l.id !== recu.id);
  if (!correspondEtat({ ...fusion, is_active: recu.is_active ?? connue?.is_active ?? (etat === 'disponibles') }, etat, aujourdhui)) {
    return { lignes: autres, recharger: false };
  }
  return { lignes: trier([...autres, fusion], limite), recharger: false };
}
