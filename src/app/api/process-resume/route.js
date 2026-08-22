import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { extractAndEmbedResume } from "@/lib/resumeEmbedding";

// Même contrainte que les autres routes dépendantes de l'OCR
// (parse-document, diagnostic-cv, extract-email) : l'extraction de texte
// peut basculer sur Tesseract pour un PDF scanné/une image, potentiellement
// lent — la fonction doit avoir le temps de finir avant que Vercel ne la tue.
export const runtime = "nodejs";
export const maxDuration = 55;

/**
 * Marque la ligne `resumes` en erreur plutôt que de la laisser bloquée à
 * 'processing' indéfiniment côté UI (le badge de statut resterait en
 * chargement pour toujours sans ce filet de sécurité).
 */
async function markResumeAsError(supabase, resumeId, message) {
  await supabase
    .from("resumes")
    .update({
      status: "error",
      content: { error: message, failedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", resumeId);
}

const ERROR_MESSAGES = {
  extraction_failed: "Impossible d'extraire le texte du document.",
  no_text: "Aucun texte exploitable détecté dans le document.",
  embedding_failed: "Échec de l'analyse sémantique du document.",
  update_failed: "Échec de l'enregistrement de l'analyse.",
};

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    if (!(await checkAiQuota(user.id))) {
      return NextResponse.json(
        { error: `Quota IA quotidien atteint (${AI_DAILY_QUOTA} requêtes/jour). Réessayez demain.` },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const resumeId = formData.get("resumeId");

    if (!file || typeof file === "string" || !resumeId) {
      return NextResponse.json({ error: "Fichier et resumeId requis." }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // La RLS limite déjà les updates à `user_id = auth.uid()`, mais on vérifie
    // explicitement l'appartenance ici pour renvoyer une erreur claire plutôt
    // qu'un échec RLS silencieux, et pour confirmer que la ligne existe bien
    // avant de lancer l'extraction (potentiellement coûteuse en OCR).
    const { data: resumeRow, error: fetchErr } = await supabase
      .from("resumes")
      .select("id, user_id")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr || !resumeRow) {
      return NextResponse.json({ error: "Document introuvable ou accès refusé." }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const check = validateUploadedFile(buffer, file.type, file.size);
    if (!check.valid) {
      await markResumeAsError(supabase, resumeId, check.error);
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const result = await extractAndEmbedResume({
      supabase,
      resumeId,
      buffer,
      filename: file.name,
      mimeType: file.type,
      token,
    });

    if (!result.success) {
      const message = ERROR_MESSAGES[result.error] || "Échec du traitement du document.";
      await markResumeAsError(supabase, resumeId, message);
      const status = result.error === "extraction_failed" || result.error === "no_text" ? 422 : 502;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[process-resume] Erreur inattendue:", error);
    return NextResponse.json({ error: "Erreur interne lors du traitement du CV." }, { status: 500 });
  }
}
