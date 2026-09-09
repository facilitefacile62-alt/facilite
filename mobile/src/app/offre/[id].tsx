import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useOffreDetail } from '@/lib/useOffreDetail';

// Reproduction de design_handoff_facilite/pages/07-fiche-offre.html — écran
// sombre (seul avec 04-recherche à l'être dans ce handoff, très
// majoritairement clair par ailleurs). "Compétences requises" (skillChips)
// et le chip "Remote" du mock sont omis : job_offers n'a ni colonne
// compétences, ni indicateur télétravail fiable — plutôt qu'inventer ces
// deux données, l'écran ne montre que ce qui est réellement en base
// (même principe que "Offres expirées" dans offres.tsx). "Candidats" est en
// revanche une vraie donnée (voir useOffreDetail.ts).
//
// "Postuler en 1 clic" bascule un état local (isApplied) — pas encore
// d'écriture réelle dans `candidatures` : cette table exige un CV joint
// (cv_url NOT NULL) et l'écran "Mes CV" mobile n'existe pas encore
// (profil.tsx le stub toujours). Câbler une vraie candidature avec pièce
// jointe est un point à part, pas construit ici.
export default function FicheOffreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { offre, erreur } = useOffreDetail(id);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [isApplied, setIsApplied] = useState(false);

  return (
    <View className="flex-1 bg-[#0B0D10]">
      <SafeAreaView className="flex-1" edges={['top']}>
        {offre === null && !erreur ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : erreur || !offre ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13px] text-[#F5F6F7]/50 font-medium text-center">
              Impossible de charger cette offre pour le moment.
            </Text>
            <Pressable onPress={() => router.back()} className="mt-4 px-5 py-2.5 rounded-full bg-[#15181D]">
              <Text className="text-[#F5F6F7] text-[12.5px] font-bold">Retour</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between px-4 pt-2">
              <Pressable
                onPress={() => router.back()}
                className="w-[38px] h-[38px] rounded-full bg-[#15181D] items-center justify-center">
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 5L8 12L15 19" stroke="#F5F6F7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
              <Pressable
                onPress={() => setSauvegarde((s) => !s)}
                className="w-[38px] h-[38px] rounded-full bg-[#15181D] items-center justify-center">
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path
                    d="M6 3.5H18V21L12 16.5L6 21V3.5Z"
                    stroke={sauvegarde ? '#10B981' : '#F5F6F7'}
                    strokeWidth={1.8}
                    fill={sauvegarde ? '#10B981' : 'none'}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>

            <View className="px-5 pt-4 items-center">
              <View
                className="w-16 h-16 rounded-[18px] items-center justify-center"
                style={{ backgroundColor: offre.logoBg }}>
                <Text className="text-[#0B0D10] font-bold text-[24px]">{offre.logo}</Text>
              </View>
              <Text className="text-[19px] font-extrabold text-[#F5F6F7] mt-3.5 text-center leading-6">
                {offre.titre}
              </Text>
              <Text className="text-[14px] text-[#F5F6F7]/55 mt-1 text-center">
                {offre.entreprise} · {offre.localisation}
              </Text>
              <View className="flex-row gap-1.5 mt-3">
                <View className="px-2.5 py-1.5 rounded-full bg-white/[0.06]">
                  <Text className="text-[12px] font-medium text-[#F5F6F7]/70">{offre.contrat}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row gap-2.5 px-5 pt-5.5">
              <View className="flex-1 bg-[#15181D] rounded-2xl p-3 items-center">
                <Text className="text-[13px] font-bold text-[#10B981]">{offre.salaire}</Text>
                <Text className="text-[11px] text-[#F5F6F7]/45 mt-0.5">Salaire</Text>
              </View>
              <View className="flex-1 bg-[#15181D] rounded-2xl p-3 items-center">
                <Text className="text-[13px] font-bold text-[#F5F6F7]">{offre.posted}</Text>
                <Text className="text-[11px] text-[#F5F6F7]/45 mt-0.5">Publiée</Text>
              </View>
              <View className="flex-1 bg-[#15181D] rounded-2xl p-3 items-center">
                <Text className="text-[13px] font-bold text-[#F5F6F7]">{offre.applicantsCount}</Text>
                <Text className="text-[11px] text-[#F5F6F7]/45 mt-0.5">Candidats</Text>
              </View>
            </View>

            <Text className="px-5 pt-5.5 pb-1.5 text-[14.5px] font-bold text-[#F5F6F7]">Description</Text>
            <Text className="px-5 text-[14px] leading-6 text-[#F5F6F7]/70">{offre.description}</Text>

            <View className="px-5 pt-6 pb-8">
              <Pressable
                onPress={() => setIsApplied((v) => !v)}
                className={`rounded-full py-3.5 flex-row items-center justify-center gap-2 ${
                  isApplied ? 'bg-[#10B981]/15 border border-[#10B981]' : 'bg-[#10B981]'
                }`}>
                {isApplied && (
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path d="M4 12L9 17L20 6" stroke="#10B981" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
                <Text className={`text-[14.5px] font-bold ${isApplied ? 'text-[#10B981]' : 'text-[#0B0D10]'}`}>
                  {isApplied ? 'Candidature envoyée' : 'Postuler en 1 clic'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
