import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

// Même zone que /api/marketplace/itineraire : refuse les coordonnées hors
// Sénégal, pour limiter les appels abusifs.
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
    const commandeId = corps?.commandeId;
    const lat = Number(corps?.lat);
    const lng = Number(corps?.lng);

    if (!commandeId || !Number.isFinite(lat) || !Number.isFinite(lng) || !dansLeSenegal(lat, lng)) {
      return NextResponse.json({ error: "Coordonnées invalides." }, { status: 400 });
    }

    // Client scellé au jeton de l'appelant : mettre_a_jour_position_livraison
    // revérifie elle-même (livreur_id = auth.uid() AND statut = 'en_livraison'),
    // jamais un client service_role ici (même patron que
    // interviews/create-room/route.js).
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.rpc("mettre_a_jour_position_livraison", {
      p_commande_id: commandeId,
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Livraison introuvable ou non assignée." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Mise à jour de la position indisponible." }, { status: 500 });
  }
}
