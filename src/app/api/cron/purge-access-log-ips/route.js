import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Purge quotidienne (Vercel Cron, voir vercel.json) des adresses IP de plus
 * de 30 jours dans security_logs — 4B du chantier du 2026-08-06
 * (docs/incident-2026-08-06.md). L'IP est une donnée personnelle ; la ligne
 * de journal elle-même n'est jamais supprimée (security_logs reste
 * append-only pour toujours, pour tout le monde, y compris cette purge —
 * seule la colonne ip_address est nullifiée, via
 * purge_old_access_log_ips()).
 */
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Purge IP] CRON_SECRET manquant côté serveur.");
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
    console.error("[Cron Purge IP] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const { data: purgedCount, error } = await admin.rpc("purge_old_access_log_ips");

  if (error) {
    console.error("[Cron Purge IP] Échec purge :", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purged: purgedCount ?? 0 });
}
