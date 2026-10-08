import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { chargerDiscussionsMarketplace, type DiscussionMarketplace } from '@/lib/messagesMarketplace';

// « Messages » de la plateforme Marketplace (maquette « Marketplace — Discussions »).
// Séparées des messages Facilité : seules les conversations marquées MARKETPLACE sont listées.
const VERT_PROFOND = '#0d3b34';

type Filtre = 'toutes' | 'non_lues';

function LigneDiscussion({ discussion, onPress }: { discussion: DiscussionMarketplace; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3 border-b border-black/[0.05] active:bg-gray-50">
      <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: VERT_PROFOND }}>
        <Text className="text-white text-[15px] font-black">{discussion.initiale}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className={`flex-1 text-[14px] text-[#1A1A1A] ${discussion.nonLue ? 'font-black' : 'font-bold'}`} numberOfLines={1}>
            {discussion.nom}
          </Text>
          <Text className="text-[11px] text-gray-500">{discussion.date}</Text>
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-[12.5px] text-gray-600" numberOfLines={1}>
            {discussion.dernierMessage || 'Aucun message'}
          </Text>
          {discussion.nonLue ? <View className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesMarketplaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [discussions, setDiscussions] = useState<DiscussionMarketplace[]>([]);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('toutes');

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      setDiscussions(await chargerDiscussionsMarketplace(userId));
    } catch (e) {
      Alert.alert('Messages', e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  const affichees = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    return discussions.filter(
      (d) => (filtre === 'toutes' || d.nonLue) && (!texte || d.nom.toLowerCase().includes(texte))
    );
  }, [discussions, filtre, recherche]);

  const nonLues = discussions.filter((d) => d.nonLue).length;

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-[20px] font-black text-[#1A1A1A]">Discussions</Text>
            {nonLues > 0 ? (
              <View className="rounded-full bg-[#10B981] px-2 py-0.5">
                <Text className="text-[11px] font-black text-white">{nonLues}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => Alert.alert('Nouvelle discussion', 'Ouvrez un article pour discuter avec son vendeur.')}
            accessibilityLabel="Nouvelle discussion"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="create-outline" size={18} color="#1A1A1A" />
          </Pressable>
        </View>

        {!userId ? (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour voir vos discussions.</Text>
            <Pressable onPress={() => router.push('/login')} className="rounded-2xl px-6 py-3" style={{ backgroundColor: VERT_PROFOND }}>
              <Text className="text-white text-[14px] font-bold">Se connecter</Text>
            </Pressable>
          </View>
        ) : chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={affichees}
            keyExtractor={(d) => d.id}
            refreshControl={
              <RefreshControl
                refreshing={rafraichissement}
                onRefresh={() => {
                  setRafraichissement(true);
                  recharger();
                }}
                tintColor="#10B981"
              />
            }
            ListHeaderComponent={
              <View className="px-4 pb-3 gap-3">
                <View className="flex-row items-center gap-2 bg-[#F2F0EA] rounded-full px-4 py-2.5">
                  <Ionicons name="search" size={16} color="#6B7280" />
                  <TextInput
                    value={recherche}
                    onChangeText={setRecherche}
                    placeholder="Rechercher ou démarrer une discussion..."
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 text-[13.5px] text-[#1A1A1A] p-0"
                  />
                </View>
                <View className="flex-row gap-2">
                  {(['toutes', 'non_lues'] as const).map((f) => {
                    const actif = filtre === f;
                    return (
                      <Pressable
                        key={f}
                        onPress={() => setFiltre(f)}
                        className={`rounded-full px-3.5 py-1.5 border ${actif ? 'border-[#0d3b34] bg-[#0d3b34]' : 'border-gray-300 bg-white'}`}>
                        <Text className={`text-[12px] font-bold ${actif ? 'text-white' : 'text-gray-700'}`}>
                          {f === 'toutes' ? 'Toutes' : 'Non lues'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center pt-16 gap-2 px-8">
                <Ionicons name="chatbubbles-outline" size={36} color="#9CA3AF" />
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Aucune discussion</Text>
                <Text className="text-[12px] text-gray-500 text-center">
                  Ouvrez un article et touchez « Discuter » pour écrire au vendeur.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <LigneDiscussion
                discussion={item}
                onPress={() =>
                  router.push(`/marketplace/chat/${item.id}?contexte=marketplace&nom=${encodeURIComponent(item.nom)}` as Href)
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
