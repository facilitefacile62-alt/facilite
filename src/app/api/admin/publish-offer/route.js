import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const supabaseAdmin = getSupabaseAdmin();

    // Vérifier rôle admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleRow || roleRow.role !== "admin") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    // L'INSERT doit passer par le client scopé au token de l'admin, pas
    // supabaseAdmin (service_role) : le trigger trg_reset_job_offer_moderation
    // (reset_job_offer_moderation()) a un bypass explicite pour les admins,
    // mais ce bypass teste current_user_role(), qui dépend de auth.uid() —
    // toujours NULL sous service_role. Résultat avant ce correctif : CHAQUE
    // offre publiée depuis ce panneau retombait silencieusement en
    // status='pending_review' (invisible sur le Fil d'Actualité, RLS
    // publique exige status='approved'), quel que soit l'admin réel qui
    // publie — le toast de succès affichait pourtant "publié en direct".
    // Vérifié : la policy INSERT ("Un recruteur publie ses propres offres")
    // exige auth.uid() = recruiter_id (déjà le cas, recruiter_id = user.id)
    // et current_user_role() = 'admin' — satisfaite avec ce client.
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const userScopedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });

    const body = await req.json();
    const payload = {
      ...body,
      status: "approved",
      is_active: true,
      archived_at: null,
      is_test_account: false,
      recruiter_id: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await userScopedSupabase
      .from("job_offers")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[Publish Offer Error]", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, offer: data });
  } catch (error) {
    console.error("[Publish Offer Exception]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
