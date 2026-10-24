import { Stack } from 'expo-router';
import { View } from 'react-native';

import { useClavierOuvert } from '@/components/ConteneurClavier';
import MarketplaceBottomBar from '@/components/MarketplaceBottomBar';
import { estSombre, fondSombre } from '@/components/themeSombre';

// Plateforme Marketplace : toutes ses pages partagent la barre du bas.
// Les pages gardent leur propre en-tête ; seule la barre est commune.
// Fond crème #F2F0EA de la charte §2 (et non blanc) : c'est la couleur de
// page de toutes les maquettes Marketplace.
const FOND_PAGE = '#F2F0EA';

export default function MarketplaceLayout() {
  const clavierOuvert = useClavierOuvert();
  return (
    <View className="flex-1" style={{ backgroundColor: FOND_PAGE }}>
      {/* Clavier ouvert : la barre du bas s'efface (la page est déjà arrêtée au-dessus du clavier par la racine, voir ConteneurClavier). */}
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: estSombre() ? fondSombre(FOND_PAGE) : FOND_PAGE } }} />
      </View>
      {clavierOuvert ? null : <MarketplaceBottomBar />}
    </View>
  );
}
