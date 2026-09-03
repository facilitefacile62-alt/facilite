import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Écran d'accueil natif — direction visuelle inspirée de Yimmo (structure :
// en-tête + salutation, gros titre, recherche en avant, étapes numérotées),
// pas copiée : iconographie, texte et données propres à Facilite. Palette
// validée par l'utilisateur pour l'app mobile uniquement (Bleu Roi #2563EB /
// Vert Menthe #10B981) — le site web garde ses couleurs actuelles, non
// touchées ici.
type Etape = {
  icone: keyof typeof Ionicons.glyphMap;
  teinte: string;
  couleurIcone: string;
  titre: string;
  detail: string;
};

const ETAPES: Etape[] = [
  {
    icone: 'create-outline',
    teinte: 'bg-blue-100 dark:bg-blue-950',
    couleurIcone: '#2563EB',
    titre: 'Décris le poste que tu cherches',
    detail: 'Secteur, ville, type de contrat.',
  },
  {
    icone: 'mail-outline',
    teinte: 'bg-emerald-100 dark:bg-emerald-950',
    couleurIcone: '#059669',
    titre: 'Les recruteurs te proposent des offres',
    detail: 'Uniquement des postes réellement ouverts.',
  },
  {
    icone: 'sparkles-outline',
    teinte: 'bg-amber-100 dark:bg-amber-950',
    couleurIcone: '#B45309',
    titre: 'Les meilleures offres remontent en tête',
    detail: 'Celles qui te correspondent le plus, en premier.',
  },
];

export default function HomeScreen() {
  const [recherche, setRecherche] = useState('');

  return (
    <View className="flex-1 bg-slate-50 dark:bg-gray-950">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-12"
          showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center justify-between pt-2">
            <Text className="text-xl font-extrabold text-blue-600">Facilité</Text>
            <View className="flex-row items-center gap-2.5">
              <Pressable className="w-10 h-10 rounded-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 items-center justify-center">
                <Ionicons name="notifications-outline" size={18} color="#334155" />
              </Pressable>
              <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                <Text className="text-sm font-extrabold text-amber-700">A</Text>
              </View>
            </View>
          </View>

          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-4">
            Bonjour Aïssatou 👋
          </Text>

          <Text className="text-[26px] leading-[32px] font-extrabold text-gray-900 dark:text-white mt-1 mb-5">
            Trouve ton{'\n'}prochain emploi
          </Text>

          <View className="flex-row items-center bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 pl-4 pr-1.5 py-1.5 shadow-sm">
            <Ionicons name="search" size={17} color="#94a3b8" />
            <TextInput
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Décris le poste que tu cherches"
              placeholderTextColor="#94a3b8"
              className="flex-1 ml-2.5 text-[13.5px] text-gray-900 dark:text-white"
            />
            <Pressable className="w-9 h-9 rounded-xl bg-blue-600 items-center justify-center">
              <Ionicons name="chevron-forward" size={18} color="#ffffff" />
            </Pressable>
          </View>

          <Text className="text-amber-500 text-base tracking-[6px] mt-7 mb-6">∿ ∿ ∿</Text>

          <Text className="text-lg font-extrabold text-gray-900 dark:text-white leading-6">
            Dis-nous ce que tu cherches,{'\n'}on s&apos;occupe du reste.
          </Text>
          <Text className="text-[12.5px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 mb-5">
            Voici comment ça marche.
          </Text>

          <View className="gap-5">
            {ETAPES.map((etape, index) => (
              <View key={etape.titre} className="flex-row gap-3.5">
                <View
                  className={`w-10 h-10 rounded-full ${etape.teinte} items-center justify-center shrink-0`}>
                  <Ionicons name={etape.icone} size={18} color={etape.couleurIcone} />
                </View>
                <View className="flex-1 pt-0.5">
                  <Text className="text-[13.5px] font-bold text-gray-900 dark:text-white">
                    {index + 1} · {etape.titre}
                  </Text>
                  <Text className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {etape.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
