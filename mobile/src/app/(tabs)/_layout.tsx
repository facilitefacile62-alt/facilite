import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import BoutonFlottantFacilite from '@/components/BoutonFlottantFacilite';

// Isolé du layout racine : ce groupe ne s'affiche que pour une session
// connectée (voir le garde d'authentification dans src/app/_layout.tsx).
// Le bouton flottant (Extracteur, Assistant vocal, Écrire un e-mail) flotte
// au-dessus des cinq onglets de Facilité.
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
      <BoutonFlottantFacilite />
    </View>
  );
}
