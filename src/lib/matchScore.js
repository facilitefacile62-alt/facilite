import { supabase } from "@/lib/supabase";
import { calculateCvMatchScore, isEducationEligible } from "@/lib/eligibility";

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
export async function computeApplicationMatch({ resumeId, offerId, offerDescription, requiredEducation, candidateEducation, candidateSkills, candidateBio }) {
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
  if (requiredEducation && requiredEducation !== "Aucun" && !isEducationEligible(candidateEducation, requiredEducation)) {
    reasons.push(`le niveau d'études demandé (${requiredEducation}) est supérieur à celui indiqué sur votre profil (${candidateEducation || "non renseigné"})`);
  }
  if (score < MATCH_WARNING_THRESHOLD) {
    reasons.push("peu de points communs entre votre profil (compétences, expérience) et la description de cette offre");
  }

  return { score, reasons };
}
