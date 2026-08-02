import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const PURGE_AFTER_DECISION_DAYS = 30;

/**
 * Purge quotidienne (Vercel Cron, voir vercel.json) des pièces
 * justificatives des demandes de badge, 30 jours après leur décision
 * (approuvée ou rejetée) — la demande décrite explicitement : garder la
 * trace de la vérification (la ligne badge_requests : qui, quel badge,
 * quand, décision, par qui), pas les documents eux-mêmes (NINEA, RCCM,
 * attestations — des identifiants d'entreprise sensibles qui n'ont plus
 * besoin d'être conservés une fois la vérification tranchée).
 *
 * document_urls stocke des CHEMINS de stockage (bucket privé
 * "badge-documents"), pas des URLs publiques ou signées — mêmes conventions
 * que resumes.file_url/orders.invoice_url ailleurs dans ce projet.
 */
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Purge Badges] CRON_SECRET manquant côté serveur.");
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
    console.error("[Cron Purge Badges] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const cutoff = new Date(Date.now() - PURGE_AFTER_DECISION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: dueRequests, error } = await admin
    .from("badge_requests")
    .select("id, user_id, document_urls")
    .in("status", ["approved", "rejected"])
    .lt("reviewed_at", cutoff)
    .not("document_urls", "eq", "{}");

  if (error) {
    console.error("[Cron Purge Badges] Échec lecture des demandes à purger :", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let purged = 0;
  let errors = 0;

  for (const request of dueRequests || []) {
    const paths = request.document_urls || [];
    if (paths.length === 0) continue;

    const { error: removeError } = await admin.storage.from("badge-documents").remove(paths);
    if (removeError) {
      console.error(`[Cron Purge Badges] Échec suppression documents (${request.id}) :`, removeError.message);
      errors += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from("badge_requests")
      .update({ document_urls: [] })
      .eq("id", request.id);

    if (updateError) {
      console.error(`[Cron Purge Badges] Échec mise à jour document_urls (${request.id}) :`, updateError.message);
      errors += 1;
      continue;
    }

    await admin.rpc("log_security_event", {
      p_event_type: "badge_documents_purged",
      p_severity: "info",
      p_actor_id: null,
      p_target_user_id: request.user_id,
      p_details: { request_id: request.id, purged_count: paths.length },
    });

    purged += 1;
  }

  return NextResponse.json({ purged, errors, total: (dueRequests || []).length });
}
