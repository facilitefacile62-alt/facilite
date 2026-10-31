import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CommandeRapideModal from '@/components/CommandeRapideModal';
import { useAuth } from '@/context/AuthContext';
import { brouillonArticle, lienWhatsapp, obtenirArticle, type ArticleMarketplace } from '@/lib/marketplace';
import { ouvrirConversation } from '@/lib/messages';

// « Marketplace — Photos & vidéo » — maquette 22 : visionneuse plein écran
// noire, compteur en haut à gauche, croix de fermeture, flèches de
// navigation, et en bas « Discuter » et « WhatsApp » (comme la fiche de l'article ; « Envoyer demande » retiré le 31/10/2026).
//
// La vidéo du produit (colonne marketplace_items.url_video, ajoutée le
// 09/10/2026) est le DERNIER élément de la série, comme sur la maquette
// (« Vidéo · 3/3 ») : les photos d'abord, la vidéo ensuite. Un article sans
// vidéo n'en affiche aucune — rien n'est inventé pour remplir la série.
const ORANGE = '#F4551E';

export default function PhotosArticleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id, index } = useLocalSearchParams<{ id?: string; index?: string }>();
  const { width } = Dimensions.get('window');

  const [article, setArticle] = useState<ArticleMarketplace | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [actif, setActif] = useState(() => Math.max(0, Number(index) || 0));
  const [commandeOuverte, setCommandeOuverte] = useState(false);
  const [ouverture, setOuverture] = useState(false);
  const whatsapp = article ? lienWhatsapp(article) : null;
  const estMonArticle = Boolean(article && user?.id && article.proprietaireId === user.id);
  function ecrireSurWhatsapp() {
    if (!whatsapp) return;
    Linking.openURL(whatsapp).catch(() => Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp."));
  }

  // Même parcours que « Discuter » de la fiche : on ouvre (ou crée) la VRAIE conversation avec le vendeur, étiquetée
  // Marketplace, au lieu de passer l'identifiant du vendeur à la place d'un identifiant de conversation.
  async function discuter() {
    if (!article || ouverture) return;
    if (!user?.id) {
      router.push('/login');
      return;
    }
    if (!article.proprietaireId) return;
    setOuverture(true);
    try {
      const conversationId = await ouvrirConversation(user.id, article.proprietaireId);
      if (!conversationId) {
        Alert.alert('Discussion', "Impossible d'ouvrir la discussion pour le moment.");
        return;
      }
      router.push({
        pathname: '/marketplace/chat/[id]',
        params: {
          id: conversationId,
          contexte: 'marketplace',
          nom: article.boutiqueNom,
          article: article.id,
        },
      });
    } finally {
      setOuverture(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let annule = false;
    obtenirArticle(id)
      .then((a) => {
        if (annule) return;
        if (a) setArticle(a);
        else setIntrouvable(true);
      })
      .catch(() => {
        if (!annule) setIntrouvable(true);
      });
    return () => {
      annule = true;
    };
  }, [id]);

  const photos = article?.photos ?? [];
  const video = article?.urlVideo ?? null;
  const total = photos.length + (video ? 1 : 0);
  const surVideo = Boolean(video) && actif === total - 1;

  // Le lecteur est créé une seule fois et re-alimenté quand la source
  // change ; il ne démarre que lorsque la vidéo est l'élément affiché.
  const lecteur = useVideoPlayer(video, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!video) return;
    if (surVideo) lecteur.play();
    else lecteur.pause();
  }, [surVideo, video, lecteur]);

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  const aller = (pas: number) => {
    if (total === 0) return;
    setActif((n) => (n + pas + total) % total);
  };

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-white text-[14px] font-bold">
            {total > 0 ? `${surVideo ? 'Vidéo' : 'Photo'} · ${actif + 1}/${total}` : 'Photos'}
          </Text>
          <Pressable
            onPress={fermer}
            accessibilityLabel="Fermer"
            className="w-9 h-9 rounded-full bg-white/15 items-center justify-center">
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>

        <View className="flex-1 justify-center">
          {introuvable ? (
            <Text className="text-white/60 text-[13px] text-center px-8">Article introuvable.</Text>
          ) : !article ? (
            <ActivityIndicator color="#fff" />
          ) : total === 0 ? (
            <View className="items-center gap-3">
              <Ionicons name="image-outline" size={46} color="rgba(255,255,255,0.35)" />
              <Text className="text-white/60 text-[13px]">Cet article n&apos;a ni photo ni vidéo.</Text>
            </View>
          ) : (
            <View className="flex-1 justify-center">
              {/* nativeControls fournit la barre de lecture de la maquette
                  (play, progression, durée) ; le bouton plein écran est
                  piloté séparément par fullscreenOptions. */}
              {surVideo ? (
                <VideoView
                  player={lecteur}
                  style={{ width, flex: 1 }}
                  contentFit="contain"
                  nativeControls
                  fullscreenOptions={{ enable: true }}
                />
              ) : (
                <Image
                  source={{ uri: photos[actif] }}
                  alt={article.titre}
                  style={{ width, flex: 1 }}
                  contentFit="contain"
                  transition={150}
                />
              )}
              {total > 1 ? (
                <>
                  <Pressable
                    onPress={() => aller(-1)}
                    accessibilityLabel="Élément précédent"
                    className="absolute left-4 w-11 h-11 rounded-full bg-white/15 items-center justify-center">
                    <Ionicons name="chevron-back" size={20} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={() => aller(1)}
                    accessibilityLabel="Élément suivant"
                    className="absolute right-4 w-11 h-11 rounded-full bg-white/15 items-center justify-center">
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </Pressable>
                </>
              ) : null}
            </View>
          )}
        </View>

        {article ? (
          <View className="flex-row gap-3 px-4 pb-4 pt-3">
            {/* Les deux mêmes boutons que la fiche de l'article : « Discuter » (messagerie de la plateforme) et « WhatsApp » (message préparé au vendeur). */}
            <Pressable
              onPress={discuter}
              disabled={!article.proprietaireId || ouverture}
              accessibilityRole="button"
              className="flex-1 flex-row items-center gap-2 rounded-[14px] px-2"
              style={{ height: 52, backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399', opacity: article.proprietaireId ? 1 : 0.5 }}>
              <View className="items-center justify-center rounded-[10px]" style={{ width: 34, height: 34, backgroundColor: '#D7F2EA' }}>
                {ouverture ? <ActivityIndicator size="small" color="#047857" /> : <Ionicons name="chatbubble-outline" size={16} color="#047857" />}
              </View>
              <Text className="text-[14px] font-black text-[#1A1A1A]">Discuter</Text>
            </Pressable>
            <Pressable
              onPress={ecrireSurWhatsapp}
              disabled={!whatsapp || estMonArticle}
              accessibilityRole="button"
              className="flex-1 flex-row items-center gap-2 rounded-[14px] px-2"
              style={{ height: 52, backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399', opacity: !whatsapp || estMonArticle ? 0.5 : 1 }}>
              <View className="items-center justify-center rounded-[10px]" style={{ width: 34, height: 34, backgroundColor: '#D7F2EA' }}>
                <Ionicons name="logo-whatsapp" size={17} color="#047857" />
              </View>
              <Text className="text-[14px] font-black text-[#1A1A1A]">WhatsApp</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      {article ? (
        <CommandeRapideModal
          visible={commandeOuverte}
          article={article}
          lienWhatsapp={lienWhatsapp(article)}
          onFermer={() => setCommandeOuverte(false)}
        />
      ) : null}
    </View>
  );
}
