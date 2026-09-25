import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CATEGORIES_MARKETPLACE,
  distanceLisible,
  enStock,
  lieuBoutique,
  prixLisible,
  RAYON_PROCHE_KM,
  type ArticleMarketplace,
} from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';
import { useMarketplaceArticles } from '@/lib/useMarketplaceArticles';

// Marketplace natif : grille d'articles + recherche + catégories. Mêmes
// données que le site (marketplace_items / marketplace_stores), sans WebView
// ni navigateur. Pas de design de référence dans design_handoff_facilite/ :
// on reprend la palette de l'app (vert profond #0d3b34, menthe #6ee7c9, fond
// clair) pour rester cohérent avec Offres et Accueil.
const VERT_PROFOND = '#0d3b34';

// Choix du menu « Autour de moi » — mêmes libellés que le menu du site (MenuAutourDeMoi.jsx).
const OPTIONS_AUTOUR_DE_MOI: { mode: 'liste' | 'mini' | 'pleine'; libelle: string; sous: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'liste', libelle: 'Articles proches', sous: 'Les articles de votre zone', icone: 'grid-outline' },
  { mode: 'mini', libelle: 'Mini carte', sous: 'Aperçu de la carte des boutiques', icone: 'map-outline' },
  { mode: 'pleine', libelle: 'Pleine carte', sous: 'Carte en grand écran', icone: 'expand-outline' },
];

// Nombre impair d'articles : sans case vide, la dernière carte s'étirerait sur
// toute la largeur (numColumns=2, flex-1).
type LigneGrille = ArticleMarketplace | { id: string; vide: true };
function avecCaseVide(articles: ArticleMarketplace[]): LigneGrille[] {
  return articles.length % 2 === 1 ? [...articles, { id: '__vide__', vide: true }] : articles;
}

function CarteArticle({ article, onPress }: { article: ArticleMarketplace; onPress: () => void }) {
  const photo = article.photos[0];
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-white rounded-2xl border border-black/[0.06] overflow-hidden active:opacity-90">
      <View className="w-full aspect-square bg-[#F2F0EA] items-center justify-center">
        {photo ? (
          <Image source={{ uri: photo }} alt={article.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
        ) : (
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        )}
        {!enStock(article) && (
          <View className="absolute top-2 left-2 bg-black/70 rounded-full px-2 py-0.5">
            <Text className="text-white text-[10px] font-bold">Sur commande</Text>
          </View>
        )}
        {distanceLisible(article.distanceKm) && (
          <View className="absolute bottom-2 left-2 flex-row items-center gap-1 bg-black/65 rounded-full px-2 py-0.5">
            <Ionicons name="location" size={10} color="#6ee7c9" />
            <Text className="text-white text-[10px] font-bold">{distanceLisible(article.distanceKm)}</Text>
          </View>
        )}
      </View>
      <View className="p-2.5">
        <Text className="text-[15px] font-extrabold" style={{ color: VERT_PROFOND }}>
          {prixLisible(article.prixXof)} <Text className="text-[10px] font-bold">FCFA</Text>
        </Text>
        <Text className="text-[12.5px] text-[#1A1A1A] mt-0.5 leading-[17px]" numberOfLines={2}>
          {article.titre}
        </Text>
        <View className="flex-row items-center gap-1 mt-1.5">
          <Ionicons name="storefront-outline" size={11} color="#6B7280" />
          <Text className="text-[10.5px] text-gray-500 flex-1" numberOfLines={1}>
            {article.boutiqueNom} · {lieuBoutique(article)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const [categorie, setCategorie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const { etat, position, activer, desactiver } = useLocalisation();
  const { articles, erreur, actualisation, recharger } = useMarketplaceArticles(categorie, recherche, position);

  // Menu « Autour de moi » (comme sur le site) : Articles proches / Mini carte / Pleine carte.
  const [menuAutourOuvert, setMenuAutourOuvert] = useState(false);

  // "Autour de moi" : la permission n'est demandée qu'ici, au choix dans le menu.
  async function choisirAutourDeMoi(mode: 'liste' | 'mini' | 'pleine') {
    setMenuAutourOuvert(false);
    if (etat === 'recherche') return;
    let p = position;
    if (!p) {
      const r = await activer();
      if (r.etat !== 'active' || !r.position) {
        signalerEchecLocalisation(r.etat);
        return;
      }
      p = r.position;
    }
    if (mode === 'liste') return; // la position est active : la liste est triée du plus proche au plus éloigné
    router.push({
      pathname: '/web/[cle]',
      params: { cle: 'marketplace-carte', lat: String(p.latitude), lng: String(p.longitude), vue: mode },
    });
  }

  function signalerEchecLocalisation(resultat: string) {
    if (resultat === 'refusee') {
      Alert.alert(
        'Localisation désactivée',
        'Autorisez la localisation dans les réglages pour voir les articles près de vous.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ouvrir les réglages',
            onPress: () => {
              Linking.openSettings().catch(() => {});
            },
          },
        ]
      );
    } else if (resultat === 'erreur') {
      Alert.alert('Localisation', "Impossible d'obtenir votre position pour le moment.");
    }
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[10.5px] font-bold tracking-widest text-[#10B981]">FACILITÉ</Text>
            <Text className="text-[20px] font-black text-[#1A1A1A] -mt-0.5">Marketplace</Text>
          </View>
          <Pressable
            onPress={() => router.push('/marketplace/vendre')}
            className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 border border-gray-300">
            <Ionicons name="storefront-outline" size={15} color="#1A1A1A" />
            <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Vendre</Text>
          </Pressable>
        </View>

        <View className="px-4">
          <View className="flex-row items-center gap-2 bg-[#F2F0EA] rounded-full px-4 py-2.5">
            <Ionicons name="search" size={17} color="#6B7280" />
            <TextInput
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher un article"
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              autoCorrect={false}
              className="flex-1 text-[14px] text-[#1A1A1A] p-0"
            />
            {recherche.length > 0 && (
              <Pressable onPress={() => setRecherche('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>

        <View className="mt-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <Pressable
              onPress={() => (etat === 'recherche' ? undefined : setMenuAutourOuvert(true))}
              accessibilityLabel="Autour de moi"
              accessibilityHint="Ouvre le choix : articles proches, mini carte ou pleine carte"
              className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 border ${
                etat === 'active' ? 'border-transparent' : 'bg-white border-[#10B981]'
              }`}
              style={etat === 'active' ? { backgroundColor: VERT_PROFOND } : undefined}>
              {etat === 'recherche' ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Ionicons name="locate" size={14} color={etat === 'active' ? '#6ee7c9' : '#047857'} />
              )}
              <Text className={`text-[12.5px] font-bold ${etat === 'active' ? 'text-white' : 'text-[#047857]'}`}>
                Autour de moi
              </Text>
            </Pressable>
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
                  <Ionicons
                    name={c.icone as keyof typeof Ionicons.glyphMap}
                    size={14}
                    color={actif ? '#6ee7c9' : '#4B5563'}
                  />
                  <Text className={`text-[12.5px] font-semibold ${actif ? 'text-white' : 'text-gray-700'}`}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {etat === 'active' && (
          <Text className="px-4 mt-2 text-[11.5px] text-gray-500">
            Articles dans un rayon de {RAYON_PROCHE_KM} km, du plus proche au plus éloigné.
          </Text>
        )}

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
                <Text className="text-[12.5px] text-gray-500 text-center">
                  {etat === 'active'
                    ? `Aucun article dans un rayon de ${RAYON_PROCHE_KM} km. Touchez « Autour de moi » pour voir tous les articles.`
                    : 'Essayez un autre mot ou une autre catégorie.'}
                </Text>
              </View>
            }
            renderItem={({ item }) =>
              'vide' in item ? (
                <View className="flex-1" />
              ) : (
                <CarteArticle article={item} onPress={() => router.push(`/marketplace/${item.id}`)} />
              )
            }
          />
        )}
      </SafeAreaView>

      {/* Menu « Autour de moi » : mêmes trois choix que sur le site */}
      <Modal visible={menuAutourOuvert} transparent animationType="fade" onRequestClose={() => setMenuAutourOuvert(false)}>
        <Pressable
          onPress={() => setMenuAutourOuvert(false)}
          accessibilityLabel="Fermer le menu"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28, gap: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 6, paddingHorizontal: 4 }}>Autour de moi</Text>
            {OPTIONS_AUTOUR_DE_MOI.map((o) => (
              <Pressable
                key={o.mode}
                onPress={() => choisirAutourDeMoi(o.mode)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6, borderRadius: 14 }}
                android_ripple={{ color: 'rgba(16,185,129,0.12)' }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={o.icone} size={19} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>{o.libelle}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{o.sous}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.3)" />
              </Pressable>
            ))}
            {etat === 'active' && (
              <Pressable
                onPress={() => {
                  setMenuAutourOuvert(false);
                  desactiver();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={19} color="#DC2626" />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#DC2626' }}>Désactiver « Autour de moi »</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
