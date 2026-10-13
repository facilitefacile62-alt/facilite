// Vidéo d'aide « comment postuler », la MÊME sous toutes les publications
// (bouton « Aide » des cartes d'offres -> écran /aide-video). Même source que
// le site (src/lib/aideVideo.js) : pensez à renseigner les deux.
//
//  - fichier : { type: 'fichier', url: 'https://…/aide.mp4', duree: '2 min' }
//  - YouTube : { type: 'youtube', id: 'XXXXXXXXXXX', duree: '2 min' }
//
// Tant que rien n'est renseigné ('aucune'), l'écran annonce que la vidéo arrive
// bientôt — aucune vidéo de test n'est affichée.
export type AideVideo =
  | { type: 'aucune' }
  | { type: 'fichier'; url: string; duree?: string }
  | { type: 'youtube'; id: string; duree?: string };

export const AIDE_VIDEO: AideVideo = { type: 'aucune' };
