/**
 * @file feedInterleaver.js
 * @description Algorithme d'entrelacement de feed haute performance (Style Facebook Feed).
 * @rule Injecte exactement 1 publication sponsorisée tous les 5 posts standards sans doublons.
 */

/**
 * Entrelace les publications standards et sponsorisées pour créer un flux continu équilibré.
 * 
 * @template T
 * @param {Array<T>} standardPosts Liste des offres d'emploi ou publications organiques
 * @param {Array<T>} sponsoredPosts Liste des offres sponsorisées actives
 * @param {number} interval Intervalle d'insertion (par défaut: 5 posts organiques)
 * @returns {Array<T>} Flux final unifié et dédupliqué
 */
function interleaveFeed(standardPosts = [], sponsoredPosts = [], interval = 5) {
  if (!Array.isArray(standardPosts)) return [];
  if (!Array.isArray(sponsoredPosts) || sponsoredPosts.length === 0) {
    return [...standardPosts];
  }

  const now = new Date().getTime();

  // 1. Filtrer et valider la fraîcheur des offres sponsorisées
  const activeSponsored = sponsoredPosts
    .filter((post) => {
      if (!post || !post.id) return false;
      if (post.is_sponsored === false && post.isSponsored === false) return false;
      
      const expiry = post.sponsored_until || post.sponsoredUntil;
      if (expiry) {
        const expiryTime = new Date(expiry).getTime();
        if (expiryTime <= now) return false;
      }
      return true;
    })
    // Trier par priorité décroissante
    .sort((a, b) => (b.sponsor_priority || 0) - (a.sponsor_priority || 0));

  if (activeSponsored.length === 0) {
    return [...standardPosts];
  }

  const result = [];
  const seenIds = new Set();

  let standardIndex = 0;
  let sponsoredIndex = 0;
  let countSinceLastSponsored = 0;

  while (standardIndex < standardPosts.length) {
    const stdPost = standardPosts[standardIndex];
    standardIndex++;

    if (stdPost && !seenIds.has(String(stdPost.id))) {
      result.push(stdPost);
      seenIds.add(String(stdPost.id));
      countSinceLastSponsored++;
    }

    // Dès qu'on a inséré 'interval' posts organiques et qu'il reste des posts sponsorisés
    if (countSinceLastSponsored >= interval && sponsoredIndex < activeSponsored.length) {
      const spPost = activeSponsored[sponsoredIndex];
      sponsoredIndex++;

      if (spPost && !seenIds.has(String(spPost.id))) {
        result.push({
          ...spPost,
          __isSponsoredSlot: true,
        });
        seenIds.add(String(spPost.id));
        countSinceLastSponsored = 0;
      }
    }
  }

  return result;
}

module.exports = {
  interleaveFeed,
};
