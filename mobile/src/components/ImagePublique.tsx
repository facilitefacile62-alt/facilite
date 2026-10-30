import { Image, type ImageProps } from 'expo-image';
import { useMemo, useState } from 'react';

import { candidatsImage } from '@/lib/imagesPubliques';

type Props = Omit<ImageProps, 'source' | 'cachePolicy'> & {
  source: { uri?: string | null } | null | undefined;
  /** Largeur de variante réduite si l'image est une affiche récente servie par le Worker (petites vignettes). */
  largeur?: 480 | 960;
};

/**
 * Image PUBLIQUE (offres, Marketplace, stories) : servie par le Worker Cloudflare quand l'interrupteur est ouvert, avec repli automatique et unique par
 * étape (variante réduite -> image entière -> Supabase). Le cache disque d'expo-image garde l'image sur le téléphone : elle n'est plus retéléchargée.
 * Ne jamais l'utiliser pour un fichier privé (voir ImagePrivee).
 */
export default function ImagePublique({ source, largeur, onError, ...reste }: Props) {
  const uri = source?.uri ?? '';
  const candidats = useMemo(() => candidatsImage(uri, largeur), [uri, largeur]);
  const [echec, setEchec] = useState({ uri, n: 0 });
  const n = echec.uri === uri ? echec.n : 0;
  const courante = candidats[Math.min(n, candidats.length - 1)];
  return (
    <Image
      {...reste}
      source={courante ? { uri: courante } : undefined}
      cachePolicy="disk"
      onError={(e) => {
        if (n < candidats.length - 1) setEchec({ uri, n: n + 1 });
        else onError?.(e);
      }}
    />
  );
}
