import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useMiseAJour } from '@/lib/miseAJour';

// Bandeau « Nouvelle mise à jour ! » en tête du fil d'actualité (modèle : capture du 30/10/2026). Il n'existe QUE s'il y a une mise à jour à installer
// (version du site plus récente que celle de l'application) et tant qu'on ne l'a pas fermé pour cette version. Toucher le bandeau mène au Play Store,
// à l'App Store ou à la page de l'APK.
const FOND = '#DCEBFB';
const BORDURE = '#B7D3F0';
const BLEU = '#1D5FA6';

export default function BandeauMiseAJour() {
  const { disponible, masquee, ignorer, ouvrir } = useMiseAJour();
  if (!disponible || masquee) return null;
  return (
    <Pressable
      onPress={ouvrir}
      accessibilityRole="button"
      accessibilityLabel={`Nouvelle mise à jour disponible, version ${disponible.version}. Toucher pour mettre à jour.`}
      className="flex-row items-center"
      style={{ marginHorizontal: 12, marginTop: 8, marginBottom: 6, padding: 12, gap: 12, borderRadius: 12, backgroundColor: FOND, borderWidth: 1, borderColor: BORDURE }}>
      <View className="items-center justify-center" style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#FFFFFF' }}>
        <Ionicons name="phone-portrait-outline" size={44} color={BLEU} />
        <View style={{ position: 'absolute' }}>
          <Ionicons name="arrow-down" size={20} color={BLEU} />
        </View>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[16px] font-black" style={{ color: BLEU }}>Nouvelle mise à jour !</Text>
        <Text className="text-[13px] mt-0.5" style={{ color: '#2A4B6E', lineHeight: 18 }}>
          Une nouvelle version de Facilité est disponible. Cliquez ici pour mettre à jour.
        </Text>
      </View>
      <Pressable onPress={ignorer} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} style={{ alignSelf: 'flex-start' }}>
        <Ionicons name="close" size={20} color="#4B6A8C" />
      </Pressable>
    </Pressable>
  );
}
