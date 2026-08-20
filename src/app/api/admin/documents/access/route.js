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
 *
 * Restauré le 20/08 après un incident : une version intermédiaire de ce
 * fichier lisait resumes/profiles directement via supabaseAdmin, sans
 * jamais appeler log_document_access() — contournant entièrement le
 * contrôle de consentement (demande approuvée et non expirée). Ne jamais
 * réintroduire de lecture directe de resumes/profiles dans cette route :
 * log_document_access() doit rester le seul chemin.
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

    const { data, error } = await supabaseAdmin.rpc("log_document_access", {
      p_admin_id: user.id,
      p_candidate_id: candidateId,
      p_document_type: documentType,
      p_resume_id: resumeId || null,
    });

    if (error) {
      return NextResponse.json({ error: "Aucune autorisation active pour ce candidat." }, { status: 403 });
    }

    return NextResponse.json({ document: data });
  } catch (err) {
    console.error("[Admin Documents Access API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
