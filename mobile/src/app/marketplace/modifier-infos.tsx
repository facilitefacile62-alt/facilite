import { useLocalSearchParams } from 'expo-router';

import ModifierInfosLocauxPager from '@/components/ModifierInfosLocauxPager';

// « Modifier infos » de Locaux : « Modifier profil » | « Réglages », deux onglets glissants (comme Facilité).
// `?boutique=1` : compte avec boutique (profil et localisation de la boutique) ; sans : compte visiteur.
export default function ModifierInfosLocauxScreen() {
  const { boutique } = useLocalSearchParams<{ boutique?: string }>();
  return <ModifierInfosLocauxPager depart={0} boutique={boutique === '1'} />;
}
