import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { initKpayGatewayPayment } from "@/lib/kpay";

import { z } from "zod";

const checkoutSchema = z.object({
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
    
    // Validation stricte Anti-Bot & Input Sanitization
    const parseResult = checkoutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Données de paiement invalides.", details: parseResult.error.format() }, { status: 400 });
    }
    
    const { amount, planName, description } = parseResult.data;

    const currency = "XOF";

    if (!process.env.NEXT_PUBLIC_KPAY_PUBLIC_KEY || !process.env.KPAY_SECRET_KEY) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré (clés KPay manquantes)." },
        { status: 503 }
      );
    }

    // Client au nom de l'utilisateur connecté (respecte RLS : transactions.user_id doit être auth.uid())
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 1. Création de la transaction en base, statut "pending"
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount,
        currency,
        provider: "kpay",
        status: "pending",
        metadata: { plan_name: planName || "credit_topup", description: description || "Recharge" }
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error("[Checkout] Échec création transaction :", transactionError?.message);
      return NextResponse.json({ error: "Impossible de créer la transaction." }, { status: 500 });
    }

    // 2. Initialisation du paiement KPay (mode Gateway)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    let kpayPayment;
    try {
      kpayPayment = await initKpayGatewayPayment({
        amount,
        externalId: transaction.id,
        returnUrl: `${appUrl}/candidat/facturation`,
        cancelUrl: `${appUrl}/candidat/facturation`,
        description: description || `Paiement Facilite - ${amount} XOF`,
        metadata: {
          transaction_id: transaction.id,
          user_id: user.id,
          plan_name: planName || "credit_topup"
        },
      });
    } catch (kpayError) {
      console.error("[Checkout] Échec initialisation KPay :", kpayError.message);
      return NextResponse.json({ error: kpayError.message }, { status: 502 });
    }

    // 3. Rattacher la référence de paiement KPay à notre transaction
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
