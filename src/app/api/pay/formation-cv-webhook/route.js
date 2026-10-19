import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifierSignatureWebhook, jetonCallbackValide, secretCallbackGlobalValide, hasherJetonCallback, rechercherTransactionOrange, evaluerConfirmationOrange } from "@/lib/orangeMoney";
import { appliquerConfirmationInscription, MONTANT_FORMATION_CV_XOF } from "@/lib/formationCvPaiement";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

export const runtime = "nodejs";

// Événement déjà traité : 202 au corps vide, la réponse recommandée par Orange
// (tout 2xx marque l'événement livré, un 4xx serait un rejet définitif).
const deja_traite = () => new NextResponse(null, { status: 202 });

// Le journal des événements sert de mécanisme d'idempotence (clé UNIQUE) : il
// est écrit AVANT le traitement. Si le traitement échoue en 5xx, Orange relance
// avec la même clé ; il faut donc retirer l'événement du journal, sinon la
// relance serait prise pour un doublon et ignorée. Meilleur effort : une
// erreur ici est journalisée, jamais propagée.
async function retirerJournal(supabaseAdmin, idempotencyKey) {
  try {
    await supabaseAdmin.from("formation_redaction_cv_webhook_events").delete().eq("idempotency_key", idempotencyKey);
  } catch (err) {
    console.error("[Webhook Formation CV] Impossible de retirer l'événement du journal :", err?.message);
  }
}

// Confirmation de paiement de la formation "Rédaction de CV" via Orange
// Money "Paiement Marchand" (QR code) — événement asynchrone, jamais une
// réponse directe à l'appel d'initiation (voir formation-cv-checkout/route.js).
// Même schéma de sécurité que jetons-webhook/route.js : la notification n'est qu'un DÉCLENCHEUR — filtre par jeton
// d'URL / secret global / signature, puis confirmation de l'état réel auprès d'Orange (statut, référence ET montant)
// avant tout passage à paye = true. Un 4xx n'est jamais retenté par Orange, un timeout/5xx l'est en boucle : toute
// anomalie récupérable doit donc répondre 5xx, jamais 4xx.
export async function POST(req) {
  // Corps BRUT lu avant tout parsing JSON — la signature HMAC est calculée
  // sur les octets exacts reçus (voir verifierSignatureWebhook).
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-sonatel-signature");
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;

  // Orange ne signe pas encore ses notifications (« évolution à venir ») : la signature est vérifiée QUAND l'en-tête est
  // présent et qu'un secret est configuré — une signature fausse est refusée net.
  let signee = false;
  if (signatureHeader && secret) {
    const verification = verifierSignatureWebhook(rawBody, signatureHeader, secret);
    if (!verification.valide) {
      console.error("[Webhook Formation CV] Signature invalide —", verification.motif);
      captureCriticalPaymentError("[Webhook Formation CV] Signature invalide", { motif: verification.motif });
      return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
    }
    signee = true;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("[Webhook Formation CV]", err.message);
    captureCriticalPaymentError("[Webhook Formation CV] Service role manquant", { message: err.message });
    return NextResponse.json({ error: "Webhook non configuré (service role manquant)." }, { status: 503 });
  }

  // reference porte notre formation_redaction_cv_inscriptions.id (UUID) —
  // voir formation-cv-checkout/route.js qui l'envoie tel quel en tant que
  // `reference` à l'appel de génération du QR code.
  const reference = event.reference;
  const orangeTransactionId = event.transactionId;
  const status = event.status;

  if (!reference || typeof reference !== "string") {
    console.error("[Webhook Formation CV] Événement sans reference.");
    captureCriticalPaymentError("[Webhook Formation CV] Événement sans reference", { orangeTransactionId, status });
    return NextResponse.json({ received: true, warning: "missing_reference" });
  }

  // user_id sélectionné pour la traçabilité des erreurs (reference == inscription.id suffit à la mise à jour elle-même,
  // user_id étant UNIQUE sur cette table : une ligne == un utilisateur).
  const { data: inscription, error: inscriptionError } = await supabaseAdmin
    .from("formation_redaction_cv_inscriptions")
    .select("id, user_id, paye, callback_token_hash")
    .eq("id", reference)
    .maybeSingle();

  // Première barrière : une signature valide, OU le jeton de la tentative (?t=) dans l'URL de callback, OU — version de
  // secours si Orange n'honore qu'une URL fixe enregistrée sur le portail — le secret global (?s=,
  // ORANGE_MONEY_CALLBACK_SECRET). Réponse 404 sans aucun détail, et jamais d'appel à Orange. La vraie garantie reste
  // la confirmation auprès d'Orange plus bas.
  const parametres = new URL(req.url).searchParams;
  const filtreOk =
    signee ||
    jetonCallbackValide(parametres.get("t"), inscription?.callback_token_hash) ||
    secretCallbackGlobalValide(parametres.get("s"), process.env.ORANGE_MONEY_CALLBACK_SECRET);
  if (inscriptionError || !inscription || !filtreOk) {
    console.error("[Webhook Formation CV] Notification refusée (inscription inconnue ou jeton de callback invalide).");
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Clé d'idempotence : celle d'Orange, sinon dérivée de l'événement (Orange ne l'envoie peut-être pas sans signature).
  const idempotencyKey =
    req.headers.get("x-sonatel-idempotency-key") ||
    `derivee:${hasherJetonCallback(`${reference}|${orangeTransactionId || ""}|${status || ""}`)}`;

  // Déduplication : un INSERT qui échoue sur la contrainte UNIQUE
  // (idempotency_key) signifie "déjà traité" — journalisé avant tout
  // traitement métier, la journalisation EST le mécanisme d'idempotence.
  const { error: insertLogError } = await supabaseAdmin.from("formation_redaction_cv_webhook_events").insert({
    idempotency_key: idempotencyKey,
    status: status || null,
    orange_transaction_id: orangeTransactionId || null,
    reference,
    inscription_id: inscription.id,
    raw_payload: event,
  });

  if (insertLogError) {
    if (insertLogError.code === "23505") {
      return deja_traite();
    }
    console.error("[Webhook Formation CV] Échec journalisation :", insertLogError.message);
    captureCriticalPaymentError("[Webhook Formation CV] Échec journalisation", { message: insertLogError.message });
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }

  // La notification n'est qu'un déclencheur : l'état RÉEL du paiement est confirmé auprès d'Orange (jeton OAuth), jamais
  // lu dans le corps reçu. Aucun passage à « payé » sans cette confirmation, même quand la signature est valide.
  if (!orangeTransactionId) {
    captureCriticalPaymentError("[Webhook Formation CV] Notification sans transactionId, confirmation impossible", { reference });
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return new NextResponse(null, { status: 202 });
  }
  let confirmation;
  try {
    const reponseOrange = await rechercherTransactionOrange({ transactionId: orangeTransactionId, reference: inscription.id });
    confirmation = evaluerConfirmationOrange(reponseOrange, { reference: inscription.id, montantXof: MONTANT_FORMATION_CV_XOF });
  } catch (err) {
    // Orange injoignable : 5xx pour qu'il relance, journal retiré pour que la relance ne soit pas prise pour un doublon.
    console.error("[Webhook Formation CV] Confirmation auprès d'Orange impossible :", err.message);
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return NextResponse.json({ error: "Confirmation indisponible." }, { status: 502 });
  }
  if (confirmation.etat === "incoherent") {
    // Paiement « réussi » mais qui ne correspond pas à l'inscription (référence ou montant) : jamais de validation.
    console.error("[Webhook Formation CV] Confirmation incohérente —", confirmation.raison);
    captureCriticalPaymentError("[Webhook Formation CV] Confirmation incohérente avec l'inscription", { reference, motif: confirmation.raison });
    return NextResponse.json({ received: true, warning: "mismatch" });
  }
  if (confirmation.etat === "attente") {
    // Statut intermédiaire : rien ne change, Orange renverra une notification au statut final.
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return new NextResponse(null, { status: 202 });
  }

  const { resultat } = await appliquerConfirmationInscription(supabaseAdmin, inscription, confirmation);
  if (resultat === "erreur") {
    // Orange relance sur 5xx avec la même clé : on retire l'événement du journal pour que la relance ne soit pas prise
    // pour un doublon.
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
  if (resultat === "deja_traite") return deja_traite();
  return NextResponse.json({ received: true });
}
