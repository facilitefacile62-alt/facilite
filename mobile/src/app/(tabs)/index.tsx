import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles, type OffreReelle } from '@/lib/useOffresReelles';

// Fil d'actualité natif, branché sur les vraies données (offres réelles +
// score de compatibilité réel) — reproduit la mise en page de ffacilite.com
// en thème sombre dédié avec l'accent Bleu Roi validé pour l'app mobile.
const MODELES: { id: string; label: string; teinte: string }[] = [
  { id: 'moderne', label: 'Moderne', teinte: 'bg-blue-500' },
  { id: 'minimaliste', label: 'Minimaliste', teinte: 'bg-emerald-500' },
  { id: 'classique', label: 'Classique', teinte: 'bg-amber-500' },
];

type NavItem = {
  id: string;
  label: string;
  icone: keyof typeof Ionicons.glyphMap;
  badge?: number;
};

const NAV_RAPIDE: NavItem[] = [
  { id: 'accueil', label: 'Accueil', icone: 'home' },
  { id: 'offres', label: 'Offres', icone: 'briefcase-outline' },
  { id: 'messages', label: 'Messages', icone: 'chatbubble-outline' },
  { id: 'notifications', label: 'Notifs', icone: 'notifications-outline', badge: 2 },
];

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { offres, erreur } = useOffresReelles();
  const candidateMatchScores = useCandidateMatchScores(user?.id);

  const initialeAvatar = (profile?.full_name || user?.email || 'F').charAt(0).toUpperCase();

  return (
    <View className="flex-1 bg-[#0B0F17]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 pt-1 pb-3">
          <Text className="text-lg font-extrabold text-blue-500">Facilité</Text>
          <View className="flex-row items-center gap-3">
            <Pressable className="w-9 h-9 rounded-full bg-[#161E2E] items-center justify-center">
              <Ionicons name="notifications-outline" size={16} color="#94a3b8" />
              <View className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </Pressable>
            <View className="w-9 h-9 rounded-full bg-amber-500 items-center justify-center">
              <Text className="text-xs font-extrabold text-white">{initialeAvatar}</Text>
            </View>
          </View>
        </View>

        <View className="flex-row justify-around border-b border-[#1B2434] pb-3 mb-1 px-2">
          {NAV_RAPIDE.map((item) => (
            <Pressable key={item.id} className="items-center gap-1">
              <View>
                <Ionicons
                  name={item.icone}
                  size={19}
                  color={item.id === 'accueil' ? '#2563EB' : '#94a3b8'}
                />
                {item.badge ? (
                  <View className="absolute -top-1 -right-2 min-w-[13px] h-[13px] px-0.5 rounded-full bg-red-500 items-center justify-center">
                    <Text className="text-[8px] font-bold text-white">{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                className={`text-[9.5px] font-semibold ${
                  item.id === 'accueil' ? 'text-blue-500' : 'text-gray-500'
                }`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {offres === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" />
            <Text className="text-[12px] text-gray-500 font-medium mt-3">Chargement des offres…</Text>
          </View>
        ) : erreur ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline-outline" size={28} color="#3d4a61" />
            <Text className="text-[12.5px] text-gray-400 font-medium mt-3 text-center">
              Impossible de charger les offres pour le moment.
            </Text>
          </View>
        ) : (
          <FlatList
            data={offres}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-4 pb-10"
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View className="h-3" />}
            ListEmptyComponent={
              <Text className="text-[12.5px] text-gray-500 font-medium text-center mt-10">
                Aucune offre active pour l&apos;instant.
              </Text>
            }
            ListHeaderComponent={
              <View className="mb-4">
                <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2.5 mt-1">
                  Modèles de CV
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                  {MODELES.map((modele) => (
                    <View key={modele.id} className="items-center mx-2 w-16">
                      <View
                        className={`w-14 h-14 rounded-full ${modele.teinte} items-center justify-center border-2 border-[#0B0F17]`}>
                        <Ionicons name="document-text-outline" size={20} color="#ffffff" />
                      </View>
                      <Text className="text-[10px] font-semibold text-gray-300 mt-1.5" numberOfLines={1}>
                        {modele.label}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            }
            renderItem={({ item }) => (
              <CarteOffre offre={item} matchScore={candidateMatchScores?.[item.id] ?? null} />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function CarteOffre({ offre, matchScore }: { offre: OffreReelle; matchScore: number | null }) {
  return (
    <View className="bg-[#161E2E] rounded-2xl border border-[#232D40] p-3.5">
      <View className="flex-row items-center gap-2.5 mb-3">
        <View className={`w-9 h-9 rounded-xl ${offre.logoTeinte} items-center justify-center`}>
          <Text className="text-[11px] font-extrabold text-white">{offre.logoInitiales}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[12.5px] font-bold text-white" numberOfLines={1}>
            {offre.entreprise}
          </Text>
          <Text className="text-[10.5px] text-gray-500">{offre.date}</Text>
        </View>
      </View>

      <BadgeMatchingOffre score={matchScore} />

      <Text className="text-[14.5px] font-bold text-white leading-5 mb-2">{offre.titre}</Text>

      <View className="flex-row flex-wrap gap-1.5 mb-3">
        <View className="flex-row items-center gap-1 bg-[#0B0F17] px-2 py-1 rounded-full">
          <Ionicons name="location-outline" size={11} color="#94a3b8" />
          <Text className="text-[10.5px] font-medium text-gray-400">{offre.localisation}</Text>
        </View>
        <View className="flex-row items-center gap-1 bg-[#0B0F17] px-2 py-1 rounded-full">
          <Ionicons name="briefcase-outline" size={11} color="#94a3b8" />
          <Text className="text-[10.5px] font-medium text-gray-400">{offre.contrat}</Text>
        </View>
      </View>

      {offre.posterUri ? (
        <Image
          source={{ uri: offre.posterUri }}
          alt={`Affiche de l'offre : ${offre.titre}`}
          contentFit="cover"
          transition={150}
          className="w-full h-48 rounded-xl bg-[#0B0F17] mb-3.5"
        />
      ) : (
        <View className="rounded-xl bg-[#0B0F17] border border-dashed border-[#232D40] h-36 items-center justify-center mb-3.5">
          <Ionicons name="image-outline" size={22} color="#3d4a61" />
          <Text className="text-[10px] font-medium text-gray-600 mt-1">Affiche du recrutement</Text>
        </View>
      )}

      <Pressable className="flex-row items-center justify-center gap-2 bg-blue-600 rounded-xl py-3 mb-2.5">
        <Ionicons name="send" size={14} color="#ffffff" />
        <Text className="text-[13px] font-bold text-white">Postuler via Facilité</Text>
      </Pressable>

      <View className="flex-row items-center justify-around pt-1">
        <Pressable className="py-1 px-4">
          <Ionicons name="thumbs-up-outline" size={15} color="#94a3b8" />
        </Pressable>
        <Pressable className="py-1 px-4">
          <Ionicons name="share-social-outline" size={15} color="#94a3b8" />
        </Pressable>
        <Pressable className="py-1 px-4">
          <Ionicons name="bookmark-outline" size={15} color="#94a3b8" />
        </Pressable>
      </View>
    </View>
  );
}
