import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Numéro de facture unique et déterministe : FACT-{année}-{8 premiers
 * caractères de l'UUID de l'enregistrement, en majuscules}. Pas de compteur
 * séquentiel partagé (pas de table dédiée) — l'UUID (orders.id ou
 * transactions.id, les deux espaces ne collisionnent jamais entre eux)
 * garantit l'unicité sans risque de collision entre requêtes concurrentes.
 */
export function buildInvoiceNumber(record) {
  const year = new Date(record.created_at || Date.now()).getFullYear();
  const shortId = String(record.id).replace(/-/g, "").slice(0, 8).toUpperCase();
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
 * Génère le PDF de reçu/facture en mémoire (Buffer), sans toucher au
 * stockage. Générique : ni le type de prestation (CV, recharge de crédits...)
 * ni le nombre de lignes ne sont figés — `lineItems` porte tout le détail
 * métier, cette fonction ne fait que la mise en page.
 *
 * Séparé de generateAndStoreInvoice pour pouvoir être testé/réutilisé
 * (ex : pièce jointe e-mail) sans dépendre de Supabase Storage.
 */
export function generateInvoicePdfBuffer({ record, customer, documentLabel, lineItems, paymentMethod, paymentReference }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const invoiceNumber = buildInvoiceNumber(record);
      const issueDate = new Date(record.updated_at || record.created_at || Date.now());

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
        .text(documentLabel, 50, 82);

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
      for (const item of lineItems) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#374151")
          .text(item.description, 50, rowY, { width: 340 })
          .text(formatFcfaAmount(item.amount), 420, rowY, { width: 125, align: "right" });
        rowY += 22;
      }

      rowY += 13;
      doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor("#E5E7EB").stroke();

      rowY += 15;
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#111827")
        .text("Total réglé", 50, rowY)
        .text(`${formatFcfaAmount(record.amount)} ${record.currency || "XOF"}`, 420, rowY, {
          width: 125,
          align: "right",
        });

      rowY += 30;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6B7280")
        .text(`Moyen de paiement : ${paymentMethod || "KPay"}`, 50, rowY)
        .text(`Référence de transaction : ${paymentReference || "—"}`, 50, rowY + 15);

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
 * Génère la facture PDF et la stocke dans le bucket privé "invoices"
 * (chemin {user_id}/{record.id}.pdf) — bucket partagé entre commandes de CV
 * et recharges de crédits, le préfixe user_id + l'UUID de l'enregistrement
 * suffisent à éviter toute collision. Ne met PAS à jour la ligne
 * orders/transactions elle-même : chaque appelant connaît sa propre table
 * et le fait directement (pas une URL publique — le bucket est privé, la
 * page de facturation génère une URL signée à la demande).
 */
export async function generateAndStoreInvoice(record, customer, { lineItems, documentLabel, paymentMethod, paymentReference }) {
  const buffer = await generateInvoicePdfBuffer({ record, customer, documentLabel, lineItems, paymentMethod, paymentReference });
  const supabaseAdmin = getSupabaseAdmin();
  const storagePath = `${record.user_id}/${record.id}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("invoices")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    throw new Error(`Échec du stockage de la facture : ${uploadError.message}`);
  }

  return { storagePath, buffer, invoiceNumber: buildInvoiceNumber(record) };
}
