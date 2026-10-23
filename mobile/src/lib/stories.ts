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
  /** false : l'administrateur a caché le bouton (et donc le numéro) de cette story. */
  boutonVisible: boolean;
  /** « cv » : modèle de CV (WhatsApp) ; « offre » : offre d'emploi, toujours avec un bouton « Postuler ». */
  type: 'cv' | 'offre';
  /** Message pré-rempli de « Commander via WhatsApp » ({nom} = titre de la story) ; null = message par défaut. */
  messageWhatsapp: string | null;
  creeLe: string;
};

export async function chargerStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, titre, image_url, libelle_bouton, lien, bouton_visible, type, message_whatsapp, created_at, date_debut, date_fin')
    .eq('actif', true)
    .order('ordre', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  // Seulement les stories ACTIVES et DANS LEUR PÉRIODE (date_debut / date_fin facultatives).
  const maintenant = Date.now();
  const dansLaPeriode = data.filter((s) => {
    const debut = s.date_debut ? new Date(s.date_debut as string).getTime() : null;
    const fin = s.date_fin ? new Date(s.date_fin as string).getTime() : null;
    return (debut === null || debut <= maintenant) && (fin === null || fin >= maintenant);
  });
  return dansLaPeriode.map((s) => ({
    id: s.id as string,
    titre: s.titre as string,
    imageUrl: s.image_url as string,
    libelleBouton: s.libelle_bouton as string,
    lien: (s.lien as string | null) ?? null,
    boutonVisible: s.bouton_visible !== false || s.type === 'offre',
    type: s.type === 'offre' ? 'offre' : 'cv',
    messageWhatsapp: (s.message_whatsapp as string | null) || null,
    creeLe: s.created_at as string,
  }));
}

export function ilYA(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
