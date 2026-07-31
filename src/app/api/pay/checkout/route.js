import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { initKpayGatewayPayment } from "@/lib/kpay";

export const runtime = "nodejs";

const PRICE_AUTONOME = 1500;
const PRICE_ACCOMPAGNE = 2000;

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

    if (!process.env.NEXT_PUBLIC_KPAY_PUBLIC_KEY || !process.env.KPAY_SECRET_KEY) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré (clés KPay manquantes)." },
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

    // 2. Initialisation du paiement KPay (mode Gateway : la page hébergée par
    // KPay laisse le client choisir Wave / Orange Money / MTN lui-même).
    // NEXT_PUBLIC_APP_URL, jamais localhost en production — voir .env.production.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    let kpayPayment;
    try {
      kpayPayment = await initKpayGatewayPayment({
        amount,
        externalId: order.id,
        returnUrl: `${appUrl}/candidat/facturation`,
        cancelUrl: `${appUrl}/creer-cv`,
        description: `Confection de CV Facilite — ${hasAgent ? "accompagnée" : "autonome"}`,
        metadata: {
          order_id: order.id,
          user_id: user.id,
          has_agent_option: hasAgent,
          cv_model_id: cvModelId,
        },
      });
    } catch (kpayError) {
      console.error("[Checkout] Échec initialisation KPay :", kpayError.message);
      // La commande "pending" reste en base — utile en debug, sans conséquence
      // pour l'utilisateur (elle n'apparaît jamais comme payée sans webhook validé).
      return NextResponse.json({ error: kpayError.message }, { status: 502 });
    }

    // 3. L'identifiant KPay est connu dès l'initialisation : on le rattache
    // tout de suite à la commande pour que le webhook puisse la retrouver de
    // façon fiable même si metadata.order_id venait à manquer.
    await supabase.from("orders").update({ payment_reference: kpayPayment.id }).eq("id", order.id);

    return NextResponse.json({
      checkoutUrl: kpayPayment.gatewayUrl,
      reference: kpayPayment.id,
      orderId: order.id,
    });
  } catch (error) {
    console.error("[Checkout API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}
