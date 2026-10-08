import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FaciliteHeader from '@/components/FaciliteHeader';

// « Modifier infos — À propos » — maquette 40 : en-tête Facilité, ligne
// « ← Retour  Modifier infos », trois onglets (À propos · Scanner ·
// Paramètres) et la liste des rubriques du profil.
//
// L'écran précédent affichait une grande bannière « CV » avec avatar et
// badges — rien de tel sur la maquette, et la charte §4 interdit justement
// la bannière « CV ». La fiche de présentation (bio, infos, coordonnées)
// vit désormais dans sa propre rubrique « Intro » (maquette 47).
//
// Les rubriques pointent toutes vers un écran réellement construit : les
// six dernières (Formation, Compétences, Centres d'intérêt, Coordonnées,
// Confidentialité, Sécurité) manquaient complètement.
const RUBRIQUES: { id: string; icone: string; label: string; route: Href }[] = [
  { id: 'intro', icone: '🎙️', label: 'Intro', route: '/mon-profil/intro' as Href },
  { id: 'infos-perso', icone: '🪪', label: 'Informations personnelles', route: '/mon-profil/infos-perso' as Href },
  { id: 'langues', icone: '🔤', label: 'Langues', route: '/mon-profil/langues' as Href },
  { id: 'experiences', icone: '👤', label: 'Expériences professionnelles', route: '/mon-profil/experiences' as Href },
  { id: 'formation', icone: '🎓', label: 'Formation', route: '/mon-profil/formation' as Href },
  { id: 'competences', icone: '💡', label: 'Compétences', route: '/mon-profil/competences' as Href },
  { id: 'interets', icone: '❤️', label: "Centres d'intérêt", route: '/mon-profil/centres-interet' as Href },
  { id: 'coordonnees', icone: '📇', label: 'Coordonnées', route: '/mon-profil/coordonnees' as Href },
  { id: 'confidentialite', icone: '🛡️', label: 'Confidentialité et informations juridiques', route: '/mon-profil/confidentialite' as Href },
  { id: 'securite', icone: '🔑', label: 'Sécurité & Connexion', route: '/mon-profil/securite' as Href },
];

export default function ProfilAProposScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/profil'))}
            className="flex-row items-center gap-1.5 bg-white rounded-full px-3 py-2">
            <Ionicons name="arrow-back" size={14} color="#1A1A1A" />
            <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Retour</Text>
          </Pressable>
          <Text className="text-[15px] font-extrabold text-[#1A1A1A]">Modifier infos</Text>
        </View>

        <View className="flex-row items-center gap-4 px-5 border-b border-black/[0.08]">
          <Text className="text-[14px] font-bold text-[#1A1A1A] pb-2.5 border-b-2 border-[#1A1A1A]">À propos</Text>
          <Pressable
            onPress={() => router.push('/mon-profil/scanner-document')}
            className="bg-[#10B981] rounded-full px-3.5 py-1.5 mb-2">
            <Text className="text-[12.5px] font-bold text-white">⛶ Scanner</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/mon-profil/parametres')}>
            <Text className="text-[14px] font-semibold text-black/45 pb-2.5">Paramètres</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 py-4">
          <View className="bg-white rounded-2xl overflow-hidden">
            {RUBRIQUES.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(r.route)}
                className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-black/[0.05]' : ''}`}>
                <View className="w-9 h-9 rounded-[10px] bg-[#eef1fb] items-center justify-center">
                  <Text className="text-[16px]">{r.icone}</Text>
                </View>
                <Text className="flex-1 text-[13.5px] font-bold text-[#2563EB]">{r.label}</Text>
                <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/web/importer-cv')}
            className="bg-white border border-[#2563EB]/30 rounded-full py-3 items-center flex-row justify-center gap-2 mt-4">
            <Ionicons name="cloud-upload-outline" size={15} color="#2563EB" />
            <Text className="text-[#2563EB] text-[12.5px] font-bold">Importer mon CV</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
