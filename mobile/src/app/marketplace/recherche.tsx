import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORIES_MARKETPLACE, lieuBoutique, prixLisible, type ArticleMarketplace } from '@/lib/marketplace';
import { chargerArticles } from '@/lib/marketplace';
import { lireHistoriqueRecherche, memoriserRecherche } from '@/lib/rechercheMarketplace';

// Recherche Marketplace (maquette « Marketplace — Recherche ») : barre en haut,
// suggestions et historique tant que rien n'est tapé, résultats en grille ensuite.
const VERT_PROFOND = '#0d3b34';

export default function RechercheMarketplaceScreen() {
  const router = useRouter();
  const [texte, setTexte] = useState('');
  const [soumise, setSoumise] = useState('');
  const [historique, setHistorique] = useState<string[]>([]);
  const [resultats, setResultats] = useState<ArticleMarketplace[] | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    lireHistoriqueRecherche().then((h) => {
      if (!annule) setHistorique(h);
    });
    return () => {
      annule = true;
    };
  }, []);

  async function lancer(terme: string) {
    const propre = terme.trim();
    if (!propre) return;
    setTexte(propre);
    setSoumise(propre);
    setEnCours(true);
    await memoriserRecherche(propre);
    setHistorique(await lireHistoriqueRecherche());
    try {
      setResultats(await chargerArticles({ texte: propre }));
    } catch {
      setResultats([]);
    } finally {
      setEnCours(false);
    }
  }

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-4 pt-2 pb-3">
          <Pressable onPress={retour} accessibilityLabel="Retour" className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <View className="flex-1 flex-row items-center gap-2 bg-[#F2F0EA] rounded-full px-3.5 py-2.5">
            <Ionicons name="search" size={16} color="#6B7280" />
            <TextInput
              value={texte}
              onChangeText={setTexte}
              onSubmitEditing={() => lancer(texte)}
              placeholder="Rechercher un article, une boutique..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              autoFocus
              autoCorrect={false}
              className="flex-1 text-[14px] text-[#1A1A1A] p-0"
            />
          </View>
        </View>

        {soumise === '' ? (
          <View className="px-4 gap-5">
            {historique.length > 0 ? (
              <View className="gap-2">
                <Text className="text-[12px] font-extrabold tracking-wide text-gray-500">RECHERCHES RÉCENTES</Text>
                {historique.map((h) => (
                  <Pressable key={h} onPress={() => lancer(h)} className="flex-row items-center gap-3 py-2">
                    <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                    <Text className="text-[14px] text-[#1A1A1A]">{h}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View className="gap-2">
              <Text className="text-[12px] font-extrabold tracking-wide text-gray-500">CATÉGORIES</Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES_MARKETPLACE.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/marketplace?categorie=${c.id}` as Href)}
                    className="rounded-full border border-gray-300 px-3.5 py-2">
                    <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : enCours ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={resultats ?? []}
            keyExtractor={(a) => a.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
            contentContainerStyle={{ gap: 10, paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <View className="items-center pt-16 gap-2 px-8">
                <Ionicons name="search-outline" size={36} color="#9CA3AF" />
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Aucun résultat pour « {soumise} »</Text>
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
                </View>
                <View className="p-2.5 gap-0.5">
                  <Text className="text-[14px] font-extrabold" style={{ color: VERT_PROFOND }}>
                    {prixLisible(item.prixXof)} <Text className="text-[10px] font-bold">FCFA</Text>
                  </Text>
                  <Text className="text-[12.5px] text-[#1A1A1A]" numberOfLines={2}>
                    {item.titre}
                  </Text>
                  <Text className="text-[10.5px] text-gray-500" numberOfLines={1}>
                    {item.boutiqueNom} · {lieuBoutique(item)}
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
