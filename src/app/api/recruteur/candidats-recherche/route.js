import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

// Point d'entrée obligatoire pour lire l'annuaire candidats (vue
// candidats_recherche) : avant ce correctif, le composant recruteur
// interrogeait la vue directement depuis le navigateur (accès PostgREST
// direct), hors du filet de checkRateLimit — un seul .select("*") sans
// pagination exfiltrait l'intégralité de la base candidats en un appel.
// Ici, la pagination est forcée côté serveur (jamais une simple suggestion
// cliente) et chaque page reste soumise au rate limit générique.
const MAX_PAGE_SIZE = 30;

export async function GET(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const { searchParams } = new URL(req.url);
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("pageSize") || String(MAX_PAGE_SIZE), 10) || MAX_PAGE_SIZE));
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Client RLS-scopé de l'appelant, pas service_role : la vue
    // candidats_recherche fait déjà toute l'autorisation (rôle + statut
    // recruiter_verified) dans son propre WHERE — un recruteur non validé
    // ou un candidat obtient simplement un résultat vide, sans code
    // d'autorisation dupliqué ici.
    const { data, error, count } = await supabase
      .from("candidats_recherche")
      .select("*", { count: "exact" })
      .range(from, to);

    if (error) {
      console.error("[Candidats Recherche] Échec requête :", error.message);
      return NextResponse.json({ error: "Impossible de charger le répertoire candidats." }, { status: 500 });
    }

    return NextResponse.json({
      candidates: data || [],
      page,
      pageSize,
      total: count ?? null,
      hasMore: count != null ? to + 1 < count : (data || []).length === pageSize,
    });
  } catch (err) {
    console.error("[Candidats Recherche API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
