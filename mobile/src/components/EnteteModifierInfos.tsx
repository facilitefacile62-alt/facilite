import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import FaciliteHeader from '@/components/FaciliteHeader';

// En-tête de « Modifier infos » (maquettes 40 et 41) : l'en-tête Facilité,
// la ligne « ← Retour  Modifier infos », puis les trois onglets
// À propos · Scanner (pastille verte) · Paramètres. L'onglet actif est
// souligné et en gras.
export default function EnteteModifierInfos({ actif }: { actif: 'apropos' | 'parametres' }) {
  const router = useRouter();
  return (
    <>
      <FaciliteHeader />
      <View className="flex-row items-center gap-3 px-4 py-3.5">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profil'))}
          accessibilityLabel="Retour"
          className="flex-row items-center gap-2 bg-white"
          style={{ borderRadius: 24, paddingHorizontal: 16, height: 46, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
          <Ionicons name="arrow-back" size={15} color="#2563EB" />
          <Text className="text-[14px] font-black text-[#1A1A1A]">Retour</Text>
        </Pressable>
        <Text className="text-[20px] font-black text-[#1A1A1A]">Modifier infos</Text>
      </View>

      <View className="flex-row items-center px-4 gap-5" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' }}>
        <Pressable
          onPress={() => router.replace('/mon-profil/a-propos' as Href)}
          style={{ paddingBottom: 10, borderBottomWidth: actif === 'apropos' ? 2 : 0, borderBottomColor: '#1A1A1A', marginBottom: -1 }}>
          <Text
            className="text-[15px]"
            style={{ fontWeight: actif === 'apropos' ? '900' : '700', color: actif === 'apropos' ? '#1A1A1A' : 'rgba(0,0,0,0.45)' }}>
            À propos
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/mon-profil/scanner-document')}
          className="flex-row items-center gap-2"
          style={{ backgroundColor: '#10E58A', borderRadius: 22, paddingHorizontal: 16, height: 42, marginBottom: 8 }}>
          <Ionicons name="scan-outline" size={16} color="#1A1A1A" />
          <Text className="text-[14px] font-black text-[#1A1A1A]">Scanner</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/mon-profil/parametres' as Href)}
          style={{ paddingBottom: 10, borderBottomWidth: actif === 'parametres' ? 2 : 0, borderBottomColor: '#1A1A1A', marginBottom: -1 }}>
          <Text
            className="text-[15px]"
            style={{ fontWeight: actif === 'parametres' ? '900' : '700', color: actif === 'parametres' ? '#1A1A1A' : 'rgba(0,0,0,0.45)' }}>
            Paramètres
          </Text>
        </Pressable>
      </View>
    </>
  );
}
