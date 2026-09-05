import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Aperçu automatique des "candidats à fort potentiel" pour une offre,
// affiché sans action du recruteur — contrairement à /api/recruteur/rag-
// matching, qui fait la même recherche vectorielle (match_resumes) mais
// l'enrichit ensuite d'un appel LLM (Groq/DeepSeek) coûteux et soumis au
// quota IA partagé. Afficher CET aperçu à chaque ouverture d'offre avec un
// appel LLM aurait épuisé ce quota pour rien : ici, uniquement la similarité
// vectorielle brute (gratuite, déjà indexée HNSW), pas de génération. Le
// bouton "Analyse IA détaillée" existant (rag-matching) reste le chemin vers
// la justification qualitative, à la demande.
//
// match_resumes() filtre déjà en SQL (cv_visible_recruteurs, deleted_at,
// is_test_account, rôle de l'appelant) — voir
// 20260809040000_match_resumes_deleted_filter.sql. Rien à revérifier ici
// côté consentement.
const MATCH_THRESHOLD = 0.4;
const MATCH_COUNT = 5;

export async function GET(req, { params }) {
  try {
    const { id: offerId } = await params;

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const admin = getSupabaseAdmin();

    const { data: offer, error: offerError } = await admin
      .from("job_offers")
      .select("id, recruiter_id, embedding")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError || !offer) {
      return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    if (offer.recruiter_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Vous ne pouvez consulter que vos propres offres." }, { status: 403 });
    }

    let embeddingLiteral = null;
    if (Array.isArray(offer.embedding)) {
      embeddingLiteral = `[${offer.embedding.join(",")}]`;
    } else if (typeof offer.embedding === "string" && offer.embedding.startsWith("[")) {
      embeddingLiteral = offer.embedding;
    }

    if (!embeddingLiteral) {
      // Pas encore d'embedding pour cette offre (rare : généré normalement à
      // la création/modification, voir /api/recruteur/offres/[id]/embedding)
      // — pas d'erreur, juste rien à montrer pour l'instant.
      return NextResponse.json({ success: true, candidats: [] });
    }

    const { data: matches, error: matchError } = await admin.rpc("match_resumes", {
      query_embedding: embeddingLiteral,
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT,
    });

    if (matchError || !Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ success: true, candidats: [] });
    }

    const userIds = matches.map((m) => m.user_id).filter(Boolean);
    const { data: profils } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);
    const profilParId = new Map((profils || []).map((p) => [p.id, p]));

    const candidats = matches
      .map((m) => ({
        id: m.user_id,
        nomComplet: profilParId.get(m.user_id)?.full_name || m.candidate_name || "Candidat Facilité",
        avatarUrl: profilParId.get(m.user_id)?.avatar_url || null,
        score: Math.round((m.similarity || 0) * 100),
      }))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ success: true, candidats });
  } catch (err) {
    console.error("[Candidats Potentiels API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
