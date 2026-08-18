/**
 * Helper unifié pour la détection automatique de numéro de téléphone / WhatsApp
 * et la génération des liens directs de contact pour toute offre d'emploi ou publication.
 */

/**
 * Nettoie une chaîne de numéro de téléphone pour obtenir le format international standard (chiffres uniquement).
 * Exemple : "+221 77 717 73 73" -> "221777177373"
 * "77 717 73 73" -> "221777177373" (auto-préfixe 221 pour le Sénégal si 9 chiffres commençant par 7x/33)
 */
export function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") return null;

  // Si c'est déjà une URL WhatsApp wa.me ou api.whatsapp.com
  const waMatch = rawPhone.match(/(?:wa\.me\/|phone=)(\+?\d+)/i);
  if (waMatch && waMatch[1]) {
    const digits = waMatch[1].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return digits;
  }

  // Nettoyage général : supprimer les caractères non numériques
  let digits = rawPhone.replace(/\D/g, "");

  // Si commence par 00 (ex: 00221...), supprimer les deux premiers zéros
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Cas spécifique Sénégal : 9 chiffres commençant par 70, 75, 76, 77, 78 ou 33 -> ajouter l'indicatif 221
  if (digits.length === 9 && /^(?:70|75|76|77|78|33)\d{7}$/.test(digits)) {
    digits = `221${digits}`;
  }

  // Cas spécifique Côte d'Ivoire : 10 chiffres commençant par 01, 05, 07 -> ajouter l'indicatif 225
  if (digits.length === 10 && /^(?:01|05|07)\d{8}$/.test(digits)) {
    digits = `225${digits}`;
  }

  // Vérifier la cohérence de taille (un numéro international fait entre 8 et 15 chiffres)
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Recherche et extrait un numéro de téléphone/WhatsApp depuis n'importe quel texte ou objet offre.
 */
export function detectWhatsAppNumber(offer, extraText = "") {
  if (!offer && !extraText) return null;

  // 1. Vérification des champs explicites d'abord
  const explicitCandidates = [
    offer?.contact_whatsapp,
    offer?.whatsapp,
    offer?.contact_phone,
    offer?.phone,
    offer?.recruiter_phone,
    offer?.recruiterPhone,
    offer?.telephone,
  ];

  for (const candidate of explicitCandidates) {
    if (candidate) {
      const normalized = normalizePhoneNumber(String(candidate));
      if (normalized) return normalized;
    }
  }

  // 2. Vérification dans external_link ou apply_url si c'est un lien WhatsApp
  const urlCandidates = [offer?.external_link, offer?.externalLink, offer?.apply_url, offer?.url];
  for (const url of urlCandidates) {
    if (url && typeof url === "string") {
      if (url.includes("wa.me/") || url.includes("whatsapp.com/")) {
        const normalized = normalizePhoneNumber(url);
        if (normalized) return normalized;
      }
      // Cas tel:+221...
      if (url.startsWith("tel:")) {
        const normalized = normalizePhoneNumber(url.slice(4));
        if (normalized) return normalized;
      }
    }
  }

  // 3. Extraction par Regex dans les textes de description et titres
  const textContent = [
    extraText,
    offer?.description,
    offer?.descFR,
    offer?.descEN,
    offer?.title,
    offer?.titleFR,
    offer?.company,
    offer?.contact_email, // Parfois les utilisateurs écrivent le numéro dans ce champ
  ]
    .filter(Boolean)
    .join("\n");

  if (!textContent) return null;

  // Pattern A : Détection explicite avec mot-clé (WhatsApp, Tél, Contact, Numéro, Infoline, etc.)
  const keywordPattern = /(?:whatsapp|wa|tél|tel|contact|infoline|infolines|téléphone|telephone|portable|appel|numéro|numero|envoyez|vidéos|videos|cv)\s*(?:par\s*whatsapp)?\s*(?::|-|\sau|\sau\s*numéro)?\s*(\+?[0-9\s.-]{8,20})/gi;
  let match;
  while ((match = keywordPattern.exec(textContent)) !== null) {
    const rawNumber = match[1];
    const normalized = normalizePhoneNumber(rawNumber);
    if (normalized) return normalized;
  }

  // Pattern B : Détection de numéros sénégalais avec indicatif +221 ou 221
  const snWithCodePattern = /(?:\+?221|00221)[\s.-]?(?:7[05678]|33)[\s.-]?[0-9]{2,3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/g;
  const snMatch = textContent.match(snWithCodePattern);
  if (snMatch && snMatch[0]) {
    const normalized = normalizePhoneNumber(snMatch[0]);
    if (normalized) return normalized;
  }

  // Pattern C : Détection de numéros sénégalais locaux standards (ex: 77 717 73 73 ou 777177373)
  const snLocalPattern = /\b(?:7[05678]|33)[\s.-]?[0-9]{2,3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}\b/g;
  const snLocalMatch = textContent.match(snLocalPattern);
  if (snLocalMatch && snLocalMatch[0]) {
    const normalized = normalizePhoneNumber(snLocalMatch[0]);
    if (normalized) return normalized;
  }

  return null;
}

/**
 * Génère le lien complet WhatsApp (wa.me) avec message personnalisé selon l'offre.
 */
export function buildWhatsAppLink(phoneNumber, offer = {}) {
  if (!phoneNumber) return null;
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  if (!cleanPhone) return null;

  const company = offer?.company ? ` chez ${offer.company}` : "";
  const title = offer?.title || offer?.titleFR || "l'opportunité";
  
  const defaultMsg = `Bonjour${offer?.company ? ` ${offer.company}` : ""}, je vous contacte concernant l'offre "${title}"${company} publiée sur Facilite.`;
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`;
}

/**
 * Extrait toutes les méthodes de contact disponibles pour une offre donnée :
 * - Email direct (mailto:)
 * - WhatsApp direct (wa.me)
 * - Portail web externe (https://...)
 */
export function extractOfferContactMethods(offer = {}) {
  // 1. Détection WhatsApp
  const phone = detectWhatsAppNumber(offer);
  const waUrl = phone ? buildWhatsAppLink(phone, offer) : null;

  // 2. Détection Email
  let emailUrl = null;
  const emailCandidate = offer?.contact_email || offer?.recruiter_email || offer?.recruiterEmail;
  if (emailCandidate && typeof emailCandidate === "string" && emailCandidate.includes("@")) {
    const title = offer?.title || offer?.titleFR || "Offre d'emploi";
    emailUrl = `mailto:${emailCandidate.trim()}?subject=${encodeURIComponent(`Candidature - ${title}`)}`;
  } else if (typeof offer?.external_link === "string" && offer.external_link.startsWith("mailto:")) {
    emailUrl = offer.external_link;
  } else if (typeof offer?.externalLink === "string" && offer.externalLink.startsWith("mailto:")) {
    emailUrl = offer.externalLink;
  }

  // 3. Détection Lien Externe (Plateforme Web - non mailto, non whatsapp)
  let portalUrl = null;
  const ext = offer?.external_link || offer?.externalLink || offer?.apply_url || offer?.source_url || offer?.url;
  if (ext && typeof ext === "string" && ext.trim().length > 0 && !ext.startsWith("mailto:") && !ext.includes("wa.me") && !ext.includes("whatsapp")) {
    portalUrl = ext.trim();
  }

  const hasBoth = Boolean((emailUrl || portalUrl) && waUrl);

  return {
    phone,
    waUrl,
    emailUrl,
    portalUrl,
    hasBoth,
  };
}

/**
 * Analyse une offre et détermine l'action de candidature prioritaire :
 * 1. WhatsApp si un numéro est présent
 * 2. Lien externe officiel
 * 3. Email (mailto)
 * 4. Candidature interne Facilité
 */
export function resolveOfferAction(offer = {}, options = {}) {
  const { customLabel } = options;

  // 1. Détection WhatsApp prioritaire
  const phone = detectWhatsAppNumber(offer);
  if (phone) {
    const waUrl = buildWhatsAppLink(phone, offer);
    return {
      type: "whatsapp",
      isWhatsApp: true,
      url: waUrl,
      phoneNumber: phone,
      label: customLabel || "Postuler sur WhatsApp",
      buttonColorClass: "bg-[#25D366] hover:bg-[#20bd5a] text-white",
      iconClass: "fa-brands fa-whatsapp",
    };
  }

  // 2. Lien externe officiel
  const extLink = offer?.external_link || offer?.externalLink || offer?.apply_url || offer?.source_url || offer?.url;
  if (extLink && typeof extLink === "string" && extLink.trim().length > 0) {
    const cleanExt = extLink.trim();
    if (cleanExt.includes("wa.me") || cleanExt.includes("whatsapp")) {
      return {
        type: "whatsapp",
        isWhatsApp: true,
        url: cleanExt,
        phoneNumber: normalizePhoneNumber(cleanExt),
        label: customLabel || "Postuler sur WhatsApp",
        buttonColorClass: "bg-[#25D366] hover:bg-[#20bd5a] text-white",
        iconClass: "fa-brands fa-whatsapp",
      };
    }

    if (cleanExt.startsWith("mailto:")) {
      return {
        type: "email",
        isWhatsApp: false,
        url: cleanExt,
        phoneNumber: null,
        label: customLabel || "Postuler par Email",
        buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
        iconClass: "fa-solid fa-envelope",
      };
    }

    return {
      type: "external",
      isWhatsApp: false,
      url: cleanExt,
      phoneNumber: null,
      label: customLabel || "Postuler sur le site officiel",
      buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
      iconClass: "fa-solid fa-arrow-up-right-from-square",
    };
  }

  // 3. Email recruteur
  const email = offer?.contact_email || offer?.recruiter_email || offer?.recruiterEmail;
  if (email && typeof email === "string" && email.includes("@")) {
    const title = offer?.title || offer?.titleFR || "Offre d'emploi";
    return {
      type: "email",
      isWhatsApp: false,
      url: `mailto:${email.trim()}?subject=${encodeURIComponent(`Candidature - ${title}`)}`,
      phoneNumber: null,
      label: customLabel || "Postuler par Email",
      buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
      iconClass: "fa-solid fa-envelope",
    };
  }

  // 4. Candidature interne
  return {
    type: "internal",
    isWhatsApp: false,
    url: null,
    phoneNumber: null,
    label: customLabel || "Postuler sur Facilite",
    buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
    iconClass: "fa-solid fa-paper-plane",
  };
}

