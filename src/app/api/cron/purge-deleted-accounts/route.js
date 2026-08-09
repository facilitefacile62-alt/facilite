import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Purge quotidienne (Vercel Cron, voir vercel.json) des comptes dont la
 * suppression a été demandée il y a 30 jours ou plus (profiles.deleted_at,
 * Section 3b "Supprimer le compte" du profil) et jamais annulée depuis
 * (annulation automatique à la reconnexion, voir /api/auth/confirm-after-login).
 *
 * auth.admin.deleteUser() suffit pour la plupart des tables : resumes,
 * candidatures, messages, conversations, assistant_messages,
 * badge_requests, interviews, cv_consultations, recruiter_profiles,
 * ai_usage_daily, support_threads, agent_assignments, subscriptions,
 * profiles, user_roles sont tous ON DELETE CASCADE depuis auth.users(id)
 * (vérifié par introspection, migration 20260809020000). orders/transactions
 * sont ON DELETE SET NULL (même migration) — conservés pour la comptabilité,
 * détachés de l'identité de la personne.
 *
 * job_offers fait exception (migration 20260809030000, revient sur le
 * CASCADE initial) : les candidatures reçues sur ces offres appartiennent à
 * de vrais candidats, les supprimer casserait leur historique. Dépubliées
 * explicitement ci-dessous (archived_at + is_active=false, la même
 * convention que archive_own_job_offer()) AVANT deleteUser() — le FK
 * ON DELETE SET NULL n'est qu'un filet de sécurité si cette étape était un
 * jour sautée, pas le mécanisme normal.
 */
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Purge Comptes] CRON_SECRET manquant côté serveur.");
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
    console.error("[Cron Purge Comptes] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const { data: dueAccounts, error } = await admin
    .from("profiles")
    .select("id")
    .not("deleted_at", "is", null)
    .lte("deleted_at", new Date().toISOString());

  if (error) {
    console.error("[Cron Purge Comptes] Échec lecture des comptes à purger :", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let purged = 0;
  let errors = 0;

  for (const account of dueAccounts || []) {
    const { error: archiveError } = await admin
      .from("job_offers")
      .update({ is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("recruiter_id", account.id)
      .is("archived_at", null);
    if (archiveError) {
      console.error(`[Cron Purge Comptes] Échec dépublication des offres (${account.id}) :`, archiveError.message);
      errors += 1;
      continue;
    }

    // Journalisé AVANT la suppression : security_logs.target_user_id est
    // ON DELETE SET NULL, la ligne survit mais perd la référence une fois le
    // compte réellement supprimé — cohérent avec le reste des logs qui
    // référencent un compte depuis disparu.
    await admin.rpc("log_security_event", {
      p_event_type: "account_purged",
      p_severity: "warning",
      p_actor_id: null,
      p_target_user_id: account.id,
      p_details: {},
    });

    const { error: deleteError } = await admin.auth.admin.deleteUser(account.id);
    if (deleteError) {
      console.error(`[Cron Purge Comptes] Échec suppression (${account.id}) :`, deleteError.message);
      errors += 1;
      continue;
    }
    purged += 1;
  }

  return NextResponse.json({ purged, errors, total: (dueAccounts || []).length });
}
