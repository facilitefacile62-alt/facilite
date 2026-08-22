import { extractTextFromFile } from "./documentParser";
import { SUPABASE_URL } from "./env";

// Même borne que l'ancienne version de /api/process-resume — l'API
// d'embedding a une fenêtre d'entrée bornée, un CV n'a pas besoin de
// plusieurs dizaines de milliers de caractères pour être représenté.
const MAX_EMBEDDING_INPUT_CHARS = 8000;

/**
 * Extrait le texte d'un fichier CV puis génère et enregistre son embedding
 * sémantique — pipeline unique factorisé pour être appelé aussi bien
 * depuis /api/process-resume (upload direct côté /profil, /importer-cv,
 * fetch HTTP classique) que depuis /api/postuler et /api/send-application
 * (fichier déjà en mémoire au moment de la candidature : appel direct,
 * sans aller-retour HTTP superflu vers process-resume).
 *
 * Jamais bloquant pour l'appelant : un échec ici ne doit jamais empêcher
 * l'action principale (candidature envoyée, CV importé) — c'est à
 * l'appelant de traiter { success: false } en best-effort (log, pas
 * d'erreur utilisateur), pas de faire échouer toute la requête.
 *
 * @param {object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase - client scopé à l'appelant (auth.uid() doit résoudre pour l'UPDATE RLS sur resumes).
 * @param {string} params.resumeId
 * @param {Buffer} params.buffer
 * @param {string} params.filename
 * @param {string} params.mimeType
 * @param {string} params.token - jeton de l'utilisateur, transmis à l'Edge Function (la passerelle Supabase exige un JWT valide, voir supabase/functions/gemini-orchestrator).
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function extractAndEmbedResume({ supabase, resumeId, buffer, filename, mimeType, token }) {
  let extractedText = "";
  try {
    extractedText = await extractTextFromFile(buffer, filename, mimeType);
  } catch (err) {
    console.error("[resumeEmbedding] Extraction échouée:", err?.message);
    return { success: false, error: "extraction_failed" };
  }

  if (!extractedText || extractedText.trim().length < 20) {
    return { success: false, error: "no_text" };
  }

  const truncatedText = extractedText.slice(0, MAX_EMBEDDING_INPUT_CHARS);

  const embedResponse = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "embed", text: truncatedText }),
  });
  const embedResult = await embedResponse.json().catch(() => null);

  if (!embedResponse.ok || !embedResult?.success || !Array.isArray(embedResult.embedding)) {
    console.error("[resumeEmbedding] Échec embedding:", embedResult?.error || embedResponse.status);
    return { success: false, error: "embedding_failed" };
  }

  // Format texte pgvector : "[v1,v2,...]" — décodé automatiquement par
  // PostgREST vers la colonne vector(768).
  const embeddingLiteral = `[${embedResult.embedding.join(",")}]`;

  const { error: updateErr } = await supabase
    .from("resumes")
    .update({
      content: { extractedText: extractedText.slice(0, 5000), analyzedAt: new Date().toISOString() },
      embedding: embeddingLiteral,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", resumeId);

  if (updateErr) {
    console.error("[resumeEmbedding] Échec mise à jour resume:", updateErr.message);
    return { success: false, error: "update_failed" };
  }

  return { success: true };
}
