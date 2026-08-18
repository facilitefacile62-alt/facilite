import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

    const { data, error } = await supabaseAdmin
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
