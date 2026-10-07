import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';

// Profil Marketplace (maquettes « Visiteur — Profil » et « Vendeur — Profil »).
// Le badge et les lignes dépendent du rôle : VISITEUR sans boutique, BOUTIQUE avec une boutique.
const VERT_PROFOND = '#0d3b34';

function Ligne({
  icone,
  fondIcone,
  titre,
  droite,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  fondIcone: string;
  titre: string;
  droite?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3.5 border-b border-black/[0.05] active:bg-gray-50">
      <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: fondIcone }}>
        <Ionicons name={icone} size={18} color="#1A1A1A" />
      </View>
      <Text className="flex-1 text-[14.5px] font-bold text-[#1A1A1A]">{titre}</Text>
      {droite ? <Text className="text-[13px] font-extrabold" style={{ color: VERT_PROFOND }}>{droite}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </Pressable>
  );
}

export default function ProfilMarketplaceScreen() {
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
  const telephone = (profile?.phone as string | undefined) || '';
  const initiale = nom.trim().charAt(0).toUpperCase() || '?';
  const estVendeur = Boolean(boutique);

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        {!userId ? (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour voir votre profil Marketplace.</Text>
            <Pressable onPress={() => router.push('/login')} className="rounded-2xl px-6 py-3" style={{ backgroundColor: VERT_PROFOND }}>
              <Text className="text-white text-[14px] font-bold">Se connecter</Text>
            </Pressable>
          </View>
        ) : chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-3 pt-3 pb-6 gap-3" showsVerticalScrollIndicator={false}>
            <View className="bg-white rounded-2xl p-4 flex-row items-center gap-3">
              <View className="w-16 h-16 rounded-full bg-[#E4DED2] items-center justify-center">
                <Text className="text-[22px] font-black text-[#1A1A1A]">{initiale}</Text>
              </View>
              <View className="flex-1">
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
                {telephone ? <Text className="text-[12.5px] text-gray-500 mt-0.5">{telephone}</Text> : null}
              </View>
            </View>

            <View className="bg-white rounded-2xl overflow-hidden">
              <Ligne
                icone="storefront-outline"
                fondIcone="#CCFBF1"
                titre="Ma boutique"
                droite={estVendeur ? boutique?.nom : 'Devenir Vendeur'}
                onPress={() => router.push('/marketplace/vendre')}
              />
              <Ligne icone="information-circle-outline" fondIcone="#F2F0EA" titre="À propos" onPress={() => router.push('/marketplace/a-propos')} />
              <Ligne icone="cube-outline" fondIcone="#F2F0EA" titre="Mes commandes" onPress={() => router.push('/marketplace/commandes')} />
              <Ligne icone="settings-outline" fondIcone="#F2F0EA" titre="Réglages" onPress={() => router.push('/mon-profil/parametres')} />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
