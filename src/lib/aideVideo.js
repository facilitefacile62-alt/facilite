import { supabase } from "@/lib/supabase";

// Vidéo d'aide « comment postuler », la MÊME sous toutes les publications
// (bouton « Aide » des cartes d'offres -> /aide-candidature).
//
// Elle se gère depuis l'espace admin « Vidéo d'aide » (/admin/aide-video) :
// fichier téléversé ou lien YouTube, stockés dans la table aide_video
// (lecture publique). Sans vidéo, la page annonce qu'elle arrive bientôt.
export const AIDE_VIDEO_VIDE = { type: "aucune" };

export async function chargerAideVideo() {
  const { data, error } = await supabase
    .from("aide_video")
    .select("type, url, youtube_id, duree")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return AIDE_VIDEO_VIDE;
  if (data.type === "fichier" && data.url) return { type: "fichier", url: data.url, duree: data.duree || undefined };
  if (data.type === "youtube" && data.youtube_id) return { type: "youtube", id: data.youtube_id, duree: data.duree || undefined };
  return AIDE_VIDEO_VIDE;
}
