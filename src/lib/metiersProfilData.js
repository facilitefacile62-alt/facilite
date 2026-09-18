// Taxonomie de métiers/situations pour le sélecteur "Ton métier ou ta
// situation actuelle" du profil candidat — remplace le champ texte libre
// "Titre professionnel" par une liste organisée par domaine, chacun avec
// une icône, plus une option "Saisir un autre métier" pour tout ce qui ne
// s'y trouve pas. Demande explicite de l'utilisateur, avec une capture de
// référence pour la structure et le contenu par catégorie.
export const CATEGORIES_METIERS = [
  {
    id: "situation_actuelle",
    label: "Situation actuelle",
    icone: "🌱",
    metiers: [
      { label: "En recherche d'emploi", emoji: "🔍" },
      { label: "Je ne travaille pas encore", emoji: "🌱" },
      { label: "Étudiant", emoji: "🎓" },
      { label: "Au foyer", emoji: "🏠" },
      { label: "Retraité", emoji: "🌅" },
    ],
  },
  {
    id: "sante",
    label: "Santé",
    icone: "⚕️",
    metiers: [
      { label: "Médecin", emoji: "🩺" },
      { label: "Infirmier", emoji: "💉" },
      { label: "Pharmacien", emoji: "💊" },
      { label: "Dentiste", emoji: "🦷" },
      { label: "Sage-femme", emoji: "🤱" },
      { label: "Kinésithérapeute", emoji: "🦴" },
      { label: "Psychologue", emoji: "🧠" },
      { label: "Vétérinaire", emoji: "🐾" },
      { label: "Technicien de labo", emoji: "🧪" },
      { label: "Aide-soignant", emoji: "🧑‍⚕️" },
    ],
  },
  {
    id: "tech_numerique",
    label: "Tech & Numérique",
    icone: "💻",
    metiers: [
      { label: "Ingénieur logiciel", emoji: "💻" },
      { label: "Développeur web", emoji: "🌐" },
      { label: "Data scientist", emoji: "📊" },
      { label: "Technicien informatique", emoji: "🖥️" },
      { label: "Administrateur réseau", emoji: "📡" },
      { label: "Expert cybersécurité", emoji: "🔒" },
      { label: "Chef de produit", emoji: "📱" },
      { label: "Designer UX/UI", emoji: "🎨" },
    ],
  },
  {
    id: "ingenierie",
    label: "Ingénierie",
    icone: "⚙️",
    metiers: [
      { label: "Ingénieur civil", emoji: "🏗️" },
      { label: "Ingénieur mécanique", emoji: "⚙️" },
      { label: "Ingénieur électrique", emoji: "🔌" },
      { label: "Architecte", emoji: "📐" },
      { label: "Ingénieur industriel", emoji: "🏭" },
      { label: "Agronome", emoji: "🌾" },
      { label: "Géologue", emoji: "🪨" },
      { label: "Géomètre", emoji: "🧭" },
    ],
  },
  {
    id: "business_finance",
    label: "Business & Finance",
    icone: "💼",
    metiers: [
      { label: "Comptable", emoji: "🧮" },
      { label: "Auditeur", emoji: "📋" },
      { label: "Banquier", emoji: "🏦" },
      { label: "Analyste financier", emoji: "📈" },
      { label: "Entrepreneur", emoji: "🚀" },
      { label: "Manager", emoji: "🗂️" },
      { label: "Consultant", emoji: "🤝" },
      { label: "Responsable RH", emoji: "👥" },
      { label: "Marketing / Communication", emoji: "📣" },
      { label: "Commercial", emoji: "🎁" },
      { label: "Caissier", emoji: "🧾" },
      { label: "Agent immobilier", emoji: "🏡" },
      { label: "Assureur", emoji: "🛡️" },
    ],
  },
  {
    id: "droit_public",
    label: "Droit & Public",
    icone: "⚖️",
    metiers: [
      { label: "Avocat", emoji: "⚖️" },
      { label: "Magistrat", emoji: "👨‍⚖️" },
      { label: "Notaire", emoji: "📜" },
      { label: "Policier", emoji: "👮" },
      { label: "Militaire", emoji: "🎖️" },
      { label: "Pompier", emoji: "🚒" },
      { label: "Fonctionnaire", emoji: "🏛️" },
      { label: "Douanier", emoji: "🛂" },
    ],
  },
  {
    id: "education",
    label: "Éducation",
    icone: "🎓",
    metiers: [
      { label: "Enseignant", emoji: "🍎" },
      { label: "Professeur d'université", emoji: "🎓" },
      { label: "Formateur", emoji: "📚" },
      { label: "Chercheur", emoji: "🔬" },
      { label: "Traducteur", emoji: "🗣️" },
      { label: "Bibliothécaire", emoji: "📖" },
    ],
  },
  {
    id: "metiers_artisanat",
    label: "Métiers & Artisanat",
    icone: "🔧",
    metiers: [
      { label: "Électricien", emoji: "💡" },
      { label: "Plombier", emoji: "🔧" },
      { label: "Mécanicien", emoji: "🚗" },
      { label: "Menuisier", emoji: "🪚" },
      { label: "Maçon", emoji: "🧱" },
      { label: "Soudeur", emoji: "🔥" },
      { label: "Couturier", emoji: "✂️" },
      { label: "Coiffeur", emoji: "💇" },
      { label: "Boulanger", emoji: "🥖" },
      { label: "Cuisinier", emoji: "🍳" },
      { label: "Agriculteur", emoji: "🌿" },
      { label: "Chauffeur", emoji: "🚕" },
      { label: "Agent magasinier", emoji: "📦" },
      { label: "Agent de sécurité", emoji: "🛡️" },
    ],
  },
  {
    id: "creation_medias",
    label: "Création & Médias",
    icone: "🎨",
    metiers: [
      { label: "Journaliste", emoji: "📰" },
      { label: "Photographe", emoji: "📷" },
      { label: "Graphiste", emoji: "✏️" },
      { label: "Artiste", emoji: "🎭" },
      { label: "Musicien", emoji: "🎵" },
      { label: "Écrivain", emoji: "✍️" },
      { label: "Créateur de contenu", emoji: "🎬" },
      { label: "Décorateur d'intérieur", emoji: "🛋️" },
      { label: "Styliste de mode", emoji: "👗" },
    ],
  },
  {
    id: "services",
    label: "Services",
    icone: "🤝",
    metiers: [
      { label: "Imam", emoji: "🕌" },
      { label: "Travailleur social", emoji: "🤲" },
      { label: "Chef cuisinier", emoji: "👨‍🍳" },
      { label: "Restaurateur", emoji: "🍽️" },
      { label: "Serveur", emoji: "🍴" },
      { label: "Personnel hôtelier", emoji: "🏨" },
      { label: "Steward", emoji: "✈️" },
      { label: "Pilote", emoji: "🛫" },
      { label: "Commerçant", emoji: "🏪" },
    ],
  },
];

/** Recherche insensible à la casse/aux accents sur le libellé du métier. */
export function rechercherMetiers(texte) {
  const q = (texte || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!q) return CATEGORIES_METIERS;
  return CATEGORIES_METIERS.map((cat) => ({
    ...cat,
    metiers: cat.metiers.filter((m) =>
      m.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q)
    ),
  })).filter((cat) => cat.metiers.length > 0);
}
