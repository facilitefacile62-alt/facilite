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
    const { user, error: authError } = await requireUser(req, { logDenials: true });
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
      .rpc("get_candidats_recherche")
      .select("*", { count: "exact" })
      .range(from, to);

    if (error) {
      console.error("[Candidats Recherche] Échec requête :", error.message);
      return NextResponse.json({ error: "Impossible de charger le répertoire candidats." }, { status: 500 });
    }

    // Quota quotidien de consultations distinctes (voir
    // 20260806150000_cv_consultations_quota.sql) : chaque candidat renvoyé
    // ici est compté côté serveur, jamais dans l'UI. record_cv_consultations
    // décide seule qui est autorisé (déjà vu aujourd'hui, admin, ou sous le
    // seuil) — un candidat marqué non autorisé est retiré de la réponse
    // avant de repartir, ses données ne quittent jamais ce serveur.
    const candidateIds = (data || []).map((c) => c.id).filter(Boolean);
    let allowedIds = new Set(candidateIds);
    let quotaExceeded = false;

    if (candidateIds.length > 0) {
      const { data: quotaResult, error: quotaError } = await supabase.rpc("record_cv_consultations", {
        p_candidate_ids: candidateIds,
      });
      if (quotaError) {
        console.error("[Candidats Recherche] Échec vérification quota :", quotaError.message);
        return NextResponse.json({ error: "Impossible de vérifier le quota de consultations." }, { status: 500 });
      }
      allowedIds = new Set((quotaResult || []).filter((r) => r.allowed).map((r) => r.candidate_id));
      quotaExceeded = (quotaResult || []).some((r) => !r.allowed);
    }

    const filteredData = (data || []).filter((c) => allowedIds.has(c.id));

    const { data: quotaStatus } = await supabase.rpc("get_cv_quota_today").maybeSingle();

    return NextResponse.json({
      candidates: filteredData,
      page,
      pageSize,
      total: count ?? null,
      hasMore: quotaExceeded ? false : count != null ? to + 1 < count : (data || []).length === pageSize,
      quota: quotaStatus
        ? { used: quotaStatus.used_count, limit: quotaStatus.daily_limit, remaining: quotaStatus.remaining }
        : null,
      quotaExceeded,
    });
  } catch (err) {
    console.error("[Candidats Recherche API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
