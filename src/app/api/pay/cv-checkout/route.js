import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { orangeMoneyActif } from "@/lib/orangeMoneyActif";
import { formeLien } from "@/lib/ouvertureAppPaiement";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { genererJetonCallback, genererQrCodePaiement, QR_VALIDITE_SECONDES, messageUtilisateurOrange } from "@/lib/orangeMoney";
import { montantAchatCvValide, nomQrCv } from "@/lib/cvAchatPaiement";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

// Achat d'un modèle de CV — même intégration Orange Money « Paiement Marchand » (QR code) que les jetons et la formation CV
// (src/lib/orangeMoney.js) ; la confirmation arrive par le webhook commun (cv-achat-webhook, via src/lib/webhookOrange.js).
//
// Le navigateur n'envoie QUE l'identifiant du modèle. Le prix, l'état « actif » et l'éventuel achat déjà fait sont lus en base côté serveur
// par preparer_achat_cv() (fonction réservée au rôle serveur, un seul paiement en attente à la fois par acheteur et par modèle).
const corpsSchema = z.object({ modeleId: z.string().uuid() });

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    if (!orangeMoneyActif()) {
      return NextResponse.json({ error: "Le paiement Orange Money n'est pas encore configuré." }, { status: 503 });
    }

    const corps = corpsSchema.safeParse(await req.json().catch(() => ({})));
    if (!corps.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { modeleId } = corps.data;

    const admin = getSupabaseAdmin();

    // Jeton secret propre à cette commande, placé dans l'URL de callback ; seule son empreinte est stockée (jamais choisie par le client).
    const { jeton: jetonCallback, empreinte: empreinteCallback } = genererJetonCallback();
    const { data: lignes, error: preparationError } = await admin.rpc("preparer_achat_cv", {
      p_user_id: user.id,
      p_modele_id: modeleId,
      p_callback_token_hash: empreinteCallback,
    });
    const preparation = Array.isArray(lignes) ? lignes[0] : lignes;
    if (preparationError || !preparation) {
      console.error("[CV Checkout] Préparation de l'achat impossible :", preparationError?.message);
      captureCriticalPaymentError("[CV Checkout] Préparation de l'achat impossible", { message: preparationError?.message });
      return NextResponse.json({ error: "Impossible de préparer le paiement." }, { status: 500 });
    }
    if (preparation.etat === "modele_introuvable") return NextResponse.json({ error: "Ce modèle n'est pas disponible." }, { status: 404 });
    if (preparation.etat === "deja_achete") return NextResponse.json({ error: "Vous avez déjà acheté ce modèle.", dejaAchete: true }, { status: 409 });
    if (preparation.etat === "en_cours") {
      // Un QR encore valable existe déjà pour ce modèle : on n'en ouvre jamais un second (il pourrait être payé deux fois). La page
      // retrouve le paiement qu'elle a gardé ; sinon elle attend la fin de validité (reste) avant de recommencer.
      return NextResponse.json(
        { error: "Un paiement est déjà en cours pour ce modèle.", paiementEnCours: true, achatId: preparation.achat_id, resteSecondes: preparation.reste_secondes },
        { status: 409 }
      );
    }

    const achatId = preparation.achat_id;
    const montantXof = preparation.montant_xof;
    if (!montantAchatCvValide(montantXof)) {
      // Prix de la base inférieur au minimum : jamais présenté à Orange. La commande est abandonnée.
      await admin.from("cv_achats").update({ status: "failed" }).eq("id", achatId).eq("status", "pending");
      console.error("[CV Checkout] Prix du modèle inférieur au minimum, paiement refusé.");
      captureCriticalPaymentError("[CV Checkout] Prix du modèle invalide", { modeleId });
      return NextResponse.json({ error: "Ce modèle n'est pas disponible pour le moment." }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    let qrCode;
    try {
      qrCode = await genererQrCodePaiement({
        reference: achatId,
        montantXof,
        // Champ `name` lu par Orange seulement : « CV » + nom du modèle, court et sans accent (voir nomQrOrange).
        nom: nomQrCv(preparation.nom),
        validiteSecondes: QR_VALIDITE_SECONDES,
        // Retour sur le site avec l'identifiant de l'achat : la page lit l'état, elle ne valide JAMAIS un achat sur la seule foi de ce retour.
        callbackSuccessUrl: `${appUrl}/achat-cv?statut=succes&commande=${achatId}`,
        callbackCancelUrl: `${appUrl}/achat-cv?statut=annule&commande=${achatId}`,
        callbackUrl: `${appUrl}/api/pay/cv-achat-webhook?t=${jetonCallback}`,
      });
    } catch (orangeError) {
      console.error("[CV Checkout] Échec génération QR code :", orangeError.message);
      captureCriticalPaymentError("[CV Checkout] Échec génération QR code", { achatId, message: orangeError.message });
      // Aucun QR n'existe : aucun paiement possible pour cette commande, on la ferme pour qu'une nouvelle tentative soit immédiate.
      await admin.from("cv_achats").update({ status: "failed" }).eq("id", achatId).eq("status", "pending");
      return NextResponse.json({ error: messageUtilisateurOrange(orangeError) }, { status: orangeError.httpStatus === 429 ? 429 : 502 });
    }

    console.info("[CV Checkout] Liens d'application Orange : MAXIT =", formeLien(qrCode.deepLinkMaxit), "· OM =", formeLien(qrCode.deepLinkOm), "· générique =", formeLien(qrCode.deepLink));

    await admin.from("cv_achats").update({ provider_reference: qrCode.qrId }).eq("id", achatId);

    return NextResponse.json({
      achatId,
      modeleId,
      montantXof,
      qrId: qrCode.qrId,
      qrCodeBase64: qrCode.qrCodeBase64,
      deepLinkMaxit: qrCode.deepLinkMaxit,
      deepLinkOm: qrCode.deepLinkOm,
      validForSeconds: QR_VALIDITE_SECONDES,
    });
  } catch (error) {
    console.error("[CV Checkout API Error]", error);
    captureCriticalPaymentError("[CV Checkout API Error] Exception non gérée", { message: error?.message });
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}

/**
 * État d'un achat (lecture seule, aucune écriture) : seul le webhook / le rattrapage validé par Orange fait passer un achat à « success ».
 * Lu avec la session de l'acheteur : la sécurité par lignes ne lui montre que ses propres achats.
 */
export async function GET(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const achatId = new URL(req.url).searchParams.get("achatId");
    if (!achatId || !z.string().uuid().safeParse(achatId).success) {
      return NextResponse.json({ error: "achatId requis." }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });

    const { data: achat, error } = await supabase.from("cv_achats").select("id, modele_id, status, created_at").eq("id", achatId).maybeSingle();
    if (error || !achat) return NextResponse.json({ error: "Achat introuvable." }, { status: 404 });
    return NextResponse.json({ status: achat.status, modeleId: achat.modele_id });
  } catch (error) {
    console.error("[CV Status API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
