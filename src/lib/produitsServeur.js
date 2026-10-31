// Lecture serveur des produits publics du Marketplace (clé publique : seulement ce que la lecture anonyme autorise, comme un navigateur). Colonnes EXPLICITES, jamais
// de select(*) : ni numéro WhatsApp, ni coordonnées GPS, ni identifiant de propriétaire ne sont lus (voir produitPublic.js).
import { SELECT_ARTICLE_PUBLIC, SELECT_BOUTIQUE_PUBLIC, articleEligible, idProduitValide } from "./produitPublic.js";

const REVALIDATION_S = 300;

const config = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && cle ? { url, cle } : null;
};

async function lire(chemin) {
  const c = config();
  if (!c) return null;
  try {
    const r = await fetch(`${c.url}/rest/v1/${chemin}`, {
      headers: { apikey: c.cle, Authorization: `Bearer ${c.cle}` },
      next: { revalidate: REVALIDATION_S },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export const urlSupabasePublique = () => process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/**
 * Un produit et sa boutique. `article` vaut null si l'article n'existe pas ou est inactif (la lecture anonyme ne renvoie que les articles actifs d'une boutique
 * active) ; `eligible` dit s'il peut être référencé (photo, prix, noms valides).
 */
export async function chargerProduit(id) {
  if (!idProduitValide(id)) return { article: null, boutique: null, eligible: false };
  const lignes = await lire(`marketplace_items?id=eq.${id}&select=${SELECT_ARTICLE_PUBLIC}&limit=1`);
  const article = Array.isArray(lignes) ? lignes[0] || null : null;
  if (!article || article.actif !== true) return { article: null, boutique: null, eligible: false };
  const boutiques = await lire(`marketplace_stores?id=eq.${article.store_id}&select=${SELECT_BOUTIQUE_PUBLIC}&limit=1`);
  const boutique = Array.isArray(boutiques) ? boutiques[0] || null : null;
  return { article, boutique, eligible: articleEligible(article, boutique, urlSupabasePublique()).eligible };
}

/** Tous les produits éligibles au référencement, du plus récemment modifié au plus ancien. Tableau vide en cas de panne (le plan du site n'est alors pas touché). */
export async function chargerProduitsEligibles(limite = 1000) {
  const [articles, boutiques] = await Promise.all([
    lire(`marketplace_items?select=${SELECT_ARTICLE_PUBLIC}&actif=eq.true&prix_xof=gt.0&order=updated_at.desc&limit=${limite}`),
    lire(`marketplace_stores?select=${SELECT_BOUTIQUE_PUBLIC}&actif=eq.true&limit=${limite}`),
  ]);
  if (!Array.isArray(articles) || !Array.isArray(boutiques)) return [];
  const parId = new Map(boutiques.map((b) => [b.id, b]));
  const base = urlSupabasePublique();
  return articles
    .map((article) => ({ article, boutique: parId.get(article.store_id) }))
    .filter((p) => articleEligible(p.article, p.boutique, base).eligible);
}
