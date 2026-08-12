import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPABASE_URL } from "@/lib/env";

export const runtime = "nodejs";

import { z } from "zod";

const EmbeddingSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

const MAX_EMBEDDING_INPUT_CHARS = 8000;

/**
 * Recalcule l'embedding sémantique d'une offre côté serveur. La colonne
 * job_offers.embedding n'est plus accordée en UPDATE à authenticated (Vague
 * 3, Partie 1 du chantier) : un recruteur pouvait sinon écrire n'importe
 * quel vecteur directement pour manipuler son classement dans la recherche
 * sémantique. L'écriture passe ici par service_role, après vérification
 * explicite de propriété (service_role ignore totalement la RLS).
 */
export async function POST(req, { params }) {
  try {
    const { id: offerId } = await params;

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => ({}));
    const parseResult = EmbeddingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const { title, description } = parseResult.data;
    const text = [title, description].filter(Boolean).join("\n\n").trim();
    if (!text) {
      return NextResponse.json({ error: "title et/ou description requis." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: offer, error: offerError } = await admin
      .from("job_offers")
      .select("id, recruiter_id")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError || !offer) {
      return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    if (offer.recruiter_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Vous ne pouvez modifier que vos propres offres." }, { status: 403 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const truncatedText = text.slice(0, MAX_EMBEDDING_INPUT_CHARS);

    const embedResponse = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "embed", text: truncatedText }),
    });
    const embedResult = await embedResponse.json().catch(() => null);

    if (!embedResponse.ok || !embedResult?.success || !Array.isArray(embedResult.embedding)) {
      console.error("[Offre Embedding] Échec embedding:", embedResult?.error || embedResponse.status);
      return NextResponse.json({ error: "Échec de la génération de l'embedding sémantique." }, { status: 502 });
    }

    const embeddingLiteral = `[${embedResult.embedding.join(",")}]`;

    const { error: updateError } = await admin
      .from("job_offers")
      .update({ embedding: embeddingLiteral })
      .eq("id", offerId);

    if (updateError) {
      console.error("[Offre Embedding] Échec écriture:", updateError.message);
      return NextResponse.json({ error: "Échec de l'enregistrement de l'embedding." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Offre Embedding API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
