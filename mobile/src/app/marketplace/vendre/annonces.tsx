import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { enStock, prixLisible, urlPhoto } from '@/lib/marketplace';
import { chargerMesArticles, type MonArticle } from '@/lib/vendeur';
import EnteteMarketplace from '@/components/EnteteMarketplace';

// Mes annonces (maquette « Vendeur — Mes annonces ») : écran dédié, séparé
// du Tableau de bord. Pas de compteur de vues affiché : aucune colonne ne
// le suit côté base, l'inventer serait une fausse donnée.

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
      video: article.url_video || '',
    });
    router.push(`/marketplace/vendre/modifier-article?${params.toString()}` as Href);
  }

  return (
    <View className="flex-row items-center gap-3 bg-white" style={{ borderRadius: 18, padding: 10 }}>
      <View style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: '#E9E4D8', overflow: 'hidden' }}>
        {photo ? (
          <Image source={{ uri: photo }} alt={article.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Svg width="100%" height="100%">
            {Array.from({ length: 8 }, (_, i) => (
              <Line key={i} x1={i * 16 - 58} y1={58} x2={i * 16} y2={0} stroke="#DDD6C6" strokeWidth={7} />
            ))}
          </Svg>
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[15px] font-black text-[#1A1A1A]" numberOfLines={1}>
          {article.titre}
        </Text>
        <Text className="text-[15px] font-black text-[#1A1A1A] mt-0.5">{prixLisible(article.prix_xof)} FCFA</Text>
        <Text className="text-[12.5px] mt-0.5" style={{ color: enStock(article) ? 'rgba(0,0,0,0.5)' : '#D97706' }}>
          {article.quantite} en stock
        </Text>
      </View>
      <Pressable
        onPress={ouvrirModification}
        className="flex-row items-center gap-1.5"
        style={{ height: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 14 }}>
        <Ionicons name="pencil" size={13} color="#1A1A1A" />
        <Text className="text-[14px] font-black text-[#1A1A1A]">Modifier</Text>
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
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Mes annonces" />

        {chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={articles}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: 14, paddingBottom: 32, gap: 12 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[15px] font-black text-[#1A1A1A]">{articles.length} article{articles.length > 1 ? 's' : ''} publié{articles.length > 1 ? 's' : ''}</Text>
                <Pressable
                  onPress={() => router.push(`/marketplace/vendre/publier?storeId=${storeId}` as Href)}
                  className="items-center justify-center"
                  style={{ backgroundColor: '#10B981', borderRadius: 16, height: 48, paddingHorizontal: 16 }}>
                  <Text className="text-white text-[14.5px] font-black">+ Publier un article</Text>
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
      </View>
    </View>
  );
}
