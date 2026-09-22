import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SelecteurDepartement from '@/components/SelecteurDepartement';
import { useAuth } from '@/context/AuthContext';
import { enStock, prixLisible, urlPhoto } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';
import {
  chargerMesArticles,
  chargerMesBoutiques,
  creerBoutique,
  definirVisibiliteBoutique,
  majStock,
  retirerArticle,
  type MaBoutique,
  type MonArticle,
} from '@/lib/vendeur';

// "Ma boutique" (espace vendeur natif). Un vendeur = une boutique gratuite
// (BOUTIQUES_OFFERTES côté site) : cet écran prend la première trouvée, comme
// le fait déjà "Ma boutique" côté web pour l'essentiel des vendeurs. Aucune
// fonctionnalité inventée : ni modification complète d'un article publié
// (aucune RPC ne l'autorise, seulement la création, l'ajustement du stock et
// le retrait — voir src/lib/vendeur.ts), ni faux avis/notes.
const VERT_PROFOND = '#0d3b34';

function FormulaireCreationBoutique({ userId, onCree }: { userId: string; onCree: () => void }) {
  const { activer } = useLocalisation();
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState<string | null>(null);
  const [quartier, setQuartier] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  async function creer() {
    if (!nom.trim()) {
      Alert.alert('Nom manquant', 'Donnez un nom à votre boutique.');
      return;
    }
    setEnregistrement(true);
    // Position best-effort : une boutique sans position reste utilisable
    // (elle n'apparaît simplement pas dans "Autour de moi").
    const { position } = await activer().catch(() => ({ position: null }));
    try {
      await creerBoutique(userId, { nom, ville, quartier, telephoneWhatsapp: whatsapp, position });
      onCree();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de créer votre boutique.');
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="px-5 pt-2 gap-4">
      <View className="items-center gap-2 py-4">
        <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: VERT_PROFOND }}>
          <Ionicons name="storefront" size={30} color="#6ee7c9" />
        </View>
        <Text className="text-[18px] font-extrabold text-[#1A1A1A]">Créez votre boutique</Text>
        <Text className="text-[13px] text-gray-500 text-center px-4">
          Une boutique gratuite pour publier vos articles sur le Marketplace Facilité.
        </Text>
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Nom de la boutique</Text>
        <TextInput
          value={nom}
          onChangeText={setNom}
          placeholder="Ex. Boutique Awa"
          placeholderTextColor="#9CA3AF"
          className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Département</Text>
        <SelecteurDepartement valeur={ville} onChoisir={setVille} />
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Quartier (facultatif)</Text>
        <TextInput
          value={quartier}
          onChangeText={setQuartier}
          placeholder="Ex. Plateau"
          placeholderTextColor="#9CA3AF"
          className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">WhatsApp (facultatif)</Text>
        <TextInput
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="77 123 45 67"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
        />
      </View>

      <Pressable
        onPress={creer}
        disabled={enregistrement}
        className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60"
        style={{ backgroundColor: VERT_PROFOND }}>
        {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Créer ma boutique</Text>}
      </Pressable>
    </View>
  );
}

function LigneArticle({ article, onChanger }: { article: MonArticle; onChanger: () => void }) {
  const [enCours, setEnCours] = useState(false);
  const photo = article.photos[0] ? urlPhoto(article.photos[0]) : null;

  async function ajusterStock(delta: number) {
    if (enCours) return;
    const nouvelle = Math.max(0, article.quantite + delta);
    setEnCours(true);
    try {
      await majStock(article.id, nouvelle);
      onChanger();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour du stock impossible.');
    } finally {
      setEnCours(false);
    }
  }

  function confirmerRetrait() {
    Alert.alert('Retirer cet article ?', `« ${article.titre} » ne sera plus visible sur le Marketplace.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          try {
            await retirerArticle(article.id);
            onChanger();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Retrait impossible.');
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-row gap-3 bg-white rounded-2xl border border-black/[0.06] p-2.5">
      <View className="w-16 h-16 rounded-xl bg-[#F2F0EA] items-center justify-center overflow-hidden">
        {photo ? (
          <Image source={{ uri: photo }} alt={article.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Ionicons name="image-outline" size={22} color="#9CA3AF" />
        )}
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[13px] font-bold text-[#1A1A1A]" numberOfLines={1}>
          {article.titre}
        </Text>
        <Text className="text-[13px] font-extrabold" style={{ color: VERT_PROFOND }}>
          {prixLisible(article.prix_xof)} FCFA
        </Text>
        <View className="flex-row items-center justify-between mt-0.5">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => ajusterStock(-1)}
              disabled={enCours || article.quantite === 0}
              className="w-6 h-6 rounded-full bg-[#F2F0EA] items-center justify-center disabled:opacity-40">
              <Ionicons name="remove" size={14} color="#1A1A1A" />
            </Pressable>
            <Text className={`text-[12px] font-bold w-14 text-center ${enStock(article) ? 'text-gray-700' : 'text-amber-600'}`}>
              {article.quantite} en stock
            </Text>
            <Pressable
              onPress={() => ajusterStock(1)}
              disabled={enCours}
              className="w-6 h-6 rounded-full bg-[#F2F0EA] items-center justify-center disabled:opacity-40">
              <Ionicons name="add" size={14} color="#1A1A1A" />
            </Pressable>
          </View>
          <Pressable onPress={confirmerRetrait} hitSlop={8} accessibilityLabel="Retirer l'article">
            <Ionicons name="trash-outline" size={17} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function MaBoutiqueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null | undefined>(undefined); // undefined = chargement, null = aucune
  const [articles, setArticles] = useState<MonArticle[]>([]);
  const [bascule, setBascule] = useState(false);

  // Fonction volontairement non mémoïsée (pas de useCallback) : l'effet de
  // montage ci-dessous ne la référence qu'une fois (deps [user?.id],
  // eslint-disable ciblé — même patron que src/app/recherche.tsx), et les
  // rappels (onChanger, onCree) sont recréés à chaque rendu sans conséquence.
  async function recharger() {
    if (!user?.id) return;
    try {
      const liste = await chargerMesBoutiques(user.id);
      const active = liste[0] ?? null;
      setBoutique(active);
      setArticles(active ? await chargerMesArticles(active.id) : []);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }

  // useFocusEffect (pas useEffect) : recharge à chaque retour sur cet écran,
  // pas seulement au montage — sans quoi un article publié ou retiré depuis
  // un autre écran (vendre/publier) restait invisible ici tant que le
  // composant ne se démontait pas.
  useFocusEffect(
    useCallback(() => {
      recharger();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

  async function basculerVisibilite(valeur: boolean) {
    if (!boutique || bascule) return;
    setBascule(true);
    try {
      await definirVisibiliteBoutique(boutique.id, valeur);
      setBoutique({ ...boutique, actif: valeur });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de changer la visibilité.');
    } finally {
      setBascule(false);
    }
  }

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={retour}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[18px] font-black text-[#1A1A1A]">Ma boutique</Text>
        </View>

        {chargement || boutique === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : !user?.id ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour gérer votre boutique.</Text>
          </View>
        ) : boutique === null ? (
          <FormulaireCreationBoutique userId={user.id} onCree={recharger} />
        ) : (
          <FlatList
            data={articles}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View className="mb-4">
                <View className="p-3.5 rounded-2xl border border-black/[0.06] bg-[#F8F6F1] gap-2.5">
                  <View className="flex-row items-center gap-3">
                    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: VERT_PROFOND }}>
                      <Ionicons name="storefront" size={20} color="#6ee7c9" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[15px] font-extrabold text-[#1A1A1A]" numberOfLines={1}>
                        {boutique.nom}
                      </Text>
                      <Text className="text-[12px] text-gray-500" numberOfLines={1}>
                        {[boutique.quartier, boutique.ville].filter(Boolean).join(', ') || 'Sénégal'}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between pt-2 border-t border-black/[0.05]">
                    <Text className="text-[12.5px] font-semibold text-gray-700">
                      {boutique.actif ? 'Visible sur le Marketplace' : 'Masquée du Marketplace'}
                    </Text>
                    <Switch
                      value={boutique.actif}
                      onValueChange={basculerVisibilite}
                      disabled={bascule}
                      trackColor={{ true: VERT_PROFOND }}
                    />
                  </View>
                </View>

                <View className="flex-row gap-2.5 mt-3">
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/marketplace/vendre/publier',
                        params: { storeId: boutique.id },
                      })
                    }
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3"
                    style={{ backgroundColor: VERT_PROFOND }}>
                    <Ionicons name="add" size={17} color="#6ee7c9" />
                    <Text className="text-white text-[13px] font-bold">Publier un article</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/marketplace/vendre/boutique',
                        params: {
                          storeId: boutique.id,
                          nom: boutique.nom,
                          quartier: boutique.quartier ?? '',
                          ville: boutique.ville ?? '',
                          whatsapp: boutique.telephone_whatsapp ?? '',
                        },
                      })
                    }
                    accessibilityLabel="Modifier ma boutique"
                    className="w-12 items-center justify-center rounded-2xl border border-gray-300">
                    <Ionicons name="settings-outline" size={18} color="#1A1A1A" />
                  </Pressable>
                </View>

                <Text className="text-[12.5px] font-extrabold tracking-wide text-gray-500 mt-5">
                  MES ARTICLES ({articles.length})
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center pt-6 pb-10 gap-2">
                <Ionicons name="pricetags-outline" size={36} color="#9CA3AF" />
                <Text className="text-[13.5px] text-gray-500 text-center px-6">
                  Aucun article publié pour l&apos;instant.
                </Text>
              </View>
            }
            renderItem={({ item }) => <LigneArticle article={item} onChanger={recharger} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
