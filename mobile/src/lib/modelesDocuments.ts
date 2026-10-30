import { lireModeleDocument, type ModeleDocument } from '@/lib/modelesDocumentsLogique';
import { supabase } from '@/lib/supabase';

/** Catalogue « Modèles de documents » : les modèles actifs publiés par l'administrateur (lecture seule, comptes connectés). */
export async function chargerModelesDocuments(): Promise<ModeleDocument[]> {
  const { data, error } = await supabase
    .from('modeles_documents')
    .select('id, type, nom, description, image_url, ordre, message_whatsapp')
    .eq('actif', true)
    .order('ordre', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(lireModeleDocument).filter((m): m is ModeleDocument => m !== null);
}
