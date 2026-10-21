import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteModifierInfos from '@/components/EnteteModifierInfos';

// « Modifier infos — À propos » — maquette 47 (version du 12/10/2026) : en-tête
// Facilité, ligne « ← Retour  Modifier infos », trois onglets (À propos ·
// Scanner · Paramètres) et HUIT rubriques, chacune avec son sous-titre, icône
// grise dans un rond clair. Confidentialité et Sécurité & Connexion ne sont
// plus ici : elles sont dans l'onglet Paramètres. Le bouton « Importer mon
// CV » n'existe pas sur la maquette (l'onglet Scanner joue ce rôle).
const RUBRIQUES: { id: string; icone: keyof typeof Ionicons.glyphMap; label: string; sous: string; route: Href }[] = [
  { id: 'intro', icone: 'mic-outline', label: 'Intro', sous: 'Votre présentation en quelques mots', route: '/mon-profil/intro' as Href },
  { id: 'infos-perso', icone: 'id-card-outline', label: 'Informations personnelles', sous: 'Lieu, âge, situation', route: '/mon-profil/infos-perso' as Href },
  { id: 'langues', icone: 'globe-outline', label: 'Langue du CV', sous: 'Langues indiquées sur votre CV', route: '/mon-profil/langues' as Href },
  { id: 'experiences', icone: 'briefcase-outline', label: 'Expériences professionnelles', sous: 'Vos postes et missions', route: '/mon-profil/experiences' as Href },
  { id: 'formation', icone: 'school-outline', label: 'Formation', sous: 'Diplômes et écoles', route: '/mon-profil/formation' as Href },
  { id: 'competences', icone: 'bulb-outline', label: 'Compétences', sous: 'Vos savoir-faire', route: '/mon-profil/competences' as Href },
  { id: 'interets', icone: 'shield-outline', label: "Centres d'intérêt", sous: 'Loisirs et engagements', route: '/mon-profil/centres-interet' as Href },
  { id: 'coordonnees', icone: 'call-outline', label: 'Coordonnées', sous: 'Téléphone, e-mail et ville', route: '/mon-profil/coordonnees' as Href },
];

export default function ProfilAProposScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteModifierInfos actif="apropos" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 py-4">
          <View className="bg-white rounded-2xl overflow-hidden">
            {RUBRIQUES.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(r.route)}
                className={`flex-row items-center gap-3.5 px-4 py-2 ${i > 0 ? 'border-t border-black/[0.05]' : ''}`}
                style={{ minHeight: 60 }}>
                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6' }}>
                  <Ionicons name={r.icone} size={17} color="rgba(0,0,0,0.6)" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[14px] font-bold text-[#1A1A1A]">{r.label}</Text>
                  <Text className="text-[11.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.45)' }}>{r.sous}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
