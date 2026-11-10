// Liens d'itinéraire vers un établissement (pharmacie, clinique, point Wave…), comme les boutons « Itinéraire » et « Démarrer » de Google Maps. Logique pure.
//
// Les liens utilisent les COORDONNÉES de l'établissement (pas son nom, pas de recherche textuelle ambiguë) et s'ouvrent dans Google Maps (appli ou navigateur) :
//  - « Itinéraire » : Google Maps propose le trajet depuis la position actuelle, avec la durée et les variantes ;
//  - « Démarrer »   : même trajet, avec le guidage lancé tout de suite (dir_action=navigate).
// Aucun appel réseau et aucune donnée personnelle : l'adresse de départ (position de la personne) n'est ajoutée que si le site la connaît déjà, et n'est jamais enregistrée.

const BASE = "https://www.google.com/maps/dir/?api=1";

function nombre(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Coordonnées valides (latitude -90..90, longitude -180..180) sous la forme « lat,lng », ou null. */
export function coordonnees(latitude, longitude) {
  const lat = nombre(latitude);
  const lng = nombre(longitude);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `${lat},${lng}`;
}

function lien(etablissement, depart, guidage) {
  const arrivee = coordonnees(etablissement?.latitude, etablissement?.longitude);
  if (!arrivee) return null;
  const origine = depart ? coordonnees(depart.latitude, depart.longitude) : null;
  return `${BASE}${origine ? `&origin=${origine}` : ""}&destination=${arrivee}&travelmode=driving${guidage ? "&dir_action=navigate" : ""}`;
}

/** Lien « Itinéraire » vers l'établissement ({ latitude, longitude }), ou null si ses coordonnées manquent. `depart` ({ latitude, longitude }) est facultatif. */
export function lienItineraire(etablissement, depart) {
  return lien(etablissement, depart, false);
}

/** Lien « Démarrer » : même trajet, guidage lancé immédiatement. */
export function lienDemarrer(etablissement, depart) {
  return lien(etablissement, depart, true);
}
