import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { BUCKET_VOCAUX } from "@/lib/aide/serveur";

export const runtime = "nodejs";

/** Adresse signée (5 minutes) d'un message vocal : réservée aux administrateurs. ?id=<uuid du vocal> */
export async function GET(req) {
  const { user, identifier, error: authError } = await requireUser(req, { logDenials: true });
  if (authError) return authError;
  const { allowed, error: rateError } = await checkRateLimit(identifier);
  if (!allowed) return rateError;

  const admin = getSupabaseAdmin();
  if (!(await isCallerAdmin(admin, user.id))) {
    return NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });

  const { data: ligne } = await admin.from("aide_messages_vocaux").select("chemin, duree_secondes").eq("id", id).maybeSingle();
  if (!ligne) return NextResponse.json({ error: "Message vocal introuvable (peut-être déjà purgé)." }, { status: 404 });

  const { data, error } = await admin.storage.from(BUCKET_VOCAUX).createSignedUrl(ligne.chemin, 300);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Adresse indisponible." }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, duree: ligne.duree_secondes });
}
