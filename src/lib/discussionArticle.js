/**
 * "Discuter sur la plateforme" depuis la fiche produit du Marketplace :
 * état des boutons, lien vers la messagerie, brouillon qui accompagne l'article.
 */

const ID_ARTICLE_VALIDE = /^[0-9A-Za-z_-]{6,64}$/;

/**
 * - "chargement" : propriétaire de la boutique pas encore connu (pas de lien
 *   vers une messagerie vide) ;
 * - "mon-article" : l'utilisateur est le vendeur, il ne peut pas s'écrire à
 *   lui-même (boutons de discussion grisés) ;
 * - "pret" : discussion possible.
 */
export function etatDiscussionArticle({ userId, proprietaireId }) {
  if (!proprietaireId) return "chargement";
  if (userId && proprietaireId === userId) return "mon-article";
  return "pret";
}

/**
 * Lien vers la messagerie Marketplace avec le vendeur. L'article (titre, id,
 * prix, photo) voyage dans l'URL pour accompagner la discussion : voir
 * construireBrouillonArticle côté messagerie pour le texte, et
 * MessagerieClient.js pour l'envoi automatique de la photo (demande
 * explicite : "Discuter" doit toujours joindre l'image du produit).
 */
export function construireLienDiscussion({ proprietaireId, article, prixUnitaire, photoUrl }) {
  const params = new URLSearchParams({ recipient: proprietaireId, contexte: "marketplace" });
  if (article?.titre) params.set("article", String(article.titre).slice(0, 120));
  if (article?.id) params.set("articleId", String(article.id));
  const prix = Number(prixUnitaire);
  if (Number.isFinite(prix) && prix > 0) params.set("prix", String(Math.round(prix)));
  // Uniquement une vraie URL http(s) (bucket public marketplace) — jamais un
  // chemin brut, ni un data:, qui dépasserait la longueur raisonnable d'une URL.
  if (typeof photoUrl === "string" && /^https?:\/\//i.test(photoUrl)) {
    params.set("photo", photoUrl);
  }
  return `/messagerie?${params.toString()}`;
}

function formaterPrix(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Premier message prérempli, pour que le vendeur sache QUEL article intéresse
 * l'acheteur. Les valeurs viennent de l'URL : le titre est nettoyé et borné,
 * l'identifiant n'est repris dans le lien que s'il a la forme d'un identifiant.
 * Renvoie "" sans titre (aucun brouillon).
 */
export function construireBrouillonArticle({ titre, articleId, prix, origine }) {
  const titreNet = String(titre || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, 120);
  if (!titreNet) return "";

  const prixNombre = Number(prix);
  const prixTexte = Number.isFinite(prixNombre) && prixNombre > 0 ? ` (${formaterPrix(prixNombre)} FCFA)` : "";

  const lignes = [`Bonjour, je suis intéressé(e) par votre article « ${titreNet} »${prixTexte}.`];
  if (articleId && origine && ID_ARTICLE_VALIDE.test(articleId)) {
    lignes.push(`Lien : ${origine}/marketplace?article=${articleId}`);
  }
  lignes.push("Est-il toujours disponible ?");
  return lignes.join("\n");
}
