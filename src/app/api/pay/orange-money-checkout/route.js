import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { genererQrCodePaiement, obtenirStatutTransaction } from "@/lib/orangeMoney";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

// Abonnement Premium — unique offre pour l'instant, montant fixé côté
// serveur (jamais accepté depuis le client) : même précaution que
// CREDIT_TOPUP_PRICE_XOF dans checkout/route.js, dont le commentaire
// documente précisément pourquoi (un montant client-fourni avait permis un
// paiement à 1 XOF crédité comme un forfait complet).
const PREMIUM_PRICE_XOF = 2000;
const PREMIUM_PLAN_NAME = "premium";
const QR_VALIDITY_SECONDS = 900;

export const runtime = "nodejs";

/**
 * Initie un paiement Orange Money "Paiement Marchand" : crée une
 * transaction "pending" (table générique "transactions", même schéma que
 * la recharge de crédits KPay) puis génère le QR code/deeplinks associés.
 * Contrairement à KPay/PayDunya, la réponse ne contient PAS d'URL de
 * paiement à rediriger — le frontend affiche le QR code et les deeplinks
 * directement sur la page, la confirmation arrivant plus tard par webhook.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    if (!process.env.ORANGE_MONEY_CLIENT_ID || !process.env.ORANGE_MONEY_CLIENT_SECRET || !process.env.ORANGE_MONEY_MERCHANT_CODE) {
      return NextResponse.json(
        { error: "Le paiement Orange Money n'est pas encore configuré." },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount: PREMIUM_PRICE_XOF,
        currency: "XOF",
        provider: "orange_money",
        metadata: { plan_name: PREMIUM_PLAN_NAME },
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error("[Orange Money Checkout] Échec création transaction :", transactionError?.message);
      captureCriticalPaymentError("[Orange Money Checkout] Échec création transaction", { message: transactionError?.message });
      return NextResponse.json({ error: "Impossible de créer la transaction." }, { status: 500 });
    }

    let qrCode;
    try {
      qrCode = await genererQrCodePaiement({
        reference: transaction.id,
        montantXof: PREMIUM_PRICE_XOF,
        nom: "Abonnement Facilité Premium",
        validiteSecondes: QR_VALIDITY_SECONDS,
        callbackSuccessUrl: `${appUrl}/premium?statut=succes`,
        callbackCancelUrl: `${appUrl}/premium?statut=annule`,
        callbackUrl: `${appUrl}/api/pay/orange-money-webhook`,
      });
    } catch (orangeError) {
      console.error("[Orange Money Checkout] Échec génération QR code :", orangeError.message);
      captureCriticalPaymentError("[Orange Money Checkout] Échec génération QR code", { transactionId: transaction.id, message: orangeError.message });
      // La transaction "pending" reste en base : elle n'a jamais eu de
      // provider_reference (qrId), distinguable plus tard d'un paiement
      // réellement initié mais jamais confirmé.
      return NextResponse.json({ error: orangeError.message }, { status: 502 });
    }

    await supabase.from("transactions").update({ provider_reference: qrCode.qrId }).eq("id", transaction.id);

    return NextResponse.json({
      transactionId: transaction.id,
      qrId: qrCode.qrId,
      qrCodeBase64: qrCode.qrCodeBase64,
      deepLinkMaxit: qrCode.deepLinkMaxit,
      deepLinkOm: qrCode.deepLinkOm,
      validForSeconds: QR_VALIDITY_SECONDS,
    });
  } catch (error) {
    console.error("[Orange Money Checkout API Error]", error);
    captureCriticalPaymentError("[Orange Money Checkout API Error] Exception non gérée", { message: error?.message });
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}

/**
 * Repli si le webhook n'arrive jamais (statut final garanti par Orange sous
 * 24h) : interrogé par le frontend en polling pendant que l'utilisateur
 * scanne/confirme le paiement dans son appli Orange Money. Ne fait AUCUNE
 * écriture ici — la seule source de vérité qui active le statut premium
 * reste le webhook signé (src/app/api/pay/orange-money-webhook/route.js) ;
 * cette route se contente de refléter, pour l'affichage, ce qu'Orange
 * répond, et de rattraper le cas où l'utilisateur revient sur la page
 * avant que le webhook n'ait eu le temps d'arriver.
 */
export async function GET(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const transactionId = new URL(req.url).searchParams.get("transactionId");
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId requis." }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id, status, provider_reference, user_id")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json({ error: "Transaction introuvable." }, { status: 404 });
    }

    // Déjà tranché localement (webhook déjà reçu) : pas besoin d'appeler
    // Orange à nouveau.
    if (transaction.status !== "pending") {
      return NextResponse.json({ status: transaction.status });
    }

    if (!transaction.provider_reference) {
      return NextResponse.json({ status: "pending" });
    }

    try {
      const statutOrange = await obtenirStatutTransaction(transaction.provider_reference);
      return NextResponse.json({ status: transaction.status, orangeStatus: statutOrange.status || null });
    } catch (orangeError) {
      console.error("[Orange Money Status] Échec lecture statut :", orangeError.message);
      // Ne bloque jamais l'affichage : la page continue de montrer "pending".
      return NextResponse.json({ status: transaction.status });
    }
  } catch (error) {
    console.error("[Orange Money Status API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
