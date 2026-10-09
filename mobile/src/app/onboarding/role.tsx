import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import BandeauOnboarding from '@/components/BandeauOnboarding';

// Onboarding 25 — Facilité Business : Visiteur ou Vendeur. Illustration
// onboarding-business.jpg centrée à 40 %.
export default function OnboardingRoleScreen() {
  const router = useRouter();

  return (
    <BandeauOnboarding image={require('../../../assets/images/onboarding/onboarding-business.jpg')} centrage={40} retour>
      <Text className="text-[24px] font-bold text-[#111] text-center">Facilité Business</Text>
      <Text className="text-[14.5px] text-center mt-2 mb-5" style={{ color: 'rgba(0,0,0,0.5)' }}>
        Comment comptez-vous utiliser la Marketplace ?
      </Text>
      <View className="gap-3">
        <Pressable
          onPress={() => router.push('/onboarding/profil-express' as Href)}
          className="items-center rounded-[16px] py-3 bg-white"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }}>
          <Text className="text-[16px] font-black text-[#111]">Je suis Visiteur</Text>
          <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>Pour découvrir, acheter et commander des produits</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/onboarding/infos-vendeur' as Href)}
          className="items-center rounded-[16px] py-3"
          style={{ backgroundColor: '#10E58A', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
          <Text className="text-[16px] font-black text-[#111]">Je suis Vendeur</Text>
          <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.6)' }}>Pour créer ma boutique et vendre mes articles</Text>
        </Pressable>
      </View>
    </BandeauOnboarding>
  );
}
