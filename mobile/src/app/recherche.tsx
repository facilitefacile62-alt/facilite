import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useRechercheOffres, useRecherchesRecentes, type ResultatRecherche } from '@/lib/useRechercheOffres';

// Reproduction de design_handoff_facilite/pages/04-recherche.html — sombre,
// comme offre/[id].tsx. Pas de bouton retour dans le mock (recherche
// "flottante" sans chrome), mais un moyen visible de sortir de l'écran
// reste nécessaire sur mobile (le geste de balayage iOS n'est pas toujours
// évident) — même bouton rond #15181D que sur offre/[id].tsx, léger écart
// assumé au pixel-perfect pour l'utilisabilité.
//
// "Catégories populaires" : job_offers n'a pas de colonne secteur, ces 6
// tuiles sont donc de vrais raccourcis de recherche par mot-clé (title/
// description), pas une liste décorative. "Recherches récentes" est un
// vrai historique persisté sur l'appareil (AsyncStorage), pas des données
// d'exemple.
const CATEGORIES = [
  { code: 'TI', color: '#2563EB', label: 'Technologie', motCle: 'informatique' },
  { code: 'CV', color: '#10B981', label: 'Commerce & Vente', motCle: 'vente' },
  { code: 'FC', color: '#F59E0B', label: 'Finance & Compta', motCle: 'comptab' },
  { code: 'SA', color: '#DC2626', label: 'Santé', motCle: 'santé' },
  { code: 'BT', color: '#8B5CF6', label: 'BTP & Logistique', motCle: 'logistique' },
  { code: 'ED', color: '#0EA5E9', label: 'Éducation', motCle: 'formation' },
];

export default function RechercheScreen() {
  const router = useRouter();
  const [requete, setRequete] = useState('');
  const resultats = useRechercheOffres(requete);
  const { recherches, enregistrerRecherche } = useRecherchesRecentes();

  const hasQuery = requete.trim().length > 0;
  const noResults = resultats !== null && resultats.length === 0;

  useEffect(() => {
    if (resultats !== null && requete.trim()) {
      enregistrerRecherche(requete);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultats]);

  return (
    <View className="flex-1 bg-[#0B0D10]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-5 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="w-[38px] h-[38px] rounded-full bg-[#15181D] items-center justify-center">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5L8 12L15 19" stroke="#F5F6F7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text className="text-[20px] font-extrabold text-[#F5F6F7]">Rechercher</Text>
        </View>

        <View className="px-5 pt-3 pb-2">
          <View className="flex-row items-center gap-2.5 bg-[#15181D] border border-white/[0.07] rounded-full px-4 py-3.5">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx={10.5} cy={10.5} r={6.5} stroke="rgba(245,246,247,0.4)" strokeWidth={1.8} />
              <Line x1={15.5} y1={15.5} x2={20.5} y2={20.5} stroke="rgba(245,246,247,0.4)" strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
            <TextInput
              value={requete}
              onChangeText={setRequete}
              placeholder="Titre, entreprise, secteur..."
              placeholderTextColor="rgba(245,246,247,0.4)"
              autoFocus
              className="flex-1 text-[14.5px] text-[#F5F6F7]"
            />
          </View>
        </View>

        {hasQuery ? (
          <FlatList
            data={resultats ?? []}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-5 pt-4 pb-6 gap-3"
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => <CarteResultat resultat={item} />}
            ListEmptyComponent={
              noResults ? (
                <Text className="text-center py-10 text-[14px] text-[#F5F6F7]/40">
                  Aucun résultat pour cette recherche.
                </Text>
              ) : null
            }
          />
        ) : (
          <ScrollView contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled">
            {recherches.length > 0 && (
              <>
                <Text className="px-5 pt-4.5 pb-2.5 text-[13px] font-bold text-[#F5F6F7]/50 uppercase tracking-wider">
                  Recherches récentes
                </Text>
                <View className="flex-row flex-wrap gap-2 px-5">
                  {recherches.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRequete(r)}
                      className="px-3.5 py-2 rounded-full bg-[#15181D] border border-white/[0.07]">
                      <Text className="text-[13px] text-[#F5F6F7]">{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text className="px-5 pt-5 pb-2.5 text-[13px] font-bold text-[#F5F6F7]/50 uppercase tracking-wider">
              Catégories populaires
            </Text>
            <View className="flex-row flex-wrap gap-3 px-5">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.code}
                  onPress={() => setRequete(cat.motCle)}
                  className="bg-[#15181D] border border-white/[0.06] rounded-2xl p-4 gap-5"
                  style={{ width: '46.5%' }}>
                  <View
                    className="w-9 h-9 rounded-[11px] items-center justify-center"
                    style={{ backgroundColor: cat.color }}>
                    <Text className="text-[13px] font-bold text-[#0B0D10]">{cat.code}</Text>
                  </View>
                  <Text className="text-[14px] font-semibold text-[#F5F6F7]">{cat.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function CarteResultat({ resultat }: { resultat: ResultatRecherche }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/offre/${resultat.id}`)}
      className="bg-[#15181D] border border-white/[0.06] rounded-3xl p-4 flex-row gap-3 items-start">
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: resultat.logoBg }}>
        <Text className="text-[15px] font-bold text-[#0B0D10]">{resultat.logo}</Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[15px] font-bold text-[#F5F6F7]">{resultat.titre}</Text>
        <Text className="text-[13px] text-[#F5F6F7]/55 mt-0.5">
          {resultat.entreprise} · {resultat.localisation}
        </Text>
      </View>
    </Pressable>
  );
}
