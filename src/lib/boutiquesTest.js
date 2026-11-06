// Boutiques de TEST : visibles seulement sur les aperçus (preview), jamais en production.
// Pourquoi ici : la base ne marque pas les boutiques de test (marketplace_stores n'a aucune colonne de ce genre) et l'indicateur is_test_account des propriétaires (table profiles) n'est pas lisible avec la clé publique
// de la carte. Le masquage se fait donc dans le code, sans toucher à la base : liste d'identifiants connus + nom contenant « test » ou « e2e » (mot entier). Toute NOUVELLE boutique de test dont le nom ne contient
// pas ces mots doit être ajoutée à IDS_BOUTIQUES_TEST (ou, mieux, marquée en base par une migration validée : décision à prendre à part).
export const IDS_BOUTIQUES_TEST = new Set([
  "d23fe736-1609-464b-a5c4-dacd19b0203c", // « facile demo »
  "d10143d7-b2cf-4cce-94de-e5e017577545", // « Candidat Test E2E »
  "dd828aa7-a34f-4bfa-b7c6-a12967c92d8b", // « masque »
]);
const NOM_DE_TEST = /(\btest\b|\be2e\b)/i;

export function estBoutiqueDeTest(boutique) {
  return IDS_BOUTIQUES_TEST.has(boutique?.id) || NOM_DE_TEST.test(String(boutique?.nom || ""));
}

/** Liste à afficher : en preview tout, en production sans les boutiques de test. */
export function boutiquesVisibles(liste, enPreview) {
  return enPreview ? liste : liste.filter((b) => !estBoutiqueDeTest(b));
}
