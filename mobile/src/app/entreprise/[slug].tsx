import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SPONTANEOUS_COMPANIES } from '@/lib/spontaneousData';

// Reproduction de design_handoff_facilite/pages/11-fiche-entreprise.html.
// Le bouton principal garde exactement le texte du mock ("↗ Postuler sur
// le site officiel", texte en dur dans le HTML, pas un {{ }}) mais sa
// destination réelle suit contactType (externalLink si "url", mailto:email
// si "email") — même logique que src/app/recrutement-spontane/[slug]/
// page.js côté web. Le bouton secondaire "Email Direct" (sc-if
// hasEmail) n'apparaît que si un canal e-mail existe EN PLUS du canal
// principal (contactType==='url' avec un email renseigné), pour éviter de
// dupliquer le même bouton quand contactType==='email'.
export default function FicheEntrepriseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const entreprise = SPONTANEOUS_COMPANIES.find((e) => e.slug === slug);

  if (!entreprise) {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <SafeAreaView className="flex-1 items-center justify-center px-8" edges={['top']}>
          <Text className="text-[13px] text-black/50 font-medium text-center">
            Entreprise introuvable ou déplacée.
          </Text>
          <Pressable onPress={() => router.back()} className="mt-4 px-5 py-2.5 rounded-full bg-white border border-black/10">
            <Text className="text-[#1A1A1A] text-[12.5px] font-bold">Retour</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const hasEmailSecondaire = entreprise.contactType === 'url' && Boolean(entreprise.email);

  function postulerSurCanalPrincipal() {
    if (!entreprise) return;
    if (entreprise.contactType === 'url' && entreprise.externalLink) {
      Linking.openURL(entreprise.externalLink);
    } else if (entreprise.email) {
      Linking.openURL(`mailto:${entreprise.email}?subject=${encodeURIComponent(`Candidature - ${entreprise.company}`)}`);
    }
  }

  function envoyerEmailDirect() {
    if (!entreprise?.email) return;
    Linking.openURL(`mailto:${entreprise.email}?subject=${encodeURIComponent(`Candidature - ${entreprise.company}`)}`);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} className="flex-row items-center gap-2 px-4 py-3.5 bg-white">
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5L8 12L15 19" stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text className="text-[14px] font-bold text-[#1A1A1A]">Retour</Text>
          </Pressable>

          {entreprise.image_url ? (
            <Image source={{ uri: entreprise.image_url }} alt={entreprise.company} contentFit="cover" className="w-full h-44" />
          ) : (
            <LinearGradient
              colors={['#dce8f5', '#cdddef', '#dce8f5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-full h-44"
            />
          )}

          <View className="px-5 py-4.5">
            {entreprise.contract_type && (
              <View className="self-start bg-[#d7f2ea] rounded-full px-2.5 py-1">
                <Text className="text-[11px] font-bold text-[#0d3b34]">{entreprise.contract_type}</Text>
              </View>
            )}
            <Text className="text-[22px] font-extrabold text-[#1A1A1A] mt-2.5">{entreprise.company}</Text>

            <Text className="text-[11px] font-bold tracking-wide text-[#0d3b34] mt-4.5">DOMAINES &amp; POSTES :</Text>
            <View className="bg-white rounded-xl p-3 mt-2">
              <Text className="text-[13.5px] leading-5 text-[#1A1A1A]">{entreprise.domains}</Text>
            </View>

            <Text className="text-[11px] font-bold tracking-wide text-[#0d3b34] mt-4">📄 DOCUMENTS REQUIS :</Text>
            <Text className="text-[13.5px] text-[#1A1A1A] mt-1">{entreprise.documentsRequired}</Text>

            <View className="bg-[#d7f2ea] rounded-2xl p-3.5 mt-4">
              <Text className="text-[10.5px] font-bold tracking-wide text-[#0d3b34]">CANAL DE CANDIDATURE DIRECT :</Text>
              <Text className="text-[14px] font-bold text-[#0d3b34] mt-1">{entreprise.rawContact}</Text>
            </View>

            <Pressable
              onPress={postulerSurCanalPrincipal}
              className="bg-[#10B981] rounded-full py-3.5 items-center flex-row justify-center gap-2 mt-4">
              <Text className="text-white text-[14.5px] font-bold">↗ Postuler sur le site officiel</Text>
            </Pressable>

            {hasEmailSecondaire && (
              <Pressable
                onPress={envoyerEmailDirect}
                className="border border-[#10B981] rounded-full py-3 items-center flex-row justify-center gap-2 mt-2.5">
                <Text className="text-[#0d3b34] text-[13.5px] font-bold">✉ Email Direct</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
