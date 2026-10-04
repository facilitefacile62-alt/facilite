import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";

export const runtime = "nodejs";

// Calcul d'itinéraire routier pour « M'y rendre ». La position de l'utilisateur
// est transmise au fournisseur (OpenRouteService) uniquement pour ce calcul : elle
// n'est ni conservée par Facilité, ni journalisée ici (voir la politique de
// confidentialité, section 8).
const ORS_URL = "https://api.openrouteservice.org/v2/directions";
const PROFILS = { pieton: "foot-walking", voiture: "driving-car" };

// Zone du Sénégal : refuse les coordonnées hors pays, pour limiter les appels abusifs.
const LIMITES = { latMin: 12.2, latMax: 16.8, lngMin: -17.9, lngMax: -11.2 };

const dansLeSenegal = (lat, lng) =>
  lat >= LIMITES.latMin && lat <= LIMITES.latMax && lng >= LIMITES.lngMin && lng <= LIMITES.lngMax;

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const corps = await req.json().catch(() => null);
    const depart = corps?.depart;
    const arrivee = corps?.arrivee;
    const profil = PROFILS[corps?.profil] ? corps.profil : "pieton";

    const valides = [depart, arrivee].every(
      (p) =>
        p &&
        Number.isFinite(Number(p.lat)) &&
        Number.isFinite(Number(p.lng)) &&
        dansLeSenegal(Number(p.lat), Number(p.lng))
    );
    if (!valides) {
      return NextResponse.json({ error: "Coordonnées invalides." }, { status: 400 });
    }

    const cle = process.env.ORS_API_KEY;
    if (!cle) {
      return NextResponse.json({ error: "Itinéraire indisponible pour le moment." }, { status: 503 });
    }

    const reponse = await fetch(`${ORS_URL}/${PROFILS[profil]}/geojson`, {
      method: "POST",
      headers: {
        Authorization: cle,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [Number(depart.lng), Number(depart.lat)],
          [Number(arrivee.lng), Number(arrivee.lat)],
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!reponse.ok) {
      return NextResponse.json({ error: "Itinéraire indisponible pour le moment." }, { status: 502 });
    }

    const donnees = await reponse.json();
    const trajet = donnees?.features?.[0];
    if (!trajet) {
      return NextResponse.json({ error: "Aucun itinéraire trouvé." }, { status: 404 });
    }

    // GeoJSON donne [lng, lat] ; Leaflet attend [lat, lng].
    const points = trajet.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const resume = trajet.properties?.summary || {};

    return NextResponse.json({
      distance_km: Math.round((resume.distance || 0) / 10) / 100,
      duree_min: Math.round((resume.duration || 0) / 60),
      profil,
      points,
    });
  } catch {
    return NextResponse.json({ error: "Itinéraire indisponible pour le moment." }, { status: 500 });
  }
}
