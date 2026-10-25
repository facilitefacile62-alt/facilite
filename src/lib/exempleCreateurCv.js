// Exemple de départ du créateur de CV (/creer-cv) et garde-fou « Écrivez vos informations avant de continuer ».
//
// Jusqu'au 25/10/2026, le créateur démarrait avec le CV complet d'une vraie personne (nom, téléphone, e-mail, LinkedIn, entreprise, écoles, profil rédigé) :
// quelqu'un qui téléchargeait ou payait sans tout réécrire produisait — et enregistrait dans ses CV — un CV avec cette identité. L'exemple d'aujourd'hui est
// NEUTRE et clairement fictif (« Prénom NOM », « Votre métier », numéro en 000), et le téléchargement, le paiement et l'impression sont refusés tant que le nom ou
// le téléphone sont encore ceux d'un exemple (l'ancien ou le nouveau).

/** Exemple neutre : une copie neuve à chaque appel (le créateur modifie ses données, jamais une valeur partagée). */
export function exempleCvNeutre() {
  return {
    firstName: "Prénom",
    lastName: "NOM",
    jobTitle: "Votre métier",
    email: "prenom.nom@exemple.com",
    phone: "+221 77 000 00 00",
    address: "",
    postalCode: "",
    city: "Votre ville",
    birthDate: "",
    drivingLicense: "",
    nationality: "Sénégalaise",
    maritalStatus: "",
    linkedin: "",
    availability: "Disponible",
    cvLang: "Français",
    photoZoom: 1,
    photoX: 50,
    photoY: 50,
    experiences: [
      {
        id: 1,
        title: "Intitulé de votre poste",
        employer: "Nom de l'entreprise",
        city: "Ville",
        startDate: "Jan 2022",
        endDate: "",
        current: true,
        description: "• Décrivez ici vos missions principales.\n• Indiquez vos résultats et vos réalisations.",
      },
    ],
    educations: [
      {
        id: 1,
        degree: "Intitulé de votre diplôme",
        school: "Nom de votre école",
        city: "Ville",
        startDate: "Jan 2018",
        endDate: "Jan 2021",
        current: false,
        description: "",
      },
    ],
    skills: [
      { id: 1, name: "Votre compétence principale", level: "Avancé" },
      { id: 2, name: "Une autre compétence", level: "Avancé" },
    ],
    profile: "Écrivez ici deux ou trois phrases qui vous présentent : votre métier, votre expérience et ce que vous cherchez.",
    languages: [{ id: 1, name: "Français", level: "Langue véhiculaire" }],
    qualities: [],
    itSkills: [{ id: 1, name: "Pack Office (Word, Excel)" }],
    hobbies: [{ id: 1, name: "Vos centres d'intérêt" }],
    sectionTitles: {
      contact: "Coordonnées",
      experience: "EXPÉRIENCE",
      education: "FORMATION",
      skills: "APTITUDES",
      profile: "PROFIL",
      languages: "LANGUES",
      itSkills: "LOGICIELS",
      qualities: "CERTIFICATIONS",
      hobbies: "CENTRES D'INTÉRÊT",
    },
  };
}

const simplifier = (v) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Noms d'exemple (prénom et nom collés, dans les deux ordres) : l'ANCIEN exemple et le nouveau.
const NOMS_EXEMPLE = new Set(["macoumbasamake", "samakemacoumba", "prenomnom", "nomprenom"]);
// Neuf derniers chiffres des téléphones d'exemple : l'ancien et le nouveau (000 000 000).
const TELEPHONES_EXEMPLE = new Set(["771400832", "770000000"]);

/**
 * Vrai si la personne doit d'abord écrire ses informations : nom vide, nom d'un exemple, ou téléphone d'un exemple.
 * (Un téléphone vide n'est pas bloqué : il n'est pas obligatoire.)
 */
export function identiteAEcrire(cv) {
  const nom = simplifier(cv?.firstName) + simplifier(cv?.lastName);
  if (nom === "" || NOMS_EXEMPLE.has(nom)) return true;
  const chiffres = String(cv?.phone ?? "").replace(/\D/g, "");
  return chiffres.length >= 9 && TELEPHONES_EXEMPLE.has(chiffres.slice(-9));
}

export const MESSAGE_ECRIVEZ_VOS_INFORMATIONS = "Écrivez vos informations avant de continuer.";
