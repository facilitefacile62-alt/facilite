// Échelle hiérarchique des diplômes pour la vérification d'éligibilité
export const EDUCATION_LEVELS = [
  "Aucun",
  "CM2",
  "Brevet",
  "BAC",
  "Licence",
  "Master",
  "Doctorat",
];

const LEVEL_RANK = {
  "aucun": 0,
  "cm2": 1,
  "brevet": 2,
  "bepc": 2,
  "bac": 3,
  "baccalaureat": 3,
  "licence": 4,
  "bachelor": 4,
  "master": 5,
  "doctorat": 6,
  "phd": 6,
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
  if (!requiredLevel || requiredLevel === "Aucun") return true;
  const candidateRank = getEducationRank(candidateLevel);
  const requiredRank = getEducationRank(requiredLevel);
  return candidateRank >= requiredRank;
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
