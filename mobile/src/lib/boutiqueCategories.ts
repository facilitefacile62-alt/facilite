// Listes de référence pour les onglets Service et Établissement de « Ma
// boutique » — mêmes valeurs que le site (MarketplaceClient.jsx), pour que
// les catégories choisies sur mobile s'affichent correctement sur le web et
// inversement. `categorie_etablissement` est contrainte par la base
// (modifier_ma_boutique, 20260925130000) ; `metier` est du texte libre côté
// base, ces propositions ne sont que des raccourcis de saisie.

export const METIERS_SERVICE = [
  'Chauffeur', 'Mécanicien', 'Livreur', 'Plombier', 'Électricien', 'Maçon',
  'Peintre bâtiment', 'Menuisier', 'Femme de ménage', 'Jardinier',
  'Coiffeur/Coiffeuse', 'Couturier/Couturière', 'Pharmacien', 'Infirmier/Infirmière',
  'Sage-femme', 'Professeur particulier', 'Photographe',
];

export const CATEGORIES_ETABLISSEMENT: { id: string; label: string }[] = [
  { id: 'point_wave', label: 'Point Wave' },
  { id: 'pharmacie', label: 'Pharmacie' },
  { id: 'clinique', label: 'Clinique' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'fast_food', label: 'Fast-food' },
  { id: 'malibu', label: 'Malibu' },
  { id: 'dibiterie', label: 'Dibiterie' },
  { id: 'jus_boissons', label: 'Jus & Boissons' },
  { id: 'boulangerie', label: 'Boulangerie' },
  { id: 'patisserie', label: 'Pâtisserie' },
  { id: 'beignet_fataya', label: 'Beignet ak Fataya' },
  { id: 'barber', label: 'Barber' },
  { id: 'tresses', label: 'Tresses' },
  { id: 'parfumerie', label: 'Parfumerie' },
  { id: 'esthetique_ongles', label: 'Esthétique & Ongles' },
  { id: 'soins_bio', label: 'Soins & Bio' },
  { id: 'musculation_fitness', label: 'Musculation / Fitness' },
  { id: 'terrain_foot', label: 'Terrain de foot' },
  { id: 'terrain_basket', label: 'Terrain de basket' },
  { id: 'alimentation_boutique', label: 'Alimentation / Boutique' },
  { id: 'cafe_the', label: 'Café ak Thé' },
  { id: 'banque_finance', label: 'Banque & Finance' },
  { id: 'hotellerie', label: 'Hôtel & Hébergement' },
  { id: 'transport_gare', label: 'Gare & Transport' },
  { id: 'bus_mobilite', label: 'Arrêt de bus' },
  { id: 'autre', label: 'Autre établissement' },
];

export function libelleCategorieEtablissement(id: string | null | undefined): string {
  return CATEGORIES_ETABLISSEMENT.find((c) => c.id === id)?.label ?? 'Non renseignée';
}
