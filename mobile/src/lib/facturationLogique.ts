// Logique PURE de la page de facturation de Locaux (jetons Premium) : montants, compteur, compte à rebours, messages. Aucun import : testable seul.

export const QUANTITE_MIN = 10;
export const QUANTITE_MAX = 500;
export const PAS_QUANTITE = 10;

/** « 1 000 » : espaces insécables comme séparateur de milliers (sans dépendre d'Intl, absent ou partiel selon l'appareil). */
export function formaterMontant(n: number): string {
  const entier = Math.round(Number.isFinite(n) ? n : 0);
  return String(Math.abs(entier)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace(/^/, entier < 0 ? '-' : '');
}

/** Compteur − / + : par pas de 10, de 10 à 500. */
export function quantiteSuivante(quantite: number, sens: 1 | -1): number {
  const base = Number.isFinite(quantite) ? quantite : QUANTITE_MIN;
  return Math.min(QUANTITE_MAX, Math.max(QUANTITE_MIN, base + sens * PAS_QUANTITE));
}

/** « 4:40 » à partir de secondes. */
export function compteARebours(secondes: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(secondes) ? secondes : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Secondes restantes avant la fin (jamais négatif). */
export const secondesRestantes = (finMs: number, maintenantMs: number): number => Math.max(0, Math.ceil((finMs - maintenantMs) / 1000));

/** « valable 5 minutes » à partir d'une durée en secondes. */
export function texteValidite(secondes: number): string {
  const minutes = Math.max(1, Math.round(secondes / 60));
  return `valable ${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/** Jetons qui manquent pour activer Premium (0 si le solde suffit). */
export const jetonsManquants = (solde: number, requis: number): number => Math.max(0, requis - solde);

/** L'activation n'est possible qu'avec assez de jetons et pas de période Premium en cours. */
export const activationPossible = (solde: number, requis: number, premiumActif: boolean): boolean => !premiumActif && requis > 0 && solde >= requis;

/** « 24/10/2027 » à partir d'une date ISO. */
export function dateFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export type TypeMessage = 'recu' | 'deja_prepare' | 'annule' | 'expire';

/** Messages sous « Acheter des jetons » : texte et couleurs (vert : reçu ; rouge : déjà préparé ; gris : annulé, expiré). */
export function messageFacturation(type: TypeMessage, jetons?: number): { texte: string; fond: string; texteCouleur: string } {
  switch (type) {
    case 'recu':
      return { texte: `Paiement reçu : +${jetons ?? 0} jetons ajoutés à votre solde.`, fond: '#ECFDF5', texteCouleur: '#047857' };
    case 'deja_prepare':
      return { texte: "Un paiement vient d'être préparé. Patientez quelques secondes avant d'en demander un autre.", fond: '#FEF2F2', texteCouleur: '#B91C1C' };
    case 'annule':
      return { texte: "Paiement annulé. Aucun montant n'a été débité.", fond: '#F1F2F4', texteCouleur: '#374151' };
    case 'expire':
      return { texte: 'Le QR code a expiré. Générez-en un nouveau.', fond: '#F1F2F4', texteCouleur: '#374151' };
  }
}

/** Les liens d'application ne s'ouvrent que s'ils ont un schéma sûr (jamais javascript:, data:, file:). */
export function lienOuvrable(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const lien = url.trim();
  const schema = /^([a-z][a-z0-9+.-]*):\/\/[^\s/]\S*$/i.exec(lien)?.[1]?.toLowerCase();
  return Boolean(schema) && !['javascript', 'data', 'file', 'vbscript', 'blob', 'about'].includes(schema as string) && lien.length <= 2000;
}
