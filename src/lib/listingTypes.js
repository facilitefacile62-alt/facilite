// Doit rester synchronisé avec le CHECK de job_offers.listing_type
// (migration 20260823110000_job_offers_listing_type.sql) et avec le prompt
// de classification du Scanner IA (documentParser.js,
// extractFullJobOfferFromPosterWithGemini).
export const LISTING_TYPE_LABELS = {
  offre_emploi: "Offre d'emploi",
  concours: "Concours",
  formation: "Formation",
  recrutement_spontane: "Recrutement spontané",
  travail_sur_place: "Travail sur place",
  autre: "Autre",
};
