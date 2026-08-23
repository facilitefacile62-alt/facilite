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

// Contenu de la bannière hero pour une page filtrée sur un listing_type
// donné (/concours, /formations...) — même patron que /offres, dont le
// contenu "offre_emploi" ci-dessous reprend le texte d'origine à l'identique.
export const LISTING_TYPE_HERO = {
  offre_emploi: {
    eyebrow: "Catalogue des Emplois",
    title: "Offres d'Emploi Disponibles",
    description: "Explorez toutes les opportunités publiées par nos recruteurs au Sénégal et postulez en un clic.",
    icon: "fa-briefcase",
  },
  concours: {
    eyebrow: "Concours & Fonction Publique",
    title: "Avis de Concours & Examens Publics",
    description: "Consultez les concours officiels de l'État, recrutements spéciaux et examens professionnels.",
    icon: "fa-landmark",
  },
  formation: {
    eyebrow: "Catalogue des Formations",
    title: "Formations & Certifications Professionnelles",
    description: "Découvrez les opportunités de formation, montées en compétences et certifications professionnelles au Sénégal.",
    icon: "fa-graduation-cap",
  },
  recrutement_spontane: {
    eyebrow: "Recrutement Spontané",
    title: "Candidatures Spontanées",
    description: "Des entreprises vous invitent à leur envoyer votre profil, même sans poste précis affiché.",
    icon: "fa-inbox",
  },
  travail_sur_place: {
    eyebrow: "Travail sur Place",
    title: "Recrutements en Présentiel",
    description: "Journées de recrutement où vous pouvez vous présenter directement, sans candidature en ligne.",
    icon: "fa-people-arrows",
  },
  autre: {
    eyebrow: "Autres Opportunités",
    title: "Autres Publications",
    description: "Opportunités diverses ne rentrant pas dans les catégories habituelles.",
    icon: "fa-list",
  },
};
