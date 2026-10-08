import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CommandeRapideModal from '@/components/CommandeRapideModal';
import { lienWhatsapp, obtenirArticle, type ArticleMarketplace } from '@/lib/marketplace';

// « Marketplace — Photos & vidéo » — maquette 22 : visionneuse plein écran
// noire, compteur en haut à gauche, croix de fermeture, flèches de
// navigation, et en bas « Envoyer demande » / « Discuter ici ».
//
// La maquette montre aussi un lecteur vidéo (« Vidéo · 3/3 », barre de
// lecture). Les articles n'ont qu'une colonne `photos` : aucune vidéo
// n'existe en base. On affiche donc les photos réelles et le compteur dit
// « Photo », plutôt que de dessiner une barre de lecture qui ne lirait rien.
const ORANGE = '#F4551E';

export default function PhotosArticleScreen() {
  const router = useRouter();
  const { id, index } = useLocalSearchParams<{ id?: string; index?: string }>();
  const { width } = Dimensions.get('window');

  const [article, setArticle] = useState<ArticleMarketplace | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [actif, setActif] = useState(() => Math.max(0, Number(index) || 0));
  const [commandeOuverte, setCommandeOuverte] = useState(false);

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

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  const photos = article?.photos ?? [];
  const total = photos.length;
  const aller = (pas: number) => {
    if (total === 0) return;
    setActif((n) => (n + pas + total) % total);
  };

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-white text-[14px] font-bold">
            {total > 0 ? `Photo · ${actif + 1}/${total}` : 'Photos'}
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
              <Text className="text-white/60 text-[13px]">Cet article n&apos;a pas encore de photo.</Text>
            </View>
          ) : (
            <View className="flex-1 justify-center">
              <Image
                source={{ uri: photos[actif] }}
                alt={article.titre}
                style={{ width, flex: 1 }}
                contentFit="contain"
                transition={150}
              />
              {total > 1 ? (
                <>
                  <Pressable
                    onPress={() => aller(-1)}
                    accessibilityLabel="Photo précédente"
                    className="absolute left-4 w-11 h-11 rounded-full bg-white/15 items-center justify-center">
                    <Ionicons name="chevron-back" size={20} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={() => aller(1)}
                    accessibilityLabel="Photo suivante"
                    className="absolute right-4 w-11 h-11 rounded-full bg-white/15 items-center justify-center">
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </Pressable>
                </>
              ) : null}
            </View>
          )}
        </View>

        {article ? (
          <View className="flex-row gap-3 px-5 pb-4 pt-3">
            <Pressable
              onPress={() => setCommandeOuverte(true)}
              className="flex-1 bg-white rounded-2xl py-3.5 items-center">
              <Text className="text-[14px] font-bold text-[#1A1A1A]">Envoyer demande</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/marketplace/chat/${article.proprietaireId}?article=${article.id}`)}
              disabled={!article.proprietaireId}
              className="flex-1 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
              style={{ backgroundColor: ORANGE, opacity: article.proprietaireId ? 1 : 0.5 }}>
              <Ionicons name="chatbubble" size={14} color="#fff" />
              <Text className="text-[14px] font-bold text-white">Discuter ici</Text>
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
