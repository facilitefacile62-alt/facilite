import { supabase } from '@/lib/supabase';

// Vidéo d'aide « comment postuler », la MÊME sous toutes les publications
// (bouton « Aide » des cartes d'offres -> écran /aide-video). Gérée depuis
// l'espace admin du site (« Vidéo d'aide ») : table aide_video, lecture
// publique. Sans vidéo, l'écran annonce qu'elle arrive bientôt.
export type AideVideo =
  | { type: 'aucune'; whatsappVisible: boolean }
  | { type: 'fichier'; url: string; duree?: string; whatsappVisible: boolean }
  | { type: 'youtube'; id: string; duree?: string; whatsappVisible: boolean };

// whatsappVisible : interrupteur admin du numéro WhatsApp ; masqué tant que la
// valeur n'est pas lue.
export const AIDE_VIDEO_VIDE: AideVideo = { type: 'aucune', whatsappVisible: false };

export async function chargerAideVideo(): Promise<AideVideo> {
  const { data, error } = await supabase.from('aide_video').select('type, url, youtube_id, duree, whatsapp_visible').eq('id', 1).maybeSingle();
  if (error || !data) return AIDE_VIDEO_VIDE;
  const whatsappVisible = data.whatsapp_visible !== false;
  if (data.type === 'fichier' && data.url) return { type: 'fichier', url: data.url as string, duree: (data.duree as string | null) ?? undefined, whatsappVisible };
  if (data.type === 'youtube' && data.youtube_id) return { type: 'youtube', id: data.youtube_id as string, duree: (data.duree as string | null) ?? undefined, whatsappVisible };
  return { type: 'aucune', whatsappVisible };
}
