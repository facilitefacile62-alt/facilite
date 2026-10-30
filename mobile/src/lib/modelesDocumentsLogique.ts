// Logique PURE de l'onglet « Modèles de documents » (Profil de Facilité) : lecture d'une ligne du catalogue. Aucun import externe.

export type ModeleDocument = {
  id: string;
  type: 'cv' | 'lettre';
  nom: string;
  description: string;
  imageUrl: string;
  /** Phrase d'accompagnement du message WhatsApp, saisie par l'administrateur (vide = phrase par défaut). */
  messageWhatsapp: string;
};

/** Une ligne de modeles_documents → un modèle ; une ligne illisible (sans nom, sans affiche en https) est ignorée (null), jamais devinée. */
export function lireModeleDocument(ligne: unknown): ModeleDocument | null {
  if (!ligne || typeof ligne !== 'object') return null;
  const l = ligne as Record<string, unknown>;
  if (typeof l.id !== 'string' || !l.id) return null;
  if (typeof l.nom !== 'string' || l.nom.trim().length < 2) return null;
  if (typeof l.image_url !== 'string' || !/^https:\/\//i.test(l.image_url)) return null;
  return {
    id: l.id,
    type: l.type === 'lettre' ? 'lettre' : 'cv',
    nom: l.nom.trim(),
    description: typeof l.description === 'string' ? l.description.trim() : '',
    imageUrl: l.image_url,
    messageWhatsapp: typeof l.message_whatsapp === 'string' ? l.message_whatsapp.trim() : '',
  };
}

/** Message WhatsApp envoyé à Facilité pour demander un modèle. */
/** Avec `imageUrl`, le lien de l'affiche suit le message : WhatsApp ne permet pas de joindre une image par lien, mais il affiche l'aperçu de l'affiche. */
export const messageDemandeModele = (nom: string, imageUrl?: string, phrase?: string | null): string => {
  const lien = imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : '';
  const perso = (phrase ?? '').trim().replace(/\{nom\}/g, nom);
  // Phrase saisie par l'administrateur : elle est suivie du lien de l'affiche. Sinon : phrase par défaut + « Voici l'affiche : lien ».
  if (perso) return lien ? `${perso}\n${lien}` : perso;
  const defaut = `Bonjour Facilité, je souhaite le modèle de document « ${nom} » que j'ai vu dans l'application.`;
  return lien ? `${defaut}\nVoici l'affiche : ${lien}` : defaut;
};
