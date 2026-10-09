import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import CarteArticleMarketplace from '@/components/CarteArticleMarketplace';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { chargerArticles, lieuBoutique, type ArticleMarketplace } from '@/lib/marketplace';

// Page publique d'une boutique : ses articles, avec son nom et son lieu.
// Cible du lien « Boutique → » de la fiche article (maquette 16). Lecture
// seule : les articles actifs des boutiques actives sont lisibles de tous.
const VERT = '#10B981';

export default function BoutiquePubliqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleMarketplace[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!id) return;
    let annule = false;
    chargerArticles({ boutiqueId: id, limite: 60 })
      .then((a) => {
        if (!annule) setArticles(a);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, [id]);

  const premier = articles?.[0];

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <EnteteMarketplace titre={premier?.boutiqueNom ?? 'Boutique'} sousTitre={premier ? lieuBoutique(premier) : undefined} />

      {articles === null && !erreur ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      ) : erreur ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[13.5px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
            Impossible de charger cette boutique pour le moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={articles ?? []}
          keyExtractor={(a) => a.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center pt-16 gap-2 px-8">
              <Ionicons name="storefront-outline" size={36} color="#9CA3AF" />
              <Text className="text-[13.5px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Cette boutique n&apos;a aucun article en vente pour l&apos;instant.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CarteArticleMarketplace article={item} onPress={() => router.push(`/marketplace/${item.id}` as Href)} />
          )}
        />
      )}
    </View>
  );
}
