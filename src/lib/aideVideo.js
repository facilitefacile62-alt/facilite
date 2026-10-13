// Vidéo d'aide « comment postuler », la MÊME sous toutes les publications
// (bouton « Aide » des cartes d'offres -> /aide-candidature).
//
// Pour brancher la vidéo : renseigner UNE des deux sources ci-dessous.
//  - fichier : { type: "fichier", url: "https://…/aide.mp4", duree: "2 min" }
//    (fichier hébergé sur ffacilite.com ou sur Supabase Storage — la CSP du site
//    n'autorise les médias que de ces deux origines) ;
//  - YouTube : { type: "youtube", id: "XXXXXXXXXXX", duree: "2 min" }
//    (lecture via youtube-nocookie.com, déjà autorisé par la CSP).
// Tant que rien n'est renseigné (type "aucune"), la page annonce que la vidéo
// arrive bientôt : elle ne montre plus de vidéo de test.
export const AIDE_VIDEO = { type: "aucune" };
