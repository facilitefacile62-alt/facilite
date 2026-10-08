import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Onboarding — Bienvenue (maquette « Onboarding — Bienvenue ») : choix de
// l'univers. Écran accessible mais pas encore inséré dans le parcours
// d'inscription obligatoire (AuthGate) — voir la note dans le rapport final :
// ce branchement touche la connexion de tous les comptes, décision à part.
const VERT_PROFOND = '#0d3b34';

export default function OnboardingBienvenueScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1 items-center" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: '#D7F2EA' }}>
            <Ionicons name="key-outline" size={28} color={VERT_PROFOND} />
          </View>
          <Text className="text-[21px] font-black text-[#1A1A1A] text-center">Bienvenue sur Facilité !</Text>
          <Text className="text-[13.5px] text-gray-500 text-center px-4">
            Par quel univers voulez-vous commencer ? Vous pourrez changer à tout moment.
          </Text>
        </View>

        <View className="w-full px-5 pb-8 gap-3">
          <Pressable
            onPress={() => router.push('/onboarding/document' as Href)}
            className="rounded-2xl p-5"
            style={{ backgroundColor: VERT_PROFOND }}>
            <Ionicons name="briefcase-outline" size={22} color="#6ee7c9" />
            <Text className="text-white text-[16px] font-black mt-2">Facilité</Text>
            <Text className="text-white/80 text-[12.5px] mt-0.5">Recherche d&apos;emploi et candidatures</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/onboarding/role' as Href)}
            className="rounded-2xl p-5 border-2"
            style={{ borderColor: VERT_PROFOND }}>
            <Ionicons name="storefront-outline" size={22} color={VERT_PROFOND} />
            <Text className="text-[#1A1A1A] text-[16px] font-black mt-2">Facilité Business</Text>
            <Text className="text-gray-500 text-[12.5px] mt-0.5">Achetez et vendez sur la marketplace</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
