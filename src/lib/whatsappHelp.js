"use client";

/**
 * Helper unifié pour le support WhatsApp Facilité (+221 77 140 08 32).
 * Permet d'ouvrir WhatsApp avec un message pré-rempli contextualisé
 * indiquant exactement d'où vient l'utilisateur (page, offre, service, etc.).
 */

export const FACILITE_WHATSAPP_NUMBER = "221771400832";
export const FACILITE_WHATSAPP_DISPLAY = "+221 77 140 08 32";

/**
 * Construit l'URL WhatsApp avec le message de contexte pré-rempli.
 * @param {Object|string} context - Objet décrivant le contexte ou message direct
 * @returns {string} URL WhatsApp complète (https://wa.me/...)
 */
export function getFaciliteWhatsAppUrl(context = {}) {
  let message = "";

  if (typeof context === "string") {
    message = context.startsWith("Bonjour")
      ? context
      : `Bonjour Facilité, j'ai besoin d'aide concernant : ${context}.`;
  } else if (context?.offerTitle || context?.offreTitre) {
    const title = (context.offerTitle || context.offreTitre || "").trim();
    const ref = context.offerId || context.offreId || "";
    message = `Bonjour Facilité, j'ai besoin d'aide pour postuler à l'offre d'emploi : "${title}"${ref ? ` (Réf: ${ref})` : ""}.`;
  } else if (context?.service) {
    message = `Bonjour Facilité, j'ai besoin d'aide concernant le service : "${context.service}".`;
  } else if (context?.page) {
    message = `Bonjour Facilité, j'ai besoin d'aide depuis la page "${context.page}" sur Facilité.`;
  } else if (context?.feature) {
    message = `Bonjour Facilité, j'ai besoin d'aide concernant la fonctionnalité "${context.feature}" sur Facilité.`;
  } else {
    message = "Bonjour Facilité, j'ai besoin d'aide sur la plateforme Facilité.";
  }

  return `https://wa.me/${FACILITE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Ouvre directement WhatsApp dans un nouvel onglet avec le message contextualisé.
 * @param {Object|string} context
 */
export function openFaciliteWhatsApp(context = {}) {
  if (typeof window !== "undefined") {
    const url = getFaciliteWhatsAppUrl(context);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
