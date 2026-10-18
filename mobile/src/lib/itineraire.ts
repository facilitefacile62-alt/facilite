import { SITE_URL, type Position } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';

// « M'y rendre » : itinéraire routier calculé par la même route du site que sur le web
// (/api/marketplace/itineraire, OpenRouteService). Si le calcul n'est pas possible (hors connexion,
// service indisponible), on trace une ligne droite en pointillés avec la distance à vol d'oiseau :
// jamais un faux itinéraire présenté comme réel.
export type Itineraire = {
  points: [number, number][];
  distanceKm: number;
  dureeMin: number | null;
  approximatif: boolean;
  profil: 'pieton' | 'voiture';
};

function distanceVolOiseauKm(a: Position, b: Position): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function calculerItineraire(depart: Position, arrivee: Position): Promise<Itineraire> {
  const volOiseau = distanceVolOiseauKm(depart, arrivee);
  const profil: 'pieton' | 'voiture' = volOiseau < 2 ? 'pieton' : 'voiture';
  const repli: Itineraire = {
    points: [
      [depart.latitude, depart.longitude],
      [arrivee.latitude, arrivee.longitude],
    ],
    distanceKm: Math.round(volOiseau * 100) / 100,
    dureeMin: null,
    approximatif: true,
    profil,
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return repli;
    const reponse = await fetch(`${SITE_URL}/api/marketplace/itineraire`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depart: { lat: depart.latitude, lng: depart.longitude },
        arrivee: { lat: arrivee.latitude, lng: arrivee.longitude },
        profil,
      }),
    });
    if (!reponse.ok) return repli;
    const corps = (await reponse.json()) as { points?: [number, number][]; distance_km?: number; duree_min?: number };
    if (!corps.points || corps.points.length < 2) return repli;
    return { points: corps.points, distanceKm: corps.distance_km ?? repli.distanceKm, dureeMin: corps.duree_min ?? null, approximatif: false, profil };
  } catch {
    return repli;
  }
}
