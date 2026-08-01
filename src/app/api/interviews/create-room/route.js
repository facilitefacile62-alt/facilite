import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { createInterviewRoom } from "@/lib/dailyco";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

// 2h, comme demandé dans la mission — au-delà, le salon Daily.co devient
// inutilisable même si la ligne `interviews` correspondante existe toujours.
const ROOM_LIFETIME_SECONDS = 2 * 60 * 60;

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => null);
    const applicationId = body?.applicationId;
    if (!applicationId) {
      return NextResponse.json({ error: "applicationId requis." }, { status: 400 });
    }

    // Client scellé au jeton de l'appelant : la RLS de candidatures/job_offers
    // fait déjà tout le travail d'autorisation ("Un recruteur lit les
    // candidatures de ses offres") — si la ligne n'est pas visible, elle
    // n'existe pas pour cet utilisateur, point final. Jamais recruiterId
    // fourni par le client comme le suggérait la spec initiale : n'importe
    // qui aurait pu prétendre être le recruteur d'une offre qui n'est pas
    // la sienne.
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: application, error: applicationError } = await supabase
      .from("candidatures")
      .select("id, user_id, job_offer_id, full_name")
      .eq("id", applicationId)
      .single();

    if (applicationError || !application) {
      // 404 générique, jamais 403 : ne pas révéler si l'id existe mais
      // appartient à un autre recruteur, plutôt que "elle n'existe pas".
      return NextResponse.json({ error: "Candidature introuvable." }, { status: 404 });
    }

    if (!application.job_offer_id) {
      return NextResponse.json(
        { error: "Cette candidature ne concerne pas une offre publiée — impossible d'y rattacher un entretien." },
        { status: 400 }
      );
    }

    const { data: jobOffer, error: jobOfferError } = await supabase
      .from("job_offers")
      .select("id, recruiter_id, title")
      .eq("id", application.job_offer_id)
      .single();

    if (jobOfferError || !jobOffer) {
      return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
    }

    // Vérification explicite en plus de la RLS : rend l'intention lisible
    // dans le code, et protège même si la policy venait à changer.
    if (jobOffer.recruiter_id !== user.id) {
      return NextResponse.json(
        { error: "Seul le recruteur propriétaire de cette offre peut démarrer un entretien." },
        { status: 403 }
      );
    }

    const roomName = `interview-${application.id}-${Date.now()}`;
    let room;
    try {
      room = await createInterviewRoom({ name: roomName, expiresInSeconds: ROOM_LIFETIME_SECONDS });
    } catch (dailyError) {
      console.error("[Entretiens] Échec de création du salon Daily.co :", dailyError.message);
      return NextResponse.json({ error: dailyError.message }, { status: 502 });
    }

    const expiresAt = new Date(Date.now() + ROOM_LIFETIME_SECONDS * 1000).toISOString();

    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .insert({
        application_id: application.id,
        job_offer_id: jobOffer.id,
        recruiter_id: user.id,
        candidate_id: application.user_id,
        room_name: room.name,
        room_url: room.url,
        expires_at: expiresAt,
      })
      .select("id, room_name, expires_at")
      .single();

    if (interviewError) {
      console.error("[Entretiens] Échec d'enregistrement de l'entretien :", interviewError.message);
      return NextResponse.json({ error: "Échec de l'enregistrement de l'entretien." }, { status: 500 });
    }

    // Message structuré envoyé au candidat — best effort, ne doit jamais
    // faire échouer la création de l'entretien (le recruteur peut toujours
    // partager le lien lui-même si l'envoi du message échoue).
    const { error: messageError } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: application.user_id,
      content: `🎥 Entretien vidéo programmé pour le poste « ${jobOffer.title} ». Cliquez pour rejoindre.`,
      is_read: false,
      type_discussion: "OFFRE",
      job_offer_id: jobOffer.id,
      attachment_url: interview.id,
      attachment_type: "video-interview",
      file_name: jobOffer.title,
      file_size: null,
    });

    if (messageError) {
      console.error("[Entretiens] Échec de l'envoi du message au candidat :", messageError.message);
    }

    return NextResponse.json({
      interviewId: interview.id,
      roomName: interview.room_name,
      expiresAt: interview.expires_at,
    });
  } catch (err) {
    console.error("[Entretiens] Erreur interne create-room :", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
