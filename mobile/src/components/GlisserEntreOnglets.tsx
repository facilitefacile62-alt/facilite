import { useRouter, type Href } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';

import { geste } from '@/lib/glisserOngletsLogique';

// Glisser du doigt vers la gauche ou la droite pour passer d'un onglet à l'autre de « Modifier infos » (À propos ↔ Paramètres), en plus de
// toucher le nom de l'onglet. Seul un geste franchement HORIZONTAL compte : le défilement vertical de la page et les listes ne sont pas gênés.
export default function GlisserEntreOnglets({ versGauche, versDroite, children }: { versGauche?: Href; versDroite?: Href; children: ReactNode }) {
  const router = useRouter();
  const reponseur = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => geste(g.dx, g.dy, false) !== null,
        onPanResponderRelease: (_e, g) => {
          const sens = geste(g.dx, g.dy, true);
          // Doigt vers la gauche → onglet de droite ; doigt vers la droite → onglet de gauche.
          if (sens === 'gauche' && versDroite) router.replace(versDroite);
          if (sens === 'droite' && versGauche) router.replace(versGauche);
        },
      }),
    [router, versGauche, versDroite]
  );

  return (
    <View style={{ flex: 1 }} {...reponseur.panHandlers}>
      {children}
    </View>
  );
}
