import { supabase } from '@/lib/supabase';

// Marque l'onboarding comme terminé (profiles.onboarding_done = true).
// Appelé à la fin de CHAQUE chemin : « Passer cette étape » ou fin du scan de
// document (24), « Accéder à la marketplace » (26), « Créer ma boutique et
// continuer » (27). Un échec réseau n'empêche pas d'avancer : l'utilisateur
// reverra simplement l'onboarding à la prochaine ouverture.
export async function terminerOnboarding(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ onboarding_done: true }).eq('id', userId);
  if (error) console.warn('Onboarding : enregistrement impossible', error.message);
}
