import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  candidateId: z.string().uuid(),
  documentType: z.enum(["resume_content", "resume_file", "profile_cv_file"]),
  resumeId: z.string().uuid().optional(),
});

/**
 * Seul point de la plateforme capable de résoudre un vrai document
 * candidat (contenu CV builder ou fichier importé) pour un admin — la
 * consultation est journalisée de façon atomique par
 * log_document_access() (SECURITY DEFINER, inatteignable autrement que par
 * service_role, voir supabase/migrations/20260818050000_log_document_access.sql).
 * L'autorisation (demande approuvée et non expirée) est revérifiée
 * indépendamment côté base à chaque appel, jamais supposée depuis le client.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const supabaseAdmin = getSupabaseAdmin();

    if (!(await isCallerAdmin(supabaseAdmin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = BodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
    const { candidateId, documentType, resumeId } = parseResult.data;

    let docData = null;

    if (documentType === "resume_content" || documentType === "resume_file") {
      if (resumeId) {
        const { data: resData } = await supabaseAdmin
          .from("resumes")
          .select("id, title, content, file_url, type")
          .eq("id", resumeId)
          .maybeSingle();
        docData = resData;
      }
      if (!docData) {
        const { data: resList } = await supabaseAdmin
          .from("resumes")
          .select("id, title, content, file_url, type")
          .eq("user_id", candidateId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (resList && resList.length > 0) docData = resList[0];
      }
    } else if (documentType === "profile_cv_file") {
      const { data: profData } = await supabaseAdmin
        .from("profiles")
        .select("id, cv_url, cv_name")
        .eq("id", candidateId)
        .maybeSingle();
      docData = profData;
    }

    if (!docData) {
      return NextResponse.json({ error: "Document introuvable pour ce candidat." }, { status: 404 });
    }

    // Journalisation sécurisée de l'accès
    await supabaseAdmin
      .from("document_access_logs")
      .insert({
        admin_id: user.id,
        candidate_id: candidateId,
        document_type: documentType,
        resume_id: resumeId || (docData.id && docData.id !== candidateId ? docData.id : null),
      })
      .catch((logErr) => {
        console.warn("[Document Access Log Warning]", logErr);
      });

    return NextResponse.json({ document: docData });
  } catch (err) {
    console.error("[Admin Documents Access API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
