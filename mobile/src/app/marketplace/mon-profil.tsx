import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import BoutonAction from '@/components/BoutonAction';
import { useAuth } from '@/context/AuthContext';

// Profil visiteur détaillé (maquette 33) : on y arrive en touchant la carte
// d'identité du profil Marketplace (59). Couverture et photo restent des
// emplacements vides tant que le compte n'a pas de visuels ; « Modifier le
// profil » ouvre l'écran 34. La ligne « Devenir Vendeur » et la carte du bas
// mènent au parcours de création de boutique.
//
// Non repris : la ligne « Commerce & Vente au détail » (catégorie) — un
// visiteur n'a pas de catégorie, c'est un champ de boutique.
export default function MonProfilVisiteurScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const nom = (profile?.full_name as string | undefined) || user?.email || 'Mon compte';
  const bio = (profile?.bio as string | undefined) || '';
  const initiale = nom.trim().charAt(0).toUpperCase() || '?';

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace/profil' as Href);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 12, paddingBottom: 28, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View className="bg-white overflow-hidden" style={{ borderRadius: 22 }}>
          <View style={{ height: 130, backgroundColor: '#D8D2C4', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
              {Array.from({ length: 30 }, (_, i) => (
                <Line key={i} x1={i * 26 - 130} y1={130} x2={i * 26} y2={0} stroke="#CFC8B8" strokeWidth={9} />
              ))}
            </Svg>
            <Ionicons name="image-outline" size={26} color="#8A8272" />
            <Text className="text-[13px] font-black mt-1" style={{ color: '#7A7466' }}>Photo de couverture</Text>
            <Pressable
              onPress={retour}
              accessibilityLabel="Retour"
              className="absolute items-center justify-center bg-white"
              style={{ top: 10, left: 10, width: 40, height: 40, borderRadius: 20 }}>
              <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
            </Pressable>
          </View>

          <View className="px-4 pb-4">
            <View
              className="items-center justify-center"
              style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: '#E4DED2', borderWidth: 4, borderColor: '#FFFFFF', marginTop: -36 }}>
              <Text className="text-[26px] font-black text-[#1A1A1A]">{initiale}</Text>
            </View>

            <View className="flex-row items-center gap-2 flex-wrap mt-2">
              <Text className="text-[22px] font-black text-[#1A1A1A]">{nom}</Text>
              <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F5D68A' }}>
                <Text className="text-[11px] font-black tracking-wide text-[#B45309]">VISITEUR</Text>
              </View>
            </View>
            {bio ? <Text className="text-[13.5px] mt-1.5" style={{ color: 'rgba(0,0,0,0.55)' }}>{bio}</Text> : null}

            <Pressable
              onPress={() => router.push('/marketplace/modifier-profil' as Href)}
              className="flex-row items-center justify-center gap-2 mt-4"
              style={{ height: 52, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
              <Ionicons name="pencil" size={14} color="#1A1A1A" />
              <Text className="text-[14.5px] font-black text-[#1A1A1A]">Modifier le profil</Text>
            </Pressable>
          </View>

          <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          <View className="p-3 gap-1">
            <Pressable
              onPress={() => router.push('/marketplace/vendre' as Href)}
              className="flex-row items-center gap-3"
              style={{ backgroundColor: '#ECFDF5', borderRadius: 14, borderWidth: 1, borderColor: '#A7F3D0', padding: 14 }}>
              <Ionicons name="storefront" size={18} color="#047857" />
              <Text className="text-[15px] font-black" style={{ color: '#047857' }}>Devenir Vendeur</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/web/faq' as Href)} className="flex-row items-center gap-3" style={{ padding: 14 }}>
              <Ionicons name="help-circle-outline" size={20} color="#1A1A1A" />
              <Text className="text-[15px] font-black text-[#1A1A1A]">Foire aux questions</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/marketplace/reglages' as Href)} className="flex-row items-center gap-3" style={{ padding: 14 }}>
              <Ionicons name="settings-outline" size={19} color="#1A1A1A" />
              <Text className="text-[15px] font-black text-[#1A1A1A]">Réglages</Text>
            </Pressable>
          </View>
        </View>

        <View className="bg-white items-center" style={{ borderRadius: 22, padding: 22 }}>
          <View className="items-center justify-center" style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: '#ECFDF5' }}>
            <Ionicons name="storefront" size={26} color="#047857" />
          </View>
          <Text className="text-[18px] font-black text-[#1A1A1A] text-center mt-4">Devenez vendeur pour publier vos articles</Text>
          <Text className="text-[13.5px] text-center mt-2" style={{ color: 'rgba(0,0,0,0.5)', lineHeight: 20 }}>
            Vous naviguez pour l&apos;instant en tant que visiteur. Créez votre boutique (
            <Text style={{ color: '#2563EB' }}>nom</Text>, <Text style={{ color: '#2563EB' }}>contact</Text> et{' '}
            <Text style={{ color: '#2563EB' }}>position</Text>) pour commencer à publier.
          </Text>
          <View className="w-full mt-4">
            <BoutonAction titre="Devenir Vendeur" sousTitre="Créer ma boutique" icone="storefront-outline" onPress={() => router.push('/marketplace/vendre' as Href)} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
