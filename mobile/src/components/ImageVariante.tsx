import { Image, type ImageProps } from 'expo-image';
import React, { useState } from 'react';
import { urlVarianteImage, type LargeurVariante } from '@/lib/variantesImageLogique';

type Props = Omit<ImageProps, 'source'> & { uri: string; largeur?: LargeurVariante };

/**
 * Image publiée affichée en variante 480 ou 960 px (au lieu des 1280 px d'origine) : moins d'octets téléchargés pour une vignette ou une carte.
 * Si la variante n'existe pas (404), on retombe UNE fois sur l'image d'origine : l'écran n'affiche jamais un cadre vide à cause d'une variante manquante.
 * Sans `largeur`, se comporte exactement comme `Image` avec l'adresse d'origine.
 */
export default function ImageVariante({ uri, largeur, onError, ...reste }: Props) {
  const [repliPour, setRepliPour] = useState<string | null>(null);
  const adresse = repliPour === uri ? uri : urlVarianteImage(uri, largeur);
  return (
    <Image
      {...reste}
      source={{ uri: adresse }}
      onError={(e) => {
        if (adresse !== uri) setRepliPour(uri);
        else onError?.(e);
      }}
    />
  );
}
