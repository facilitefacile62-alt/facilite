import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { aideOuverte } from "@/lib/aide/serveur";

export const runtime = "nodejs";

/**
 * L'orbe « Aide » doit-il s'afficher pour cette personne connectée ? Tient compte de AIDE_IDS_AUTORISES, qui
 * n'existe que côté serveur. Ne renvoie qu'un booléen : jamais la liste.
 */
export async function GET(req) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const ouvert = await aideOuverte(getSupabaseAdmin(), user.id);
  return NextResponse.json({ ouvert }, { headers: { "Cache-Control": "private, no-store" } });
}
