import { NextResponse } from "next/server";
import { Client } from "pg";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * auth.admin.updateUserById(id, { phone: "" }) — l'API documentée par
 * Supabase pour effacer un téléphone — répond 200 sans jamais modifier la
 * ligne (constaté en conditions réelles sur ce projet, avec "" ET null) :
 * GoTrue semble traiter un phone vide/nul comme "non fourni" plutôt que
 * "à effacer". Contournement : connexion Postgres directe (POSTGRES_URL_NON_POOLING,
 * déjà provisionnée par l'intégration Vercel/Supabase, jamais exposée au
 * client) qui efface auth.users.phone ET supprime l'identité 'phone'
 * correspondante (auth.identities) — les deux, comme le ferait GoTrue lui-même
 * pour un vrai dé-lien. Requête fixe et paramétrée, jamais de SQL construit
 * depuis une entrée admin : ce n'est pas de l'exécution SQL libre.
 */
async function clearPhoneDirectly(targetUserId) {
  const rawConnectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!rawConnectionString) {
    throw new Error("Aucune chaîne de connexion PostgreSQL configurée (POSTGRES_URL_NON_POOLING).");
  }
  // sslmode=require dans la chaîne (provisionnée par l'intégration Vercel)
  // est traité comme un alias de verify-full par pg-connection-string, qui
  // écrase l'option ssl explicite ci-dessous et échoue sur le certificat du
  // pooler Supabase (auto-signé du point de vue du trust store Node) — retiré
  // pour laisser l'option ssl du Client faire foi.
  const connectionString = rawConnectionString.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM auth.identities WHERE user_id = $1 AND provider = 'phone'", [targetUserId]);
    await client.query(
      "UPDATE auth.users SET phone = NULL, phone_confirmed_at = NULL, phone_change = '', phone_change_token = '' WHERE id = $1",
      [targetUserId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Seul point d'entrée pour dissocier le numéro de téléphone (auth.users.phone,
 * connexion SMS/OTP) d'un compte — même raisonnement que
 * /api/admin/users/[id]/status : nécessite des privilèges serveur,
 * impossible depuis le client. Le numéro complet ne transite jamais que
 * côté serveur ; seule sa version masquée (mask_phone_number) atteint
 * security_logs.
 */
export async function POST(req, { params }) {
  try {
    const { id: targetUserId } = await params;

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const supabaseAdmin = getSupabaseAdmin();

    if (!(await isCallerAdmin(supabaseAdmin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    const { data: targetData, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (fetchError || !targetData?.user) {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    }
    if (!targetData.user.phone) {
      return NextResponse.json({ error: "Ce compte n'a aucun numéro de téléphone associé." }, { status: 400 });
    }

    const { data: phoneMasked } = await supabaseAdmin.rpc("mask_phone_number", { p_phone: targetData.user.phone });

    try {
      await clearPhoneDirectly(targetUserId);
    } catch (err) {
      console.error("[Admin Phone Unlink API] Échec de l'effacement direct:", err.message);
      return NextResponse.json({ error: "Échec de la dissociation." }, { status: 500 });
    }

    // Vérification finale : ne journalise un succès que si le numéro a
    // réellement disparu, jamais sur la base d'une simple absence d'erreur.
    const { data: recheck } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (recheck?.user?.phone) {
      return NextResponse.json(
        { error: "La dissociation n'a pas pu être confirmée. Aucune modification n'a été journalisée." },
        { status: 500 }
      );
    }

    const { error: logError } = await supabaseAdmin.rpc("log_security_event", {
      p_event_type: "admin_phone_unlinked",
      p_severity: "warning",
      p_actor_id: user.id,
      p_target_user_id: targetUserId,
      p_details: { phone_masked: phoneMasked || null },
    });
    if (logError) {
      // Best-effort, jamais bloquant — même schéma que le reste des routes admin.
      console.warn("[Admin Phone Unlink API] Échec journalisation (non bloquant):", logError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Phone Unlink API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
