/**
 * Un seul point de vérité pour "cette offre est-elle sponsorisée MAINTENANT" —
 * jamais is_sponsored seul, toujours avec sponsored_until dans le futur.
 * Exporté pour que le badge UI (offres/page.js, admin/offres/page.js)
 * revérifie indépendamment plutôt que de faire confiance à une liste déjà
 * filtrée en amont. Volontairement en dehors de tout composant React : un
 * appel direct à Date.now()/new Date() dans le corps d'un composant est
 * une fonction impure au sens des règles React (react-hooks/purity) — cette
 * fonction vit dans un module utilitaire ordinaire, pas dans un rendu.
 */
export function isOfferActivelySponsored(offer) {
  return offer?.is_sponsored === true && !!offer?.sponsored_until && new Date(offer.sponsored_until).getTime() > Date.now();
}

/**
 * Entrelace des offres sponsorisées dans un fil d'offres standard, 1 offre
 * sponsorisée toutes les `everyN` offres standard. Filtre lui-même
 * strictement sur is_sponsored === true ET sponsored_until dans le futur —
 * ne fait jamais confiance à un appelant qui aurait mal filtré en amont
 * (même principe que le badge UI, qui revérifie indépendamment).
 *
 * Les offres sponsorisées qualifiantes sont triées par sponsor_priority
 * décroissant, puis parcourues en boucle (round-robin) pour continuer à
 * remplir un slot toutes les `everyN` positions sur tout le fil, même s'il
 * y a plus de positions que d'offres sponsorisées distinctes.
 */
export function interleaveSponsoredOffers(offers, { everyN = 5 } = {}) {
  const list = Array.isArray(offers) ? offers : [];
  const isQualifyingSponsor = isOfferActivelySponsored;

  const sponsored = list
    .filter(isQualifyingSponsor)
    .sort((a, b) => (b.sponsor_priority ?? 0) - (a.sponsor_priority ?? 0));

  const standard = list.filter((offer) => !isQualifyingSponsor(offer));

  if (sponsored.length === 0 || everyN < 1) {
    return standard;
  }

  const result = [];
  let sponsorCursor = 0;
  for (let i = 0; i < standard.length; i++) {
    result.push(standard[i]);
    const isSlot = (i + 1) % everyN === 0;
    if (isSlot) {
      result.push(sponsored[sponsorCursor % sponsored.length]);
      sponsorCursor++;
    }
  }

  return result;
}
