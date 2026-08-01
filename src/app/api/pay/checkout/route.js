import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { initKpayGatewayPayment } from "@/lib/kpay";

import { z } from "zod";

const PRICE_AUTONOME = 1500;
const PRICE_ACCOMPAGNE = 2000;

// Deux flux de paiement distincts partagent ce point d'entrée, jamais
// mélangés dans un seul schéma : la confection de CV (paiement unique,
// table "orders", inchangée depuis l'origine) et la recharge de crédits
// générique (table "transactions" + "subscriptions", utilisée par
// /candidat/facturation pour les futures fonctionnalités IA). Une session
// précédente avait remplacé le premier schéma par le second, cassant
// PricingModal.js qui envoie toujours { cvModelId, hasAgentOption } sans
// "amount" — restauré ici en union plutôt qu'en écrasant l'un des deux.
const cvOrderSchema = z.object({
  cvModelId: z.string().min(1, "Le modèle de CV choisi est requis."),
  hasAgentOption: z.boolean().optional(),
});

const creditTopupSchema = z.object({
  amount: z.number().int().positive("Le montant doit être strictement positif"),
  planName: z.string().optional(),
  description: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => ({}));

    if (!process.env.NEXT_PUBLIC_KPAY_PUBLIC_KEY || !process.env.KPAY_SECRET_KEY) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré (clés KPay manquantes)." },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    // --- Flux 1 : confection de CV (paiement unique, table "orders") ---
    if (body?.cvModelId !== undefined) {
      const parseResult = cvOrderSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Données de commande invalides.", details: parseResult.error.format() },
          { status: 400 }
        );
      }
      const { cvModelId, hasAgentOption } = parseResult.data;
      const hasAgent = hasAgentOption === true;
      const amount = hasAgent ? PRICE_ACCOMPAGNE : PRICE_AUTONOME;
      const currency = "XOF";

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({ user_id: user.id, cv_model_id: cvModelId, has_agent_option: hasAgent, amount, currency })
        .select()
        .single();

      if (orderError || !order) {
        console.error("[Checkout] Échec création commande :", orderError?.message);
        return NextResponse.json({ error: "Impossible de créer la commande." }, { status: 500 });
      }

      let kpayPayment;
      try {
        kpayPayment = await initKpayGatewayPayment({
          amount,
          externalId: order.id,
          returnUrl: `${appUrl}/candidat/facturation`,
          cancelUrl: `${appUrl}/creer-cv`,
          description: `Confection de CV Facilite — ${hasAgent ? "accompagnée" : "autonome"}`,
          metadata: { order_id: order.id, user_id: user.id, has_agent_option: hasAgent, cv_model_id: cvModelId },
        });
      } catch (kpayError) {
        console.error("[Checkout] Échec initialisation KPay :", kpayError.message);
        return NextResponse.json({ error: kpayError.message }, { status: 502 });
      }

      await supabase.from("orders").update({ payment_reference: kpayPayment.id }).eq("id", order.id);

      return NextResponse.json({
        checkoutUrl: kpayPayment.gatewayUrl,
        reference: kpayPayment.id,
        orderId: order.id,
      });
    }

    // --- Flux 2 : recharge de crédits générique (table "transactions") ---
    const parseResult = creditTopupSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données de paiement invalides.", details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const { amount, planName, description } = parseResult.data;
    const currency = "XOF";

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount,
        currency,
        provider: "kpay",
        status: "pending",
        metadata: { plan_name: planName || "credit_topup", description: description || "Recharge" },
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error("[Checkout] Échec création transaction :", transactionError?.message);
      return NextResponse.json({ error: "Impossible de créer la transaction." }, { status: 500 });
    }

    let kpayPayment;
    try {
      kpayPayment = await initKpayGatewayPayment({
        amount,
        externalId: transaction.id,
        returnUrl: `${appUrl}/candidat/facturation`,
        cancelUrl: `${appUrl}/candidat/facturation`,
        description: description || `Paiement Facilite - ${amount} XOF`,
        metadata: { transaction_id: transaction.id, user_id: user.id, plan_name: planName || "credit_topup" },
      });
    } catch (kpayError) {
      console.error("[Checkout] Échec initialisation KPay :", kpayError.message);
      return NextResponse.json({ error: kpayError.message }, { status: 502 });
    }

    await supabase.from("transactions").update({ provider_reference: kpayPayment.id }).eq("id", transaction.id);

    return NextResponse.json({
      checkoutUrl: kpayPayment.gatewayUrl,
      reference: kpayPayment.id,
      transactionId: transaction.id,
    });
  } catch (error) {
    console.error("[Checkout API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}
