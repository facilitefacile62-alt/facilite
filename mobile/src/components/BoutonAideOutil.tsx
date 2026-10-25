import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

// Bouton « Aide » d'un outil de « Fonctionnalités », placé DANS la page de l'outil (en-tête de la page) : il ouvre l'écran vidéo d'aide de cet outil
// (une vidéo par outil viendra plus tard). Cible tactile de 44 px.
export default function BoutonAideOutil({ outilId, titre }: { outilId: string; titre: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/aide-video?outil=${encodeURIComponent(outilId)}&titre=${encodeURIComponent(titre)}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Aide pour ${titre}`}
      hitSlop={4}
      className="flex-row items-center justify-center gap-1 rounded-full px-3"
      style={{ minHeight: 44, backgroundColor: '#E8F0FE' }}>
      <Ionicons name="help-circle-outline" size={17} color="#2563EB" />
      <Text className="text-[13px] font-extrabold" style={{ color: '#2563EB' }}>Aide</Text>
    </Pressable>
  );
}
