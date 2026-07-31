import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { labelForCvModel } from "./cvModels";

/**
 * Numéro de facture unique et déterministe : FACT-{année}-{8 premiers
 * caractères de l'UUID de la commande, en majuscules}. Pas de compteur
 * séquentiel partagé (pas de table dédiée) — l'UUID de orders.id garantit
 * l'unicité sans risque de collision entre requêtes concurrentes.
 */
export function buildInvoiceNumber(order) {
  const year = new Date(order.created_at || Date.now()).getFullYear();
  const shortId = String(order.id).replace(/-/g, "").slice(0, 8).toUpperCase();
  return `FACT-${year}-${shortId}`;
}

/**
 * Number.toLocaleString("fr-FR") sépare les milliers avec U+202F (espace fine
 * insécable) — absent de l'encodage WinAnsi des polices standard PDFKit
 * (Helvetica), il s'affichait comme un caractère corrompu dans le PDF généré
 * (ex: "2 /000" au lieu de "2 000", confirmé en générant et ré-analysant un
 * vrai PDF). Formatage manuel avec un espace ASCII normal, seul caractère de
 * séparation garanti supporté par cet encodage.
 */
function formatFcfaAmount(amount) {
  return Math.round(Number(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Génère le PDF de facture en mémoire (Buffer), sans toucher au stockage.
 * Séparé de generateAndStoreInvoice pour pouvoir être testé/réutilisé
 * (ex : pièce jointe e-mail) sans dépendre de Supabase Storage.
 */
export function generateInvoicePdfBuffer({ order, customer }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const invoiceNumber = buildInvoiceNumber(order);
      const issueDate = new Date(order.updated_at || order.created_at || Date.now());

      // En-tête
      doc
        .fillColor("#10E688")
        .fontSize(26)
        .font("Helvetica-Bold")
        .text("Facilite", 50, 50);

      doc
        .fillColor("#111827")
        .fontSize(11)
        .font("Helvetica")
        .text("Facture de confection de CV", 50, 82);

      doc
        .fontSize(10)
        .fillColor("#6B7280")
        .text(`Facture N° : ${invoiceNumber}`, 50, 110)
        .text(`Date d'émission : ${issueDate.toLocaleDateString("fr-FR")}`, 50, 125);

      doc.moveTo(50, 150).lineTo(545, 150).strokeColor("#E5E7EB").stroke();

      // Détails client
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Facturé à", 50, 170);

      // width + height + ellipsis force un rendu sur une seule ligne : sans
      // ces contraintes, un nom très long revient à la ligne (comportement
      // par défaut de PDFKit) et chevauche visuellement la ligne suivante,
      // positionnée en coordonnées absolues — confirmé en générant un PDF
      // réel avec un nom de 104 caractères.
      const singleLineOpts = { width: 495, height: 14, ellipsis: true };
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#374151")
        .text(customer.fullName || "Client Facilite", 50, 188, singleLineOpts)
        .text(customer.email || "", 50, 203, singleLineOpts)
        .text(customer.phone || "", 50, 218, singleLineOpts);

      // Tableau de la prestation
      const tableTop = 260;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#111827")
        .text("Description", 50, tableTop)
        .text("Montant (FCFA)", 420, tableTop, { width: 125, align: "right" });

      doc.moveTo(50, tableTop + 18).lineTo(545, tableTop + 18).strokeColor("#E5E7EB").stroke();

      let rowY = tableTop + 30;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#374151")
        .text(`Confection de CV — ${labelForCvModel(order.cv_model_id)}`, 50, rowY)
        .text("1 500", 420, rowY, { width: 125, align: "right" });

      if (order.has_agent_option) {
        rowY += 22;
        doc
          .text("Option accompagnement personnalisé par un expert", 50, rowY)
          .text("500", 420, rowY, { width: 125, align: "right" });
      }

      rowY += 35;
      doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor("#E5E7EB").stroke();

      rowY += 15;
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#111827")
        .text("Total réglé", 50, rowY)
        .text(`${formatFcfaAmount(order.amount)} ${order.currency || "XOF"}`, 420, rowY, {
          width: 125,
          align: "right",
        });

      rowY += 30;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6B7280")
        .text(`Moyen de paiement : ${order.payment_method || "Paystack"}`, 50, rowY)
        .text(`Référence de transaction : ${order.paystack_reference || "—"}`, 50, rowY + 15);

      doc
        .fontSize(9)
        .fillColor("#9CA3AF")
        .text("Facilite — Merci pour votre confiance.", 50, 760, { align: "center", width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Génère la facture PDF, la stocke dans le bucket privé "invoices" (chemin
 * {user_id}/{order_id}.pdf) et met à jour orders.invoice_url avec ce chemin
 * de stockage (pas une URL publique — le bucket est privé, la page de
 * facturation génère une URL signée à la demande, comme pour les CV).
 */
export async function generateAndStoreInvoice(order, customer) {
  const buffer = await generateInvoicePdfBuffer({ order, customer });
  const supabaseAdmin = getSupabaseAdmin();
  const storagePath = `${order.user_id}/${order.id}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("invoices")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    throw new Error(`Échec du stockage de la facture : ${uploadError.message}`);
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ invoice_url: storagePath })
    .eq("id", order.id);

  if (updateError) {
    console.error("Facture stockée mais échec de la mise à jour de orders.invoice_url :", updateError.message);
  }

  return { storagePath, buffer, invoiceNumber: buildInvoiceNumber(order) };
}
