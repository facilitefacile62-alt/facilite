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
/**
 * Recherche si l'offre propose explicitement une candidature par WhatsApp.
 * Ne se déclenche QUE si WhatsApp est explicitement mentionné comme canal de postulation
 * ou si un champ contact_whatsapp / lien wa.me est fourni.
 */
export function detectWhatsAppNumber(offer, extraText = "") {
  if (!offer && !extraText) return null;

  // 1. Vérification des champs WhatsApp explicites
  const explicitWaCandidates = [
    offer?.contact_whatsapp,
    offer?.whatsapp,
  ];

  for (const candidate of explicitWaCandidates) {
    if (candidate) {
      const normalized = normalizePhoneNumber(String(candidate));
      if (normalized) return normalized;
    }
  }

  // 2. Vérification dans external_link si c'est un lien WhatsApp explicite
  const urlCandidates = [offer?.external_link, offer?.externalLink, offer?.apply_url, offer?.url];
  for (const url of urlCandidates) {
    if (url && typeof url === "string") {
      if (url.includes("wa.me/") || url.includes("whatsapp.com/")) {
        const normalized = normalizePhoneNumber(url);
        if (normalized) return normalized;
      }
    }
  }

  // 3. Extraction dans le texte UNIQUEMENT si le texte mentionne explicitement de postuler par WhatsApp
  const textContent = [
    extraText,
    offer?.description,
    offer?.descFR,
    offer?.descEN,
    offer?.title,
    offer?.titleFR,
  ]
    .filter(Boolean)
    .join("\n");

  if (!textContent) return null;

  // Pattern strict : candidature / CV / postulation explicitement demandée par WhatsApp
  const explicitWaApplicationPattern = /(?:candidature|postuler|postulez|envoyez?(?:\s+vos|\s+votre)?\s+(?:cv|vid[ée]o|dossier)|d[ée]p[ôo]t)\s+(?:sur|via|par|au)\s*whatsapp\s*(?::|-|\sau|\sau\s*num[ée]ro)?\s*(\+?[0-9\s.-]{8,20})/i;
  const match = explicitWaApplicationPattern.exec(textContent);
  if (match && match[1]) {
    const normalized = normalizePhoneNumber(match[1]);
    if (normalized) return normalized;
  }

  // Pattern alternatif : mention "WhatsApp : +221..." spécifiquement étiquetée
  const labeledWaPattern = /\b(?:whatsapp|wa)\s*:\s*(\+?[0-9\s.-]{8,20})/i;
  const matchLabeled = labeledWaPattern.exec(textContent);
  if (matchLabeled && matchLabeled[1]) {
    const normalized = normalizePhoneNumber(matchLabeled[1]);
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
  
  const defaultMsg = `Bonjour${offer?.company ? ` ${offer.company}` : ""}, je vous contacte concernant l'offre "${title}"${company} publiée sur Facilité.`;
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`;
}

/**
 * Extrait toutes les méthodes de contact disponibles pour une offre donnée :
 * - Email direct (mailto: / candidature Facilité)
 * - WhatsApp direct (wa.me - UNIQUEMENT si explicitement indiqué)
 * - Portail web externe (https://...)
 */
export function extractOfferContactMethods(offer = {}) {
  // 1. Détection WhatsApp (Strictement si explicitement demandé)
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
 * Analyse une offre et détermine l'action de candidature prioritaire et fidèle :
 * 1. Email recruteur ou lien mailto -> Postuler via Facilité (ou Postuler par E-mail)
 * 2. Lien externe officiel (site web, portail SIGOF, etc.) -> Postuler sur le site officiel
 * 3. WhatsApp UNIQUEMENT si l'offre le demande explicitement
 * 4. Candidature interne Facilité standard
 */
export function resolveOfferAction(offer = {}, options = {}) {
  const { customLabel } = options;

  // 1. Email recruteur explicite (Priorité N°1 pour la postulation directe via Facilité)
  const email = offer?.contact_email || offer?.recruiter_email || offer?.recruiterEmail;
  if (email && typeof email === "string" && email.includes("@")) {
    const title = offer?.title || offer?.titleFR || "Offre d'emploi";
    return {
      type: "email",
      isWhatsApp: false,
      isEmail: true,
      email: email.trim(),
      mailtoUrl: `mailto:${email.trim()}?subject=${encodeURIComponent(`Candidature - ${title}`)}`,
      url: null, // url null déclenche ApplyModal (candidature directe Facilité)
      phoneNumber: null,
      label: customLabel || "Postuler via Facilité",
      buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
      iconClass: "fa-solid fa-paper-plane",
    };
  }

  // 2. Lien externe officiel (site, portail, plateforme entreprise)
  const extLink = offer?.external_link || offer?.externalLink || offer?.apply_url || offer?.source_url || offer?.url;
  if (extLink && typeof extLink === "string" && extLink.trim().length > 0) {
    const cleanExt = extLink.trim();

    // Si le lien externe est un mailto:
    if (cleanExt.startsWith("mailto:")) {
      const emailRaw = cleanExt.replace(/^mailto:/i, "").split("?")[0];
      return {
        type: "email",
        isWhatsApp: false,
        isEmail: true,
        email: emailRaw,
        mailtoUrl: cleanExt,
        url: null,
        phoneNumber: null,
        label: customLabel || "Postuler via Facilité",
        buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
        iconClass: "fa-solid fa-paper-plane",
      };
    }

    // Si le lien externe est un lien WhatsApp wa.me explicite
    if (cleanExt.includes("wa.me") || cleanExt.includes("whatsapp")) {
      return {
        type: "whatsapp",
        isWhatsApp: true,
        isEmail: false,
        url: cleanExt,
        phoneNumber: normalizePhoneNumber(cleanExt),
        label: customLabel || "Postuler sur WhatsApp",
        buttonColorClass: "bg-[#25D366] hover:bg-[#20bd5a] text-white",
        iconClass: "fa-brands fa-whatsapp",
      };
    }

    return {
      type: "external",
      isWhatsApp: false,
      isEmail: false,
      url: cleanExt,
      phoneNumber: null,
      label: customLabel || "Postuler sur le site officiel",
      buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
      iconClass: "fa-solid fa-arrow-up-right-from-square",
    };
  }

  // 3. WhatsApp UNIQUEMENT si l'annonce le demande explicitement
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

  // 4. Candidature interne Facilité standard
  return {
    type: "internal",
    isWhatsApp: false,
    isEmail: false,
    url: null,
    phoneNumber: null,
    label: customLabel || "Postuler via Facilité",
    buttonColorClass: "bg-blue-600 hover:bg-blue-700 text-white",
    iconClass: "fa-solid fa-paper-plane",
  };
}

