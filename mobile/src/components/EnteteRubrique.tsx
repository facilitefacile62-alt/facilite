import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import FaciliteHeader from '@/components/FaciliteHeader';

// En-tête commun des rubriques du profil (maquettes 47 à 56) : l'en-tête
// Facilité, puis chevron de retour + titre, puis un filet. Les dix
// maquettes de rubrique montrent toutes l'en-tête Facilité au-dessus du
// titre — il est donc rendu ici, une fois, plutôt que recopié par écran.
//
// Le retour suit la pile d'historique (charte §1.5) et retombe sur le hub
// « Modifier infos » si la pile est vide (ouverture directe par lien).
export default function EnteteRubrique({ titre }: { titre: string }) {
  const router = useRouter();
  return (
    <>
      <FaciliteHeader />
      <View className="flex-row items-center gap-2.5 px-5 py-4">
        <Pressable
          accessibilityLabel="Retour"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/mon-profil/a-propos'))}>
          <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-[#1A1A1A]">{titre}</Text>
      </View>
      <View className="h-px bg-black/[0.08] mx-5 mb-3.5" />
    </>
  );
}
