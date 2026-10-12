import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VERT_BANDEAU, CREME } from '@/components/EcranConnexion';
import { lireLangue, libelleLangue, marquerBienvenueVue, type CodeLangue } from '@/lib/preferencesConnexion';
import { SITE_URL } from '@/lib/webEcrans';

// Bienvenue — écran 01, montré UNIQUEMENT au tout premier lancement, tel que
// sur l'image 01 : titre « Bienvenue sur ffacilite » en vert foncé sur la
// bande claire, illustration pleine largeur (découpée de cette image dans
// assets/images/connexion/), puis la feuille crème : « Accepter et continuer »,
// sélecteur de langue et, tout en bas, la phrase d'acceptation avec ses deux
// liens vers les vraies pages légales du site.
//
// Le texte de la spécification parlait d'un bandeau vert foncé avec le logo
// clé ; l'image montre l'illustration à la place — c'est l'image qui est
// reproduite.
const FOND_TITRE = '#DDE6E2';

export default function BienvenueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [langue, setLangue] = useState<CodeLangue>('fr');

  useEffect(() => {
    lireLangue().then(setLangue);
  }, []);

  async function accepter() {
    await marquerBienvenueVue();
    router.push('/login');
  }

  const ouvrir = (chemin: string) => Linking.openURL(`${SITE_URL}${chemin}`).catch(() => {});

  return (
    <View className="flex-1" style={{ backgroundColor: FOND_TITRE }}>
      <View className="items-center justify-center" style={{ paddingTop: insets.top, height: insets.top + 46 }}>
        <Text className="text-[26px] font-black text-center" style={{ color: VERT_BANDEAU }}>
          Bienvenue sur ffacilite
        </Text>
      </View>
      <Image
        alt=""
        source={require('../../../assets/images/connexion/bienvenue-illustration.png')}
        contentFit="cover"
        style={{ width: '100%', aspectRatio: 792 / 434 }}
      />

      <View className="flex-1 px-7" style={{ backgroundColor: CREME, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 30, marginTop: -8 }}>
        <Pressable
          onPress={accepter}
          accessibilityRole="button"
          className="items-center justify-center"
          style={{ height: 56, borderRadius: 28, backgroundColor: '#10E688' }}>
          <Text className="text-[18px] font-black text-[#111]">Accepter et continuer</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/langue' as Href)}
          accessibilityLabel="Langue de l'application"
          className="self-center flex-row items-center gap-2.5 bg-white mt-5"
          style={{ height: 48, borderRadius: 24, paddingHorizontal: 22, borderWidth: 1.5, borderColor: '#E5E2DC' }}>
          <Ionicons name="globe-outline" size={20} color="#111" />
          <Text className="text-[16px] font-black text-[#111]">{libelleLangue(langue)}</Text>
          <Ionicons name="chevron-down" size={16} color="#111" />
        </Pressable>

        <Text
          className="text-center absolute left-7 right-7"
          style={{ bottom: Math.max(insets.bottom, 12) + 28, color: 'rgba(0,0,0,0.6)', fontSize: 14, lineHeight: 21 }}>
          Consultez notre{' '}
          <Text onPress={() => ouvrir('/politique-de-confidentialite')} style={{ color: '#059669', fontWeight: '800' }}>
            Politique de confidentialité
          </Text>
          . Appuyez sur « Accepter et continuer » pour accepter nos{' '}
          <Text onPress={() => ouvrir('/conditions')} style={{ color: '#059669', fontWeight: '800' }}>
            Conditions d&apos;utilisation
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}
