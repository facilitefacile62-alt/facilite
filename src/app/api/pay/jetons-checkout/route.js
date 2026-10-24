import { NextResponse } from "next/server";
import { orangeMoneyActif } from "@/lib/orangeMoneyActif";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { genererJetonCallback, genererQrCodePaiement, rechercherTransactionOrange, messageUtilisateurOrange } from "@/lib/orangeMoney";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";
import { z } from "zod";

// Achat de jetons Marketplace — remplace l'ancien abonnement générique
// "2 000 FCFA/mois" (voir jetons_marketplace, migration
// 20260912020000) : une boutique achète un nombre de jetons de son choix,
// convertis en FCFA au taux configuré dans jetons_config (jamais codé en
// dur, voir ce commentaire de tête de migration). Réutilise telle quelle
// l'intégration Orange Money "Paiement Marchand" déjà codée
// (src/lib/orangeMoney.js) — seule la table écrite change
// (jetons_transactions au lieu de transactions/subscriptions).
const QR_VALIDITY_SECONDS = 900;
const QUANTITE_MIN = 1;
const QUANTITE_MAX = 100000; // garde-fou large, pas une vraie limite métier

const corpsSchema = z.object({
  storeId: z.string().uuid(),
  quantiteJetons: z.number().int().min(QUANTITE_MIN).max(QUANTITE_MAX),
});

export const runtime = "nodejs";

/**
 * Initie un achat de jetons : crée une transaction "pending" dans
 * jetons_transactions puis génère le QR code/deeplinks Orange Money
 * associés. Comme pour l'ancien flux, aucune URL de redirection n'est
 * renvoyée — le frontend affiche le QR code et les deeplinks directement,
 * la confirmation arrivant plus tard par webhook signé.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    if (!orangeMoneyActif()) {
      return NextResponse.json(
        { error: "Le paiement Orange Money n'est pas encore configuré." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = corpsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides.", details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const { storeId, quantiteJetons } = parseResult.data;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Propriété vérifiée explicitement plutôt que de s'appuyer uniquement
    // sur la policy RLS de marketplace_stores (qui autorise aussi la
    // lecture des boutiques actives d'autrui) : un vendeur ne doit jamais
    // pouvoir créditer les jetons d'une boutique qui n'est pas la sienne.
    const { data: store, error: storeError } = await supabase
      .from("marketplace_stores")
      .select("id, owner_id")
      .eq("id", storeId)
      .single();

    if (storeError || !store || store.owner_id !== user.id) {
      return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
    }

    const { data: config, error: configError } = await supabase
      .from("jetons_config")
      .select("cout_jeton_fcfa")
      .eq("id", 1)
      .single();

    if (configError || !config) {
      console.error("[Jetons Checkout] Configuration du taux introuvable :", configError?.message);
      captureCriticalPaymentError("[Jetons Checkout] Configuration du taux introuvable", { message: configError?.message });
      return NextResponse.json({ error: "Le tarif des jetons n'est pas configuré." }, { status: 503 });
    }

    const montantXof = quantiteJetons * config.cout_jeton_fcfa;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    // Jeton secret propre à cette commande, placé dans l'URL de callback ; seule son empreinte est stockée. La ligne est
    // écrite avec le rôle serveur (propriété de la boutique déjà vérifiée plus haut) : montant_xof et l'empreinte ne
    // doivent jamais pouvoir être choisis par le client.
    const { jeton: jetonCallback, empreinte: empreinteCallback } = genererJetonCallback();
    const { data: transaction, error: transactionError } = await getSupabaseAdmin()
      .from("jetons_transactions")
      .insert({
        montant_xof: montantXof,
        callback_token_hash: empreinteCallback,
        store_id: storeId,
        montant: quantiteJetons,
        type: "achat",
        status: "pending",
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error("[Jetons Checkout] Échec création transaction :", transactionError?.message);
      captureCriticalPaymentError("[Jetons Checkout] Échec création transaction", { message: transactionError?.message });
      return NextResponse.json({ error: "Impossible de créer la transaction." }, { status: 500 });
    }

    let qrCode;
    try {
      qrCode = await genererQrCodePaiement({
        reference: transaction.id,
        montantXof,
        nom: `Achat de ${quantiteJetons} jeton${quantiteJetons > 1 ? "s" : ""} Facilité Marketplace`,
        validiteSecondes: QR_VALIDITY_SECONDS,
        // Retour du client sur le site avec l'identifiant de commande : la page lit l'état de la commande, elle ne crédite JAMAIS sur la
        // seule foi de ce retour (seule la confirmation auprès d'Orange, côté serveur, crédite).
        callbackSuccessUrl: `${appUrl}/premium?statut=succes&commande=${transaction.id}`,
        callbackCancelUrl: `${appUrl}/premium?statut=annule&commande=${transaction.id}`,
        callbackUrl: `${appUrl}/api/pay/jetons-webhook?t=${jetonCallback}`,
      });
    } catch (orangeError) {
      console.error("[Jetons Checkout] Échec génération QR code :", orangeError.message);
      captureCriticalPaymentError("[Jetons Checkout] Échec génération QR code", { transactionId: transaction.id, message: orangeError.message });
      // La transaction "pending" reste en base : elle n'a jamais eu de
      // provider_reference (qrId), distinguable plus tard d'un paiement
      // réellement initié mais jamais confirmé.
      // Détail technique dans les journaux ci-dessus ; l'utilisateur ne voit qu'une phrase claire.
      return NextResponse.json({ error: messageUtilisateurOrange(orangeError) }, { status: orangeError.httpStatus === 429 ? 429 : 502 });
    }

    // Rôle serveur : le client n'a plus aucun droit d'écriture sur jetons_transactions.
    await getSupabaseAdmin().from("jetons_transactions").update({ provider_reference: qrCode.qrId }).eq("id", transaction.id);

    return NextResponse.json({
      transactionId: transaction.id,
      quantiteJetons,
      montantXof,
      qrId: qrCode.qrId,
      qrCodeBase64: qrCode.qrCodeBase64,
      deepLinkMaxit: qrCode.deepLinkMaxit,
      deepLinkOm: qrCode.deepLinkOm,
      validForSeconds: QR_VALIDITY_SECONDS,
    });
  } catch (error) {
    console.error("[Jetons Checkout API Error]", error);
    captureCriticalPaymentError("[Jetons Checkout API Error] Exception non gérée", { message: error?.message });
    return NextResponse.json({ error: "Une erreur interne est survenue lors du paiement." }, { status: 500 });
  }
}

/**
 * Repli si le webhook n'arrive jamais (statut final garanti par Orange sous
 * 24h) — même raisonnement que l'ancien flux : ne fait AUCUNE écriture, la
 * seule source de vérité qui crédite les jetons reste le webhook signé.
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
      .from("jetons_transactions")
      .select("id, status, provider_reference, store_id")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json({ error: "Transaction introuvable." }, { status: 404 });
    }

    // RLS ("Un vendeur lit l'historique de sa boutique") a déjà filtré la
    // ligne ci-dessus par propriété — mais avec la clé anon+JWT, une ligne
    // invisible renvoie simplement "not found" (comportement déjà vérifié
    // par transactionError ci-dessus), donc arriver ici garantit déjà la
    // propriété. Vérification explicite tout de même, moins fragile qu'une
    // dépendance implicite à la policy pour un contrôle d'accès critique.
    const { data: store } = await supabase
      .from("marketplace_stores")
      .select("owner_id")
      .eq("id", transaction.store_id)
      .single();
    if (!store || store.owner_id !== user.id) {
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
      // provider_reference contient le qrId, pas le transactionId Orange (le statut s'interroge par transactionId) : on cherche par
      // NOTRE référence. Lecture seule, à titre indicatif : seule la confirmation du webhook / du rattrapage crédite.
      const reponseOrange = await rechercherTransactionOrange({ reference: transaction.id });
      return NextResponse.json({ status: transaction.status, orangeStatus: reponseOrange.status || null });
    } catch (orangeError) {
      console.error("[Jetons Status] Échec lecture statut :", orangeError.message);
      // Ne bloque jamais l'affichage : la page continue de montrer "pending".
      return NextResponse.json({ status: transaction.status });
    }
  } catch (error) {
    console.error("[Jetons Status API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
