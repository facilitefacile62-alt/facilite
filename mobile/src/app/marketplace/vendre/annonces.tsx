import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { enStock, prixLisible, urlPhoto } from '@/lib/marketplace';
import { chargerMesArticles, type MonArticle } from '@/lib/vendeur';

// Mes annonces (maquette « Vendeur — Mes annonces ») : écran dédié, séparé
// du Tableau de bord. Pas de compteur de vues affiché : aucune colonne ne
// le suit côté base, l'inventer serait une fausse donnée.
const VERT_PROFOND = '#0d3b34';

function LigneAnnonce({ article, storeId, onChange }: { article: MonArticle; storeId: string; onChange: () => void }) {
  const router = useRouter();
  const photo = article.photos[0] ? urlPhoto(article.photos[0]) : null;

  function ouvrirModification() {
    const params = new URLSearchParams({
      id: article.id,
      titre: article.titre,
      categorie: article.categorie,
      prix: String(article.prix_xof),
      quantite: String(article.quantite),
      description: article.description || '',
      photos: JSON.stringify(article.photos),
    });
    router.push(`/marketplace/vendre/modifier-article?${params.toString()}` as Href);
  }

  return (
    <View className="flex-row items-center gap-3 bg-white rounded-2xl border border-black/[0.06] p-2.5">
      <View className="w-14 h-14 rounded-xl bg-[#F2F0EA] items-center justify-center overflow-hidden">
        {photo ? (
          <Image source={{ uri: photo }} alt={article.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Ionicons name="image-outline" size={20} color="#9CA3AF" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] font-bold text-[#1A1A1A]" numberOfLines={1}>
          {article.titre}
        </Text>
        <Text className="text-[13px] font-extrabold" style={{ color: VERT_PROFOND }}>
          {prixLisible(article.prix_xof)} FCFA
        </Text>
        <Text className={`text-[11px] mt-0.5 ${enStock(article) ? 'text-gray-500' : 'text-amber-600'}`}>
          {article.quantite} en stock
        </Text>
      </View>
      <Pressable
        onPress={ouvrirModification}
        className="flex-row items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5">
        <Ionicons name="create-outline" size={13} color="#1A1A1A" />
        <Text className="text-[11.5px] font-bold text-[#1A1A1A]">Modifier</Text>
      </Pressable>
    </View>
  );
}

export default function MesAnnoncesScreen() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const [articles, setArticles] = useState<MonArticle[]>([]);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    if (!storeId) return;
    try {
      setArticles(await chargerMesArticles(storeId));
    } finally {
      setChargement(false);
    }
  }, [storeId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  return (
    <View className="flex-1 bg-[#FAF9F6]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/vendre'))}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-white items-center justify-center border border-black/[0.06]">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[17px] font-black text-[#1A1A1A] flex-1">Mes annonces</Text>
        </View>

        {chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={articles}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[13px] font-bold text-gray-600">{articles.length} article{articles.length > 1 ? 's' : ''} publié{articles.length > 1 ? 's' : ''}</Text>
                <Pressable
                  onPress={() => router.push(`/marketplace/vendre/publier?storeId=${storeId}` as Href)}
                  className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2"
                  style={{ backgroundColor: VERT_PROFOND }}>
                  <Ionicons name="add" size={15} color="#6ee7c9" />
                  <Text className="text-white text-[12px] font-bold">Publier un article</Text>
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center pt-16 gap-2">
                <Ionicons name="pricetags-outline" size={36} color="#9CA3AF" />
                <Text className="text-[13.5px] text-gray-500 text-center px-6">Aucun article publié pour l&apos;instant.</Text>
              </View>
            }
            renderItem={({ item }) => <LigneAnnonce article={item} storeId={storeId} onChange={recharger} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
