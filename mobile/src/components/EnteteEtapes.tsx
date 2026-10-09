import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// En-tête des parcours en étapes du Marketplace (maquettes 18, 19 et 20) :
// bande #e3dbcc, carré de retour arrondi, « Étape n / total » en petit puis
// le titre de l'étape, quatre pastilles numérotées à droite (étape en cours :
// contour vert, étapes passées : vert plein avec ✓, à venir : grises) et une
// barre de progression verte sous la bande.
const VERT = '#10B981';

export default function EnteteEtapes({
  etape,
  total = 4,
  titre,
  onRetour,
}: {
  etape: number;
  total?: number;
  titre: string;
  onRetour: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={onRetour}
          accessibilityLabel="Retour"
          className="items-center justify-center"
          style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#d3cab9' }}>
          <Ionicons name="arrow-back" size={21} color="#1A1A1A" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
            Étape {etape} / {total}
          </Text>
          <Text className="text-[18px] font-black text-[#1A1A1A]">{titre}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1;
            const passee = n < etape;
            const courante = n === etape;
            return (
              <View
                key={n}
                className="items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: passee ? VERT : courante ? '#FFFFFF' : '#d3cab9',
                  borderWidth: courante ? 2 : 0,
                  borderColor: VERT,
                }}>
                {passee ? (
                  <Ionicons name="checkmark" size={17} color="#FFFFFF" />
                ) : (
                  <Text className="text-[13px] font-black" style={{ color: courante ? VERT : 'rgba(0,0,0,0.5)' }}>
                    {n}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: 'rgba(0,0,0,0.12)' }}>
        <View style={{ height: 3, width: `${(etape / total) * 100}%`, backgroundColor: VERT }} />
      </View>
    </View>
  );
}
