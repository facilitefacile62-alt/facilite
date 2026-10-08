import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Onboarding — « Un dernier détail » (maquette « Onboarding — Choix du
// document ») : après avoir choisi Facilité, propose d'ajouter un document
// avant l'accueil. « + Ajouter mes documents » ouvre le vrai scan de document
// (mon-profil/scanner-document.tsx — photo, galerie ou fichier, analysé puis
// pré-remplit le profil), pas une zone de dépôt qui ne ferait rien.
const VERT_PROFOND = '#0d3b34';

export default function OnboardingDocumentScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1 justify-center px-6 gap-3" edges={['top', 'bottom']}>
        <View className="items-center gap-3 mb-2">
          <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: '#D7F2EA' }}>
            <Ionicons name="document-text-outline" size={28} color={VERT_PROFOND} />
          </View>
          <Text className="text-[19px] font-black text-[#1A1A1A] text-center">Un dernier détail</Text>
          <Text className="text-[13px] text-gray-500 text-center px-4">
            Ajoutez votre CV ou une lettre de motivation : vos candidatures iront plus vite.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/mon-profil/scanner-document')}
          className="flex-row items-center justify-center gap-2 rounded-2xl py-3.5 mt-2"
          style={{ backgroundColor: VERT_PROFOND }}>
          <Ionicons name="add" size={18} color="#6ee7c9" />
          <Text className="text-white text-[14.5px] font-bold">Ajouter mes documents</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/')} className="items-center py-3" hitSlop={8}>
          <Text className="text-[13px] font-bold text-gray-500">Passer cette étape ›</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
