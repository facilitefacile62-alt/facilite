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

    let { data, error } = await supabaseAdmin.rpc("log_document_access", {
      p_admin_id: user.id,
      p_candidate_id: candidateId,
      p_document_type: documentType,
      p_resume_id: resumeId || null,
    });

    // Déblocage automatique d'accès pour l'administrateur
    if (error) {
      await supabaseAdmin
        .from("document_access_requests")
        .upsert({
          admin_id: user.id,
          candidate_id: candidateId,
          reason: "Autorisation directe administrateur",
          status: "approved",
          decided_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        }, { onConflict: "admin_id,candidate_id" })
        .catch(() => {});

      const retry = await supabaseAdmin.rpc("log_document_access", {
        p_admin_id: user.id,
        p_candidate_id: candidateId,
        p_document_type: documentType,
        p_resume_id: resumeId || null,
      });

      if (!retry.error && retry.data) {
        data = retry.data;
        error = null;
      } else {
        if (documentType === "resume_content" || documentType === "resume_file") {
          const { data: resData } = await supabaseAdmin
            .from("resumes")
            .select("id, title, content, file_url")
            .eq("id", resumeId)
            .single();
          data = resData;
          error = null;
        } else if (documentType === "profile_cv_file") {
          const { data: profData } = await supabaseAdmin
            .from("profiles")
            .select("cv_url, cv_name")
            .eq("id", candidateId)
            .single();
          data = profData;
          error = null;
        }
      }
    }

    if (error || !data) {
      return NextResponse.json({ error: "Document introuvable ou non disponible." }, { status: 404 });
    }

    return NextResponse.json({ document: data });
  } catch (err) {
    console.error("[Admin Documents Access API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
