// Centre approximatif de chaque département du Sénégal et département le plus proche d'une position GPS. Même table et même formule
// (Haversine) que le site (src/lib/marketplaceData.js : CENTRES_DEPARTEMENTS / departementLePlusProche).
export const CENTRES_DEPARTEMENTS: Record<string, { lat: number; lng: number }> = {
  Dakar: { lat: 14.6928, lng: -17.4467 },
  Guédiawaye: { lat: 14.7708, lng: -17.3872 },
  Pikine: { lat: 14.7547, lng: -17.3997 },
  Rufisque: { lat: 14.7167, lng: -17.2667 },
  "Keur Massar": { lat: 14.7833, lng: -17.3167 },
  Thiès: { lat: 14.791, lng: -16.925 },
  Mbour: { lat: 14.422, lng: -16.963 },
  Tivaouane: { lat: 14.954, lng: -16.812 },
  Diourbel: { lat: 14.653, lng: -16.234 },
  Bambey: { lat: 14.7, lng: -16.45 },
  Mbacké: { lat: 14.79, lng: -15.9 },
  Touba: { lat: 14.864, lng: -15.875 },
  Fatick: { lat: 14.333, lng: -16.4 },
  Foundiougne: { lat: 14.133, lng: -16.467 },
  Gossas: { lat: 14.5, lng: -16.067 },
  Kaolack: { lat: 14.15, lng: -16.083 },
  Guinguinéo: { lat: 14.267, lng: -15.95 },
  "Nioro du Rip": { lat: 13.75, lng: -15.767 },
  Kaffrine: { lat: 14.105, lng: -15.542 },
  Birkelane: { lat: 14.133, lng: -15.75 },
  Koungheul: { lat: 13.983, lng: -14.8 },
  "Malem-Hodar": { lat: 14.1, lng: -15.3 },
  "Saint-Louis": { lat: 16.032, lng: -16.489 },
  Dagana: { lat: 16.517, lng: -15.5 },
  Podor: { lat: 16.65, lng: -14.967 },
  Louga: { lat: 15.618, lng: -16.224 },
  Kébémer: { lat: 15.367, lng: -16.45 },
  Linguère: { lat: 15.395, lng: -15.119 },
  Matam: { lat: 15.655, lng: -13.255 },
  Kanel: { lat: 15.483, lng: -13.167 },
  "Ranérou-Ferlo": { lat: 15.3, lng: -13.967 },
  Tambacounda: { lat: 13.768, lng: -13.667 },
  Bakel: { lat: 14.9, lng: -12.467 },
  Goudiry: { lat: 14.183, lng: -12.717 },
  Koumpentoum: { lat: 13.983, lng: -14.567 },
  Kédougou: { lat: 12.556, lng: -12.174 },
  Salémata: { lat: 12.633, lng: -12.817 },
  Saraya: { lat: 12.833, lng: -11.75 },
  Kolda: { lat: 12.883, lng: -14.95 },
  "Médina Yoro Foulah": { lat: 13.3, lng: -15.0 },
  Vélingara: { lat: 13.15, lng: -14.117 },
  Sédhiou: { lat: 12.708, lng: -15.556 },
  Bounkiling: { lat: 13.033, lng: -15.7 },
  Goudomp: { lat: 12.583, lng: -15.867 },
  Ziguinchor: { lat: 12.583, lng: -16.271 },
  Bignona: { lat: 12.81, lng: -16.23 },
  Oussouye: { lat: 12.483, lng: -16.55 },
};

export function departementLePlusProche(latitude: number | null | undefined, longitude: number | null | undefined): string | null {
  if (latitude == null || longitude == null) return null;
  const R = 6371;
  let meilleur: { nom: string; ecartKm: number } | null = null;
  for (const [nom, c] of Object.entries(CENTRES_DEPARTEMENTS)) {
    const dLat = ((c.lat - latitude) * Math.PI) / 180;
    const dLng = ((c.lng - longitude) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((latitude * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const ecartKm = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    if (!meilleur || ecartKm < meilleur.ecartKm) meilleur = { nom, ecartKm };
  }
  return meilleur?.nom ?? null;
}
