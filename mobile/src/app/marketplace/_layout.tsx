import { Stack } from 'expo-router';
import { View } from 'react-native';

import MarketplaceBottomBar from '@/components/MarketplaceBottomBar';

// Plateforme Marketplace : toutes ses pages partagent la barre du bas.
// Les pages gardent leur propre en-tête ; seule la barre est commune.
// Fond crème #F2F0EA de la charte §2 (et non blanc) : c'est la couleur de
// page de toutes les maquettes Marketplace.
const FOND_PAGE = '#F2F0EA';

export default function MarketplaceLayout() {
  return (
    <View className="flex-1" style={{ backgroundColor: FOND_PAGE }}>
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: FOND_PAGE } }} />
      </View>
      <MarketplaceBottomBar />
    </View>
  );
}
