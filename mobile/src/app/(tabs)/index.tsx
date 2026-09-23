import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import FaciliteHeader from '@/components/FaciliteHeader';
import { IconEnvoyer, IconPartager } from '@/components/facilite-icons';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles, type OffreReelle } from '@/lib/useOffresReelles';

const MODELES_CV = [
  { id: 'moderne', label: 'Moderne', template: 'modern', icone: 'sparkles', gradient: ['#2563EB', '#1D4ED8'], border: '#2563EB' },
  { id: 'minimaliste', label: 'Minimaliste', template: 'minimalist', icone: 'document-text', gradient: ['#10B981', '#059669'], border: '#10B981' },
  { id: 'classique', label: 'Classique', template: 'classic', icone: 'school', gradient: ['#8B5CF6', '#6D28D9'], border: '#8B5CF6' },
  { id: 'canadien', label: 'Canadien', template: 'canadian', icone: 'globe-outline', gradient: ['#EF4444', '#B91C1C'], border: '#EF4444' },
  { id: 'creatif', label: 'Créatif', template: 'creative', icone: 'color-palette', gradient: ['#EC4899', '#BE185D'], border: '#EC4899' },
  { id: 'executive', label: 'Executive', template: 'executive', icone: 'briefcase', gradient: ['#F59E0B', '#B45309'], border: '#F59E0B' },
];

export default function AccueilScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [limite, setLimite] = useState(30);
  const { offres, erreur } = useOffresReelles(limite);
  const [rafraichissement, setRafraichissement] = useState(false);
  const candidateMatchScores = useCandidateMatchScores(user?.id);

  const rechargerFlux = async () => {
    setRafraichissement(true);
    setLimite((n) => n);
    setTimeout(() => setRafraichissement(false), 800);
  };

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        {offres === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" size="large" />
            <Text className="text-[12px] text-black/50 font-medium mt-3">Chargement des offres en direct…</Text>
          </View>
        ) : erreur ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline-outline" size={32} color="rgba(0,0,0,0.3)" />
            <Text className="text-[13px] text-black/60 font-medium mt-3 text-center">
              Impossible de charger les offres pour le moment.
            </Text>
            <Pressable onPress={rechargerFlux} className="mt-4 px-5 py-2.5 rounded-full bg-blue-600 active:opacity-90">
              <Text className="text-white text-[13px] font-bold">Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={offres}
            keyExtractor={(item) => item.id}
            contentContainerClassName="pb-10"
            showsVerticalScrollIndicator={false}
            refreshing={rafraichissement}
            onRefresh={rechargerFlux}
            ListHeaderComponent={
              <View>
                {/* Carrousel Stories : Modèles de CV interactifs */}
                <View className="bg-white mx-3 mt-2.5 mb-3 rounded-2xl p-2.5 border border-gray-200 shadow-xs">
                  <Text className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1 mb-2">
                    Créer mon CV · Modèles Recommandés
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-1 pb-1">
                    {MODELES_CV.map((modele) => (
                      <Pressable
                        key={modele.id}
                        onPress={() =>
                          router.push({ pathname: '/web/[cle]', params: { cle: 'creer-cv', template: modele.template } })
                        }
                        className="items-center gap-1.5 active:scale-95">
                        <View
                          className="w-14 h-14 rounded-full p-0.5 items-center justify-center border-2"
                          style={{ borderColor: modele.border }}>
                          <LinearGradient
                            colors={modele.gradient as [string, string]}
                            className="w-full h-full rounded-full items-center justify-center shadow-xs">
                            <Ionicons name={modele.icone as any} size={22} color="#FFFFFF" />
                          </LinearGradient>
                        </View>
                        <Text className="text-[11px] font-bold text-gray-800">{modele.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Entrée du Marketplace natif */}
                <Pressable onPress={() => router.push('/marketplace')} className="mx-3 mb-3 active:opacity-90">
                  <LinearGradient
                    colors={['#0d3b34', '#0f4f42']}
                    className="rounded-2xl px-4 py-3.5 flex-row items-center gap-3 overflow-hidden shadow-sm">
                    <View className="w-11 h-11 rounded-xl bg-white/[0.14] items-center justify-center">
                      <Ionicons name="storefront" size={22} color="#6ee7c9" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10.5px] font-bold tracking-widest text-[#6ee7c9]">MARKETPLACE</Text>
                      <Text className="text-white text-[15px] font-extrabold mt-0.5">Achetez et vendez près de chez vous</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6ee7c9" />
                  </LinearGradient>
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              <View className="bg-white mx-3 rounded-2xl p-8 items-center border border-gray-200">
                <Ionicons name="briefcase-outline" size={32} color="#9CA3AF" />
                <Text className="text-[13px] text-gray-500 font-medium text-center mt-2">
                  Aucune offre active pour l&apos;instant.
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => (
              <CarteOffre offre={item} matchScore={candidateMatchScores?.[item.id] ?? null} />
            )}
            ListFooterComponent={
              offres.length > 0 ? (
                <View className="flex-row items-center justify-center gap-2 py-5">
                  <Text className="text-black/40 text-[12px] font-semibold">
                    {offres.length} offre{offres.length > 1 ? 's' : ''} disponible{offres.length > 1 ? 's' : ''} en direct
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function CarteOffre({ offre, matchScore }: { offre: OffreReelle; matchScore: number | null }) {
  const router = useRouter();
  const [aime, setAime] = useState(false);

  const partager = async () => {
    try {
      const url = `https://ffacilite.com/offres/${offre.id}`;
      await Share.share({
        title: offre.titre,
        message: `Découvrez cette offre d'emploi sur Facilité :\n${offre.titre} chez ${offre.entreprise} (${offre.localisation})\n\nPostulez ici : ${url}`,
        url,
      });
    } catch {}
  };

  return (
    <Pressable
      onPress={() => router.push(`/offre/${offre.id}`)}
      className="bg-white mx-3 rounded-2xl p-4 border border-gray-200 shadow-xs active:opacity-95">
      {/* En-tête : Logo entreprise réel ou Avatar coloré + Nom + Date */}
      <View className="flex-row items-center gap-3">
        {offre.posterUri ? (
          <Image
            source={{ uri: offre.posterUri }}
            alt={offre.entreprise}
            style={{ width: 44, height: 44, borderRadius: 12 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className={`w-11 h-11 rounded-xl ${offre.logoTeinte} items-center justify-center shadow-xs`}>
            <Text className="text-white font-black text-[14px]">{offre.logoInitiales}</Text>
          </View>
        )}
        <View className="flex-1 min-w-0">
          <Text className="text-[14.5px] font-bold text-blue-600" numberOfLines={1}>
            {offre.entreprise}
          </Text>
          <Text className="text-[11.5px] text-black/45 mt-0.5">{offre.date}</Text>
        </View>
      </View>

      {/* Badge Matching IA */}
      <View className="mt-2.5">
        <BadgeMatchingOffre score={matchScore} />
      </View>

      {/* Titre & Localisation & Contrat */}
      <Text className="text-[16px] font-extrabold text-[#1A1A1A] leading-5 mt-1.5">{offre.titre}</Text>
      <Text className="text-[12.5px] text-black/60 mt-1.5 font-medium">
        💼 {offre.localisation} · {offre.contrat} {offre.salaire ? `· 💰 ${offre.salaire}` : ''}
      </Text>

      {/* Affiche de l'offre si présente */}
      {offre.posterUri ? (
        <Image
          source={{ uri: offre.posterUri }}
          alt={`Affiche : ${offre.titre}`}
          contentFit="cover"
          transition={150}
          className="w-full h-48 rounded-xl bg-black/5 mt-3"
        />
      ) : null}

      {/* Boutons d'Action Connectés */}
      <View className="flex-row gap-2 mt-3.5 items-center">
        {/* Like */}
        <Pressable
          onPress={() => setAime(!aime)}
          className={`w-[40px] h-[40px] rounded-full border-[1.5px] items-center justify-center transition active:scale-90 ${
            aime ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
          }`}>
          <Ionicons name={aime ? 'heart' : 'heart-outline'} size={19} color={aime ? '#EF4444' : '#6B7280'} />
        </Pressable>

        {/* Partager universel */}
        <Pressable
          onPress={partager}
          className="w-[40px] h-[40px] rounded-full border-[1.5px] border-gray-200 bg-gray-50 items-center justify-center active:scale-90">
          <IconPartager />
        </Pressable>

        {/* Postuler en direct */}
        <Pressable
          onPress={() => router.push(`/offre/${offre.id}`)}
          className="flex-1 bg-blue-600 active:bg-blue-700 rounded-full flex-row items-center justify-center gap-2 py-2.5 shadow-sm active:scale-98">
          <IconEnvoyer />
          <Text className="text-white text-[14px] font-bold">Postuler via Facilité</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
