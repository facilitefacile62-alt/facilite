import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendCvReadyEmail } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * Finalise une affectation agent : bascule le statut à "completed" et
 * enregistre le chemin du CV livré (déjà téléversé côté client vers le
 * bucket "completed_cvs"), puis notifie le candidat.
 *
 * L'autorisation réelle est laissée à Postgres : l'UPDATE s'exécute avec le
 * client authentifié de l'appelant (jeton Bearer), donc soumis aux policies
 * RLS de agent_assignments — un agent ne peut mettre à jour QUE sa propre
 * affectation (auth.uid() = agent_id), un admin peut tout. Si l'appelant
 * n'a pas le droit, l'UPDATE ne retourne simplement aucune ligne.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => ({}));
    const { assignmentId, completedCvPath } = body;

    if (!assignmentId || !completedCvPath) {
      return NextResponse.json(
        { error: "assignmentId et completedCvPath sont requis." },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: updatedAssignment, error: updateError } = await supabase
      .from("agent_assignments")
      .update({ status: "completed", completed_cv_url: completedCvPath })
      .eq("id", assignmentId)
      .select()
      .single();

    if (updateError || !updatedAssignment) {
      console.error("[Complete Assignment] Échec (RLS ou dossier introuvable) :", updateError?.message);
      return NextResponse.json(
        { error: "Affectation introuvable ou non autorisée." },
        { status: 403 }
      );
    }

    // Notification best-effort : le dossier reste "completed" même si l'e-mail échoue.
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: candidateProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email, contact_email")
        .eq("id", updatedAssignment.candidate_id)
        .single();

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(updatedAssignment.candidate_id);

      await sendCvReadyEmail({
        to: candidateProfile?.contact_email || candidateProfile?.email || authUser?.user?.email || null,
        fullName: candidateProfile?.full_name || null,
      });
    } catch (notifyErr) {
      console.error("[Complete Assignment] Échec notification (dossier déjà finalisé) :", notifyErr?.message);
    }

    return NextResponse.json({ success: true, assignment: updatedAssignment });
  } catch (error) {
    console.error("[Complete Assignment API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
