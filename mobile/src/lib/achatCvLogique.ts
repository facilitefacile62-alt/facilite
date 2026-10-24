// Logique PURE de l'« Achat de CV » (Profil Facilité) : lecture des modèles, textes courts de la maquette du 24/10/2026, messages. Aucun import externe.
import { formaterMontant } from './facturationLogique';

export type ModeleCv = {
  id: string;
  nom: string;
  description: string;
  prixXof: number;
  nbPages: number;
  achete: boolean;
};

/** Une ligne de lister_modeles_cv() → un modèle ; une ligne illisible est ignorée (null), jamais devinée. */
export function lireModeleCv(ligne: unknown): ModeleCv | null {
  if (!ligne || typeof ligne !== 'object') return null;
  const l = ligne as Record<string, unknown>;
  const prix = Number(l.prix_xof);
  const pages = Number(l.nb_pages);
  if (typeof l.id !== 'string' || typeof l.nom !== 'string' || !Number.isInteger(prix) || prix <= 0) return null;
  return {
    id: l.id,
    nom: l.nom,
    description: typeof l.description === 'string' ? l.description : '',
    prixXof: prix,
    nbPages: Number.isInteger(pages) && pages > 0 ? pages : 0,
    achete: l.achete === true,
  };
}

/** « 1 500 FCFA » */
export const prixFcfa = (prixXof: number): string => `${formaterMontant(prixXof)} FCFA`;

/** Texte du bouton de la barre fixe de l'aperçu. */
export const texteBoutonApercu = (modele: Pick<ModeleCv, 'prixXof' | 'achete'>): string =>
  modele.achete ? 'Utiliser ce modèle' : `Acheter ce modèle · ${prixFcfa(modele.prixXof)}`;

/** « Page 2 / 3 · glissez ←→ » (page de 1 à total). */
export function textePage(page: number, total: number): string {
  const p = Math.min(Math.max(1, Math.round(page) || 1), Math.max(1, total));
  return `Page ${p} / ${Math.max(1, total)} · glissez ←→`;
}

/** Page affichée d'après le décalage horizontal de la liste (aimantation au centre). */
export function pageDepuisDecalage(decalage: number, largeurPas: number, total: number): number {
  if (!(largeurPas > 0) || total < 1) return 1;
  return Math.min(total, Math.max(1, Math.round(decalage / largeurPas) + 1));
}

export type TypeMessageCv = 'recu' | 'deja_prepare' | 'annule' | 'expire' | 'capture' | 'echec';

/** Messages de l'achat : vert (reçu), rouge (déjà préparé), gris (annulé, expiré, capture refusée). Phrases courtes. */
export function messageAchatCv(type: TypeMessageCv, nomModele?: string): { texte: string; fond: string; texteCouleur: string } {
  switch (type) {
    case 'recu':
      return { texte: `Paiement reçu : le modèle « ${nomModele ?? ''} » est à vous.`, fond: '#ECFDF5', texteCouleur: '#047857' };
    case 'deja_prepare':
      return { texte: 'Un paiement est déjà en cours pour ce modèle. Patientez quelques instants.', fond: '#FEF2F2', texteCouleur: '#B91C1C' };
    case 'annule':
      return { texte: "Paiement annulé. Aucun montant n'a été débité.", fond: '#F1F2F4', texteCouleur: '#374151' };
    case 'expire':
      return { texte: 'Le QR code a expiré. Générez-en un nouveau.', fond: '#F1F2F4', texteCouleur: '#374151' };
    case 'capture':
      return { texte: "La capture d'écran est désactivée sur l'aperçu.", fond: '#F1F2F4', texteCouleur: '#374151' };
    case 'echec':
      return { texte: "Le paiement n'a pas pu être préparé. Réessayez.", fond: '#FEF2F2', texteCouleur: '#B91C1C' };
  }
}

/** Texte du filigrane répété sur chaque page de l'aperçu. */
export const TEXTE_FILIGRANE = 'APERÇU · FACILITÉ';

/** Nombre de lignes et de répétitions du filigrane diagonal pour couvrir toute la page (jamais moins de 4 lignes de 3). */
export function grilleFiligrane(largeur: number, hauteur: number): { lignes: number; colonnes: number } {
  const diagonale = Math.sqrt(Math.max(0, largeur) ** 2 + Math.max(0, hauteur) ** 2);
  return { lignes: Math.max(4, Math.ceil(diagonale / 46)), colonnes: Math.max(3, Math.ceil(diagonale / 150)) };
}

/** Adresse de l'image d'aperçu d'une page : seule une page entière valide, jamais un chemin libre. */
export function adresseApercu(siteUrl: string, modeleId: string, page: number): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modeleId) || !Number.isInteger(page) || page < 1 || page > 10) return null;
  return `${siteUrl}/api/cv-modeles/${modeleId}/apercu/${page}`;
}
