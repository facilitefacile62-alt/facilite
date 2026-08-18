"use client";

import { supabase } from "@/lib/supabase";

// Libellés/couleurs partagés entre le panneau admin (demande) et
// /candidat/securite (réponse) pour que les deux UIs parlent le même
// vocabulaire pour un même statut.
export const STATUS_LABELS = {
  pending: "En attente",
  approved: "Approuvé",
  denied: "Refusé",
  expired: "Expiré",
};

export const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  expired: "bg-gray-100 text-gray-600 border-gray-200",
};

// Libellés FR des champs renvoyés par get_profiles_completeness() (RPC
// SQL, voir supabase/migrations/20260818060000_get_profiles_completeness.sql)
// — jamais le contenu des champs eux-mêmes, seulement des booléens.
export const PROFILE_COMPLETENESS_FIELDS = [
  { key: "has_avatar", label: "Photo de profil" },
  { key: "has_headline", label: "Titre professionnel" },
  { key: "has_bio", label: "Biographie" },
  { key: "has_phone", label: "Téléphone" },
  { key: "has_location", label: "Localisation" },
  { key: "has_experience", label: "Expériences" },
  { key: "has_education", label: "Formations" },
  { key: "has_skills", label: "Compétences" },
  { key: "has_cv", label: "CV" },
];

/**
 * Admin : crée une demande d'accès temporaire aux documents d'un candidat.
 * Échoue si une demande est déjà en attente pour cette paire (index unique
 * côté base, voir create_document_access_request()).
 */
export async function requestDocumentAccess(candidateId, reason) {
  const { data, error } = await supabase.rpc("create_document_access_request", {
    p_candidate_id: candidateId,
    p_reason: reason,
  });
  return { requestId: data || null, error };
}

/**
 * Candidat : approuve ou refuse une demande reçue. decision doit être
 * "approved" ou "denied".
 */
export async function respondToAccessRequest(requestId, decision) {
  const { data, error } = await supabase.rpc("respond_document_access_request", {
    p_request_id: requestId,
    p_decision: decision,
  });
  return { success: data === true, error };
}

/**
 * Admin : résout un document autorisé (contenu de CV builder ou fichier
 * importé) via la route API dédiée — seul point capable de le faire, la
 * consultation y est journalisée de façon atomique (voir
 * src/app/api/admin/documents/access/route.js et log_document_access()).
 */
export async function fetchAccessibleDocument({ candidateId, documentType, resumeId }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { data: null, error: "Session expirée." };

  const res = await fetch("/api/admin/documents/access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ candidateId, documentType, resumeId }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { data: null, error: body?.error || `Erreur (HTTP ${res.status}).` };
  }
  return { data: body, error: null };
}
