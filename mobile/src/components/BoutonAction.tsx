import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

// Bouton d'action de la charte §2.1 — la forme du bouton « Compresser PDF » :
// rectangle arrondi (14 px), fond #F3FBF7, bordure 1,5 px #34D399, sans
// ombre ; à gauche un carré arrondi #D7F2EA (40 px) portant l'icône, au
// centre un titre gras et un sous-titre discret, à droite un chevron.
// Variante `sombre` : « Continuer avec l'e-mail » garde son vert foncé
// #0d3b34 avec la même forme et un texte blanc.
export default function BoutonAction({
  titre,
  sousTitre,
  icone,
  onPress,
  desactive,
  chargement,
  sombre,
}: {
  titre: string;
  sousTitre?: string;
  icone: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  desactive?: boolean;
  chargement?: boolean;
  sombre?: boolean;
}) {
  const inactif = Boolean(desactive || chargement);
  return (
    <Pressable
      onPress={onPress}
      disabled={inactif}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif }}
      className="w-full flex-row items-center gap-3 rounded-[14px] p-3"
      style={{
        backgroundColor: sombre ? '#0d3b34' : '#F3FBF7',
        borderWidth: sombre ? 0 : 1.5,
        borderColor: '#34D399',
        // Désactivé : on atténue sans changer la forme, comme la maquette 43.
        opacity: inactif && !chargement ? 0.55 : 1,
      }}>
      <View
        className="w-10 h-10 rounded-[10px] items-center justify-center"
        style={{ backgroundColor: sombre ? 'rgba(255,255,255,0.14)' : '#D7F2EA' }}>
        {chargement ? (
          <ActivityIndicator size="small" color={sombre ? '#fff' : '#047857'} />
        ) : (
          <Ionicons name={icone} size={18} color={sombre ? '#fff' : '#047857'} />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[14px] font-extrabold" style={{ color: sombre ? '#fff' : '#1A1A1A' }}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text className="text-[12px] mt-0.5" style={{ color: sombre ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)' }}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={sombre ? '#fff' : 'rgba(0,0,0,0.3)'} />
    </Pressable>
  );
}
