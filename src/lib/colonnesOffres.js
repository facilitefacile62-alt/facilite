// Colonnes de job_offers réellement lues par les LISTES publiques (accueil, offres, recherche) et par les composants qu'elles affichent.
//
// Pourquoi : `select("*")` renvoie aussi `embedding` (le vecteur de recherche sémantique : environ 9,7 Ko par offre où il existe, 65 % des octets d'une
// ligne), `recherche_norm` (copie sans accents de titre + société + lieu + description : la description partait deux fois), et six colonnes jamais lues par
// ces écrans. Chaque requête de liste était donc plus lourde que nécessaire, et les listes se rafraîchissent souvent.
//
// À ne PAS faire : y ajouter une colonne qui n'existe pas (l'accueil lit offer.positions_count, offer.sector, offer.category, offer.project et offer.domain,
// absentes de la table : elles valent toujours undefined, donc null à l'affichage ; les sélectionner ferait échouer toute la requête). Une colonne ajoutée à
// une liste doit exister dans la table et figurer ici ; un test le vérifie.
export const COLONNES_LISTE_OFFRES = [
  "id",
  "title",
  "company",
  "location",
  "description",
  "created_at",
  "contract_type",
  "image_url",
  "audio_url",
  "contact_email",
  "contact_phone",
  "contact_whatsapp",
  "external_link",
  "deadline",
  "status",
  "is_active",
  "listing_type",
  "is_sponsored",
  "sponsor_priority",
  "sponsored_until",
  "min_education_level_code",
  "salary_range",
  "application_url",
  "application_email",
  "view_count",
  // La page Offres la transmet à la candidature (recruiterId de la modale).
  "recruiter_id",
];

export const SELECT_LISTE_OFFRES = COLONNES_LISTE_OFFRES.join(", ");
