import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import LigneOutil from '@/components/LigneOutil';
import { ONGLETS_OUTILS, filtrerOutils, type TypeOutil } from '@/lib/outils';

// Écran « Fonctionnalités » — maquette 13. En-tête propre (badge outil,
// titre, pastille OUTILS ACTIFS, bouton Accueil), onglets, liste d'outils.
// Le catalogue vit dans lib/outils.ts : l'onglet Fonctionnalités du profil
// (maquette 38) affiche exactement la même liste.
//
// La barre du bas est fournie par le layout racine (règle §1.1) ; le bouton
// flottant « assistant » n'est plus ici (charte §3 : fil d'actualité seul).
const VERT = '#10B981';

export default function FonctionnalitesScreen() {
  const router = useRouter();
  const [ongletActif, setOngletActif] = useState<TypeOutil>('tous');
  const outilsAffiches = useMemo(() => filtrerOutils(ongletActif), [ongletActif]);

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-4 py-3.5" style={{ backgroundColor: '#e3dbcc' }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-[38px] h-[38px] rounded-xl bg-black/[0.06] items-center justify-center">
                <Text className="text-[17px]">🛠️</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Fonctionnalités</Text>
                <View className="bg-black/[0.08] px-2 py-1 rounded-full">
                  <Text className="text-[10px] font-bold text-[#44403C]">OUTILS ACTIFS</Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => router.navigate('/')}
              className="flex-row items-center gap-1.5 bg-white rounded-full px-3.5 py-2.5">
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M4 11L12 4L20 11V20H14V14H10V20H4V11Z" stroke="#1A1A1A" strokeWidth={1.8} strokeLinejoin="round" />
              </Svg>
              <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Accueil</Text>
            </Pressable>
          </View>
        </View>

        {/* Onglets : pastille active VERTE comme la maquette (elle était noire). */}
        <View className="bg-white px-4 py-3">
          <View className="flex-row gap-1 bg-[#F2F0EA] rounded-full p-1">
            {ONGLETS_OUTILS.map((o) => {
              const actif = ongletActif === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setOngletActif(o.id)}
                  className="flex-1 py-2 rounded-full items-center"
                  style={actif ? { backgroundColor: VERT } : undefined}>
                  <Text className={`text-[12px] font-bold text-center ${actif ? 'text-white' : 'text-black/55'}`}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FlatList
          data={outilsAffiches}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 py-3.5"
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          renderItem={({ item }) => <LigneOutil outil={item} onPress={() => item.ouvrir(router)} />}
        />
      </SafeAreaView>
    </View>
  );
}
