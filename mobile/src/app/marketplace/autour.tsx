import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { distanceLisible, prixLisible, RAYON_PROCHE_KM, type ArticleMarketplace } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';
import { useMarketplaceArticles } from '@/lib/useMarketplaceArticles';

// « Autour de moi » (maquette « Marketplace — Autour de moi ») : articles triés
// par distance. Pas de fond de carte dans cette version (aucun module carte
// natif installé) — la liste triée par distance reste l'information utile.
const VERT_PROFOND = '#0d3b34';

export default function AutourDeMoiScreen() {
  const router = useRouter();
  const { etat, position, activer } = useLocalisation();
  const { articles, erreur } = useMarketplaceArticles(null, '', position);

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable onPress={retour} accessibilityLabel="Retour" className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[18px] font-black text-[#1A1A1A]">Autour de moi</Text>
            {position ? <Text className="text-[11.5px] text-gray-500">Articles triés par distance</Text> : null}
          </View>
        </View>

        {!position ? (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Ionicons name="location-outline" size={40} color="#9CA3AF" />
            <Text className="text-[13.5px] text-gray-600 text-center">
              Activez votre position pour voir les articles dans un rayon de {RAYON_PROCHE_KM} km.
            </Text>
            <Pressable
              onPress={activer}
              disabled={etat === 'recherche'}
              className="flex-row items-center gap-2 rounded-2xl px-6 py-3 disabled:opacity-60"
              style={{ backgroundColor: VERT_PROFOND }}>
              {etat === 'recherche' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-[14px] font-bold">Activer ma position</Text>
              )}
            </Pressable>
            {etat === 'refusee' ? (
              <Text className="text-[12px] text-amber-700 text-center">
                Localisation refusée. Autorisez-la dans les réglages du téléphone pour utiliser cet écran.
              </Text>
            ) : null}
          </View>
        ) : articles === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : erreur ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Chargement impossible pour le moment.</Text>
          </View>
        ) : (
          <FlatList<ArticleMarketplace>
            data={articles}
            keyExtractor={(a) => a.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
            contentContainerStyle={{ gap: 10, paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <View className="items-center pt-16 gap-2 px-8">
                <Ionicons name="storefront-outline" size={36} color="#9CA3AF" />
                <Text className="text-[13.5px] text-gray-500 text-center">Aucun article à proximité pour l&apos;instant.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/marketplace/${item.id}` as Href)}
                className="flex-1 bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
                <View className="w-full aspect-square bg-[#F2F0EA]">
                  {item.photos[0] ? (
                    <Image source={{ uri: item.photos[0] }} alt={item.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : null}
                  {distanceLisible(item.distanceKm) ? (
                    <View className="absolute bottom-2 left-2 flex-row items-center gap-1 bg-black/65 rounded-full px-2 py-0.5">
                      <Ionicons name="location" size={10} color="#6ee7c9" />
                      <Text className="text-white text-[10px] font-bold">{distanceLisible(item.distanceKm)}</Text>
                    </View>
                  ) : null}
                </View>
                <View className="p-2.5 gap-0.5">
                  <Text className="text-[14px] font-extrabold" style={{ color: VERT_PROFOND }}>
                    {prixLisible(item.prixXof)} <Text className="text-[10px] font-bold">FCFA</Text>
                  </Text>
                  <Text className="text-[12.5px] text-[#1A1A1A]" numberOfLines={2}>
                    {item.titre}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
