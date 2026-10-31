import { Image } from 'expo-image';

// Le logo clé de Facilité : l'IMAGE détourée du propriétaire (assets/images/cle-detouree.png, fond transparent), à la place de l'ancien dessin vectoriel.
// `couleur` teinte la clé (blanc dans le rond foncé de la bascule) ; sans `couleur`, la clé garde son marron d'origine.
export const RATIO_CLE = 54 / 138;

export default function CleLogo({ hauteur, couleur }: { hauteur: number; couleur?: string }) {
  return (
    <Image
      source={require('@/assets/images/cle-detouree.png')}
      alt=""
      contentFit="contain"
      tintColor={couleur}
      style={{ width: Math.round(hauteur * RATIO_CLE * 10) / 10, height: hauteur }}
    />
  );
}
