import { supabase } from "@/lib/supabase";
import { calculateCvMatchScore, isEducationEligible } from "@/lib/eligibility";
import { chargerNiveauxEtudes, comparerNiveaux } from "@/lib/niveauxEtudes";

// Même seuil que la recommandation candidat (candidat/page.js,
// match_job_offers match_threshold: 0.4) — un seul seuil "correspondance
// faible" dans tout le produit, pas un second nombre inventé pour ce point.
export const MATCH_WARNING_THRESHOLD = 40;

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
