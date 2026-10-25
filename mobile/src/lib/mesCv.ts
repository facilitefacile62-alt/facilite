import type { DonneesExtraites } from '@/lib/scanLogique';
import type { CvEnregistre } from '@/lib/mesCvLogique';
import { supabase } from '@/lib/supabase';

// CV de la personne déjà enregistrés sur Facilité (créés sur le site ou importés) : lecture seule, uniquement les siens.
export async function listerMesCv(userId: string): Promise<CvEnregistre[]> {
  const { data, error } = await supabase
    .from('resumes')
    .select('id, title, type, created_at, content')
    .eq('user_id', userId)
    .in('type', ['created', 'imported'])
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as CvEnregistre[];
}

// CV choisi dans « Mes CV » : transmis à l'écran de relecture du scanner (en mémoire, le temps de la navigation).
let cvChoisi: DonneesExtraites | null = null;
export const memoriserCvChoisi = (d: DonneesExtraites | null) => {
  cvChoisi = d;
};
export const lireCvChoisi = (): DonneesExtraites | null => cvChoisi;
