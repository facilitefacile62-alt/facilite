import { lireVersionCv, type Rubriques, type VersionCv } from '@/lib/rubriquesCvLogique';
import { supabase } from '@/lib/supabase';

// Écriture des rubriques du CV : UNIQUEMENT par les fonctions du serveur, qui sauvegardent l'état actuel avant de remplacer (aucune écriture directe).

/** Remplace les rubriques par celles d'un CV. Renvoie l'identifiant de la version sauvegardée (null s'il n'y avait rien de réel à sauvegarder). */
export async function appliquerRubriquesCv(r: Rubriques): Promise<string | null> {
  const { data, error } = await supabase.rpc('appliquer_rubriques_cv', {
    p_languages: r.languages,
    p_experiences: r.experiences,
    p_educations: r.educations,
    p_skills: r.skills,
    p_interests: r.interests,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : null;
}

/** Anciennes versions de la personne, la plus récente d'abord (la sécurité par lignes ne montre que les siennes). */
export async function listerVersionsCv(): Promise<VersionCv[]> {
  const { data, error } = await supabase.from('profil_cv_versions').select('*').order('created_at', { ascending: false }).limit(10);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(lireVersionCv).filter((v): v is VersionCv => v !== null);
}

/** Remet une ancienne version ; l'état actuel est sauvegardé avant, donc ce retour en arrière est lui aussi annulable. */
export async function restaurerVersionCv(id: string): Promise<void> {
  const { error } = await supabase.rpc('restaurer_version_cv', { p_version_id: id });
  if (error) throw new Error(error.message);
}
