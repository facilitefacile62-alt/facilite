import { useCallback, useEffect, useState } from 'react';

import {
  chargerArticles,
  chargerArticlesProches,
  type ArticleMarketplace,
  type Position,
} from '@/lib/marketplace';

// Liste d'articles du Marketplace filtrée par catégorie et par texte, ou
// triée par distance quand une position est fournie ("Autour de moi").
// La recherche est temporisée (400 ms) pour ne pas interroger la base à chaque
// frappe. `articles === null` = premier chargement en cours.
export function useMarketplaceArticles(categorie: string | null, texte: string, position: Position | null = null) {
  const [articles, setArticles] = useState<ArticleMarketplace[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [actualisation, setActualisation] = useState(false);
  const [version, setVersion] = useState(0);
  const latitude = position?.latitude ?? null;
  const longitude = position?.longitude ?? null;

  useEffect(() => {
    let annule = false;
    const delai = setTimeout(async () => {
      try {
        const liste =
          latitude !== null && longitude !== null
            ? await chargerArticlesProches({ position: { latitude, longitude }, categorie, texte })
            : await chargerArticles({ categorie, texte });
        if (annule) return;
        setArticles(liste);
        setErreur(false);
      } catch {
        if (!annule) setErreur(true);
      } finally {
        if (!annule) setActualisation(false);
      }
    }, texte ? 400 : 0);

    return () => {
      annule = true;
      clearTimeout(delai);
    };
  }, [categorie, texte, latitude, longitude, version]);

  const recharger = useCallback(() => {
    setActualisation(true);
    setVersion((v) => v + 1);
  }, []);

  return { articles, erreur, actualisation, recharger };
}
