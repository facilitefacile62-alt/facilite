import { supabase } from '@/lib/supabase';

// Stories du fil d'actualité, gérées depuis l'espace admin du site
// (« Stories ») : table stories, lecture publique des stories actives. Tant
// qu'il n'y en a aucune, l'Accueil garde son carrousel de modèles de CV.
export type Story = {
  id: string;
  titre: string;
  imageUrl: string;
  libelleBouton: string;
  lien: string | null;
  creeLe: string;
};

export async function chargerStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, titre, image_url, libelle_bouton, lien, created_at')
    .eq('actif', true)
    .order('ordre', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((s) => ({
    id: s.id as string,
    titre: s.titre as string,
    imageUrl: s.image_url as string,
    libelleBouton: s.libelle_bouton as string,
    lien: (s.lien as string | null) ?? null,
    creeLe: s.created_at as string,
  }));
}

export function ilYA(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
