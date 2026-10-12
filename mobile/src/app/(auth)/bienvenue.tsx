import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoCle, VERT_BANDEAU, CREME } from '@/components/EcranConnexion';
import { lireLangue, libelleLangue, marquerBienvenueVue, type CodeLangue } from '@/lib/preferencesConnexion';
import { SITE_URL } from '@/lib/webEcrans';

// Bienvenue — écran 01, montré UNIQUEMENT au tout premier lancement.
// Mise à jour du 12/10/2026 (elle l'emporte sur l'image 01) : bandeau vert
// foncé #0B3D2A (≈ 330 px) avec le titre « Bienvenue sur ffacilite » en blanc
// AU-DESSUS du grand logo clé (halo 150 px → disque 104 px → clé), puis la
// feuille crème : « Accepter et continuer », sélecteur de langue et, tout en
// bas, la phrase d'acceptation avec ses deux liens vers les pages légales.
// L'image 01 montrait encore l'illustration des cinq personnages sous un titre
// vert foncé : elle est remplacée par le logo ; l'emplacement d'une image
// d'arrière-plan du bandeau est prévu (BANDEAU_IMAGE), à fournir plus tard.
const BANDEAU_IMAGE: number | null = null;

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
    <View className="flex-1" style={{ backgroundColor: VERT_BANDEAU }}>
      <View className="items-center justify-center" style={{ paddingTop: insets.top, height: insets.top + 330 - 28 }}>
        {BANDEAU_IMAGE ? (
          <Image alt="" source={BANDEAU_IMAGE} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : null}
        <Text className="text-[24px] font-bold text-center text-white" style={{ marginBottom: 22 }}>
          Bienvenue sur ffacilite
        </Text>
        <LogoCle taille={150} />
      </View>

      <View className="flex-1 px-7" style={{ backgroundColor: CREME, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 30 }}>
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
