import { supabase } from '@/lib/supabase';

// « Autour de moi » de Facilité : où recrutent les entreprises ? Les offres
// n'ont pas de position GPS, seulement une localisation en texte (« Dakar »,
// « Kédougou », « Sénégal (Dakar & Régions) »…). On les range donc par VILLE
// reconnue dans ce texte et on place chaque pastille au centre de la ville —
// une position approximative, annoncée comme telle sur l'écran. Une offre dont
// le texte ne cite aucune ville connue (« Sénégal » seul) n'est pas posée sur la
// carte : elle est comptée à part, jamais inventée à un endroit précis.
export type Ville = { nom: string; lat: number; lng: number; alias: string[] };

// Centre de chaque ville ; `alias` : quartiers et noms voisins qui désignent la même zone.
export const VILLES: Ville[] = [
  { nom: 'Dakar', lat: 14.7167, lng: -17.4677, alias: ['dakar', 'mermoz', 'plateau', 'almadies', 'medina', 'médina', 'ouakam', 'yoff', 'ngor', 'sacre-coeur', 'sacré-coeur', 'hann', 'parcelles', 'liberté', 'point e', 'fann', 'keur gorgui', 'foire', 'sicap'] },
  { nom: 'Guédiawaye', lat: 14.7692, lng: -17.39, alias: ['guédiawaye', 'guediawaye'] },
  { nom: 'Pikine', lat: 14.7549, lng: -17.3985, alias: ['pikine', 'thiaroye'] },
  { nom: 'Rufisque', lat: 14.7167, lng: -17.2667, alias: ['rufisque'] },
  { nom: 'Diamniadio', lat: 14.7172, lng: -17.1833, alias: ['diamniadio'] },
  { nom: 'Thiès', lat: 14.791, lng: -16.9359, alias: ['thiès', 'thies'] },
  { nom: 'Mbour', lat: 14.4198, lng: -16.964, alias: ['mbour', 'saly'] },
  { nom: 'Saint-Louis', lat: 16.0179, lng: -16.4896, alias: ['saint-louis', 'saint louis'] },
  { nom: 'Louga', lat: 15.6167, lng: -16.2167, alias: ['louga'] },
  { nom: 'Touba', lat: 14.85, lng: -15.8833, alias: ['touba'] },
  { nom: 'Diourbel', lat: 14.6553, lng: -16.2306, alias: ['diourbel'] },
  { nom: 'Kaolack', lat: 14.15, lng: -16.0833, alias: ['kaolack'] },
  { nom: 'Fatick', lat: 14.339, lng: -16.4111, alias: ['fatick'] },
  { nom: 'Kaffrine', lat: 14.1059, lng: -15.5508, alias: ['kaffrine'] },
  { nom: 'Tambacounda', lat: 13.77, lng: -13.67, alias: ['tambacounda'] },
  { nom: 'Kédougou', lat: 12.5605, lng: -12.1747, alias: ['kédougou', 'kedougou'] },
  { nom: 'Kolda', lat: 12.8833, lng: -14.95, alias: ['kolda'] },
  { nom: 'Sédhiou', lat: 12.7081, lng: -15.5569, alias: ['sédhiou', 'sedhiou'] },
  { nom: 'Ziguinchor', lat: 12.5833, lng: -16.2719, alias: ['ziguinchor'] },
  { nom: 'Matam', lat: 15.6559, lng: -13.2554, alias: ['matam'] },
  { nom: 'Ngaparou', lat: 14.45, lng: -17.05, alias: ['ngaparou'] },
  { nom: 'Joal-Fadiouth', lat: 14.1667, lng: -16.8333, alias: ['joal', 'joal-fadiouth', 'fadiouth'] },
  { nom: 'Tivaouane', lat: 14.95, lng: -16.8167, alias: ['tivaouane'] },
  { nom: 'Richard-Toll', lat: 16.4625, lng: -15.7, alias: ['richard-toll', 'richard toll'] },
  { nom: 'Podor', lat: 16.65, lng: -14.9667, alias: ['podor'] },
  { nom: 'Linguère', lat: 15.3944, lng: -15.1139, alias: ['linguère', 'linguere'] },
  { nom: 'Bambey', lat: 14.7, lng: -16.45, alias: ['bambey'] },
  { nom: 'Bignona', lat: 12.8089, lng: -16.2261, alias: ['bignona'] },
  { nom: 'Vélingara', lat: 13.15, lng: -14.1167, alias: ['vélingara', 'velingara'] },
  { nom: 'Oussouye', lat: 12.485, lng: -16.5469, alias: ['oussouye', 'cap skirring'] },
];

export type OffreVille = { id: string; titre: string; entreprise: string };

export type GroupeVille = {
  ville: string;
  lat: number;
  lng: number;
  offres: OffreVille[];
  entreprises: number;
};

export type ResultatAutour = { groupes: GroupeVille[]; sansVille: number };

function normaliser(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** La ville citée en PREMIER dans le texte de localisation (« Dakar / Diamniadio » -> Dakar). */
export function trouverVille(localisation: string | null | undefined): Ville | null {
  const texte = normaliser(localisation ?? '');
  if (!texte) return null;
  let meilleure: { ville: Ville; index: number } | null = null;
  for (const v of VILLES) {
    for (const a of v.alias) {
      const i = texte.search(new RegExp(`(^|[^a-z])${normaliser(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`));
      if (i !== -1 && (!meilleure || i < meilleure.index)) meilleure = { ville: v, index: i };
    }
  }
  return meilleure?.ville ?? null;
}

type LigneOffre = { id: string; title: string | null; company: string | null; location: string | null; deadline: string | null };

export function regrouperParVille(lignes: LigneOffre[]): ResultatAutour {
  const parVille = new Map<string, GroupeVille>();
  let sansVille = 0;
  for (const l of lignes) {
    const v = trouverVille(l.location);
    if (!v) {
      sansVille += 1;
      continue;
    }
    const g = parVille.get(v.nom) ?? { ville: v.nom, lat: v.lat, lng: v.lng, offres: [], entreprises: 0 };
    g.offres.push({ id: l.id, titre: l.title || 'Offre', entreprise: l.company || 'Entreprise' });
    parVille.set(v.nom, g);
  }
  const groupes = [...parVille.values()].map((g) => ({ ...g, entreprises: new Set(g.offres.map((o) => o.entreprise.toLowerCase())).size }));
  groupes.sort((a, b) => b.offres.length - a.offres.length);
  return { groupes, sansVille };
}

/** Offres approuvées, actives et non expirées. */
export async function chargerOffresParVille(): Promise<ResultatAutour> {
  const { data, error } = await supabase
    .from('job_offers')
    .select('id, title, company, location, deadline')
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(600);
  if (error) throw new Error(error.message);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const valides = ((data ?? []) as LigneOffre[]).filter((o) => !o.deadline || o.deadline >= aujourdhui);
  return regrouperParVille(valides);
}
