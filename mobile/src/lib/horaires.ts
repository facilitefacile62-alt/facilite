import { supabase } from '@/lib/supabase';

// Horaires d'ouverture d'une boutique (maquettes « Boutique —
// Établissement » 30 et « Programmer des horaires »).
//
// Table réelle `public.marketplace_horaires` : une ligne par jour et par
// boutique, `jour_semaine` 0 = dimanche … 6 = samedi (convention
// Date.getDay()). L'écriture passe par la fonction SECURITY DEFINER
// `enregistrer_mes_horaires(p_store_id, p_horaires)`, qui remplace la
// semaine entière et revérifie le propriétaire.

export type HoraireJour = {
  jour: number; // 0 = dimanche … 6 = samedi
  ouverture: string | null; // "08:00"
  fermeture: string | null; // "18:00"
  ferme: boolean;
};

/** Ordre d'affichage des maquettes : la semaine commence le lundi. */
export const JOURS_AFFICHAGE = [1, 2, 3, 4, 5, 6, 0];

export const NOM_JOUR: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

const DEFAUT_OUVERTURE = '08:00';
const DEFAUT_FERMETURE = '18:00';

/** "08:00:00" -> "08:00" ; null reste null. */
function heureCourte(v: string | null): string | null {
  if (!v) return null;
  return v.slice(0, 5);
}

/** Semaine complète, même si la base n'a aucune ligne pour la boutique. */
export function semaineVide(): HoraireJour[] {
  return JOURS_AFFICHAGE.map((jour) => ({
    jour,
    ouverture: DEFAUT_OUVERTURE,
    fermeture: DEFAUT_FERMETURE,
    // Dimanche fermé par défaut, comme la maquette 30.
    ferme: jour === 0,
  }));
}

export async function chargerHoraires(storeId: string): Promise<HoraireJour[]> {
  const { data, error } = await supabase
    .from('marketplace_horaires')
    .select('jour_semaine, heure_ouverture, heure_fermeture, ferme_ce_jour')
    .eq('store_id', storeId);
  if (error) throw new Error(error.message);

  const lignes = data ?? [];
  if (lignes.length === 0) return semaineVide();

  const parJour = new Map<number, HoraireJour>();
  for (const l of lignes) {
    parJour.set(l.jour_semaine as number, {
      jour: l.jour_semaine as number,
      ouverture: heureCourte(l.heure_ouverture as string | null),
      fermeture: heureCourte(l.heure_fermeture as string | null),
      ferme: l.ferme_ce_jour === true,
    });
  }
  return JOURS_AFFICHAGE.map(
    (jour) => parJour.get(jour) ?? { jour, ouverture: null, fermeture: null, ferme: true }
  );
}

export async function enregistrerHoraires(storeId: string, semaine: HoraireJour[]): Promise<void> {
  const { error } = await supabase.rpc('enregistrer_mes_horaires', {
    p_store_id: storeId,
    p_horaires: semaine.map((h) => ({
      jour_semaine: h.jour,
      heure_ouverture: h.ferme ? null : h.ouverture,
      heure_fermeture: h.ferme ? null : h.fermeture,
      ferme_ce_jour: h.ferme,
    })),
  });
  if (error) throw new Error(error.message);
}

/** Texte affiché à droite du jour : « 08:00 – 18:00 » ou « Fermé ». */
export function plageLisible(h: HoraireJour): string {
  if (h.ferme || !h.ouverture || !h.fermeture) return 'Fermé';
  return `${h.ouverture} – ${h.fermeture}`;
}

export function estAujourdhui(jour: number): boolean {
  return new Date().getDay() === jour;
}
