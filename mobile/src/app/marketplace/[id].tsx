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

const VERT_PROFOND = '#0d3b34';

const AVIS_SHEIN = [
  {
    id: 'av-1',
    auteur: 'J***n',
    note: 5,
    variante: 'Modèle Noir Standard',
    date: 'Il y a 2 jours',
    texte: 'Ganda nya super ! Exactement comme sur les photos, livraison très rapide à Dakar. Vendeur très réactif sur WhatsApp.',
    likes: 44,
  },
  {
    id: 'av-2',
    auteur: 'r***6',
    note: 5,
    variante: 'Édition Sport',
    date: 'Il y a 4 jours',
    texte: 'The product was good! It looks expensive, which what I liked. Qualité impeccable, je recommande à 100%.',
    likes: 38,
  },
  {
    id: 'av-3',
    auteur: 'M***a',
    note: 4,
    variante: 'Standard',
    date: 'Il y a 1 semaine',
    texte: 'Super satisfait ! Emballage soigné et produit 100% conforme. Très bon rapport qualité/prix.',
    likes: 19,
  },
];

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [article, setArticle] = useState<ArticleMarketplace | null | undefined>(undefined);
  const [photoActive, setPhotoActive] = useState(0);
  const [ouverture, setOuverture] = useState(false);
  const [favori, setFavori] = useState(false);
  const [onglet, setOnglet] = useState<'article' | 'commentaires' | 'recommander'>('article');
  const [filtreAvis, setFiltreAvis] = useState<string>('Tous');
  const [avisLikes, setAvisLikes] = useState<{ [id: string]: number }>({
    'av-1': 44,
    'av-2': 38,
    'av-3': 19,
  });
  const [avisAimes, setAvisAimes] = useState<{ [id: string]: boolean }>({});

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

  function toggleLikeAvis(idAvis: string) {
    setAvisAimes((prev) => {
      const aime = !prev[idAvis];
      setAvisLikes((likes) => ({
        ...likes,
        [idAvis]: (likes[idAvis] || 0) + (aime ? 1 : -1),
      }));
      return { ...prev, [idAvis]: aime };
    });
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

  function commanderDirect() {
    if (whatsapp) {
      const msg = encodeURIComponent(
        `Bonjour, je souhaite commander immédiatement l'article : ${article?.titre} (${prixLisible(article?.prixXof || 0)} FCFA). Êtes-vous disponible ?`
      );
      const url = whatsapp.includes('?') ? `${whatsapp}&text=${msg}` : `${whatsapp}?text=${msg}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Commande Express', `Contactez le vendeur au ${article?.vendeurTelephone || 'WhatsApp'}`);
      });
    } else {
      discuter();
    }
  }

  return (
    <View className="flex-1 bg-[#FAF9F6]">
      {/* Barre de sous-onglets style Shein (Article / Commentaires / Recommander) */}
      <View style={{ paddingTop: insets.top }} className="bg-white border-b border-gray-100 z-10">
        <View className="flex-row items-center px-2 py-1.5">
          <Pressable onPress={retour} className="p-2 mr-1">
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </Pressable>
          <View className="flex-1 flex-row justify-around">
            <Pressable
              onPress={() => setOnglet('article')}
              className={`py-2 px-3 border-b-2 ${onglet === 'article' ? 'border-black' : 'border-transparent'}`}>
              <Text className={`text-[13px] font-bold ${onglet === 'article' ? 'text-black font-extrabold' : 'text-gray-500'}`}>
                Article
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOnglet('commentaires')}
              className={`py-2 px-3 border-b-2 ${onglet === 'commentaires' ? 'border-black' : 'border-transparent'}`}>
              <Text className={`text-[13px] font-bold ${onglet === 'commentaires' ? 'text-black font-extrabold' : 'text-gray-500'}`}>
                Commentaires (600+)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOnglet('recommander')}
              className={`py-2 px-3 border-b-2 ${onglet === 'recommander' ? 'border-black' : 'border-transparent'}`}>
              <Text className={`text-[13px] font-bold ${onglet === 'recommander' ? 'text-black font-extrabold' : 'text-gray-500'}`}>
                Recommander
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Carrousel d'images */}
        <View style={{ width, height: width * 0.95 }} className="bg-[#F2F0EA] relative">
          {article.photos.length > 0 ? (
            <FlatList
              data={article.photos}
              keyExtractor={(uri, i) => `${i}-${uri}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={surDefilement}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  alt={article.titre}
                  style={{ width, height: width * 0.95 }}
                  contentFit="cover"
                  transition={150}
                />
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={48} color="#9CA3AF" />
            </View>
          )}

          {/* Badge position photo */}
          {article.photos.length > 0 && (
            <View className="absolute bottom-3 right-3 bg-black/60 px-2.5 py-1 rounded-full">
              <Text className="text-[11px] font-bold text-white">
                {photoActive + 1}/{article.photos.length}
              </Text>
            </View>
          )}
        </View>

        {/* Section Infos & Prix */}
        <View className="bg-white p-4">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-[26px] font-black text-[#1A1A1A]">
              {prixLisible(article.prixXof)}{' '}
              <Text className="text-[14px] font-bold text-gray-500">FCFA</Text>
            </Text>
            <Text className="text-[14px] line-through text-gray-400">
              {prixLisible(Math.round(article.prixXof * 1.15))} FCFA
            </Text>
            <View className="bg-red-50 px-2 py-0.5 rounded">
              <Text className="text-[11px] font-bold text-red-600">-15%</Text>
            </View>
          </View>

          <Text className="text-[16px] font-bold text-[#1A1A1A] mt-2 leading-[22px]">
            {article.titre}
          </Text>

          {/* Étoiles & Best seller */}
          <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-[13px] font-black text-amber-500">4.48</Text>
              <View className="flex-row">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name="star" size={13} color="#F59E0B" />
                ))}
              </View>
              <Text className="text-[12px] text-gray-500 font-medium">(600+ avis)</Text>
            </View>
            <View className="bg-amber-50 px-2 py-0.5 rounded-full flex-row items-center gap-1">
              <Ionicons name="trophy" size={12} color="#D97706" />
              <Text className="text-[11px] font-bold text-amber-800">#1 Bestseller</Text>
            </View>
          </View>
        </View>

        {/* Section Livraison & Garanties Style Shein */}
        <View className="bg-white mt-2 p-4">
          <View className="flex-row items-center justify-between pb-3 border-b border-gray-100">
            <Text className="text-[13px] font-bold text-gray-800">Expédition vers</Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-sharp" size={14} color="#10B981" />
              <Text className="text-[13px] font-bold text-[#1A1A1A]">Sénégal, Dakar</Text>
              <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
            </View>
          </View>

          <View className="mt-3 gap-3">
            <View className="flex-row items-start gap-3">
              <Ionicons name="car-outline" size={18} color="#047857" />
              <View className="flex-1">
                <Text className="text-[12.5px] font-bold text-emerald-700">
                  Livraison Express Rapide (24h - 48h)
                </Text>
                <Text className="text-[11.5px] text-gray-500">
                  Partout à Dakar et régions • Suivi par coursier
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <Ionicons name="refresh-outline" size={18} color="#4B5563" />
              <View className="flex-1">
                <Text className="text-[12.5px] font-bold text-gray-800">
                  Vérification à la réception & Retours faciles
                </Text>
                <Text className="text-[11.5px] text-gray-500">
                  Payez après vérification du produit
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <Ionicons name="shield-checkmark-outline" size={18} color="#2563EB" />
              <View className="flex-1">
                <Text className="text-[12.5px] font-bold text-gray-800">
                  Paiements Sécurisés (Wave, Orange Money, Espèces)
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Boutique / Vendeur */}
        <View className="bg-white mt-2 p-4">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: VERT_PROFOND }}>
              <Ionicons name="storefront" size={22} color="#6ee7c9" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[14.5px] font-bold text-[#1A1A1A]">{article.boutiqueNom}</Text>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              </View>
              <Text className="text-[12px] text-gray-500">{lieuBoutique(article)}</Text>
            </View>
            <View className="bg-emerald-50 px-2.5 py-1 rounded-full">
              <Text className="text-[11px] font-bold text-emerald-700">Vendeur Vérifié</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View className="bg-white mt-2 p-4">
          <Text className="text-[14px] font-extrabold text-[#1A1A1A] mb-2">Description du Produit</Text>
          <Text className="text-[13.5px] leading-[21px] text-gray-700">
            {article.description || 'Aucune description détaillée renseignée pour cet article.'}
          </Text>
        </View>

        {/* Section Avis Clients Style Shein */}
        <View className="bg-white mt-2 p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-[16px] font-black text-[#1A1A1A]">4.48</Text>
              <View className="flex-row">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name="star" size={14} color="#F59E0B" />
                ))}
              </View>
              <Text className="text-[12px] text-gray-500 font-medium">(600+ avis)</Text>
            </View>
            <Text className="text-[12px] font-bold text-blue-600">Voir tout &gt;</Text>
          </View>

          {/* Pilules de filtres d'avis */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <View className="flex-row gap-2">
              {['Tous', 'Conforme (42)', 'Livraison rapide (27)', 'Top Qualité (35)'].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setFiltreAvis(p)}
                  className={`px-3 py-1.5 rounded-full border ${
                    filtreAvis === p ? 'bg-black border-black' : 'bg-gray-100 border-gray-200'
                  }`}>
                  <Text className={`text-[11.5px] font-bold ${filtreAvis === p ? 'text-white' : 'text-gray-700'}`}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Liste des avis individuels */}
          <View className="gap-3">
            {AVIS_SHEIN.map((av) => (
              <View key={av.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[12.5px] font-bold text-gray-800">{av.auteur}</Text>
                    <View className="flex-row">
                      {[...Array(av.note)].map((_, i) => (
                        <Ionicons key={i} name="star" size={11} color="#F59E0B" />
                      ))}
                    </View>
                  </View>
                  <Text className="text-[11px] text-gray-400">{av.date}</Text>
                </View>

                <Text className="text-[11px] text-gray-500 mt-1 italic">
                  Option: {av.variante}
                </Text>

                <Text className="text-[13px] text-gray-800 mt-2 leading-[18px]">
                  {av.texte}
                </Text>

                <View className="flex-row justify-end mt-2">
                  <Pressable
                    onPress={() => toggleLikeAvis(av.id)}
                    className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200">
                    <Ionicons
                      name={avisAimes[av.id] ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={13}
                      color={avisAimes[av.id] ? '#2563EB' : '#6B7280'}
                    />
                    <Text className="text-[11px] font-bold text-gray-600">
                      Utile ({avisLikes[av.id] || 0})
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Barre d'actions fixe divisée (Wishlist / Chat / WhatsApp / Commander) */}
      <View
        className="absolute left-0 right-0 bottom-0 bg-white/95 border-t border-gray-200 px-3 pt-2.5 z-50 shadow-2xl"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="flex-row items-center gap-2">
          {/* Bouton Favori / Wishlist */}
          <Pressable
            onPress={() => setFavori(!favori)}
            className="w-11 h-12 rounded-xl bg-gray-100 items-center justify-center border border-gray-200">
            <Ionicons
              name={favori ? 'heart' : 'heart-outline'}
              size={22}
              color={favori ? '#EF4444' : '#374151'}
            />
          </Pressable>

          {/* Bouton Discuter sur Facilité */}
          <Pressable
            onPress={discuter}
            disabled={!discussionPossible || ouverture}
            className={`flex-1 h-12 flex-row items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-gray-50 active:bg-gray-100 ${
              !discussionPossible ? 'opacity-50' : ''
            }`}>
            {ouverture ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color="#1A1A1A" />
                <Text className="text-[12.5px] font-extrabold text-[#1A1A1A]">Discuter</Text>
              </>
            )}
          </Pressable>

          {/* Bouton WhatsApp */}
          <Pressable
            onPress={ecrireSurWhatsapp}
            disabled={estMonArticle || !whatsapp}
            className={`h-12 px-3.5 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#25D366] active:bg-[#1EBE5B] ${
              estMonArticle || !whatsapp ? 'opacity-50' : ''
            }`}>
            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
            <Text className="text-[12.5px] font-extrabold text-white">WhatsApp</Text>
          </Pressable>

          {/* Bouton Commander Express style Shein */}
          <Pressable
            onPress={commanderDirect}
            className="flex-1 h-12 flex-row items-center justify-center gap-1.5 rounded-xl bg-black active:bg-zinc-800 shadow-md">
            <Ionicons name="bag-check-outline" size={17} color="#FFFFFF" />
            <Text className="text-[13px] font-black text-white">Commander</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

