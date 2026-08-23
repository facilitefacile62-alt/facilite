import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { initKpayGatewayPayment } from "@/lib/kpay";
import { createPayDunyaInvoiceCheckout } from "@/lib/paydunya";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

import { z } from "zod";

// KPay redevient le processeur par défaut (retour arrière du 22/08) : les
// workers RabbitMQ qui reconcilient les paiements PayDunya (webhooksWorker.js)
// ne tournent nulle part en production — confirmé en direct via l'API de
// gestion CloudAMQP, 0 consumer sur les 4 files, à l'instant. Un paiement
// PayDunya confirmé aujourd'hui resterait en file indéfiniment sans jamais
// mettre à jour orders/transactions. processor: "paydunya" reste disponible
// explicitement (code non supprimé, juste plus le choix par défaut) pour
// reprendre la bascule dès que l'hébergement des workers sera réglé.
const processorSchema = z.enum(["kpay", "paydunya"]).optional().default("kpay");

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
  // Lie la commande au brouillon exact (resumes.id) qui l'a déclenchée —
  // sans ça, impossible de savoir plus tard quel contenu régénérer en PDF
  // après paiement. Optionnel : reste compatible avec un appel sans brouillon.
  resumeId: z.string().uuid().optional(),
  processor: processorSchema,
});

// Une seule offre de recharge existe actuellement : montant et nom de plan
// sont donc fixés ici, jamais acceptés depuis le client. Un ancien schéma
// prenait `amount`/`planName` tels quels depuis le corps de la requête —
// n'importe quel utilisateur authentifié pouvait poster `{ amount: 1 }` et
// obtenir un vrai lien de paiement KPay à 1 XOF, crédité comme un forfait
// complet par le webhook (qui accorde 1 crédit dès que la transaction
// réussit, sans reproportionner au montant réellement payé).
const CREDIT_TOPUP_PRICE_XOF = 5000;
const CREDIT_TOPUP_PLAN_NAME = "Premium";

const creditTopupSchema = z.object({
  description: z.string().max(200).optional(),
  processor: processorSchema,
});

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => ({}));
    const processor = body?.processor === "paydunya" ? "paydunya" : "kpay";

    if (processor === "kpay" && (!process.env.NEXT_PUBLIC_KPAY_PUBLIC_KEY || !process.env.KPAY_SECRET_KEY)) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré (clés KPay manquantes)." },
        { status: 503 }
      );
    }

    if (processor === "paydunya" && (!process.env.PAYDUNYA_MASTER_KEY || !process.env.PAYDUNYA_PRIVATE_KEY || !process.env.PAYDUNYA_TOKEN)) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré (clés PayDunya manquantes)." },
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
      const { cvModelId, hasAgentOption, resumeId } = parseResult.data;
      const hasAgent = hasAgentOption === true;
      const amount = hasAgent ? PRICE_ACCOMPAGNE : PRICE_AUTONOME;
      const currency = "XOF";

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          cv_model_id: cvModelId,
          has_agent_option: hasAgent,
          amount,
          currency,
          resume_id: resumeId || null,
        })
        .select()
        .single();

      if (orderError || !order) {
        console.error("[Checkout] Échec création commande :", orderError?.message);
        captureCriticalPaymentError("[Checkout] Échec création commande", { message: orderError?.message });
        return NextResponse.json({ error: "Impossible de créer la commande." }, { status: 500 });
      }

      const cvOrderDescription = `Confection de CV Facilite — ${hasAgent ? "accompagnée" : "autonome"}`;
      const cvOrderMetadata = { order_id: order.id, user_id: user.id, has_agent_option: hasAgent, cv_model_id: cvModelId };

      let payment;
      if (processor === "paydunya") {
        try {
          const invoice = await createPayDunyaInvoiceCheckout({
            amount,
            externalId: order.id,
            returnUrl: `${appUrl}/candidat/facturation`,
            cancelUrl: `${appUrl}/creer-cv`,
            callbackUrl: `${appUrl}/api/pay/paydunya-webhook`,
            description: cvOrderDescription,
            metadata: cvOrderMetadata,
          });
          payment = { id: invoice.token, gatewayUrl: invoice.checkoutUrl };
        } catch (paydunyaError) {
          console.error("[Checkout] Échec initialisation PayDunya :", paydunyaError.message);
          captureCriticalPaymentError("[Checkout] Échec initialisation PayDunya (commande CV)", { orderId: order.id, message: paydunyaError.message });
          return NextResponse.json({ error: paydunyaError.message }, { status: 502 });
        }
      } else {
        try {
          const kpayPayment = await initKpayGatewayPayment({
            amount,
            currency,
            externalId: order.id,
            returnUrl: `${appUrl}/candidat/facturation`,
            cancelUrl: `${appUrl}/creer-cv`,
            description: cvOrderDescription,
            metadata: cvOrderMetadata,
          });
          payment = { id: kpayPayment.id, gatewayUrl: kpayPayment.gatewayUrl };
        } catch (kpayError) {
          console.error("[Checkout] Échec initialisation KPay :", kpayError.message);
          captureCriticalPaymentError("[Checkout] Échec initialisation KPay (commande CV)", { orderId: order.id, message: kpayError.message });
          return NextResponse.json({ error: kpayError.message }, { status: 502 });
        }
      }

      await supabase.from("orders").update({ payment_reference: payment.id }).eq("id", order.id);

      return NextResponse.json({
        checkoutUrl: payment.gatewayUrl,
        reference: payment.id,
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
    const { description } = parseResult.data;
    const amount = CREDIT_TOPUP_PRICE_XOF;
    const planName = CREDIT_TOPUP_PLAN_NAME;
    const currency = "XOF";

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount,
        currency,
        provider: processor,
        status: "pending",
        metadata: { plan_name: planName || "credit_topup", description: description || "Recharge" },
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error("[Checkout] Échec création transaction :", transactionError?.message);
      captureCriticalPaymentError("[Checkout] Échec création transaction", { message: transactionError?.message });
      return NextResponse.json({ error: "Impossible de créer la transaction." }, { status: 500 });
    }

    const creditTopupDescription = description || `Paiement Facilite - ${amount} XOF`;
    const creditTopupMetadata = { transaction_id: transaction.id, user_id: user.id, plan_name: planName || "credit_topup" };

    let payment;
    if (processor === "paydunya") {
      try {
        const invoice = await createPayDunyaInvoiceCheckout({
          amount,
          externalId: transaction.id,
          returnUrl: `${appUrl}/candidat/facturation`,
          cancelUrl: `${appUrl}/candidat/facturation`,
          callbackUrl: `${appUrl}/api/pay/paydunya-webhook`,
          description: creditTopupDescription,
          metadata: creditTopupMetadata,
        });
        payment = { id: invoice.token, gatewayUrl: invoice.checkoutUrl };
      } catch (paydunyaError) {
        console.error("[Checkout] Échec initialisation PayDunya :", paydunyaError.message);
        captureCriticalPaymentError("[Checkout] Échec initialisation PayDunya (recharge crédits)", { transactionId: transaction.id, message: paydunyaError.message });
        return NextResponse.json({ error: paydunyaError.message }, { status: 502 });
      }
    } else {
      try {
        const kpayPayment = await initKpayGatewayPayment({
          amount,
          currency,
          externalId: transaction.id,
          returnUrl: `${appUrl}/candidat/facturation`,
          cancelUrl: `${appUrl}/candidat/facturation`,
          description: creditTopupDescription,
          metadata: creditTopupMetadata,
        });
        payment = { id: kpayPayment.id, gatewayUrl: kpayPayment.gatewayUrl };
      } catch (kpayError) {
        console.error("[Checkout] Échec initialisation KPay :", kpayError.message);
        captureCriticalPaymentError("[Checkout] Échec initialisation KPay (recharge crédits)", { transactionId: transaction.id, message: kpayError.message });
        return NextResponse.json({ error: kpayError.message }, { status: 502 });
      }
    }

    // transactions n'accorde aucune écriture UPDATE à authenticated
    // (service_role uniquement, voir 20260821120000_transactions_service_role_only_writes.sql)
    // — contrairement à orders.payment_reference ci-dessus, qui a sa
    // propre policy candidat dédiée.
    await getSupabaseAdmin().from("transactions").update({ provider_reference: payment.id }).eq("id", transaction.id);

    return NextResponse.json({
      checkoutUrl: payment.gatewayUrl,
      reference: payment.id,
      transactionId: transaction.id,
    });
  } catch (error) {
    console.error("[Checkout API Error]", error);
    captureCriticalPaymentError("[Checkout API Error] Exception non gérée", { message: error?.message });
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}
