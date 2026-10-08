import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Onboarding — Choix du rôle Marketplace (maquette « Onboarding — Rôle Marketplace »).
const VERT_PROFOND = '#0d3b34';

export default function OnboardingRoleScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1 items-center justify-center px-6 gap-3" edges={['top', 'bottom']}>
        <Text className="text-[21px] font-black text-[#1A1A1A] text-center">Facilité Business</Text>
        <Text className="text-[13px] text-gray-500 text-center -mt-1">Comment comptez-vous utiliser la Marketplace ?</Text>

        <View className="w-full gap-3 mt-4">
          <Pressable
            onPress={() => router.push('/onboarding/profil-express' as Href)}
            className="flex-row items-center gap-3 rounded-2xl border-2 p-4"
            style={{ borderColor: VERT_PROFOND }}>
            <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: '#D7F2EA' }}>
              <Ionicons name="bag-outline" size={20} color={VERT_PROFOND} />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-black text-[#1A1A1A]">Je suis Visiteur</Text>
              <Text className="text-[12px] text-gray-500 mt-0.5">Pour découvrir, acheter et commander des produits</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/onboarding/infos-vendeur' as Href)}
            className="flex-row items-center gap-3 rounded-2xl p-4"
            style={{ backgroundColor: VERT_PROFOND }}>
            <View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center">
              <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-black text-white">Je suis Vendeur</Text>
              <Text className="text-[12px] text-white/80 mt-0.5">Pour créer ma boutique et vendre mes articles</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
