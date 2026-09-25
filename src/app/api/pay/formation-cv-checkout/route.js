import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { genererQrCodePaiement, obtenirStatutTransaction } from "@/lib/orangeMoney";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

// Paiement de la formation "Rédaction de CV" (15 000 FCFA, accès permanent)
// — réutilise l'intégration Orange Money "Paiement Marchand" déjà codée
// (src/lib/orangeMoney.js), même patron que jetons-checkout/route.js. PAS le
// flux générique "transactions/subscriptions" (abandonné le 2026-08-28, voir
// checkout/route.js et la migration 20260925150000) : ce dernier a été
// retiré précisément parce qu'un abonnement/contenu numérique acheté et
// consommé dans l'app Android impose Google Play Billing. Cette page est
// WEB SEULEMENT (jamais ajoutée à mobile/src/lib/webEcrans.ts), même
// mitigation que /premium.
//
// Une seule ligne d'inscription par utilisateur (user_id UNIQUE,
// contrairement aux jetons rechargeables) : elle EST la transaction, pas
// besoin d'une table séparée. Réutilisée telle quelle en cas de nouvelle
// tentative (QR expiré, paiement annulé) plutôt que d'en recréer une.
const MONTANT_XOF = 15000;
const QR_VALIDITY_SECONDS = 900;

export const runtime = "nodejs";

function clientAvecJeton(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

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
    const supabase = clientAvecJeton(token);

    const { data: existante, error: lectureError } = await supabase
      .from("formation_redaction_cv_inscriptions")
      .select("id, paye")
      .eq("user_id", user.id)
      .maybeSingle();

    if (lectureError) {
      console.error("[Formation CV Checkout] Échec lecture inscription :", lectureError.message);
      return NextResponse.json({ error: "Impossible de vérifier votre inscription." }, { status: 500 });
    }

    if (existante?.paye) {
      return NextResponse.json({ error: "Vous êtes déjà inscrit à cette formation.", dejaInscrit: true }, { status: 409 });
    }

    let inscriptionId = existante?.id;
    if (!inscriptionId) {
      const { data: nouvelle, error: insertError } = await supabase
        .from("formation_redaction_cv_inscriptions")
        .insert({ user_id: user.id, paye: false, montant_xof: MONTANT_XOF })
        .select("id")
        .single();

      if (insertError || !nouvelle) {
        console.error("[Formation CV Checkout] Échec création inscription :", insertError?.message);
        captureCriticalPaymentError("[Formation CV Checkout] Échec création inscription", { message: insertError?.message });
        return NextResponse.json({ error: "Impossible de créer votre inscription." }, { status: 500 });
      }
      inscriptionId = nouvelle.id;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    let qrCode;
    try {
      qrCode = await genererQrCodePaiement({
        reference: inscriptionId,
        montantXof: MONTANT_XOF,
        nom: "Formation Rédaction de CV Facilité",
        validiteSecondes: QR_VALIDITY_SECONDS,
        callbackSuccessUrl: `${appUrl}/formation-redaction-cv?statut=succes`,
        callbackCancelUrl: `${appUrl}/formation-redaction-cv?statut=annule`,
        callbackUrl: `${appUrl}/api/pay/formation-cv-webhook`,
      });
    } catch (orangeError) {
      console.error("[Formation CV Checkout] Échec génération QR code :", orangeError.message);
      captureCriticalPaymentError("[Formation CV Checkout] Échec génération QR code", { inscriptionId, message: orangeError.message });
      return NextResponse.json({ error: orangeError.message }, { status: 502 });
    }

    await supabase
      .from("formation_redaction_cv_inscriptions")
      .update({ provider_reference: qrCode.qrId })
      .eq("id", inscriptionId);

    return NextResponse.json({
      inscriptionId,
      montantXof: MONTANT_XOF,
      qrId: qrCode.qrId,
      qrCodeBase64: qrCode.qrCodeBase64,
      deepLinkMaxit: qrCode.deepLinkMaxit,
      deepLinkOm: qrCode.deepLinkOm,
      validForSeconds: QR_VALIDITY_SECONDS,
    });
  } catch (error) {
    console.error("[Formation CV Checkout API Error]", error);
    captureCriticalPaymentError("[Formation CV Checkout API Error] Exception non gérée", { message: error?.message });
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}

/**
 * Repli si le webhook n'arrive jamais — même raisonnement que
 * jetons-checkout : ne fait AUCUNE écriture, seul le webhook signé fait
 * passer paye à true.
 */
export async function GET(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = clientAvecJeton(token);

    const { data: inscription, error: lectureError } = await supabase
      .from("formation_redaction_cv_inscriptions")
      .select("paye, provider_reference, certifie")
      .eq("user_id", user.id)
      .maybeSingle();

    if (lectureError || !inscription) {
      return NextResponse.json({ status: "pending" });
    }

    if (inscription.paye) {
      return NextResponse.json({ status: "success", certifie: inscription.certifie });
    }

    if (!inscription.provider_reference) {
      return NextResponse.json({ status: "pending" });
    }

    try {
      const statutOrange = await obtenirStatutTransaction(inscription.provider_reference);
      return NextResponse.json({ status: "pending", orangeStatus: statutOrange.status || null });
    } catch (orangeError) {
      console.error("[Formation CV Status] Échec lecture statut :", orangeError.message);
      return NextResponse.json({ status: "pending" });
    }
  } catch (error) {
    console.error("[Formation CV Status API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
