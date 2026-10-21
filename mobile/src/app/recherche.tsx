import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRechercheOffres, useRecherchesRecentes, type ResultatRecherche } from '@/lib/useRechercheOffres';

// Recherche Facilité aux couleurs de la recherche Locaux (choix du 20/10/2026) : bande #e3dbcc avec retour, champ #d3cab9 et
// loupe, corps blanc. Avant : version sombre de design_handoff_facilite/pages/04-recherche.html. Pas de bouton retour dans le mock (recherche
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
// Libellés, ordre (par ligne : IN CO / SA BT / FI ED) et couleurs de la
// maquette 04. Chaque tuile lance une vraie recherche par mot-clé.
const CATEGORIES = [
  { code: 'IN', color: '#2563EB', label: 'Informatique', motCle: 'informatique' },
  { code: 'CO', color: '#10B981', label: 'Commerce', motCle: 'commerc' },
  { code: 'SA', color: '#F59E0B', label: 'Santé', motCle: 'santé' },
  { code: 'BT', color: '#8B5CF6', label: 'BTP', motCle: 'btp' },
  { code: 'FI', color: '#EC4899', label: 'Finance', motCle: 'financ' },
  { code: 'ED', color: '#2563EB', label: 'Éducation', motCle: 'éducation' },
];

export default function RechercheScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [requete, setRequete] = useState(typeof q === 'string' ? q : '');
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

  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pb-3 flex-row items-center gap-3" style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top + 10 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Retour" hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </Pressable>
        <TextInput
          value={requete}
          onChangeText={setRequete}
          placeholder="Rechercher..."
          placeholderTextColor="rgba(0,0,0,0.45)"
          returnKeyType="search"
          autoFocus
          autoCorrect={false}
          className="flex-1 text-[14.5px] text-[#1A1A1A]"
          style={[{ height: 46, borderRadius: 23, backgroundColor: '#d3cab9', paddingHorizontal: 18 }, { outlineStyle: 'none' } as object]}
        />
        <Ionicons name="search" size={24} color="#111" />
      </View>

      {hasQuery ? (
        <FlatList
          data={resultats ?? []}
          keyExtractor={(item) => item.id}
          style={{ backgroundColor: '#F2F0EA' }}
          contentContainerClassName="px-4 pt-4 pb-6"
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => <CarteResultat resultat={item} />}
          ListEmptyComponent={
            noResults ? (
              <Text className="text-center py-10 text-[14px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Aucun résultat pour cette recherche.
              </Text>
            ) : null
          }
        />
      ) : (
        <ScrollView contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled">
          {recherches.length > 0 ? (
            <View className="px-4 pt-4 gap-1">
              {recherches.map((r) => (
                <Pressable key={r} onPress={() => setRequete(r)} className="flex-row items-center gap-3 py-2.5">
                  <Ionicons name="time-outline" size={17} color="#9CA3AF" />
                  <Text className="text-[14.5px] text-[#1A1A1A]">{r}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text className="px-4 pt-4 text-[14.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Aucune recherche récente</Text>
          )}

          <Text className="px-4 pt-5 pb-2.5 text-[13px] font-bold uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.45)' }}>
            Catégories populaires
          </Text>
          <View className="flex-row flex-wrap gap-3 px-4">
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.code}
                onPress={() => setRequete(cat.motCle)}
                className="rounded-2xl p-4 gap-5"
                style={{ width: '47%', backgroundColor: '#F2F0EA', borderWidth: 1, borderColor: '#D9D1C1' }}>
                <View className="w-9 h-9 rounded-[11px] items-center justify-center" style={{ backgroundColor: cat.color }}>
                  <Text className="text-[13px] font-bold text-white">{cat.code}</Text>
                </View>
                <Text className="text-[14px] font-semibold text-[#1A1A1A]">{cat.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function CarteResultat({ resultat }: { resultat: ResultatRecherche }) {
  const router = useRouter();
  const [logoErreur, setLogoErreur] = useState(false);

  return (
    <Pressable
      onPress={() => router.push(`/offre/${resultat.id}`)}
      className="bg-white rounded-3xl p-4 flex-row gap-3 items-start"
      style={{ borderWidth: 1, borderColor: '#D9D1C1' }}>
      {resultat.posterUri && !logoErreur ? (
        <Image
          source={{ uri: resultat.posterUri }}
          alt={resultat.entreprise}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F2F0EA' }}
          contentFit="cover"
          transition={150}
          onError={() => setLogoErreur(true)}
        />
      ) : (
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: resultat.logoBg }}>
          <Text className="text-[15px] font-bold text-white">{resultat.logo}</Text>
        </View>
      )}
      <View className="flex-1 min-w-0">
        <Text className="text-[15px] font-bold text-[#1A1A1A]">{resultat.titre}</Text>
        <Text className="text-[13px] mt-0.5" style={{ color: 'rgba(0,0,0,0.55)' }}>
          {resultat.entreprise} · {resultat.localisation}
        </Text>
      </View>
    </Pressable>
  );
}
