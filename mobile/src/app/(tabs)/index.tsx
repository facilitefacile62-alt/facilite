import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import FaciliteHeader from '@/components/FaciliteHeader';
import { IconEnvoyer, IconPartager, IconPouceLeve } from '@/components/facilite-icons';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles, type OffreReelle } from '@/lib/useOffresReelles';

// Reproduction pixel-perfect de design_handoff_facilite/pages/01-accueil.html
// (thème clair #FAF6F1, cartes blanches, palette Bleu Royal/Vert Menthe du
// handoff) — remplace la précédente version en thème sombre de cet écran,
// direction supplantée par ce dossier de design "hifi" fourni pour l'app
// mobile. Données réelles conservées (useOffresReelles,
// useCandidateMatchScores) : le handoff ne fixe que la mise en page, pas
// les libellés d'annonces d'exemple qu'il contient (README : "Aucune image
// réelle... placeholders").
const MODELES = [
  { id: 'moderne', label: 'Moderne' },
  { id: 'minimaliste', label: 'Minimaliste' },
  { id: 'classique', label: 'Classique' },
];

export default function AccueilScreen() {
  const { user } = useAuth();
  const { offres, erreur } = useOffresReelles();
  const candidateMatchScores = useCandidateMatchScores(user?.id);

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        {offres === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" />
            <Text className="text-[12px] text-black/50 font-medium mt-3">Chargement des offres…</Text>
          </View>
        ) : erreur ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline-outline" size={28} color="rgba(0,0,0,0.3)" />
            <Text className="text-[12.5px] text-black/50 font-medium mt-3 text-center">
              Impossible de charger les offres pour le moment.
            </Text>
          </View>
        ) : (
          <FlatList
            data={offres}
            keyExtractor={(item) => item.id}
            contentContainerClassName="pb-8"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View className="bg-white mx-3 mt-2.5 mb-3 rounded-2xl px-3 py-3.5 flex-row gap-4 border border-gray-200 shadow-xs">
                {MODELES.map((modele) => (
                  <View key={modele.id} className="items-center gap-1.5">
                    <View className="w-14 h-14 rounded-full border-[2.5px] border-blue-600 p-0.5">
                      <View className="w-full h-full rounded-full bg-[#e8c77a]" />
                    </View>
                    <Text className="text-[11px] font-semibold text-blue-600">{modele.label}</Text>
                  </View>
                ))}
              </View>
            }
            ListEmptyComponent={
              <Text className="text-[12.5px] text-black/40 font-medium text-center mt-10">
                Aucune offre active pour l&apos;instant.
              </Text>
            }
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => (
              <CarteOffre offre={item} matchScore={candidateMatchScores?.[item.id] ?? null} />
            )}
            ListFooterComponent={
              offres.length > 0 ? (
                <View className="flex-row items-center justify-center gap-2 py-5">
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text className="text-black/40 text-[12.5px]">Chargement de nouvelles offres…</Text>
                </View>
              ) : null
            }
          />
        )}

        <Pressable className="absolute right-4 bottom-4 w-[52px] h-[52px] rounded-full overflow-hidden shadow-lg">
          <LinearGradient
            colors={['#10B981', '#0ea975']}
            className="w-full h-full items-center justify-center">
            <Ionicons name="mic-outline" size={22} color="#fff" />
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function CarteOffre({ offre, matchScore }: { offre: OffreReelle; matchScore: number | null }) {
  return (
    <View className="bg-white mx-3 rounded-2xl p-3.5 border border-gray-200 shadow-xs">
      <View className="flex-row items-center gap-2.5">
        <View className="w-[38px] h-[38px] rounded-[10px] bg-[#E5E2DA]" />
        <View className="flex-1">
          <Text className="text-[14px] font-bold text-blue-600" numberOfLines={1}>
            {offre.entreprise}
          </Text>
          <Text className="text-[11.5px] text-black/45 mt-0.5">{offre.date}</Text>
        </View>
      </View>

      <View className="mt-2.5">
        <BadgeMatchingOffre score={matchScore} />
      </View>

      <Text className="text-[15.5px] font-extrabold text-[#1A1A1A] leading-5 mt-1">{offre.titre}</Text>
      <Text className="text-[12.5px] text-black/55 mt-1.5">
        💼 {offre.localisation} · Opportunité · {offre.contrat}
      </Text>

      {offre.posterUri ? (
        <Image
          source={{ uri: offre.posterUri }}
          alt={`Affiche de l'offre : ${offre.titre}`}
          contentFit="cover"
          transition={150}
          className="w-full h-48 rounded-xl bg-black/5 mt-3"
        />
      ) : null}

      <View className="flex-row gap-2 mt-3">
        <View className="w-[38px] h-[38px] rounded-full border-[1.5px] border-black/10 items-center justify-center">
          <IconPouceLeve />
        </View>
        <View className="w-[38px] h-[38px] rounded-full border-[1.5px] border-black/10 items-center justify-center">
          <IconPartager />
        </View>
        <Pressable className="flex-1 bg-blue-600 rounded-full flex-row items-center justify-center gap-2">
          <IconEnvoyer />
          <Text className="text-white text-[14px] font-bold">Postuler via Facilité</Text>
        </Pressable>
      </View>
    </View>
  );
}
