import { supabase } from "@/lib/supabase";
import { calculateCvMatchScore, isEducationEligible } from "@/lib/eligibility";
import { chargerNiveauxEtudes, comparerNiveaux } from "@/lib/niveauxEtudes";

// Seuil de l'avertissement "correspondance limitée", recalé le 2026-08-24
// sur la plage RÉELLEMENT produite par la métrique.
//
// L'ancienne valeur (40) était alignée sur match_job_offers
// (candidat/page.js, match_threshold: 0.4), mais ces deux nombres ne
// portent pas sur la même chose : match_threshold filtre des
// RECOMMANDATIONS (on veut un plancher très bas pour ne rien cacher),
// MATCH_WARNING_THRESHOLD déclenche une ALERTE à l'utilisateur. Aligner
// les deux avait un effet mesurable : le seuil était sous le plancher de
// la métrique, donc l'avertissement était mathématiquement inatteignable
// et ne s'est jamais déclenché une seule fois en production.
//
// Distribution mesurée — 7 profils types × 6 offres réelles, même modèle
// (gemini-embedding-001, 768 dims) et même formule que
// resume_offer_similarity :
//
//   profils ALIGNÉS sur l'offre      54% .. 73%   (18 mesures)
//   profils NON alignés              49% .. 64%   (24 mesures)
//   texte hors sujet total (recette) 49% .. 58%
//   texte identique à l'offre        100%
//
//   seuil 40% -> détecte  0/24 faibles, 0/18 fausses alertes  (inerte)
//   seuil 55% -> détecte  5/24 faibles, 1/18 fausses alertes
//   seuil 60% -> détecte 14/24 faibles, 5/18 fausses alertes
//   seuil 62% -> détecte 22/24 faibles, 7/18 fausses alertes
//
// Les deux distributions se CHEVAUCHENT (54-64% est un territoire
// commun) : aucun seuil ne les sépare proprement. Ce seuil n'est donc pas
// un classifieur de pertinence, c'est un détecteur de plancher de bruit —
// et c'est suffisant, parce que depuis le point 2e le niveau d'études est
// vérifié par un signal STRUCTURÉ séparé (comparerNiveaux), plus par ce
// pourcentage. 55 est retenu comme le meilleur compromis mesuré : il
// attrape le bruit sans crier au loup sur un candidat réellement aligné,
// ce qui userait l'avertissement jusqu'à le rendre invisible.
export const MATCH_WARNING_THRESHOLD = 55;

/**
 * Score de correspondance candidat/offre pour un CV précis, avec raisons
 * lisibles — appelé au clic sur "Postuler" (ApplyModal), jamais bloquant.
 * Même logique à deux niveaux que /api/postuler : priorité à la similarité
 * cosinus réelle (resume_offer_similarity, sur le CV effectivement
 * sélectionné) si son embedding est disponible, repli sur l'heuristique
 * mot-à-mot (calculateCvMatchScore) sinon — jamais un second algorithme
 * inventé pour ce seul avertissement.
 */
export async function computeApplicationMatch({
  resumeId,
  offerId,
  offerDescription,
  requiredEducation,
  candidateEducation,
  requiredEducationCode,
  candidateEducationCode,
  candidateSkills,
  candidateBio,
}) {
  let score = null;

  if (resumeId && offerId) {
    const { data: similarity, error } = await supabase.rpc("resume_offer_similarity", {
      p_resume_id: resumeId,
      p_offer_id: offerId,
    });
    if (!error && typeof similarity === "number") {
      score = Math.round(similarity * 100);
    }
  }

  if (score === null) {
    score = calculateCvMatchScore(candidateSkills || [], candidateBio || "", offerDescription || "");
  }

  const reasons = [];

  // Signal NIVEAU D'ÉTUDES — explicite, structuré, et calculé séparément du
  // score sémantique (mesures du 2026-08-24, point 1 : un embedding ne
  // capte que le thème, jamais le niveau ; un CM2 manœuvre obtenait 57%
  // face à une offre exigeant une Licence, et dépassait même le titulaire
  // de Licence sur 2 offres sur 3). Les deux signaux sont rendus l'un À
  // CÔTÉ de l'autre, jamais fusionnés en un seul pourcentage.
  let niveau = { statut: "inconnu", exige: null, candidat: null, ecart: 0 };
  try {
    const niveaux = await chargerNiveauxEtudes();
    niveau = comparerNiveaux(niveaux, candidateEducationCode, requiredEducationCode);
  } catch (err) {
    console.error("[matchScore] Référentiel des niveaux indisponible :", err?.message);
  }

  if (niveau.statut === "insuffisant") {
    reasons.push(
      `le niveau d'études demandé (${niveau.exige.libelle}) est supérieur à celui indiqué sur votre profil (${niveau.candidat.libelle})`
    );
  } else if (niveau.statut === "inconnu" && requiredEducationCode) {
    // Ne bloque pas et ne se présente pas comme une vérification faite :
    // on ne peut pas conclure, on le dit.
    reasons.push(
      "votre niveau d'études n'est pas renseigné sur votre profil : cette offre en demande un, il n'a pas pu être vérifié"
    );
  } else if (!requiredEducationCode && requiredEducation && requiredEducation !== "Aucun" && !isEducationEligible(candidateEducation, requiredEducation)) {
    // Repli sur l'ancienne comparaison en texte libre UNIQUEMENT pour une
    // offre dont la saisie n'a pas pu être normalisée (min_education_level_code
    // NULL) — jamais en doublon du signal structuré ci-dessus.
    reasons.push(`le niveau d'études demandé (${requiredEducation}) est supérieur à celui indiqué sur votre profil (${candidateEducation || "non renseigné"})`);
  }

  if (score < MATCH_WARNING_THRESHOLD) {
    reasons.push("peu de points communs entre votre profil (compétences, expérience) et la description de cette offre");
  }

  return { score, reasons, niveau };
}
