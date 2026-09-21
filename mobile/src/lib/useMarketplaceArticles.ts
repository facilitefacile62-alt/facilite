import { useCallback, useEffect, useState } from 'react';

import { chargerArticles, type ArticleMarketplace } from '@/lib/marketplace';

// Liste d'articles du Marketplace filtrée par catégorie et par texte.
// La recherche est temporisée (400 ms) pour ne pas interroger la base à chaque
// frappe. `articles === null` = premier chargement en cours.
export function useMarketplaceArticles(categorie: string | null, texte: string) {
  const [articles, setArticles] = useState<ArticleMarketplace[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [actualisation, setActualisation] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let annule = false;
    const delai = setTimeout(async () => {
      try {
        const liste = await chargerArticles({ categorie, texte });
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
  }, [categorie, texte, version]);

  const recharger = useCallback(() => {
    setActualisation(true);
    setVersion((v) => v + 1);
  }, []);

  return { articles, erreur, actualisation, recharger };
}
