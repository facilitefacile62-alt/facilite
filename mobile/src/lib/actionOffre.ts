// Que fait le bouton « Postuler » d'une offre ? Port de resolveOfferAction
// (src/lib/offerContact.js, site web), branche par branche et dans le même
// ordre — pour qu'une même offre déclenche la même action sur le site et dans
// l'app.
//
// Avant ce port, l'app appliquait une règle simplifiée (« lien externe ⇒ site
// officiel ») et ne lisait pas application_url / application_email, que 31 et
// 51 offres disponibles renseignent explicitement (relevé du 09/10/2026) :
// une offre dont l'annonce désigne une adresse e-mail pour candidater pouvait
// donc renvoyer vers un simple lien de site.
//
//   type 'facilite'  : feuille « Candidature Rapide », avec `email` du recruteur
//   type 'externe'   : ouvrir `url` (portail / site officiel)
//   type 'whatsapp'  : ouvrir `url` (wa.me)

export type ChampsActionOffre = {
  titre?: string;
  entreprise?: string;
  description?: string;
  externalLink?: string;
  applicationUrl?: string;
  applicationEmail?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
};

export type ActionOffre =
  | { type: 'facilite'; email: string | null; libelle: string }
  | { type: 'externe'; url: string; libelle: string }
  | { type: 'whatsapp'; url: string; libelle: string };

const LIBELLE_FACILITE = 'Postuler via Facilité';
const LIBELLE_SITE = 'Postuler sur le site officiel';
const LIBELLE_WHATSAPP = 'Postuler sur WhatsApp';

/** « +221 77 717 73 73 » -> « 221777177373 » (indicatif 221 ajouté pour un mobile sénégalais). */
export function normaliserTelephone(brut: string | undefined | null): string | null {
  if (!brut || typeof brut !== 'string') return null;

  const wa = brut.match(/(?:wa\.me\/|phone=)(\+?\d+)/i);
  if (wa?.[1]) {
    const c = wa[1].replace(/\D/g, '');
    if (c.length >= 8 && c.length <= 15) return c;
  }

  let c = brut.replace(/\D/g, '');
  if (c.startsWith('00')) c = c.slice(2);
  if (c.length === 9 && /^(?:70|75|76|77|78|33)\d{7}$/.test(c)) c = `221${c}`;
  if (c.length === 10 && /^(?:01|05|07)\d{8}$/.test(c)) c = `225${c}`;
  return c.length >= 8 && c.length <= 15 ? c : null;
}

/** WhatsApp UNIQUEMENT si l'annonce le demande explicitement (champ dédié, lien wa.me, ou phrase explicite). */
function detecterWhatsapp(o: ChampsActionOffre): string | null {
  const direct = normaliserTelephone(o.contactWhatsapp);
  if (direct) return direct;

  if (o.externalLink && (o.externalLink.includes('wa.me/') || o.externalLink.includes('whatsapp.com/'))) {
    const n = normaliserTelephone(o.externalLink);
    if (n) return n;
  }

  const texte = [o.description, o.titre].filter(Boolean).join('\n');
  if (!texte) return null;

  const explicite =
    /(?:candidature|postuler|postulez|envoyez?(?:\s+vos|\s+votre)?\s+(?:cv|vid[ée]o|dossier)|d[ée]p[ôo]t)\s+(?:sur|via|par|au)\s*whatsapp\s*(?::|-|\sau|\sau\s*num[ée]ro)?\s*(\+?[0-9\s.-]{8,20})/i.exec(
      texte
    );
  if (explicite?.[1]) {
    const n = normaliserTelephone(explicite[1]);
    if (n) return n;
  }
  const etiquete = /\b(?:whatsapp|wa)\s*:\s*(\+?[0-9\s.-]{8,20})/i.exec(texte);
  if (etiquete?.[1]) {
    const n = normaliserTelephone(etiquete[1]);
    if (n) return n;
  }
  return null;
}

function lienWhatsapp(telephone: string, o: ChampsActionOffre): string {
  const societe = o.entreprise ? ` chez ${o.entreprise}` : '';
  const titre = o.titre || "l'opportunité";
  const message = `Bonjour${o.entreprise ? ` ${o.entreprise}` : ''}, je vous contacte concernant l'offre "${titre}"${societe} publiée sur Facilité.`;
  return `https://wa.me/${telephone}?text=${encodeURIComponent(message)}`;
}

const MOTS_PORTAIL = ['vacancy', 'sigof', 'mirador', 'forms', 'jobs', 'tzportal', 'lnkd.in', 'youthmedia', 'opportunites', 'apply'];

export function resoudreActionOffre(o: ChampsActionOffre): ActionOffre {
  const lien = (o.externalLink ?? '').trim();
  const email = (o.applicationEmail || o.contactEmail || '').trim();
  const urlCandidature = (o.applicationUrl ?? '').trim();
  const emailCandidature = (o.applicationEmail ?? '').trim();

  // 0. Adresse de candidature EXPLICITE : ce que l'annonce désigne elle-même l'emporte sur toute déduction.
  if (urlCandidature && !urlCandidature.startsWith('mailto:')) {
    if (urlCandidature.includes('wa.me') || urlCandidature.includes('whatsapp')) {
      return { type: 'whatsapp', url: urlCandidature, libelle: LIBELLE_WHATSAPP };
    }
    return { type: 'externe', url: urlCandidature, libelle: LIBELLE_SITE };
  }
  if (emailCandidature && emailCandidature.includes('@')) {
    return { type: 'facilite', email: emailCandidature, libelle: LIBELLE_FACILITE };
  }

  // 1. WhatsApp explicite dans le lien.
  if (lien.includes('wa.me') || lien.includes('whatsapp')) {
    return { type: 'whatsapp', url: lien, libelle: LIBELLE_WHATSAPP };
  }

  // 2. Portail de candidature officiel dédié — ou, sans e-mail fourni, tout lien externe.
  const estPortail = lien.length > 0 && !lien.startsWith('mailto:') && (MOTS_PORTAIL.some((m) => lien.includes(m)) || !email);
  if (estPortail) return { type: 'externe', url: lien, libelle: LIBELLE_SITE };

  // 3. E-mail recruteur explicite : dépôt direct avec le CV Facilité.
  if (email && email.includes('@')) return { type: 'facilite', email, libelle: LIBELLE_FACILITE };

  // 4. Lien externe restant.
  if (lien.length > 0 && !lien.startsWith('mailto:')) return { type: 'externe', url: lien, libelle: LIBELLE_SITE };

  // 5. WhatsApp seulement si l'annonce le demande explicitement.
  const tel = detecterWhatsapp(o);
  if (tel) return { type: 'whatsapp', url: lienWhatsapp(tel, o), libelle: LIBELLE_WHATSAPP };

  // 6. Candidature interne Facilité par défaut (sans adresse : la route applique son repli).
  return { type: 'facilite', email: null, libelle: LIBELLE_FACILITE };
}
