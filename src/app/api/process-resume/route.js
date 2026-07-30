import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTextFromFile } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

// Même contrainte que les autres routes dépendantes de l'OCR
// (parse-document, diagnostic-cv, extract-email) : l'extraction de texte
// peut basculer sur Tesseract pour un PDF scanné/une image, potentiellement
// lent — la fonction doit avoir le temps de finir avant que Vercel ne la tue.
export const runtime = "nodejs";
export const maxDuration = 55;

// Limite de texte envoyée à l'Edge Function d'embedding : gemini-embedding-001
// a une fenêtre d'entrée bornée, et un CV n'a de toute façon pas besoin de
// plusieurs dizaines de milliers de caractères pour être représenté.
const MAX_EMBEDDING_INPUT_CHARS = 8000;

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

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

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

    let extractedText = "";
    try {
      extractedText = await extractTextFromFile(buffer, file.name, file.type);
    } catch (extractErr) {
      console.error("[process-resume] Extraction échouée:", extractErr);
      await markResumeAsError(supabase, resumeId, "Impossible d'extraire le texte du document.");
      return NextResponse.json({ error: "Impossible d'extraire le texte du document." }, { status: 422 });
    }

    if (!extractedText || extractedText.trim().length < 20) {
      await markResumeAsError(supabase, resumeId, "Aucun texte exploitable détecté dans le document.");
      return NextResponse.json({ error: "Aucun texte exploitable détecté dans le document." }, { status: 422 });
    }

    const truncatedText = extractedText.slice(0, MAX_EMBEDDING_INPUT_CHARS);

    // Génération de l'embedding via l'Edge Function déployée plutôt qu'un
    // appel Gemini dupliqué ici : un seul endroit connaît le modèle
    // d'embedding réellement disponible pour ce projet (gemini-embedding-001,
    // voir supabase/functions/gemini-orchestrator).
    const embedResponse = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "embed", text: truncatedText }),
    });

    const embedResult = await embedResponse.json().catch(() => null);

    if (!embedResponse.ok || !embedResult?.success || !Array.isArray(embedResult.embedding)) {
      console.error("[process-resume] Échec embedding:", embedResult?.error || embedResponse.status);
      await markResumeAsError(supabase, resumeId, "Échec de la génération de l'embedding sémantique.");
      return NextResponse.json({ error: "Échec de l'analyse sémantique du document." }, { status: 502 });
    }

    // Format texte pgvector : "[v1,v2,...]" — décodé automatiquement par
    // PostgREST vers la colonne `vector(768)`.
    const embeddingLiteral = `[${embedResult.embedding.join(",")}]`;

    const { error: updateErr } = await supabase
      .from("resumes")
      .update({
        content: {
          extractedText: extractedText.slice(0, 5000),
          analyzedAt: new Date().toISOString(),
        },
        embedding: embeddingLiteral,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", resumeId);

    if (updateErr) {
      console.error("[process-resume] Échec mise à jour resume:", updateErr.message);
      return NextResponse.json({ error: "Échec de l'enregistrement de l'analyse." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[process-resume] Erreur inattendue:", error);
    return NextResponse.json({ error: "Erreur interne lors du traitement du CV." }, { status: 500 });
  }
}
