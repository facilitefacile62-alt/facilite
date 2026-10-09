import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CarteArticleMarketplace from '@/components/CarteArticleMarketplace';
import { CATEGORIES_MARKETPLACE, chargerArticles, type ArticleMarketplace } from '@/lib/marketplace';
import { lireHistoriqueRecherche, memoriserRecherche } from '@/lib/rechercheMarketplace';

// Recherche Marketplace — maquette 17 : bande #e3dbcc avec retour, champ gris
// « Rechercher… » et loupe en gras ; rangée de catégories sur fond blanc ;
// puis l'historique réel de l'appareil (« Aucune recherche récente » quand il
// est vide) ; les résultats prennent la place de l'historique, en grille.
//
// Les catégories sont les 10 de la base (contrainte CHECK de
// marketplace_items.categorie), pas celles de la maquette (« Vêtements pour
// hommes », « Chaussures »…) qui n'existent pas en base.
const VERT = '#10B981';

export default function RechercheMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <View className="px-4 pb-3 flex-row items-center gap-3" style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top + 10 }}>
        <Pressable onPress={retour} accessibilityLabel="Retour" hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </Pressable>
        <TextInput
          value={texte}
          onChangeText={(t) => {
            setTexte(t);
            if (!t.trim()) {
              setSoumise('');
              setResultats(null);
            }
          }}
          onSubmitEditing={() => lancer(texte)}
          placeholder="Rechercher..."
          placeholderTextColor="rgba(0,0,0,0.45)"
          returnKeyType="search"
          autoFocus
          autoCorrect={false}
          className="flex-1 text-[14.5px] text-[#1A1A1A]"
          style={[{ height: 46, borderRadius: 23, backgroundColor: '#d3cab9', paddingHorizontal: 18 }, { outlineStyle: 'none' } as object]}
        />
        <Pressable onPress={() => lancer(texte)} accessibilityLabel="Rechercher" hitSlop={10}>
          <Ionicons name="search" size={24} color="#111" />
        </Pressable>
      </View>

      {/* Catégories : chaque appui ouvre l'accueil filtré */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 22, alignItems: 'center', height: 50 }}>
          {CATEGORIES_MARKETPLACE.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/marketplace?categorie=${c.id}` as Href)}
              className="flex-row items-center gap-2">
              <Ionicons name={c.icone as keyof typeof Ionicons.glyphMap} size={15} color="rgba(0,0,0,0.5)" />
              <Text className="text-[13.5px] font-extrabold" style={{ color: 'rgba(0,0,0,0.55)' }}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {soumise === '' ? (
        <View className="px-4 pt-4 gap-1">
          {historique.length > 0 ? (
            historique.map((h) => (
              <Pressable key={h} onPress={() => lancer(h)} className="flex-row items-center gap-3 py-2.5">
                <Ionicons name="time-outline" size={17} color="#9CA3AF" />
                <Text className="text-[14.5px] text-[#1A1A1A]">{h}</Text>
              </Pressable>
            ))
          ) : (
            <Text className="text-[14.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Aucune recherche récente</Text>
          )}
        </View>
      ) : enCours ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      ) : (
        <FlatList
          data={resultats ?? []}
          keyExtractor={(a) => a.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingTop: 14, paddingBottom: 24 }}
          style={{ backgroundColor: '#F2F0EA' }}
          ListEmptyComponent={
            <View className="items-center pt-16 gap-2 px-8">
              <Ionicons name="search-outline" size={36} color="#9CA3AF" />
              <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Aucun résultat pour « {soumise} »</Text>
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
