// Échelle hiérarchique des diplômes pour la vérification d'éligibilité
export const EDUCATION_LEVELS = [
  "Aucun",
  "CFEE",
  "CM2",
  "BFEM",
  "BEPC",
  "CAP",
  "BEP",
  "Secondaire",
  "BAC",
  "BTS",
  "DUT",
  "DEUG",
  "BAC+2",
  "Licence",
  "Bachelor",
  "Master 1",
  "Master 2",
  "Ingénieur",
  "BAC+5",
  "Doctorat",
  "Médecine",
];

export const DETAILED_EDUCATION_LEVELS = [
  { value: "Aucun", label: "Aucun diplôme exigé" },
  { value: "CFEE", label: "CFEE" },
  { value: "CM2", label: "CM2 (Niveau Primaire)" },
  { value: "BFEM", label: "BFEM" },
  { value: "BEPC", label: "BEPC" },
  { value: "CAP", label: "CAP" },
  { value: "BEP", label: "BEP" },
  { value: "Secondaire", label: "Niveau Secondaire" },
  { value: "BAC", label: "BAC (Baccalauréat)" },
  { value: "BTS", label: "BTS" },
  { value: "DUT", label: "DUT" },
  { value: "DEUG", label: "DEUG" },
  { value: "BAC+2", label: "BAC+2" },
  { value: "Licence", label: "Licence (BAC+3)" },
  { value: "Bachelor", label: "Bachelor (BAC+3)" },
  { value: "Master 1", label: "Master 1 / Maîtrise (BAC+4)" },
  { value: "Master 2", label: "Master 2 (BAC+5)" },
  { value: "Ingénieur", label: "Diplôme d'Ingénieur (BAC+5)" },
  { value: "BAC+5", label: "BAC+5" },
  { value: "Doctorat", label: "Doctorat / Ph.D" },
  { value: "Médecine", label: "Doctorat en Médecine / Pharmacie" },
];

const LEVEL_RANK = {
  "aucun": 0,
  "cfee": 1,
  "cm2": 1,
  "primaire": 1,
  "bfem": 2,
  "bepc": 2,
  "brevet": 2,
  "cap": 2,
  "bep": 2,
  "secondaire": 3,
  "bac": 3,
  "baccalaureat": 3,
  "bts": 4,
  "dut": 4,
  "deug": 4,
  "bac+2": 4,
  "licence": 5,
  "bachelor": 5,
  "bac+3": 5,
  "master 1": 6,
  "maitrise": 6,
  "bac+4": 6,
  "master": 7,
  "master 2": 7,
  "ingenieur": 7,
  "bac+5": 7,
  "doctorat": 8,
  "phd": 8,
  "medecine": 8,
  "bac+8": 8,
};

export function getEducationRank(levelStr) {
  if (!levelStr) return 0;
  const normalized = String(levelStr).trim().toLowerCase();
  for (const [key, rank] of Object.entries(LEVEL_RANK)) {
    if (normalized.includes(key)) return rank;
  }
  return 0;
}

export function isEducationEligible(candidateLevel, requiredLevel) {
  // Désactivé à la demande de l'administrateur : ne bloque plus les candidatures
  return true;
}

/**
 * Calcul du score de match entre les compétences/CV du candidat et l'offre.
 *
 * Heuristique par recouvrement de mots-clés (pas de matching sémantique/IA) :
 * % des mots significatifs (≥4 lettres) de la description de l'offre
 * retrouvés dans le texte du candidat. Volontairement SANS plancher
 * artificiel — une version précédente forçait un minimum de 65% dès qu'un
 * candidat avait au moins une compétence renseignée, ce qui rendait le
 * filtre "< 50% → refus" quasiment impossible à déclencher, quel que soit
 * le rapport réel entre le profil et l'offre.
 */
export function calculateCvMatchScore(candidateSkills = [], candidateBio = "", offerDescription = "") {
  if (!offerDescription) return 100;

  const textToScan = `${Array.isArray(candidateSkills) ? candidateSkills.join(" ") : candidateSkills} ${candidateBio}`.toLowerCase();
  const words = offerDescription.toLowerCase().match(/\b[a-zà-ÿ]{4,}\b/g) || [];

  if (words.length === 0) return 100;

  const uniqueWords = Array.from(new Set(words));
  let matches = 0;

  for (const word of uniqueWords) {
    if (textToScan.includes(word)) {
      matches++;
    }
  }

  return Math.round((matches / uniqueWords.length) * 100);
}
