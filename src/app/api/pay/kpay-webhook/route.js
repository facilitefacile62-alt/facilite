import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAndStoreInvoice } from "@/lib/invoiceGenerator";
import { sendInvoiceEmail, sendWhatsAppConfirmation } from "@/lib/notifications";
import { isEquivalentCfaCurrency, isPlaceholderKpaySecret } from "@/lib/kpay";

export const runtime = "nodejs";

/**
 * Vérifie que la requête provient bien de KPay : le corps brut (non parsé)
 * doit produire, une fois signé en HMAC SHA256 avec le secret webhook,
 * exactement la valeur du header X-KPAY-Signature (voir
 * https://kpay.site/documentation/webhooks). Sans cette vérification,
 * n'importe qui connaissant l'URL du webhook pourrait simuler un paiement
 * réussi.
 */
function isValidKpaySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  const expectedHash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expectedHash, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export async function POST(req) {
  const secret = process.env.KPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook KPay] KPAY_WEBHOOK_SECRET manquant côté serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  }

  // Alerte explicite (pas un blocage) : une valeur de substitution est
  // "configurée" au sens strict (la variable n'est pas vide) mais ne
  // correspond à aucun vrai secret KPay — toute notification réelle
  // échouera silencieusement la vérification de signature ci-dessous sans
  // ce signal, ce qui est très difficile à diagnostiquer en production.
  if (isPlaceholderKpaySecret(secret)) {
    console.error(
      "[Webhook KPay] ALERTE : KPAY_WEBHOOK_SECRET ressemble à une valeur de substitution, pas à un vrai " +
        "secret du tableau de bord KPay. Toutes les notifications KPay réelles seront rejetées (signature " +
        "invalide) tant que la vraie valeur n'aura pas été renseignée."
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-kpay-signature");

  if (!isValidKpaySignature(rawBody, signature, secret)) {
    console.error("[Webhook KPay] Signature invalide — requête rejetée.");
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // Tout statut autre que COMPLETED est acquitté sans action (PENDING,
  // FAILED, CANCELLED...) — KPay ne doit pas réessayer indéfiniment.
  if (event?.status !== "COMPLETED") {
    return NextResponse.json({ received: true });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("[Webhook KPay]", err.message);
    return NextResponse.json({ error: "Webhook non configuré (service role manquant)." }, { status: 503 });
  }

  // externalId = orders.id, fixé lors de l'initialisation dans
  // /api/pay/checkout (voir initKpayGatewayPayment). paymentId (l'id KPay)
  // sert de filet de secours si externalId venait à manquer.
  const orderId = event.externalId;
  const kpayPaymentId = event.paymentId;

  try {
    const orderQuery = supabaseAdmin.from("orders").select("*");
    const { data: order, error: orderError } = orderId
      ? await orderQuery.eq("id", orderId).single()
      : await orderQuery.eq("payment_reference", kpayPaymentId).single();

    if (orderError || !order) {
      console.error("[Webhook KPay] Commande introuvable pour externalId/paymentId", orderId, kpayPaymentId, orderError?.message);
      // 200 volontaire : rejouer le webhook ne fera pas apparaître une commande
      // qui n'existe pas. Une alerte serait préférable en prod (hors périmètre ici).
      return NextResponse.json({ received: true, warning: "order_not_found" });
    }

    // Vérification défensive du montant : ne jamais marquer "paid" sur la
    // seule foi du statut si le montant confirmé par KPay ne correspond pas
    // à la commande. 200 volontaire (comme order_not_found ci-dessus) :
    // rejouer un webhook au montant erroné ne le corrigera pas.
    if (typeof event.amount === "number" && event.amount !== Number(order.amount)) {
      console.error(
        `[Webhook KPay] Montant incohérent pour la commande ${order.id} : reçu ${event.amount}, attendu ${order.amount}.`
      );
      return NextResponse.json({ received: true, warning: "amount_mismatch" });
    }

    // Idem pour la devise, avec XOF/XAF traités comme équivalents (voir
    // isEquivalentCfaCurrency) — seule une devise réellement différente
    // (ni XOF ni XAF) doit bloquer.
    if (event.currency && !isEquivalentCfaCurrency(event.currency, order.currency)) {
      console.error(
        `[Webhook KPay] Devise incohérente pour la commande ${order.id} : reçu ${event.currency}, attendu ${order.currency}.`
      );
      return NextResponse.json({ received: true, warning: "currency_mismatch" });
    }

    // Idempotence sous concurrence réelle : deux livraisons quasi simultanées
    // du même événement liraient toutes les deux payment_status="pending"
    // AVANT que l'une ou l'autre n'ait eu le temps d'écrire — un simple test
    // en lecture puis écriture séparée (TOCTOU) ne suffit pas à l'empêcher.
    // La condition .eq("payment_status", "pending") sur l'UPDATE lui-même
    // rend la transition atomique au niveau de la ligne Postgres : une seule
    // requête peut réellement faire basculer pending -> paid, l'autre reçoit
    // 0 ligne modifiée et s'arrête ici sans dupliquer facture/notifications/
    // agent_assignments.
    const { data: updatedOrders, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: "kpay",
        payment_reference: kpayPaymentId || order.payment_reference,
      })
      .eq("id", order.id)
      .eq("payment_status", "pending")
      .select();

    if (updateError) {
      console.error("[Webhook KPay] Échec mise à jour de la commande :", updateError.message);
      return NextResponse.json({ error: "Échec de la mise à jour de la commande." }, { status: 500 });
    }

    if (!updatedOrders || updatedOrders.length === 0) {
      // Déjà "paid" (traité par cette requête ou une requête concurrente
      // entre-temps) : on acquitte sans rejouer les effets de bord.
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const updatedOrder = updatedOrders[0];

    // Option "Accompagnement par un agent" : crée l'entrée à traiter côté dashboard admin
    if (updatedOrder.has_agent_option) {
      const { error: assignmentError } = await supabaseAdmin.from("agent_assignments").insert({
        order_id: updatedOrder.id,
        candidate_id: updatedOrder.user_id,
        status: "unassigned",
      });
      if (assignmentError) {
        console.error("[Webhook KPay] Échec création agent_assignments :", assignmentError.message);
      }
    }

    // Profil client pour la facture et les notifications
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone, contact_email")
      .eq("id", updatedOrder.user_id)
      .single();

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(updatedOrder.user_id);

    const customer = {
      fullName: profile?.full_name || authUser?.user?.email || "Client Facilite",
      email: profile?.contact_email || profile?.email || authUser?.user?.email || null,
      phone: profile?.phone || authUser?.user?.phone || event.phoneNumber || null,
    };

    // Génération et stockage de la facture PDF — le paiement doit rester
    // "paid" même si cette étape échoue (best effort, jamais bloquant).
    let invoiceNumber = null;
    let invoiceSignedUrl = null;
    let pdfBuffer = null;
    try {
      const result = await generateAndStoreInvoice(updatedOrder, customer);
      invoiceNumber = result.invoiceNumber;
      pdfBuffer = result.buffer;

      const { data: signedUrlData } = await supabaseAdmin.storage
        .from("invoices")
        .createSignedUrl(result.storagePath, 60 * 60 * 24 * 7); // valable 7 jours
      invoiceSignedUrl = signedUrlData?.signedUrl || null;
    } catch (invoiceErr) {
      console.error("[Webhook KPay] Échec génération/stockage de la facture :", invoiceErr?.message);
    }

    if (invoiceNumber) {
      await sendInvoiceEmail({
        to: customer.email,
        fullName: customer.fullName,
        invoiceNumber,
        order: updatedOrder,
        pdfBuffer,
      });

      await sendWhatsAppConfirmation({
        phone: customer.phone,
        fullName: customer.fullName,
        invoiceNumber,
        invoiceSignedUrl,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook KPay] Erreur interne :", error);
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
}
