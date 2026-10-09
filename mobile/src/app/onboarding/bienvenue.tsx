import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import BandeauOnboarding from '@/components/BandeauOnboarding';

// Onboarding 23 — Bienvenue : choix de l'univers. Illustration
// onboarding-hero.jpg centrée à 30 %.
const VERT_VIF = '#10E58A';

export default function OnboardingBienvenueScreen() {
  const router = useRouter();

  return (
    <BandeauOnboarding image={require('../../../assets/images/onboarding/onboarding-hero.jpg')} centrage={30}>
      <Text className="text-[26px] font-black text-[#111] text-center">Bienvenue sur Facilité !</Text>
      <Text className="text-[14.5px] text-center mt-2 mb-5" style={{ color: 'rgba(0,0,0,0.5)' }}>
        Par quel univers voulez-vous commencer ? Vous pourrez changer à tout moment.
      </Text>
      <View className="gap-3">
        <Pressable
          onPress={() => router.push('/onboarding/document' as Href)}
          className="items-center rounded-[16px] py-3"
          style={{ backgroundColor: VERT_VIF, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
          <Text className="text-[16px] font-black text-[#111]">Facilité</Text>
          <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.6)' }}>Recherche d&apos;emploi et candidatures</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/onboarding/role' as Href)}
          className="items-center rounded-[16px] py-3 bg-white"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }}>
          <Text className="text-[16px] font-black text-[#111]">Facilité Business</Text>
          <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>Achetez et vendez sur la marketplace</Text>
        </Pressable>
      </View>
    </BandeauOnboarding>
  );
}
