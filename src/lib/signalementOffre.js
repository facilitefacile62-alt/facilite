// Signalement d'une offre par un compte connecté. Logique pure + une fonction d'envoi qui prend le client Supabase en paramètre.
//
// Écrit dans public.reports (migration 20260803040000_moderation_et_suspension.sql) : target_type = 'job_offer', target_id = identifiant de l'offre,
// reason = texte libre obligatoire. La table n'a pas de colonne « motif » : le motif choisi est donc écrit au début de `reason` sous la forme
// « [motif] Libellé — précisions éventuelles ». Aucune migration. Les droits de la table (insertion par un compte connecté pour son propre compte,
// lecture par l'administrateur) sont ceux de la migration d'origine : ils sont à contrôler en base avant mise en ligne.

export const MOTIFS_SIGNALEMENT_OFFRE = Object.freeze([
  { id: "arnaque", libelle: "Arnaque ou fausse offre" },
  { id: "demande_argent", libelle: "On me demande de l'argent" },
  { id: "offre_inexistante", libelle: "L'offre n'existe pas ou n'est plus valable" },
  { id: "doublon", libelle: "Offre en double" },
  { id: "autre", libelle: "Autre problème" },
]);

export const LONGUEUR_MAX_PRECISIONS = 500;
export const MESSAGE_CONFIRMATION_SIGNALEMENT = "Merci. Votre signalement a été transmis à l'équipe, qui l'examinera.";
export const MESSAGE_ERREUR_SIGNALEMENT = "Le signalement n'a pas pu être envoyé pour le moment. Réessayez plus tard.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Seules les offres enregistrées (identifiant UUID) peuvent être signalées : pas les offres d'exemple à identifiant numérique. */
export function offreSignalable(offreId) {
  return UUID.test(String(offreId ?? "").trim());
}

/** Texte enregistré dans reports.reason, ou null si le motif est inconnu. */
export function construireRaison(motifId, precisions = "") {
  const motif = MOTIFS_SIGNALEMENT_OFFRE.find((m) => m.id === motifId);
  if (!motif) return null;
  const detail = String(precisions ?? "").replace(/\s+/g, " ").trim().slice(0, LONGUEUR_MAX_PRECISIONS);
  return detail ? `[${motif.id}] ${motif.libelle} — ${detail}` : `[${motif.id}] ${motif.libelle}`;
}

/** Ligne à insérer dans public.reports, ou null si une donnée manque ou est invalide. */
export function ligneSignalement({ reporterId, offreId, motifId, precisions } = {}) {
  const raison = construireRaison(motifId, precisions);
  if (!reporterId || !offreSignalable(offreId) || !raison) return null;
  return { reporter_id: reporterId, target_type: "job_offer", target_id: String(offreId).trim(), reason: raison };
}

/**
 * Envoie le signalement. N'écrit QUE dans public.reports, une seule ligne, avec le compte connecté.
 * @returns {Promise<{ ok: boolean, raison?: "donnees_invalides" | "erreur" }>}
 */
export async function envoyerSignalementOffre(supabase, donnees) {
  const ligne = ligneSignalement(donnees);
  if (!ligne) return { ok: false, raison: "donnees_invalides" };
  try {
    const { error } = await supabase.from("reports").insert(ligne);
    return error ? { ok: false, raison: "erreur" } : { ok: true };
  } catch {
    return { ok: false, raison: "erreur" };
  }
}
