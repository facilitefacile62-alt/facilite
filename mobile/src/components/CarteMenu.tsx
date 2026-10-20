import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

// Ligne de menu « bouton séparé » de Ma boutique (maquettes du 20/10/2026) : carte blanche sur le fond crème #F2F0EA,
// bordure beige #D9D1C1, légère ombre, coins de 16 px, hauteur d'au moins 64 px, icône verte dans un rond vert menthe,
// titre en gras + courte description, flèche › dans un petit rond. Une pastille « Activé / Désactivé » peut remplacer la flèche.
export const FOND_CARTES = '#F2F0EA';

export function CarteMenu({
  icone,
  titre,
  sous,
  onPress,
  pastille,
  droite,
  rouge,
  sansFleche,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  sous?: string;
  onPress: () => void;
  pastille?: { texte: string; actif: boolean };
  /** Élément posé à droite à la place de la flèche (interrupteur…). */
  droite?: ReactNode;
  rouge?: boolean;
  sansFleche?: boolean;
}) {
  const couleurIcone = rouge ? '#DC2626' : '#059669';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D9D1C1',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: rouge ? '#FEE2E2' : '#D7F2EA',
          borderWidth: 1,
          borderColor: rouge ? '#FECACA' : '#BFEBDC',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icone} size={19} color={couleurIcone} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: rouge ? '#DC2626' : '#1A1A1A' }} numberOfLines={1}>
          {titre}
        </Text>
        {sous ? (
          <Text style={{ fontSize: 12, marginTop: 1, color: 'rgba(0,0,0,0.5)' }} numberOfLines={2}>
            {sous}
          </Text>
        ) : null}
      </View>
      {pastille ? (
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: pastille.actif ? '#D1FAE5' : '#E5E7EB' }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: pastille.actif ? '#047857' : '#4B5563' }}>{pastille.texte}</Text>
        </View>
      ) : null}
      {droite}
      {pastille || droite || sansFleche ? null : (
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0EEE8', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={15} color="#1A1A1A" />
        </View>
      )}
    </Pressable>
  );
}

/** Groupe de cartes séparées par un espace (pas de cadre commun). */
export function GroupeCartes({ children }: { children: ReactNode }) {
  return <View style={{ gap: 10, marginBottom: 18 }}>{children}</View>;
}
