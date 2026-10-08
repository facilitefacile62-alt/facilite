import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Outil } from '@/lib/outils';

// Ligne d'outil, identique sur l'écran Fonctionnalités (maquette 13) et
// dans l'onglet Fonctionnalités du profil (maquette 38).
export default function LigneOutil({ outil, onPress }: { outil: Outil; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="bg-white rounded-2xl p-3 flex-row items-center gap-3">
      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: outil.bg }}>
        <Text className="text-[18px]">{outil.icone}</Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[14px] font-bold text-[#1A1A1A]">{outil.titre}</Text>
        <Text className="text-[12px] text-black/45 mt-0.5">{outil.sous}</Text>
      </View>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M9 5L16 12L9 19" stroke="rgba(0,0,0,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}
