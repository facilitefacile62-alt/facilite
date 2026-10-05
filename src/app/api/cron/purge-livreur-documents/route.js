import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const PURGE_AFTER_DECISION_DAYS = 30;

/**
 * Purge quotidienne (Vercel Cron) des pièces justificatives des demandes
 * livreur, 30 jours après leur décision (approuvée ou rejetée) — même
 * politique que purge-badge-documents : garder la trace de la demande
 * (qui, quand, décision, par qui), pas les pièces d'identité elles-mêmes
 * une fois la vérification tranchée.
 *
 * Pas encore enregistré dans vercel.json — à activer explicitement.
 */
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Purge Livreurs] CRON_SECRET manquant côté serveur.");
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
    console.error("[Cron Purge Livreurs] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const cutoff = new Date(Date.now() - PURGE_AFTER_DECISION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: dueRequests, error } = await admin
    .from("livreurs_demandes")
    .select("id, user_id, document_urls")
    .in("status", ["approved", "rejected"])
    .lt("reviewed_at", cutoff)
    .not("document_urls", "eq", "{}");

  if (error) {
    console.error("[Cron Purge Livreurs] Échec lecture des demandes à purger :", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let purged = 0;
  let errors = 0;

  for (const request of dueRequests || []) {
    const paths = request.document_urls || [];
    if (paths.length === 0) continue;

    const { error: removeError } = await admin.storage.from("livreur-documents").remove(paths);
    if (removeError) {
      console.error(`[Cron Purge Livreurs] Échec suppression documents (${request.id}) :`, removeError.message);
      errors += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from("livreurs_demandes")
      .update({ document_urls: [] })
      .eq("id", request.id);

    if (updateError) {
      console.error(`[Cron Purge Livreurs] Échec mise à jour document_urls (${request.id}) :`, updateError.message);
      errors += 1;
      continue;
    }

    await admin.rpc("log_security_event", {
      p_event_type: "livreur_documents_purged",
      p_severity: "info",
      p_actor_id: null,
      p_target_user_id: request.user_id,
      p_details: { request_id: request.id, purged_count: paths.length },
    });

    purged += 1;
  }

  return NextResponse.json({ purged, errors, total: (dueRequests || []).length });
}
