import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// En-tête des pages Marketplace (maquettes 59 à 81) : bande #e3dbcc, bouton
// retour rond, titre en gras et, quand il y en a un, sous-titre vert
// (« Étape 1 sur 2 · Identité », « Livreur actif »…).
//
// La bande couvre aussi la zone de la barre d'état (comme sur les maquettes,
// où l'heure s'affiche sur le beige) : l'en-tête applique lui-même l'inset du
// haut, les écrans n'ont donc plus de SafeAreaView « top » à poser.
//
// Le retour suit la pile d'historique (charte §1.5) : `onRetour` ne sert
// qu'aux écrans qui gèrent des étapes internes (le retour recule d'une étape
// avant de quitter l'écran). À défaut, retour natif, avec repli sur l'accueil
// Marketplace quand la pile est vide (ouverture directe par lien).
export default function EnteteMarketplace({
  titre,
  sousTitre,
  onRetour,
  droite,
}: {
  titre: string;
  sousTitre?: string;
  onRetour?: () => void;
  droite?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const retour = () => {
    if (onRetour) onRetour();
    else if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  };

  return (
    <View
      className="flex-row items-center gap-3 px-4 pb-3"
      style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top + 10 }}>
      <Pressable
        onPress={retour}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        className="items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#d3cab9' }}>
        <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
      </Pressable>
      <View className="flex-1 min-w-0">
        <Text className="text-[17px] font-black text-[#1A1A1A]" numberOfLines={1}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text className="text-[12px] font-bold" style={{ color: '#047857' }} numberOfLines={1}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
      {droite}
    </View>
  );
}
