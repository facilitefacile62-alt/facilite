import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

// Bouton d'action de la plateforme (règle du 12/10/2026) : capsule entièrement
// arrondie (rounded-full), pastille d'icône CIRCULAIRE à gauche, titre en gras
// et courte description. AUCUN chevron, flèche ni élément de navigation à
// droite. Fond #F3FBF7 et bordure 1,5 px #34D399 ; variante `sombre` vert foncé
// #0d3b34 avec texte blanc.
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
      className="w-full flex-row items-center gap-3 rounded-full"
      style={{
        paddingVertical: 8,
        paddingLeft: 8,
        paddingRight: 20,
        backgroundColor: sombre ? '#0d3b34' : '#F3FBF7',
        borderWidth: sombre ? 0 : 1.5,
        borderColor: '#34D399',
        // Désactivé : on atténue sans changer la forme.
        opacity: inactif && !chargement ? 0.55 : 1,
      }}>
      <View
        className="w-11 h-11 rounded-full items-center justify-center"
        style={{ backgroundColor: sombre ? 'rgba(255,255,255,0.14)' : '#D7F2EA' }}>
        {chargement ? (
          <ActivityIndicator size="small" color={sombre ? '#fff' : '#047857'} />
        ) : (
          <Ionicons name={icone} size={19} color={sombre ? '#fff' : '#047857'} />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[14.5px] font-black" style={{ color: sombre ? '#fff' : '#1A1A1A' }}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text className="text-[12px] mt-0.5" style={{ color: sombre ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
