import { Tabs } from 'expo-router';

import FaciliteBottomBar from '@/components/FaciliteBottomBar';

// Groupe (tabs) de la plateforme Facilité. Ordre demandé explicitement :
// Accueil, Offres, Extracteur (au milieu), Messages, Profil —
// Notifications n'est pas un onglet, elle vit dans l'en-tête
// (FaciliteHeader), en haut.
//
// `tabBar` : la barre native de React Navigation ne sait pas rendre la
// charte (fond #e3dbcc, icône pleine quand l'onglet est actif, pastille
// « 9+ »). On rend donc exactement la même barre que sur les écrans de
// détail hors onglets — un seul composant, un seul rendu possible.
export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <FaciliteBottomBar />}>
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="offres" options={{ title: 'Offres' }} />
      <Tabs.Screen name="extracteur" options={{ title: 'Extracteur' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
