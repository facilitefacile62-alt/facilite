import { supabase } from '@/lib/supabase';

// Écriture d'un champ du profil. Les rubriques du profil (langues,
// formation, compétences, centres d'intérêt, coordonnées, confidentialité)
// vivent toutes dans des colonnes de `public.profiles`, écrites directement
// par le client comme sur le site — la RLS limite la ligne à son
// propriétaire. Mêmes noms de colonnes que src/app/profil/page.js :
// educations, skills, interests, languages, experiences, phone,
// contact_whatsapp, contact_email, city, is_public, show_contact,
// cv_visible_recruteurs.

export type Formation = {
  id?: string | number;
  school: string;
  degree: string;
  field?: string;
  startYear?: string;
  endYear?: string;
  isCurrent?: boolean;
};

export async function enregistrerChampsProfil(
  userId: string,
  champs: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...champs, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/** Tableau de chaînes propre (compétences, centres d'intérêt). */
export function listeTexte(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/** "2019 — 2022" / "2019 — En cours" / "" quand rien n'est renseigné. */
export function periodeFormation(f: Formation): string {
  const fin = f.isCurrent ? 'En cours' : f.endYear || '';
  if (!f.startYear && !fin) return '';
  if (!f.startYear) return fin;
  return fin ? `${f.startYear} — ${fin}` : String(f.startYear);
}
