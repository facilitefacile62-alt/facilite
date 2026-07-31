import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAndStoreInvoice } from "@/lib/invoiceGenerator";
import { sendInvoiceEmail, sendWhatsAppConfirmation } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * Vérifie que la requête provient bien de Paystack : le corps brut (non
 * parsé) doit produire, une fois signé en HMAC SHA512 avec la clé secrète,
 * exactement la valeur du header x-paystack-signature. Sans cette
 * vérification, n'importe qui connaissant l'URL du webhook pourrait
 * simuler un paiement réussi.
 */
function isValidPaystackSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  const expectedHash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expectedHash, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export async function POST(req) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("[Webhook Paystack] PAYSTACK_SECRET_KEY manquant côté serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!isValidPaystackSignature(rawBody, signature, secret)) {
    console.error("[Webhook Paystack] Signature invalide — requête rejetée.");
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // Tout événement autre que charge.success est acquitté sans action
  // (ex: charge.failed, transfer.success...) — Paystack ne doit pas réessayer indéfiniment.
  if (event?.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("[Webhook Paystack]", err.message);
    return NextResponse.json({ error: "Webhook non configuré (service role manquant)." }, { status: 503 });
  }

  const data = event.data || {};
  const reference = data.reference;
  const orderId = data.metadata?.order_id;

  try {
    const orderQuery = supabaseAdmin.from("orders").select("*");
    const { data: order, error: orderError } = orderId
      ? await orderQuery.eq("id", orderId).single()
      : await orderQuery.eq("paystack_reference", reference).single();

    if (orderError || !order) {
      console.error("[Webhook Paystack] Commande introuvable pour la référence", reference, orderError?.message);
      // 200 volontaire : rejouer le webhook ne fera pas apparaître une commande
      // qui n'existe pas. Une alerte serait préférable en prod (hors périmètre ici).
      return NextResponse.json({ received: true, warning: "order_not_found" });
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
        payment_method: data.channel || "paystack",
        paystack_reference: reference,
      })
      .eq("id", order.id)
      .eq("payment_status", "pending")
      .select();

    if (updateError) {
      console.error("[Webhook Paystack] Échec mise à jour de la commande :", updateError.message);
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
        console.error("[Webhook Paystack] Échec création agent_assignments :", assignmentError.message);
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
      phone: profile?.phone || authUser?.user?.phone || null,
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
      console.error("[Webhook Paystack] Échec génération/stockage de la facture :", invoiceErr?.message);
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
    console.error("[Webhook Paystack] Erreur interne :", error);
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
}
