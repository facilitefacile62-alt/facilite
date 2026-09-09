import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { SPONTANEOUS_COMPANIES, type EntrepriseSpontanee } from '@/lib/spontaneousData';

// Reproduction de design_handoff_facilite/pages/10-candidature-spontanee.html.
// La rangée de 6 icônes du mock (identique sur tous les écrans du handoff)
// est retirée comme partout ailleurs dans l'app : barre d'onglets + retour
// suffisent (voir FaciliteHeader.tsx). "Toutes les entreprises (178)" /
// "Stations-Services (26)" et le compteur sous la recherche sont de vrais
// décomptes calculés sur SPONTANEOUS_COMPANIES, pas les nombres du mock
// recopiés en dur. "Stations-Services" filtre par correspondance texte
// (domaine/description/pôles/nom) plutôt qu'une colonne catégorie
// dédiée, qui n'existe pas dans ces données. "Voir les dépôts physiques"
// et le bouton micro (assistant vocal) n'ont pas d'écran/service réel
// derrière eux : alerte honnête, comme le reste de l'app.
type Filtre = 'toutes' | 'stations';

const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

function estStation(e: EntrepriseSpontanee) {
  const texte = `${e.company} ${e.domains} ${e.description} ${e.poles.join(' ')}`.toLowerCase();
  return texte.includes('station');
}

const STATIONS = SPONTANEOUS_COMPANIES.filter(estStation);

export default function CandidatureSpontaneeScreen() {
  const router = useRouter();
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [recherche, setRecherche] = useState('');

  const listeAffichee = useMemo(() => {
    const base = filtre === 'stations' ? STATIONS : SPONTANEOUS_COMPANIES;
    const requete = recherche.trim().toLowerCase();
    if (!requete) return base;
    return base.filter(
      (e) => e.company.toLowerCase().includes(requete) || e.domains.toLowerCase().includes(requete)
    );
  }, [filtre, recherche]);

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="bg-white border-b border-black/[0.06] px-4 py-3.5 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5L8 12L15 19" stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Candidature Spontanée</Text>
        </View>

        <FlatList
          data={listeAffichee}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-3 pt-3.5 pb-8"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListHeaderComponent={
            <View className="mb-3.5">
              <LinearGradient colors={['#0d3b34', '#0f4f42']} className="rounded-2xl p-[18px]">
                <Text className="text-[11px] font-bold tracking-wide text-[#6ee7c9]">
                  CANDIDATURES SPONTANÉES
                </Text>
                <Text className="text-white text-[20px] font-extrabold mt-1.5 leading-6">
                  Répertoire Officiel des Entreprises
                </Text>
                <Text className="text-[13px] text-white/80 leading-5 mt-2.5">
                  Envoyez votre profil directement aux entreprises partenaires pour de futures opportunités.
                  Retrouvez la liste complète des canaux et contacts de recrutement direct au Sénégal.
                </Text>
              </LinearGradient>

              <View className="bg-[#eaf1fb] border border-[#2563EB]/[0.15] rounded-2xl p-3.5 mt-3.5 gap-2.5">
                <View className="flex-row gap-2.5 items-start">
                  <View className="w-[34px] h-[34px] rounded-full bg-[#dbe8fc] items-center justify-center">
                    <Text className="text-[15px]">🧑‍🔧</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13.5px] font-bold text-[#1A1A1A]">
                      Vous recherchez plutôt des emplois de journalier ?
                    </Text>
                    <Text className="text-[12px] text-black/55 mt-0.5 leading-4">
                      Découvrez notre répertoire d&apos;entreprises acceptant les candidatures physiques en
                      personne à Dakar.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => BIENTOT('Dépôts physiques')}
                  className="bg-[#2563EB] rounded-full py-3 items-center flex-row justify-center gap-2">
                  <Text className="text-white text-[13.5px] font-bold">🏭 Voir les dépôts physiques</Text>
                </Pressable>
              </View>

              <View className="flex-row gap-2 mt-4">
                <Pressable
                  onPress={() => setFiltre('toutes')}
                  className={`rounded-full px-4 py-2.5 ${filtre === 'toutes' ? 'bg-[#1A1A1A]' : 'bg-white border border-black/10'}`}>
                  <Text className={`text-[12.5px] font-bold ${filtre === 'toutes' ? 'text-white' : 'text-black/60'}`}>
                    Toutes les entreprises ({SPONTANEOUS_COMPANIES.length})
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFiltre('stations')}
                  className={`rounded-full px-4 py-2.5 ${filtre === 'stations' ? 'bg-[#1A1A1A]' : 'bg-white border border-black/10'}`}>
                  <Text className={`text-[12.5px] font-bold ${filtre === 'stations' ? 'text-white' : 'text-black/60'}`}>
                    ⛽ Stations-Services ({STATIONS.length})
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row items-center gap-2.5 bg-white border border-black/[0.08] rounded-full px-4 py-3 mt-3">
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Circle cx={10.5} cy={10.5} r={6.5} stroke="rgba(0,0,0,0.4)" strokeWidth={1.8} />
                  <Line x1={15.5} y1={15.5} x2={20.5} y2={20.5} stroke="rgba(0,0,0,0.4)" strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
                <TextInput
                  value={recherche}
                  onChangeText={setRecherche}
                  placeholder="Rechercher une entreprise ou un domaine"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  className="flex-1 text-[13px] text-[#1A1A1A]"
                />
              </View>

              <Text className="text-center text-[11px] font-bold tracking-wide text-black/40 mt-2.5">
                {listeAffichee.length} ENTREPRISE{listeAffichee.length > 1 ? 'S' : ''} RÉPERTORIÉE
                {listeAffichee.length > 1 ? 'S' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text className="text-center py-10 text-[12.5px] text-black/40 font-medium">
              Aucune entreprise ne correspond à cette recherche.
            </Text>
          }
          renderItem={({ item }) => <CarteEntreprise entreprise={item} />}
        />

        <Pressable
          onPress={() => BIENTOT('Assistant vocal')}
          className="absolute right-4 bottom-4 w-[52px] h-[52px] rounded-full overflow-hidden shadow-lg">
          <LinearGradient colors={['#10B981', '#0ea975']} className="w-full h-full items-center justify-center">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M9 3H15V14A3 3 0 0 1 9 14V3Z" stroke="#fff" strokeWidth={1.8} />
              <Path d="M6 11V12C6 15.3 8.7 18 12 18C15.3 18 18 15.3 18 12V11" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
              <Path d="M12 18V21" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function CarteEntreprise({ entreprise }: { entreprise: EntrepriseSpontanee }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/entreprise/${entreprise.slug}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-xs">
      <View className="h-[110px] relative overflow-hidden">
        {entreprise.image_url ? (
          <Image
            source={{ uri: entreprise.image_url }}
            alt={entreprise.company}
            contentFit="cover"
            className="w-full h-full"
          />
        ) : (
          <LinearGradient
            colors={['#dce8f5', '#cdddef', '#dce8f5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-full h-full"
          />
        )}
        <View className="absolute top-2.5 right-2.5 bg-white rounded-full px-2.5 py-1">
          <Text className="text-[11px] font-bold text-[#2563EB]">
            {entreprise.contactType === 'url' ? '🌐 Lien Web' : '✉️ Email'}
          </Text>
        </View>
      </View>
      <View className="p-3.5">
        <Text className="text-[15px] font-extrabold text-[#1A1A1A]" numberOfLines={1}>
          {entreprise.company}
        </Text>
        <Text className="text-[12px] text-black/50 mt-1" numberOfLines={2}>
          {entreprise.domains}
        </Text>
      </View>
    </Pressable>
  );
}
