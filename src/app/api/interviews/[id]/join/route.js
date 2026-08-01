import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { createMeetingToken } from "@/lib/dailyco";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

// Un jeton de participation est minté à la demande, jamais persisté — voir
// le commentaire de createMeetingToken dans src/lib/dailyco.js pour le
// raisonnement (fenêtre de fuite réduite au minimum).
export async function POST(req, { params }) {
  try {
    const { id: interviewId } = await params;

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // La RLS ("Recruteur et candidat lisent leurs propres entretiens") rend
    // cette ligne invisible à quiconque n'est ni le recruteur ni le candidat
    // concerné : pas de vérification d'autorisation séparée à écrire, une
    // ligne introuvable EST la réponse d'autorisation.
    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("id, room_name, room_url, recruiter_id, candidate_id, status, expires_at")
      .eq("id", interviewId)
      .single();

    if (interviewError || !interview) {
      return NextResponse.json({ error: "Entretien introuvable." }, { status: 404 });
    }

    if (interview.status !== "active") {
      return NextResponse.json({ error: "Cet entretien a été clôturé." }, { status: 410 });
    }

    const expiresAtMs = new Date(interview.expires_at).getTime();
    if (expiresAtMs <= Date.now()) {
      return NextResponse.json({ error: "Ce salon d'entretien a expiré." }, { status: 410 });
    }

    const isOwner = interview.recruiter_id === user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const remainingSeconds = Math.max(60, Math.floor((expiresAtMs - Date.now()) / 1000));

    let meetingToken;
    try {
      meetingToken = await createMeetingToken({
        roomName: interview.room_name,
        isOwner,
        userName: profile?.full_name || user.email || (isOwner ? "Recruteur" : "Candidat"),
        expiresInSeconds: remainingSeconds,
      });
    } catch (dailyError) {
      console.error("[Entretiens] Échec de génération du jeton de participation :", dailyError.message);
      return NextResponse.json({ error: dailyError.message }, { status: 502 });
    }

    return NextResponse.json({
      token: meetingToken,
      roomUrl: interview.room_url,
      roomName: interview.room_name,
      isOwner,
    });
  } catch (err) {
    console.error("[Entretiens] Erreur interne join :", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
