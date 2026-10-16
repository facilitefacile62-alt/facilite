import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Tâche quotidienne (Vercel Cron, voir vercel.json) : annule les commandes Marketplace restées
 * 48 h « en attente d'un livreur » et prévient l'acheteur et le vendeur. Toute la logique est dans
 * la fonction SQL expirer_commandes_sans_livreur (migration 20261016220000), réservée à service_role.
 */
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Commandes expirées] CRON_SECRET manquant côté serveur.");
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
    console.error("[Cron Commandes expirées] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const { data, error } = await admin.rpc("expirer_commandes_sans_livreur");
  if (error) {
    console.error("[Cron Commandes expirées] Échec :", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ expirees: data });
}
