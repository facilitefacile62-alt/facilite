// Logique PURE de l'onglet « Modèles de documents » (Profil de Facilité) : lecture d'une ligne du catalogue. Aucun import externe.

export type ModeleDocument = {
  id: string;
  type: 'cv' | 'lettre';
  nom: string;
  description: string;
  imageUrl: string;
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
  };
}

/** Message WhatsApp envoyé à Facilité pour demander un modèle. */
export const messageDemandeModele = (nom: string): string => `Bonjour Facilité, je souhaite le modèle de document « ${nom} » que j'ai vu dans l'application.`;
