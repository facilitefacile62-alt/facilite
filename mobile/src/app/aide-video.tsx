import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import BoutonAction from '@/components/BoutonAction';
import FaciliteHeader from '@/components/FaciliteHeader';
import { AIDE_VIDEO_VIDE, chargerAideVideo, type AideVideo } from '@/lib/aideVideo';

// « Vidéo d'explication pour postuler » — page ouverte par le bouton « Aide »
// des publications (elle remplace le « J'aime »). Même contenu que la page du
// site /aide-candidature : la vidéo d'aide (table aide_video, gérée depuis l'admin du site),
// un bouton pour continuer vers le site officiel de l'offre quand il y en a un,
// et l'accompagnement WhatsApp de Facilité.
const NUMERO_WHATSAPP = '221771400832';

function LecteurFichier({ url }: { url: string }) {
  const lecteur = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return <VideoView player={lecteur} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />;
}

export default function AideVideoScreen() {
  const router = useRouter();
  const { titre, lien } = useLocalSearchParams<{ titre?: string; lien?: string }>();
  const [AIDE_VIDEO, setAideVideo] = useState<AideVideo>(AIDE_VIDEO_VIDE);
  useEffect(() => {
    let annule = false;
    chargerAideVideo().then((v) => {
      if (!annule) setAideVideo(v);
    });
    return () => {
      annule = true;
    };
  }, []);
  const lienOfficiel = typeof lien === 'string' && /^https?:\/\//.test(lien) ? lien : null;

  const message = `Bonjour Facilité, j'ai besoin d'aide pour postuler${titre ? ` à « ${titre} »` : ''}.`;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        <ScrollView contentContainerClassName="px-4 pt-3 pb-8 gap-3.5" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityLabel="Retour"
              className="flex-row items-center gap-1.5"
              style={{ minHeight: 44 }}>
              <Ionicons name="arrow-back" size={16} color="#1A1A1A" />
              <Text className="text-[13px] font-bold underline text-[#1A1A1A]">Retour</Text>
            </Pressable>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: '#DCFCE7' }}>
              <Text className="text-[12px] font-black" style={{ color: '#166534' }}>Tutoriel et aide</Text>
            </View>
          </View>

          <View className="bg-white p-4 gap-3.5" style={{ borderRadius: 24 }}>
            <View className="flex-row items-center gap-3">
              <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7' }}>
                <Ionicons name="play" size={16} color="#166534" />
              </View>
              <Text className="flex-1 text-[17px] font-black text-[#1A1A1A]">Vidéo d&apos;explication pour postuler</Text>
            </View>

            <Text className="text-[13.5px]" style={{ color: 'rgba(0,0,0,0.6)', lineHeight: 20 }}>
              Regardez cette courte vidéo pour réussir votre candidature
              {titre ? (
                <>
                  {' '}à <Text className="font-extrabold text-[#1A1A1A]">{titre}</Text>
                </>
              ) : null}
              .
            </Text>

            {/* Cadre du lecteur */}
            <View className="overflow-hidden items-center justify-center" style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: AIDE_VIDEO.type === 'aucune' ? '#F3F4F6' : '#000' }}>
              {AIDE_VIDEO.type === 'fichier' ? (
                <LecteurFichier url={AIDE_VIDEO.url} />
              ) : AIDE_VIDEO.type === 'youtube' ? (
                <WebView
                  source={{ uri: `https://www.youtube-nocookie.com/embed/${AIDE_VIDEO.id}?playsinline=1` }}
                  allowsFullscreenVideo
                  allowsInlineMediaPlayback
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <View className="items-center gap-2 px-6">
                  <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#DCFCE7' }}>
                    <Ionicons name="videocam" size={20} color="#166534" />
                  </View>
                  <Text className="text-[14px] font-extrabold text-center text-[#1A1A1A]">La vidéo d&apos;aide arrive bientôt</Text>
                  {AIDE_VIDEO.whatsappVisible ? (
                    <Text className="text-[12px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      En attendant, notre équipe vous accompagne sur WhatsApp.
                    </Text>
                  ) : null}
                </View>
              )}
              {AIDE_VIDEO.type !== 'aucune' && AIDE_VIDEO.duree ? (
                <View className="absolute rounded-full px-2.5 py-0.5" style={{ top: 10, right: 10, backgroundColor: 'rgba(75,85,99,0.9)' }}>
                  <Text className="text-[11px] font-bold text-white">{AIDE_VIDEO.duree}</Text>
                </View>
              ) : null}
            </View>

            <Text className="text-[12px] font-semibold" style={{ color: 'rgba(0,0,0,0.5)' }}>Astuces pour maximiser votre sélection</Text>

            {lienOfficiel ? (
              <BoutonAction titre="Postuler sur le site officiel" sousTitre="Continuer vers l'offre" icone="open-outline" onPress={() => Linking.openURL(lienOfficiel).catch(() => {})} />
            ) : null}
          </View>

          {/* Accompagnement WhatsApp — masqué par l'interrupteur admin « Vidéo d'aide » */}
          {AIDE_VIDEO.whatsappVisible ? (
          <View className="bg-white p-4 gap-3" style={{ borderRadius: 20, borderWidth: 1, borderColor: '#A7F3D0' }}>
            <View className="flex-row items-center gap-3">
              <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#25D366' }}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-black text-[#1A1A1A]">Accompagnement Facilité</Text>
                <Text className="text-[11.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Envoyez un message à Facilité sur WhatsApp</Text>
              </View>
            </View>
            <Pressable
              onPress={() => Linking.openURL(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(message)}`).catch(() => {})}
              accessibilityRole="button"
              className="flex-row items-center justify-center gap-2"
              style={{ height: 46, borderRadius: 23, backgroundColor: '#25D366' }}>
              <Ionicons name="logo-whatsapp" size={17} color="#fff" />
              <Text className="text-[13px] font-black text-white">WhatsApp (+221 77 140 08 32)</Text>
            </Pressable>
          </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
