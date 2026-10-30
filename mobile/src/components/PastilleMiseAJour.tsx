import { View } from 'react-native';

// Petite pastille rouge posée sur l'icône ☰ des en-têtes (Facilité et Locaux) quand une mise à jour de l'application est disponible : elle invite à ouvrir
// le menu, où la tuile « Mise à jour » est active. Elle disparaît d'elle-même quand l'application est à jour.
export default function PastilleMiseAJour({ visible, fond }: { visible: boolean; fond: string }) {
  if (!visible) return null;
  return (
    <View
      accessibilityLabel="Mise à jour disponible"
      pointerEvents="none"
      style={{ position: 'absolute', top: -3, right: -4, width: 11, height: 11, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: fond }}
    />
  );
}
