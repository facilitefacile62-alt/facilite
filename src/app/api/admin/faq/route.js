import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

// assistant_faq n'accorde RIEN à authenticated (0 policy RLS, aucun GRANT —
// voir 20260821100000_assistant_faq.sql) : cette route est le SEUL chemin,
// lecture ET écriture, admin comme visiteur du site. Le SYSTEM_PROMPT de
// /api/voice-assistant lit la table directement via service_role, pas via
// cette route (pas de garde admin à appliquer côté assistant public).
async function authorizeAdmin(req) {
  const { user, identifier, error: authError } = await requireUser(req, { logDenials: true });
  if (authError) return { error: authError };

  const { allowed, error: rateLimitError } = await checkRateLimit(identifier);
  if (!allowed) return { error: rateLimitError };

  const admin = getSupabaseAdmin();
  if (!(await isCallerAdmin(admin, user.id))) {
    return { error: NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 }) };
  }

  return { admin, user };
}

export async function GET(req) {
  const { admin, error } = await authorizeAdmin(req);
  if (error) return error;

  const { data, error: dbError } = await admin
    .from("assistant_faq")
    .select("id, question, reponse, categorie, actif, created_at, updated_at")
    .order("categorie", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error("[admin/faq GET]", dbError);
    return NextResponse.json({ error: "Impossible de charger la FAQ." }, { status: 500 });
  }

  return NextResponse.json({ entries: data || [] });
}

export async function POST(req) {
  const { admin, user, error } = await authorizeAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const question = body?.question?.trim();
  const reponse = body?.reponse?.trim();
  const categorie = body?.categorie?.trim() || null;

  if (!question || !reponse) {
    return NextResponse.json({ error: "Question et réponse sont requises." }, { status: 400 });
  }

  const { data, error: dbError } = await admin
    .from("assistant_faq")
    .insert({ question, reponse, categorie, created_by: user.id, updated_by: user.id })
    .select("id, question, reponse, categorie, actif, created_at, updated_at")
    .single();

  if (dbError) {
    console.error("[admin/faq POST]", dbError);
    return NextResponse.json({ error: "Impossible de créer cette entrée." }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function PATCH(req) {
  const { admin, user, error } = await authorizeAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id) {
    return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  const patch = { updated_by: user.id };
  if (typeof body.question === "string") patch.question = body.question.trim();
  if (typeof body.reponse === "string") patch.reponse = body.reponse.trim();
  if (typeof body.categorie === "string" || body.categorie === null) patch.categorie = body.categorie?.trim() || null;
  if (typeof body.actif === "boolean") patch.actif = body.actif;

  const { data, error: dbError } = await admin
    .from("assistant_faq")
    .update(patch)
    .eq("id", id)
    .select("id, question, reponse, categorie, actif, created_at, updated_at")
    .single();

  if (dbError) {
    console.error("[admin/faq PATCH]", dbError);
    return NextResponse.json({ error: "Impossible de modifier cette entrée." }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}
