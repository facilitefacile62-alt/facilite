import { Stack } from 'expo-router';
import { View } from 'react-native';

import MarketplaceBottomBar from '@/components/MarketplaceBottomBar';

// Plateforme Marketplace : toutes ses pages partagent la barre du bas.
// Les pages gardent leur propre en-tête ; seule la barre est commune.
export default function MarketplaceLayout() {
  return (
    <View className="flex-1 bg-white">
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <MarketplaceBottomBar />
    </View>
  );
}
