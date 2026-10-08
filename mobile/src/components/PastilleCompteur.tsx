import { Text, View } from 'react-native';

import { libellePastille } from '@/lib/notifications';

// Pastille de notification (charte §1.4) : rouge, chiffre blanc, en haut à
// droite de l'icône, « 9+ » au-delà de 9, RIEN si rien n'est non lu. Elle
// est posée en absolu par-dessus l'icône, et volontairement petite pour ne
// jamais déborder de la barre du bas.
const ROUGE = '#EF4444';

export default function PastilleCompteur({ valeur }: { valeur: number }) {
  const libelle = libellePastille(valeur);
  if (!libelle) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -5,
        right: -9,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3.5,
        borderRadius: 8,
        backgroundColor: ROUGE,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', lineHeight: 12 }}>{libelle}</Text>
    </View>
  );
}
