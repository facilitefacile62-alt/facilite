import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

// Écran de confirmation très simple : une question en gros, quelques phrases courtes, et DEUX gros boutons (oui en vert, non en blanc).
// Sert avant tout remplacement des informations du profil par celles d'un CV, et avant de récupérer une ancienne version.
export default function GrosBoutonsChoix({
  question,
  details,
  oui,
  non,
  occupe,
  onOui,
  onNon,
}: {
  question: string;
  details: string[];
  oui: string;
  non: string;
  occupe?: boolean;
  onOui: () => void;
  onNon: () => void;
}) {
  return (
    <ScrollView contentContainerClassName="px-5 pt-6 pb-8" showsVerticalScrollIndicator={false}>
      <Text className="text-[24px] leading-[30px] font-black text-[#1A1A1A]">{question}</Text>
      <View className="mt-4 gap-2">
        {details.filter(Boolean).map((d, i) => (
          <Text key={i} className="text-[15.5px] leading-[22px]" style={{ color: 'rgba(0,0,0,0.65)' }}>
            {d}
          </Text>
        ))}
      </View>

      <Pressable
        onPress={onOui}
        disabled={occupe}
        accessibilityRole="button"
        className="items-center justify-center mt-8"
        style={{ minHeight: 64, borderRadius: 18, backgroundColor: '#10B981', opacity: occupe ? 0.6 : 1, paddingHorizontal: 14 }}>
        {occupe ? <ActivityIndicator color="#fff" /> : <Text className="text-[17px] font-black text-white text-center">{oui}</Text>}
      </Pressable>
      <Pressable
        onPress={onNon}
        disabled={occupe}
        accessibilityRole="button"
        className="items-center justify-center mt-3 bg-white"
        style={{ minHeight: 64, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 14 }}>
        <Text className="text-[17px] font-black text-[#1A1A1A] text-center">{non}</Text>
      </Pressable>
    </ScrollView>
  );
}
