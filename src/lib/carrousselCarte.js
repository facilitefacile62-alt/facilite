// Produits du panneau « Carrousel » de la carte : tous les produits (avec photo) des boutiques actuellement affichées sur la carte, dans l'ordre reçu.
// Logique pure, sans React.

/**
 * @param {object[]} articles articles de la carte (déjà filtrés par la recherche)
 * @param {{ id: string|number }[]} boutiquesAffichees boutiques visibles sur la carte
 * @returns {object[]} articles ayant une photo et dont la boutique est affichée, sans doublon
 */
export function produitsDuCarrousselCarte(articles, boutiquesAffichees) {
  const ids = new Set((boutiquesAffichees || []).map((b) => String(b?.id)));
  const vus = new Set();
  const sortie = [];
  for (const a of Array.isArray(articles) ? articles : []) {
    if (!a || a.id == null || vus.has(a.id)) continue;
    const boutique = String(a.boutique_id ?? a.boutiqueId ?? a.boutique?.id ?? "");
    if (!boutique || !ids.has(boutique)) continue;
    if (!Array.isArray(a.photos) || !a.photos[0]) continue;
    vus.add(a.id);
    sortie.push(a);
  }
  return sortie;
}
