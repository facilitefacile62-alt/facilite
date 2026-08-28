import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendReminderEmail } from "@/lib/notifications";

export const runtime = "nodejs";
// Le cron parcourt potentiellement plusieurs dizaines de lignes et envoie un
// e-mail par ligne (I/O réseau Resend) : la limite par défaut (10s) suffirait
// rarement au-delà d'une poignée de relances.
export const maxDuration = 60;

const PENDING_CANDIDATURE_REMINDER_DAYS = 3;
const ABANDONED_CV_DRAFT_REMINDER_DAYS = 2;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

/**
 * Relances automatiques quotidiennes (Vercel Cron, voir vercel.json) :
 * - candidatures restées "pending" sans action du recruteur depuis
 *   PENDING_CANDIDATURE_REMINDER_DAYS jours ;
 * - brouillons de CV créés mais jamais finalisés (aucune commande "paid"
 *   associée) depuis ABANDONED_CV_DRAFT_REMINDER_DAYS jours.
 *
 * reminder_sent_at rend chaque relance strictement unique : une fois
 * envoyée, la ligne ne sera plus jamais reciblée par une exécution future
 * (voir migration 20260801230000_reminder_tracking_columns.sql) — sans ça,
 * la même candidature/le même brouillon recevrait un rappel chaque jour.
 */
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Reminders] CRON_SECRET manquant côté serveur.");
    return NextResponse.json({ error: "Cron non configuré." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (configError) {
    console.error("[Cron Reminders] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const candidatureResult = await remindStalePendingCandidatures(admin);
  const cvDraftResult = await remindAbandonedCvDrafts(admin);

  return NextResponse.json({
    candidatureReminders: candidatureResult.sent,
    candidatureErrors: candidatureResult.errors,
    cvDraftReminders: cvDraftResult.sent,
    cvDraftErrors: cvDraftResult.errors,
  });
}

async function remindStalePendingCandidatures(admin) {
  const cutoff = new Date(Date.now() - PENDING_CANDIDATURE_REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleCandidatures, error } = await admin
    .from("candidatures")
    .select("id, full_name, email, job_title, company")
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .lt("created_at", cutoff);

  if (error) {
    console.error("[Cron Reminders] Échec lecture candidatures en attente :", error.message);
    return { sent: 0, errors: 1 };
  }

  let sent = 0;
  let errors = 0;

  for (const candidature of staleCandidatures || []) {
    const { delivered } = await sendReminderEmail({
      to: candidature.email,
      fullName: candidature.full_name,
      subject: `[Facilite] Votre candidature chez ${candidature.company} est toujours en cours d'examen`,
      message: `Votre candidature pour le poste « ${candidature.job_title} » chez ${candidature.company} est toujours en attente d'examen par le recruteur. Nous vous invitons à suivre son évolution depuis votre espace candidat.`,
      ctaLabel: "Suivre ma candidature",
      ctaUrl: `${APP_URL}/candidat/candidatures`,
    });

    if (!delivered) {
      errors += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from("candidatures")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", candidature.id);

    if (updateError) {
      console.error("[Cron Reminders] Échec marquage reminder_sent_at (candidature) :", updateError.message);
      errors += 1;
      continue;
    }

    sent += 1;
  }

  return { sent, errors };
}

async function remindAbandonedCvDrafts(admin) {
  const cutoff = new Date(Date.now() - ABANDONED_CV_DRAFT_REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidateDrafts, error: draftsError } = await admin
    .from("resumes")
    .select("id, user_id, title")
    .eq("type", "created")
    .is("reminder_sent_at", null)
    .lt("created_at", cutoff);

  if (draftsError) {
    console.error("[Cron Reminders] Échec lecture brouillons CV :", draftsError.message);
    return { sent: 0, errors: 1 };
  }

  if (!candidateDrafts || candidateDrafts.length === 0) {
    return { sent: 0, errors: 0 };
  }

  // Pas de sous-requête NOT EXISTS exprimable via le client Supabase JS :
  // on récupère séparément les resume_id déjà payés, puis on filtre en
  // mémoire (volumes attendus faibles pour un cron quotidien).
  const { data: paidOrders, error: ordersError } = await admin
    .from("orders")
    .select("resume_id")
    .eq("payment_status", "paid")
    .not("resume_id", "is", null);

  if (ordersError) {
    console.error("[Cron Reminders] Échec lecture commandes payées :", ordersError.message);
    return { sent: 0, errors: 1 };
  }

  const paidResumeIds = new Set((paidOrders || []).map((o) => o.resume_id));
  const abandonedDrafts = candidateDrafts.filter((draft) => !paidResumeIds.has(draft.id));

  let sent = 0;
  let errors = 0;

  for (const draft of abandonedDrafts) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, contact_email")
      .eq("id", draft.user_id)
      .single();

    const recipientEmail = profile?.contact_email || profile?.email;
    if (!recipientEmail) {
      continue; // pas d'email exploitable, rien à envoyer — pas une erreur en soi
    }

    const { delivered } = await sendReminderEmail({
      to: recipientEmail,
      fullName: profile?.full_name,
      subject: "[Facilite] Votre CV vous attend pour être finalisé",
      message: `Vous avez commencé un CV (« ${draft.title} ») sur Facilité mais ne l'avez pas encore finalisé. Reprenez-le où vous vous étiez arrêté et téléchargez-le en PDF en quelques clics.`,
      ctaLabel: "Reprendre mon CV",
      ctaUrl: `${APP_URL}/creer-cv?resumeId=${draft.id}`,
    });

    if (!delivered) {
      errors += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from("resumes")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", draft.id);

    if (updateError) {
      console.error("[Cron Reminders] Échec marquage reminder_sent_at (resume) :", updateError.message);
      errors += 1;
      continue;
    }

    sent += 1;
  }

  return { sent, errors };
}
