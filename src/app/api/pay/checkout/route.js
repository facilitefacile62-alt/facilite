import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

const PRICE_AUTONOME = 1500;
const PRICE_ACCOMPAGNE = 2000;

/**
 * Paystack attend le montant dans la plus petite unité de la devise (comme
 * les centimes pour l'EUR/USD). Le XOF (franc CFA) n'a pas de sous-unité
 * (devise "zero-decimal") : contrairement à NGN/GHS, le montant est transmis
 * tel quel, sans multiplication par 100.
 */
function toPaystackAmount(amount, currency) {
  const zeroDecimalCurrencies = ["XOF", "XAF"];
  return zeroDecimalCurrencies.includes(currency) ? Math.round(amount) : Math.round(amount * 100);
}

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => ({}));
    const { cvModelId, hasAgentOption } = body;

    if (!cvModelId || typeof cvModelId !== "string") {
      return NextResponse.json({ error: "Le modèle de CV choisi est requis." }, { status: 400 });
    }

    const hasAgent = hasAgentOption === true;
    const amount = hasAgent ? PRICE_ACCOMPAGNE : PRICE_AUTONOME;
    const currency = "XOF";

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré (PAYSTACK_SECRET_KEY manquant)." },
        { status: 503 }
      );
    }

    // Client au nom de l'utilisateur connecté (respecte RLS : orders.user_id doit être auth.uid())
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 1. Création de la commande en base, statut "pending"
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        cv_model_id: cvModelId,
        has_agent_option: hasAgent,
        amount,
        currency,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("[Checkout] Échec création commande :", orderError?.message);
      return NextResponse.json({ error: "Impossible de créer la commande." }, { status: 500 });
    }

    // 2. Initialisation de la transaction Paystack
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: toPaystackAmount(amount, currency),
        currency,
        callback_url: origin ? `${origin}/candidat/facturation` : undefined,
        metadata: {
          order_id: order.id,
          user_id: user.id,
          has_agent_option: hasAgent,
          cv_model_id: cvModelId,
        },
      }),
    });

    const paystackData = await paystackRes.json().catch(() => null);

    if (!paystackRes.ok || !paystackData?.status) {
      console.error("[Checkout] Échec initialisation Paystack :", paystackData);
      // La commande "pending" reste en base — utile en debug, sans conséquence
      // pour l'utilisateur (elle n'apparaît jamais comme payée sans webhook validé).
      return NextResponse.json(
        { error: paystackData?.message || "Impossible d'initialiser le paiement." },
        { status: 502 }
      );
    }

    // 3. La référence Paystack est connue dès l'initialisation : on la
    // rattache tout de suite à la commande pour que le webhook puisse la
    // retrouver de façon fiable même si metadata.order_id venait à manquer.
    await supabase
      .from("orders")
      .update({ paystack_reference: paystackData.data.reference })
      .eq("id", order.id);

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
      orderId: order.id,
    });
  } catch (error) {
    console.error("[Checkout API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}
