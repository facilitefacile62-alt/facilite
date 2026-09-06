import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import FaciliteHeader from '@/components/FaciliteHeader';
import { IconClotureExpiree, IconDossier, IconEnvoyer, IconEtincelle } from '@/components/facilite-icons';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles, type OffreReelle } from '@/lib/useOffresReelles';
import { supabase } from '@/lib/supabase';

// Reproduction de design_handoff_facilite/pages/03-offres.html. Le handoff
// distingue "Offres disponibles" / "Offres expirées", mais job_offers ne
// modélise pas de statut "expiré" distinct (seulement is_active) : le
// filtre "Expirées" affiche donc honnêtement l'état vide déjà prévu par le
// design plutôt qu'une fausse liste. "Voir plus d'offres" augmente la
// limite réelle demandée à Supabase (pagination simple), pas une donnée
// simulée.
type Filtre = 'disponibles' | 'expirees';
const PAS_PAGINATION = 12;

export default function OffresScreen() {
  const { user } = useAuth();
  const [limite, setLimite] = useState(PAS_PAGINATION);
  const { offres, erreur } = useOffresReelles(limite);
  const candidateMatchScores = useCandidateMatchScores(user?.id);
  const [filtre, setFiltre] = useState<Filtre>('disponibles');
  const [totalDisponibles, setTotalDisponibles] = useState<number | null>(null);

  useEffect(() => {
    let annule = false;
    supabase
      .from('job_offers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => {
        if (!annule) setTotalDisponibles(count ?? null);
      });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader ecranActif="offres" />

        {offres === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : (
          <FlatList
            data={filtre === 'disponibles' ? offres : []}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-3 pb-8"
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View className="h-3.5" />}
            ListHeaderComponent={
              <View className="mb-3">
                <LinearGradient colors={['#0d3b34', '#0f4f42']} className="rounded-2xl p-4 relative overflow-hidden">
                  <View className="absolute top-3.5 right-3.5 w-[34px] h-[34px] rounded-[10px] bg-white/[0.14] items-center justify-center">
                    <IconDossier />
                  </View>
                  <Text className="text-[10.5px] font-bold tracking-widest text-[#6ee7c9]">
                    CATALOGUE DES EMPLOIS
                  </Text>
                  <Text className="text-white text-[18px] font-extrabold mt-1.5 leading-6 max-w-[80%]">
                    Offres d&apos;Emploi Disponibles
                  </Text>
                  <Text className="text-[#d8f3ea] text-[12px] leading-5 mt-1.5 max-w-[85%]">
                    Explorez toutes les opportunités publiées par nos recruteurs au Sénégal et postulez en un
                    clic.
                  </Text>
                </LinearGradient>

                <Pressable
                  onPress={() => Alert.alert('Recherche IA', 'Cette fonctionnalité arrive dans une prochaine mise à jour.')}
                  className="bg-[#6ee7c9] rounded-full py-3.5 items-center mt-3 flex-row justify-center gap-2">
                  <IconEtincelle color="#0d3b34" />
                  <Text className="text-[#0d3b34] text-[14px] font-bold">Recherche IA</Text>
                </Pressable>

                <View className="flex-row gap-2.5 mt-3">
                  <Pressable
                    onPress={() => setFiltre('disponibles')}
                    className={`flex-1 flex-row items-center gap-2 rounded-2xl px-3 py-3 ${
                      filtre === 'disponibles' ? 'bg-white shadow-xs' : 'bg-white/40'
                    }`}>
                    <IconEtincelle color="#10B981" size={16} />
                    <Text className="text-[12px] font-semibold text-[#1A1A1A] flex-1">Offres disponibles</Text>
                    <Text className="text-[11.5px] font-bold text-[#0d3b34] bg-[#d7f2ea] px-2.5 py-0.5 rounded-full">
                      {totalDisponibles ?? '—'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFiltre('expirees')}
                    className={`flex-1 flex-row items-center gap-2 rounded-2xl px-3 py-3 ${
                      filtre === 'expirees' ? 'bg-white shadow-xs' : 'bg-white/40'
                    }`}>
                    <IconClotureExpiree />
                    <Text className="text-[12px] font-semibold text-[#1A1A1A] flex-1">Offres expirées</Text>
                    <Text className="text-[11.5px] font-bold text-[#7a1f1f] bg-[#f6d9d9] px-2.5 py-0.5 rounded-full">
                      0
                    </Text>
                  </Pressable>
                </View>

                {filtre === 'disponibles' ? (
                  <View className="flex-row items-center gap-2 bg-[#d7f2ea] rounded-xl px-3.5 py-2.5 mt-3">
                    <View className="w-[7px] h-[7px] rounded-full bg-amber-500" />
                    <Text className="text-[12px] font-semibold text-[#0d3b34] flex-1">
                      Recrutements en cours : postulez rapidement avant clôture !
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2 bg-[#fbe1e1] rounded-xl px-3.5 py-2.5 mt-3">
                    <Text className="text-[13px]">↩</Text>
                    <Text className="text-[12px] font-semibold text-[#7a1f1f] flex-1">
                      Ces opportunités sont clôturées. Consultez les offres disponibles pour postuler à temps !
                    </Text>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              filtre === 'expirees' ? (
                <View className="bg-white rounded-2xl px-5 py-8 items-center gap-2.5 shadow-xs">
                  <View className="w-[52px] h-[52px] rounded-2xl bg-[#ECECEC] items-center justify-center">
                    <IconClotureExpiree size={24} color="rgba(0,0,0,0.35)" />
                  </View>
                  <Text className="text-[15px] font-extrabold text-[#1A1A1A] mt-1">
                    Aucune offre expirée pour le moment
                  </Text>
                  <Text className="text-[12.5px] leading-5 text-black/50 text-center max-w-[88%]">
                    Toutes les offres publiées sont actuellement actives et prêtes pour vos candidatures !
                  </Text>
                  <Pressable
                    onPress={() => setFiltre('disponibles')}
                    className="mt-1.5 bg-emerald-500 rounded-full px-5.5 py-2.5">
                    <Text className="text-white text-[13px] font-bold">⚡ Voir les offres disponibles</Text>
                  </Pressable>
                </View>
              ) : erreur ? (
                <Text className="text-[12.5px] text-black/50 font-medium text-center mt-6">
                  Impossible de charger les offres pour le moment.
                </Text>
              ) : (
                <Text className="text-[12.5px] text-black/40 font-medium text-center mt-6">
                  Aucune offre active pour l&apos;instant.
                </Text>
              )
            }
            renderItem={({ item }) => (
              <CarteOffreDetaillee offre={item} matchScore={candidateMatchScores?.[item.id] ?? null} />
            )}
            ListFooterComponent={
              filtre === 'disponibles' && offres.length > 0 && totalDisponibles !== null ? (
                <View className="items-center mt-4">
                  {offres.length < totalDisponibles && (
                    <Pressable
                      onPress={() => setLimite((n) => n + PAS_PAGINATION)}
                      className="border-[1.5px] border-black/10 rounded-full px-5 py-2.5">
                      <Text className="text-[12.5px] font-bold text-[#1A1A1A]">↓ Voir plus d&apos;offres</Text>
                    </Pressable>
                  )}
                  <Text className="text-[11.5px] text-black/40 mt-2">
                    {offres.length} offre{offres.length > 1 ? 's' : ''} affichée{offres.length > 1 ? 's' : ''} sur{' '}
                    {totalDisponibles}
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

function CarteOffreDetaillee({ offre, matchScore }: { offre: OffreReelle; matchScore: number | null }) {
  return (
    <Pressable
      onPress={() => Alert.alert('Fiche offre', 'La fiche détaillée arrive dans une prochaine mise à jour.')}
      className="bg-white rounded-2xl p-3.5 shadow-xs">
      <View className="flex-row items-center gap-2.5">
        <View className={`w-[38px] h-[38px] rounded-full ${offre.logoTeinte} items-center justify-center`}>
          <Text className="text-white font-bold text-[13px]">{offre.logoInitiales}</Text>
        </View>
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
      <Text className="text-[12.5px] text-black/55 mt-2">
        {offre.localisation} · {offre.contrat}
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

      <Pressable
        onPress={(e) => e.stopPropagation()}
        className="flex-1 bg-blue-600 rounded-full flex-row items-center justify-center gap-2 py-3 mt-3">
        <IconEnvoyer />
        <Text className="text-white text-[14px] font-bold">Postuler via Facilité</Text>
      </Pressable>

      <Text className="text-center mt-3 text-[12.5px] font-semibold text-blue-600">
        Voir la fiche détaillée →
      </Text>
    </Pressable>
  );
}
