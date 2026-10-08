import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';

// « À propos » du profil Marketplace (maquette « Visiteur — À propos »).
// Le bouton vert « Devenir Vendeur » n'apparaît que sans boutique ; avec une
// boutique, il ouvre « Ma boutique ».
const VERT = '#10B981';
const VERT_PROFOND = '#0d3b34';

export default function AProposMarketplaceScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const liste = await chargerMesBoutiques(userId);
      setBoutique(liste[0] ?? null);
    } catch {
      setBoutique(null);
    } finally {
      setChargement(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  const nom = (profile?.full_name as string | undefined) || user?.email || 'Mon compte';
  const estVendeur = Boolean(boutique);

  return (
    <View className="flex-1 bg-[#e3dbcc]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/profil'))}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-white/60 items-center justify-center">
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[17px] font-black text-[#1A1A1A]">À propos</Text>
        </View>

        {!userId ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-600 text-center">Connectez-vous pour voir votre profil.</Text>
          </View>
        ) : chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-3 pb-6 gap-3" showsVerticalScrollIndicator={false}>
            <View className="bg-white rounded-2xl overflow-hidden">
              <View className="h-[110px] bg-[#E6DFD0]" />
              <View className="px-4 pb-4 -mt-10 gap-1.5">
                <View className="w-[72px] h-[72px] rounded-full bg-[#D9D2C3] border-4 border-white items-center justify-center">
                  <Text className="text-[22px] font-black text-[#1A1A1A]">{nom.trim().charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-[17px] font-black text-[#1A1A1A]" numberOfLines={1}>
                    {nom}
                  </Text>
                  <View className={`rounded-full px-2 py-0.5 ${estVendeur ? 'bg-[#D1FAE5]' : 'bg-[#FEF3C7]'}`}>
                    <Text className={`text-[10px] font-black tracking-wide ${estVendeur ? 'text-[#047857]' : 'text-[#B45309]'}`}>
                      {estVendeur ? 'BOUTIQUE' : 'VISITEUR'}
                    </Text>
                  </View>
                </View>
                <Text className="text-[12.5px] text-gray-600">
                  {estVendeur ? boutique?.nom : 'Boutique officielle partenaire sur Facilité Sénégal'}
                </Text>
                <Pressable
                  onPress={() => router.push('/marketplace/modifier-profil')}
                  className="self-start flex-row items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 mt-1">
                  <Ionicons name="pencil-outline" size={12} color="#1A1A1A" />
                  <Text className="text-[11.5px] font-bold text-[#1A1A1A]">Modifier le profil</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/marketplace/vendre')}
              className="flex-row items-center gap-3 rounded-2xl px-4 py-4 active:opacity-90"
              style={{ backgroundColor: VERT }}>
              <View className="w-10 h-10 rounded-xl bg-white/25 items-center justify-center">
                <Ionicons name="storefront" size={20} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-black text-white">{estVendeur ? 'Ma boutique' : 'Devenir Vendeur'}</Text>
                <Text className="text-[12px] text-white/90">
                  {estVendeur ? 'Gérer vos articles et vos commandes' : 'Créez votre boutique en 2 étapes'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </Pressable>

            <View className="flex-row gap-2.5">
              <Pressable
                onPress={() => router.push('/web/faq')}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white py-3">
                <Ionicons name="help-circle-outline" size={17} color={VERT_PROFOND} />
                <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Foire aux questions</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/marketplace/reglages')}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white py-3">
                <Ionicons name="settings-outline" size={17} color={VERT_PROFOND} />
                <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Réglages</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
