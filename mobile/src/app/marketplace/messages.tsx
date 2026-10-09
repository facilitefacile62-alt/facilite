import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { chargerDiscussionsMarketplace, type DiscussionMarketplace } from '@/lib/messagesMarketplace';

// « Messages » de la plateforme Marketplace (maquette « Marketplace — Discussions »).
// Séparées des messages Facilité : seules les conversations marquées MARKETPLACE sont listées.
const VERT_PROFOND = '#0d3b34';

type Filtre = 'toutes' | 'non_lues';

function LigneDiscussion({ discussion, onPress }: { discussion: DiscussionMarketplace; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
      <View className="items-center justify-center rounded-full" style={{ width: 52, height: 52, backgroundColor: '#059669' }}>
        <Text className="text-white text-[17px] font-black">{discussion.initiale}</Text>
      </View>
      <View className="flex-1 min-w-0 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-[15.5px] text-[#1A1A1A] font-black" numberOfLines={1}>
            {discussion.nom}
          </Text>
          <Text className="text-[12px] font-bold" style={{ color: discussion.nonLue ? '#059669' : 'rgba(0,0,0,0.5)' }}>{discussion.date}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          {discussion.dernierEnvoyeParMoi ? (
            <Ionicons name="checkmark-done" size={16} color={discussion.dernierLu ? '#38BDF8' : 'rgba(0,0,0,0.35)'} />
          ) : null}
          <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(0,0,0,0.55)' }} numberOfLines={1}>
            {discussion.dernierMessage || 'Aucun message'}
          </Text>
          {discussion.nonLue ? <View className="rounded-full" style={{ width: 10, height: 10, backgroundColor: '#10B981' }} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  return (
    <View className="flex-1 bg-[#F7F3EC]">
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
          <View className="flex-row items-center gap-2.5">
            <Text className="text-[22px] font-black text-[#1A1A1A]">Discussions</Text>
            {discussions.length > 0 ? (
              <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: '#D1FAE5' }}>
                <Text className="text-[12px] font-black" style={{ color: '#047857' }}>{discussions.length}</Text>
              </View>
            ) : null}
          </View>
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => Alert.alert('Nouvelle discussion', 'Ouvrez un article et touchez « Discuter » pour écrire au vendeur.')}
              accessibilityLabel="Nouvelle discussion"
              hitSlop={8}>
              <Ionicons name="create-outline" size={22} color="#1A1A1A" />
            </Pressable>
            <Pressable onPress={() => Alert.alert('Options', 'Bientôt disponible.')} accessibilityLabel="Options" hitSlop={8}>
              <Ionicons name="ellipsis-vertical" size={20} color="#1A1A1A" />
            </Pressable>
          </View>
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
                <View className="flex-row items-center gap-2.5 bg-white rounded-[18px] px-4" style={{ height: 50, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
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
                        className={`rounded-full px-5 py-2 border ${actif ? 'border-[#111] bg-[#111]' : 'border-gray-200 bg-white'}`}>
                        <Text className={`text-[13px] font-extrabold ${actif ? 'text-white' : 'text-[#1A1A1A]'}`}>
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
      </View>
    </View>
  );
}
