import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import {
  brouillonArticle,
  enStock,
  libelleCategorie,
  lieuBoutique,
  lienWhatsapp,
  obtenirArticle,
  prixLisible,
  type ArticleMarketplace,
} from '@/lib/marketplace';
import { ouvrirConversation } from '@/lib/messages';

// Fiche produit native. Pas de "Commander maintenant" (aucun moyen de
// paiement pour le moment) ; sur son propre article, la discussion est grisée
// (on ne s'écrit pas à soi-même). Aucune donnée inventée : ni ancien prix, ni
// promotion, ni note, ni faux avis — seulement ce que le vendeur a saisi.
const VERT_PROFOND = '#0d3b34';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [article, setArticle] = useState<ArticleMarketplace | null | undefined>(undefined); // undefined = chargement
  const [photoActive, setPhotoActive] = useState(0);
  const [ouverture, setOuverture] = useState(false);

  useEffect(() => {
    let annule = false;
    obtenirArticle(id).then((a) => {
      if (!annule) setArticle(a);
    });
    return () => {
      annule = true;
    };
  }, [id]);

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  function surDefilement(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPhotoActive(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  if (article === undefined) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#10B981" />
      </View>
    );
  }

  if (article === null) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4 pt-2">
          <Pressable onPress={retour} className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8 gap-2">
          <Ionicons name="alert-circle-outline" size={42} color="#9CA3AF" />
          <Text className="text-[16px] font-bold text-[#1A1A1A]">Article introuvable</Text>
          <Text className="text-[13px] text-gray-500 text-center">
            Il a peut-être été retiré par le vendeur.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const estMonArticle = Boolean(user?.id) && article.proprietaireId === user?.id;
  const vendeurConnu = Boolean(article.proprietaireId);
  const discussionPossible = !estMonArticle && vendeurConnu;
  const whatsapp = lienWhatsapp(article);
  const stock = enStock(article);

  async function discuter() {
    if (!article) return;
    if (!user?.id) {
      router.push('/login');
      return;
    }
    if (!article.proprietaireId || ouverture) return;
    setOuverture(true);
    try {
      const conversationId = await ouvrirConversation(user.id, article.proprietaireId);
      if (!conversationId) {
        Alert.alert('Discussion', "Impossible d'ouvrir la discussion pour le moment.");
        return;
      }
      // L'article accompagne la discussion : message prérempli (modifiable)
      // qui le nomme, pour que le vendeur sache quel produit est visé.
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: conversationId,
          contexte: 'marketplace',
          nom: article.boutiqueNom,
          brouillon: brouillonArticle(article),
        },
      });
    } finally {
      setOuverture(false);
    }
  }

  function ecrireSurWhatsapp() {
    if (!whatsapp) return;
    Linking.openURL(whatsapp).catch(() => Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp."));
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={{ width, height: width * 0.95 }} className="bg-[#F2F0EA]">
          {article.photos.length > 0 ? (
            <FlatList
              data={article.photos}
              keyExtractor={(uri, i) => `${i}-${uri}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={surDefilement}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} alt={article.titre} style={{ width, height: width * 0.95 }} contentFit="cover" transition={150} />
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={48} color="#9CA3AF" />
            </View>
          )}
          {article.photos.length > 1 && (
            <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
              {article.photos.map((uri, i) => (
                <View
                  key={`${i}-${uri}`}
                  className={`h-1.5 rounded-full ${i === photoActive ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
                />
              ))}
            </View>
          )}
          <Pressable
            onPress={retour}
            accessibilityLabel="Retour"
            style={{ top: insets.top + 8 }}
            className="absolute left-4 w-10 h-10 rounded-full bg-white/95 items-center justify-center shadow-sm">
            <Ionicons name="arrow-back" size={21} color="#1A1A1A" />
          </Pressable>
        </View>

        <View className="px-4 pt-4">
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-[#F2F0EA] px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-gray-700">{libelleCategorie(article.categorie)}</Text>
            </View>
            <View className={`rounded-full px-2.5 py-1 ${stock ? 'bg-[#D1FAE5]' : 'bg-[#FEF3C7]'}`}>
              <Text className={`text-[11px] font-bold ${stock ? 'text-[#047857]' : 'text-[#B45309]'}`}>
                {stock ? 'En stock' : 'Sur commande'}
              </Text>
            </View>
          </View>

          <Text className="text-[21px] font-extrabold text-[#1A1A1A] mt-3 leading-[27px]">{article.titre}</Text>
          <Text className="text-[27px] font-black mt-1.5" style={{ color: VERT_PROFOND }}>
            {prixLisible(article.prixXof)} <Text className="text-[14px] font-bold">FCFA</Text>
          </Text>

          <View className="flex-row items-center gap-3 mt-4 p-3 rounded-2xl bg-[#F8F6F1] border border-black/[0.05]">
            <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: VERT_PROFOND }}>
              <Ionicons name="storefront" size={20} color="#6ee7c9" />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-gray-500">Vendu par</Text>
              <Text className="text-[14.5px] font-bold text-[#1A1A1A]" numberOfLines={1}>
                {article.boutiqueNom}
              </Text>
              <Text className="text-[12px] text-gray-500" numberOfLines={1}>
                {lieuBoutique(article)}
              </Text>
            </View>
          </View>

          <Text className="text-[13px] font-extrabold tracking-wide text-[#1A1A1A] mt-5">DESCRIPTION</Text>
          <Text className="text-[13.5px] leading-[20px] text-gray-700 mt-1.5">
            {article.description || 'Aucune description fournie par le vendeur.'}
          </Text>

          <View className="flex-row items-start gap-2.5 mt-5 p-3 rounded-2xl border border-black/[0.06]">
            <Ionicons name="bicycle-outline" size={19} color="#10B981" />
            <Text className="flex-1 text-[12.5px] leading-[18px] text-gray-600">
              Frais et date de livraison à convenir avec le vendeur : contactez-le avant d&apos;acheter.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute left-0 right-0 bottom-0 bg-white border-t border-black/[0.06] px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        {estMonArticle && (
          <Text className="text-[11.5px] text-center text-gray-500 mb-2">
            C&apos;est votre article : la discussion est désactivée.
          </Text>
        )}
        <View className="flex-row gap-3">
          <Pressable
            onPress={discuter}
            disabled={!discussionPossible || ouverture}
            accessibilityState={{ disabled: !discussionPossible }}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5 ${
              discussionPossible ? '' : 'bg-gray-200'
            }`}
            style={discussionPossible ? { backgroundColor: VERT_PROFOND } : undefined}>
            {ouverture ? (
              <ActivityIndicator color="#6ee7c9" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={discussionPossible ? '#6ee7c9' : '#9CA3AF'} />
                <Text className={`text-[14px] font-bold ${discussionPossible ? 'text-white' : 'text-gray-400'}`}>
                  Discuter avec le vendeur
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={ecrireSurWhatsapp}
            disabled={estMonArticle || !whatsapp}
            accessibilityLabel="Écrire sur WhatsApp"
            className={`w-14 items-center justify-center rounded-2xl ${estMonArticle || !whatsapp ? 'bg-gray-200' : 'bg-[#25D366]'}`}>
            <Ionicons name="logo-whatsapp" size={24} color={estMonArticle || !whatsapp ? '#9CA3AF' : '#FFFFFF'} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
