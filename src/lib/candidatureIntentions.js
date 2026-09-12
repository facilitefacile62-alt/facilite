"use client";

import { supabase } from "@/lib/supabase";

// Mémorise côté serveur l'intention de candidater à une offre, quand
// l'utilisateur n'a pas encore d'email confirmé — voir
// supabase/migrations/20260912030000_candidature_email_obligatoire.sql.
// Jamais en sessionStorage/état client : un lien de validation d'email
// s'ouvre souvent dans un nouvel onglet ou un autre appareil.
export async function enregistrerIntentionCandidature({
  userId,
  jobId = null,
  jobOfferId = null,
  recruiterId = null,
  jobTitle,
  company,
  recruiterEmail = null,
}) {
  const { error } = await supabase.from("candidature_intentions").insert({
    user_id: userId,
    job_id: jobId,
    job_offer_id: jobOfferId,
    recruiter_id: recruiterId,
    job_title: jobTitle,
    company,
    recruiter_email: recruiterEmail,
  });
  // Code 23505 = intention "pending" déjà enregistrée pour cette offre
  // (index unique) : pas une erreur, l'utilisateur a déjà cliqué "Postuler"
  // une première fois sur cette même offre avant de confirmer son email.
  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

/**
 * Finalise automatiquement les candidatures en attente de l'utilisateur
 * connecté, si son email est désormais confirmé — sans effet si ce n'est
 * pas encore le cas (voir finaliser_candidatures_en_attente, qui revérifie
 * elle-même la confirmation avant tout traitement). Appelée en best-effort
 * à chaque connexion (AuthContext.jsx) : jamais bloquante.
 */
export async function finaliserCandidaturesEnAttente() {
  const { data, error } = await supabase.rpc("finaliser_candidatures_en_attente");
  if (error) throw new Error(error.message);
  return data || [];
}
