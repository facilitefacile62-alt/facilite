import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/context/AuthContext';
import { marquerEtapeEmailVue } from '@/lib/preferencesConnexion';

// Étape FACULTATIVE après « Crée un mot de passe » (demande du 23/10/2026) : la MÊME page « Confirmer mon compte » que celle
// affichée à une personne de Locaux qui veut postuler sur Facilité (app/confirmer-compte.tsx), avec en plus « Passer cette
// étape ». Une personne dont l'adresse est déjà confirmée ne la voit pas.
export default function EmailFacultatifScreen() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    if (user.email_confirmed_at) {
      marquerEtapeEmailVue(user.id).finally(() => router.replace('/onboarding/bienvenue' as Href));
      return;
    }
    router.replace({ pathname: '/confirmer-compte', params: { onboarding: '1', retour: '/onboarding/bienvenue' } } as Href);
  }, [user?.id, user?.email_confirmed_at, router]);

  return null;
}
