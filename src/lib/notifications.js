import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

/**
 * E-mail de confirmation d'achat avec la facture PDF en pièce jointe.
 *
 * Reprend le mode dégradé déjà en place dans /api/postuler : en l'absence de
 * domaine vérifié Resend, l'expéditeur retombe sur onboarding@resend.dev, qui
 * ne peut envoyer qu'à l'adresse e-mail vérifiée du compte Resend
 * (RESEND_TEST_RECIPIENT). Ne lève jamais d'exception : un échec d'envoi ne
 * doit pas remettre en cause un paiement déjà confirmé côté webhook.
 */
export async function sendInvoiceEmail({ to, fullName, invoiceNumber, order, pdfBuffer }) {
  const isProd = process.env.NODE_ENV === "production";
  const sender =
    process.env.RESEND_FROM_BILLING ||
    (isProd ? "Facilite Facturation <facturation@ffacilite.com>" : "Facilite <onboarding@resend.dev>");

  const isOnboarding = sender.includes("onboarding@resend.dev");
  const testRecipient = isOnboarding ? process.env.RESEND_TEST_RECIPIENT || process.env.RESEND_VERIFIED_EMAIL : null;
  const finalRecipient = testRecipient || to;

  if (!finalRecipient) {
    console.error("[Notifications] Aucun destinataire e-mail disponible pour la facture", invoiceNumber);
    return { delivered: false, reason: "no_recipient" };
  }

  try {
    const { error } = await resend.emails.send({
      from: sender,
      to: finalRecipient,
      subject: `[Facilite] Confirmation de paiement — Facture ${invoiceNumber}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2 style="color: #10E688;">Bonjour ${fullName || "cher client"},</h2>
          <p>Nous vous confirmons la réception de votre paiement de
             <strong>${Number(order.amount).toLocaleString("fr-FR")} ${order.currency}</strong>
             pour la confection de votre CV${order.has_agent_option ? " avec accompagnement personnalisé" : ""}.</p>
          <p>Votre facture <strong>${invoiceNumber}</strong> est disponible en pièce jointe de cet e-mail,
             ainsi que dans votre espace « Facturation & Historique ».</p>
          <br/>
          <p style="border-top: 1px solid #eee; padding-top: 15px; font-size: 12px; color: #777;">
            Cordialement,<br/>L'équipe Facilite
          </p>
        </div>
      `,
      attachments: pdfBuffer
        ? [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer }]
        : undefined,
    });

    if (error) {
      console.error("[Notifications] Échec envoi e-mail de facture :", error.message || error);
      return { delivered: false, reason: error.message };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[Notifications] Exception envoi e-mail de facture :", err?.message);
    return { delivered: false, reason: err?.message };
  }
}

/**
 * Notification WhatsApp de confirmation d'achat (API Twilio).
 *
 * Best-effort et silencieux par conception : TWILIO_ACCOUNT_SID/AUTH_TOKEN
 * ne sont pas encore configurés en environnement de développement — la
 * fonction se contente alors de logguer et de renvoyer `skipped`, sans jamais
 * faire échouer le flux de paiement qui l'appelle.
 */
export async function sendWhatsAppConfirmation({ phone, fullName, invoiceNumber, invoiceSignedUrl }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"; // numéro sandbox Twilio par défaut

  if (!accountSid || !authToken) {
    console.warn("[Notifications] TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN absents — notification WhatsApp ignorée.");
    return { delivered: false, reason: "twilio_not_configured" };
  }

  if (!phone) {
    console.warn("[Notifications] Aucun numéro de téléphone disponible pour la notification WhatsApp.");
    return { delivered: false, reason: "no_phone" };
  }

  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(accountSid, authToken);

    const toNumber = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
    const bodyLines = [
      `Bonjour ${fullName || ""},`.trim(),
      `Votre paiement pour la confection de votre CV a bien été confirmé (facture ${invoiceNumber}).`,
    ];
    if (invoiceSignedUrl) {
      bodyLines.push(`Téléchargez votre facture : ${invoiceSignedUrl}`);
    }
    bodyLines.push("— L'équipe Facilite");

    await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: bodyLines.join("\n\n"),
    });

    return { delivered: true };
  } catch (err) {
    console.error("[Notifications] Échec envoi WhatsApp :", err?.message);
    return { delivered: false, reason: err?.message };
  }
}
