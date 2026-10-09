import { Ionicons } from '@expo/vector-icons';
import { Pressable, Switch, Text, View } from 'react-native';

// Lignes de menu des maquettes Marketplace (59, 69, 74, 79) : un pictogramme
// dans un carré gris clair, un titre en gras, un sous-titre discret, puis un
// chevron — ou un lien externe, un compteur vert, un interrupteur.
// Les maquettes n'utilisent QUE des pictogrammes colorés (📋 📦 🚀…), jamais
// des icônes en contour : c'est ce qui donne leur identité à ces listes.
const FOND_PICTO = '#F0EEE8';

export function Picto({ emoji, rouge }: { emoji: string; rouge?: boolean }) {
  return (
    <View
      className="items-center justify-center"
      style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: rouge ? '#FEF2F2' : FOND_PICTO }}>
      <Text style={{ fontSize: 17 }}>{emoji}</Text>
    </View>
  );
}

export function LigneMenu({
  emoji,
  titre,
  sous,
  compteur,
  externe,
  rouge,
  droite,
  derniere,
  onPress,
}: {
  emoji: string;
  titre: string;
  sous?: string;
  /** Pastille verte avec un nombre RÉEL (jamais inventé) : Mes annonces, Mes commandes. */
  compteur?: number | null;
  externe?: boolean;
  rouge?: boolean;
  /** Valeur affichée avant le chevron, par exemple « Voir ma boutique ». */
  droite?: React.ReactNode;
  derniere?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 px-4 py-3.5"
      style={derniere ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
      <Picto emoji={emoji} rouge={rouge} />
      <View className="flex-1 min-w-0">
        <Text className="text-[14.5px] font-extrabold" style={{ color: rouge ? '#DC2626' : '#1A1A1A' }}>
          {titre}
        </Text>
        {sous ? <Text className="text-[11.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.45)' }}>{sous}</Text> : null}
      </View>
      {typeof compteur === 'number' && compteur > 0 ? (
        <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: '#D1FAE5' }}>
          <Text className="text-[12px] font-black text-[#047857]">{compteur}</Text>
        </View>
      ) : null}
      {droite}
      {rouge ? null : <Ionicons name={externe ? 'open-outline' : 'chevron-forward'} size={15} color="rgba(0,0,0,0.3)" />}
    </Pressable>
  );
}

/** Ligne à interrupteur (maquette 79). `bientot` : réglage sans fonction réelle derrière, grisé et signalé. */
export function LigneBascule({
  emoji,
  titre,
  sous,
  valeur,
  onChange,
  occupe,
  bientot,
  derniere,
}: {
  emoji: string;
  titre: string;
  sous?: string;
  valeur: boolean;
  onChange: (v: boolean) => void;
  occupe?: boolean;
  bientot?: boolean;
  derniere?: boolean;
}) {
  return (
    <View
      className="flex-row items-center gap-3 px-4 py-3.5"
      style={derniere ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
      <Picto emoji={emoji} />
      <View className="flex-1 min-w-0">
        <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">{titre}</Text>
        <Text className="text-[11.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.45)' }}>
          {bientot ? 'Bientôt disponible' : sous}
        </Text>
      </View>
      <Switch
        value={valeur}
        onValueChange={onChange}
        disabled={occupe || bientot}
        trackColor={{ true: '#10B981' }}
      />
    </View>
  );
}
