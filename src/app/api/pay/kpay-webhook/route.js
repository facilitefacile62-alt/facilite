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
  // Hardening : Filtrer les agents utilisateurs suspects
  const userAgent = req.headers.get("user-agent")?.toLowerCase() || "";
  const suspectAgents = ["curl", "postman", "insomnia", "wget", "python-requests", "go-http-client"];
  if (suspectAgents.some((agent) => userAgent.includes(agent))) {
    console.warn(`[Webhook KPay] Tentative bloquée depuis User-Agent suspect : ${userAgent}`);
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

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

  // externalId = transactions.id, fixé lors de l'initialisation dans
  // /api/pay/checkout (voir initKpayGatewayPayment). paymentId (l'id KPay)
  // sert de filet de secours si externalId venait à manquer.
  const externalId = event.externalId;
  const kpayPaymentId = event.paymentId;

  try {
    const transactionQuery = supabaseAdmin.from("transactions").select("*");
    const { data: transaction, error: transactionError } = externalId
      ? await transactionQuery.eq("id", externalId).single()
      : await transactionQuery.eq("provider_reference", kpayPaymentId).single();

    if (transactionError || !transaction) {
      console.error("[Webhook KPay] Transaction introuvable pour externalId/paymentId", externalId, kpayPaymentId, transactionError?.message);
      return NextResponse.json({ received: true, warning: "transaction_not_found" });
    }

    if (typeof event.amount === "number" && event.amount !== Number(transaction.amount)) {
      console.error(`[Webhook KPay] Montant incohérent pour la transaction ${transaction.id} : reçu ${event.amount}, attendu ${transaction.amount}.`);
      return NextResponse.json({ received: true, warning: "amount_mismatch" });
    }

    if (event.currency && !isEquivalentCfaCurrency(event.currency, transaction.currency)) {
      console.error(`[Webhook KPay] Devise incohérente pour la transaction ${transaction.id} : reçu ${event.currency}, attendu ${transaction.currency}.`);
      return NextResponse.json({ received: true, warning: "currency_mismatch" });
    }

    // Atomicity
    const { data: updatedTransactions, error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "success",
        provider_reference: kpayPaymentId || transaction.provider_reference,
      })
      .eq("id", transaction.id)
      .eq("status", "pending")
      .select();

    if (updateError) {
      console.error("[Webhook KPay] Échec mise à jour de la transaction :", updateError.message);
      return NextResponse.json({ error: "Échec de la mise à jour de la transaction." }, { status: 500 });
    }

    if (!updatedTransactions || updatedTransactions.length === 0) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const updatedTransaction = updatedTransactions[0];
    
    // Créditer la souscription/le solde
    const { data: subscription, error: subSelectError } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", updatedTransaction.user_id)
      .single();
      
    if (!subscription && subSelectError?.code === "PGRST116") { // Non trouvé
       await supabaseAdmin.from("subscriptions").insert({
         user_id: updatedTransaction.user_id,
         plan_name: updatedTransaction.metadata?.plan_name || "premium",
         credits: 1, // On ajoute 1 crédit ou autre
         status: "active"
       });
    } else if (subscription) {
       await supabaseAdmin.from("subscriptions").update({
         credits: (subscription.credits || 0) + 1,
         plan_name: updatedTransaction.metadata?.plan_name || subscription.plan_name
       }).eq("id", subscription.id);
    }

    // Option "Accompagnement par un agent" (pour transactions spécifiques)
    if (updatedTransaction.metadata?.has_agent_option) {
      const { error: assignmentError } = await supabaseAdmin.from("agent_assignments").insert({
        order_id: updatedTransaction.id,
        candidate_id: updatedTransaction.user_id,
        status: "unassigned",
      });
      if (assignmentError) {
        console.error("[Webhook KPay] Échec création agent_assignments :", assignmentError.message);
      }
    }

    // Profil client pour les notifications
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone, contact_email")
      .eq("id", updatedTransaction.user_id)
      .single();

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(updatedTransaction.user_id);

    const customer = {
      fullName: profile?.full_name || authUser?.user?.email || "Client Facilite",
      email: profile?.contact_email || profile?.email || authUser?.user?.email || null,
      phone: profile?.phone || authUser?.user?.phone || event.phoneNumber || null,
    };

    // On retourne succès
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook KPay] Erreur interne :", error);
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
}
