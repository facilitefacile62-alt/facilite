import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { MESSAGE_ACHAT_INDISPONIBLE } from '@/lib/biensNumeriquesLogique';

// Remplace un écran de paiement de bien numérique sur iOS (règle Apple 3.1.1) : message neutre, SANS prix, SANS bouton d'achat, SANS lien de paiement.
export default function IndisponibleNeutre({ retour }: { retour?: Href }) {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#F2F0EA' }}>
      <View className="items-center" style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#D9D1C1', padding: 24, maxWidth: 360 }}>
        <Ionicons name="information-circle-outline" size={34} color="rgba(0,0,0,0.35)" />
        <Text className="text-[15px] font-bold text-center text-[#1A1A1A] mt-3">{MESSAGE_ACHAT_INDISPONIBLE}</Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : retour ? router.replace(retour) : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          className="items-center justify-center mt-5"
          style={{ minHeight: 48, minWidth: 140, borderRadius: 14, backgroundColor: '#1A1A1A', paddingHorizontal: 20 }}>
          <Text className="text-[14px] font-extrabold text-white">Retour</Text>
        </Pressable>
      </View>
    </View>
  );
}
