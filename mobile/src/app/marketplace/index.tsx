import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CarteArticleMarketplace from '@/components/CarteArticleMarketplace';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES_MARKETPLACE, type ArticleMarketplace } from '@/lib/marketplace';
import { useMarketplaceArticles } from '@/lib/useMarketplaceArticles';
import { chargerMesBoutiques } from '@/lib/vendeur';

// Marketplace — Accueil (maquette « Marketplace », image 15). En-tête
// compact (logo + recherche + menu, pas de barre de recherche en ligne : un
// clic ouvre /marketplace/recherche), catégories, grille d'articles
// (CarteArticleMarketplace, partagée avec Autour de moi). « Autour de moi »
// est désormais l'onglet dédié de la barre du bas.
const VERT_PROFOND = '#0d3b34';
const BLEU_MARKETPLACE = '#2563EB';

// Nombre impair d'articles : sans case vide, la dernière carte s'étirerait sur
// toute la largeur (numColumns=2, flex-1).
type LigneGrille = ArticleMarketplace | { id: string; vide: true };
function avecCaseVide(articles: ArticleMarketplace[]): LigneGrille[] {
  return articles.length % 2 === 1 ? [...articles, { id: '__vide__', vide: true }] : articles;
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const [categorie, setCategorie] = useState<string | null>(null);
  const { articles, erreur, actualisation, recharger } = useMarketplaceArticles(categorie, '');

  // Catégorie choisie depuis la page Recherche (/marketplace?categorie=...).
  const { categorie: categorieParam } = useLocalSearchParams<{ categorie?: string }>();
  useEffect(() => {
    if (!categorieParam) return;
    queueMicrotask(() => setCategorie(categorieParam));
  }, [categorieParam]);

  // Libellé des actions rapides : « Devenir Vendeur » sans boutique, « Ma boutique » avec une.
  const { user } = useAuth();
  const userId = user?.id;
  const [aBoutique, setAboutique] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let annule = false;
      if (userId) {
        chargerMesBoutiques(userId)
          .then((liste) => {
            if (!annule) setAboutique(liste.length > 0);
          })
          .catch(() => {});
      }
      return () => {
        annule = true;
      };
    }, [userId])
  );

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-4 pt-2 pb-3">
          <Ionicons name="storefront" size={20} color={BLEU_MARKETPLACE} />
          <Text className="text-[19px] font-black flex-1" style={{ color: BLEU_MARKETPLACE }}>
            Marketplace
          </Text>
          <Pressable
            onPress={() => router.push('/marketplace/recherche')}
            accessibilityLabel="Rechercher"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="search" size={17} color="#1A1A1A" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/marketplace/profil')}
            accessibilityLabel="Menu"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="menu" size={19} color="#1A1A1A" />
          </Pressable>
        </View>

        <View style={{ height: 40, marginTop: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
            {[{ id: null as string | null, label: 'Toutes', icone: 'apps-outline' }, ...CATEGORIES_MARKETPLACE].map((c) => {
              const actif = categorie === c.id;
              return (
                <Pressable
                  key={c.id ?? 'toutes'}
                  onPress={() => setCategorie(c.id)}
                  className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 border ${
                    actif ? 'border-transparent' : 'bg-white border-gray-200'
                  }`}
                  style={actif ? { backgroundColor: VERT_PROFOND } : undefined}>
                  <Ionicons name={c.icone as keyof typeof Ionicons.glyphMap} size={14} color={actif ? '#6ee7c9' : '#4B5563'} />
                  <Text className={`text-[12.5px] font-semibold ${actif ? 'text-white' : 'text-gray-700'}`}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Actions rapides (maquette « Visiteur — Marketplace, actions rapides ») */}
        <View className="flex-row gap-2 px-4 mt-3">
          <Pressable
            onPress={() => router.push('/marketplace/vendre')}
            className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 bg-[#D1FAE5]">
            <Ionicons name="storefront-outline" size={15} color="#047857" />
            <Text className="text-[12.5px] font-bold text-[#047857]">{aBoutique ? 'Ma boutique' : 'Devenir Vendeur'}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/marketplace/commandes')}
            className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 bg-white border border-gray-200">
            <Ionicons name="receipt-outline" size={15} color="#1A1A1A" />
            <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Mes commandes</Text>
          </Pressable>
        </View>

        {articles === null && !erreur ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : erreur && articles === null ? (
          <View className="flex-1 items-center justify-center px-8 gap-3">
            <Ionicons name="cloud-offline-outline" size={40} color="#9CA3AF" />
            <Text className="text-[14px] text-gray-600 text-center">
              Impossible de charger les articles. Vérifiez votre connexion.
            </Text>
            <Pressable onPress={recharger} className="rounded-full px-5 py-2.5" style={{ backgroundColor: VERT_PROFOND }}>
              <Text className="text-white text-[13px] font-bold">Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={avecCaseVide(articles ?? [])}
            keyExtractor={(a) => a.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshing={actualisation}
            onRefresh={recharger}
            ListEmptyComponent={
              <View className="items-center pt-16 px-8 gap-2">
                <Ionicons name="search-outline" size={40} color="#9CA3AF" />
                <Text className="text-[15px] font-bold text-[#1A1A1A]">Aucun article trouvé</Text>
                <Text className="text-[12.5px] text-gray-500 text-center">Essayez un autre mot ou une autre catégorie.</Text>
              </View>
            }
            renderItem={({ item }) =>
              'vide' in item ? (
                <View className="flex-1" />
              ) : (
                <CarteArticleMarketplace article={item} onPress={() => router.push(`/marketplace/${item.id}`)} />
              )
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
