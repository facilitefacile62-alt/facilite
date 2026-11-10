// Trajets alternatifs (« raccourcis ») pour l'itinéraire, comme Google Maps : le trajet principal et jusqu'à deux autres, avec la différence de durée.
// Logique pure (aucun réseau) : la route /api/marketplace/itineraire s'en sert pour construire la demande à OpenRouteService et lire sa réponse.

/** Corps de la demande à OpenRouteService. Les alternatives sont facultatives : demandées seulement si l'appelant les veut. */
export function corpsItineraire(depart, arrivee, avecAlternatives) {
  const corps = {
    coordinates: [
      [Number(depart.lng), Number(depart.lat)],
      [Number(arrivee.lng), Number(arrivee.lat)],
    ],
  };
  if (avecAlternatives) {
    // Jusqu'à 3 trajets au total ; les alternatives doivent différer d'au moins 40 % du trajet principal et ne pas dépasser 1,4 fois son temps.
    corps.alternative_routes = { target_count: 3, share_factor: 0.6, weight_factor: 1.4 };
  }
  return corps;
}

function trajetDe(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const resume = feature.properties?.summary || {};
  return {
    // GeoJSON donne [lng, lat] ; Leaflet attend [lat, lng].
    points: coords.map(([lng, lat]) => [lat, lng]),
    distance_km: Math.round((resume.distance || 0) / 10) / 100,
    duree_min: Math.round((resume.duration || 0) / 60),
  };
}

/** Trajet principal (premier) et alternatives (les suivants, au plus 2) à partir de la réponse GeoJSON d'OpenRouteService. */
export function extraireTrajets(donnees) {
  const liste = Array.isArray(donnees?.features) ? donnees.features : [];
  const principal = trajetDe(liste[0]);
  if (!principal) return null;
  const alternatives = liste
    .slice(1, 3)
    .map(trajetDe)
    .filter(Boolean);
  return { principal, alternatives };
}
