// Recherche du candidat idéal dans la banque de CV, à partir d'un intitulé
// de poste tapé par l'admin.
//
// Deux étapes, comme le RAG déjà en place pour les candidats inscrits
// (src/app/api/recruteur/rag-matching/route.js) : d'abord une présélection
// par proximité sémantique (embedding du poste comparé à l'embedding de
// chaque CV, match_banque_cv), puis un diagnostic écrit par le modèle sur ce
// lot restreint — jamais l'inverse. Faire écrire le diagnostic à un modèle
// qui n'a vu AUCUN CV produirait un texte plausible mais inventé ; c'est
// exactement le risque que la présélection vectorielle évite.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { diagnostiquerCandidats, embarquerTexte } from "@/lib/banqueCvIA";

export const runtime = "nodejs";
export const maxDuration = 45;

const RechercheSchema = z.object({
  poste: z.string().trim().min(2).max(500),
  categorie: z.string().max(50).optional(),
  limite: z.number().int().min(1).max(15).optional().default(8),
});

export async function POST(req) {
  const { user, identifier, error: authError } = await requireUser(req, { logDenials: true });
  if (authError) return authError;

  const { allowed, error: rateLimitError } = await checkRateLimit(identifier);
  if (!allowed) return rateLimitError;

  const admin = getSupabaseAdmin();
  if (!(await isCallerAdmin(admin, user.id))) {
    return NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 });
  }

  if (!(await checkAiQuota(user.id))) {
    return NextResponse.json(
      { error: `Quota IA quotidien atteint (${AI_DAILY_QUOTA} requêtes/jour). Réessayez demain.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = RechercheSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Décrivez le poste recherché (2 caractères minimum)." }, { status: 400 });
  }
  const { poste, categorie, limite } = parsed.data;

  // 1. Retrieval — présélection par proximité sémantique.
  let embedding;
  try {
    embedding = await embarquerTexte(poste);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  const { data: candidatsProches, error: matchError } = await admin.rpc("match_banque_cv", {
    query_embedding: `[${embedding.join(",")}]`,
    match_threshold: 0.3,
    match_count: limite,
    filtre_categorie: categorie || null,
  });
  if (matchError) {
    return NextResponse.json({ error: `Recherche impossible : ${matchError.message}` }, { status: 500 });
  }
  if (!candidatsProches || candidatsProches.length === 0) {
    return NextResponse.json({
      success: true,
      poste,
      candidats: [],
      message: "Aucun CV de la banque ne correspond à ce poste pour l'instant.",
    });
  }

  // 2. Profils complets des candidats présélectionnés uniquement — jamais
  // toute la banque, pour garder le contexte envoyé au modèle borné.
  const ids = candidatsProches.map((c) => c.id);
  const { data: profils, error: profilsError } = await admin
    .from("banque_cv")
    .select("id, nom_complet, categorie, niveau_etude_code, annees_experience, competences, resume_profil, points_forts")
    .in("id", ids);
  if (profilsError) {
    return NextResponse.json({ error: `Lecture des profils impossible : ${profilsError.message}` }, { status: 500 });
  }
  const similariteParId = new Map(candidatsProches.map((c) => [c.id, c.similarity]));

  // 3. Generation — diagnostic écrit sur ce lot précis.
  let diagnostics = new Map();
  try {
    diagnostics = await diagnostiquerCandidats(poste, profils);
  } catch {
    // Le diagnostic peut échouer sans faire échouer la recherche : le
    // classement par similarité seul reste utile, moins riche.
  }

  const resultats = profils
    .map((p) => {
      const diag = diagnostics.get(p.id);
      const similarite = Math.round((similariteParId.get(p.id) || 0) * 100);
      return {
        id: p.id,
        nomComplet: p.nom_complet,
        categorie: p.categorie,
        niveauEtudeCode: p.niveau_etude_code,
        anneesExperience: p.annees_experience,
        competences: p.competences || [],
        pointsForts: p.points_forts || [],
        resumeProfil: p.resume_profil,
        similarite,
        diagnostic: diag
          ? {
              score: diag.score,
              verdict: diag.verdict,
              texte: diag.diagnostic,
              pointsAVerifier: diag.points_a_verifier || [],
            }
          : {
              score: similarite,
              verdict: similarite >= 75 ? "Forte adéquation" : "Adéquation à confirmer",
              texte: "Diagnostic détaillé indisponible pour le moment ; classement fondé sur la seule proximité sémantique.",
              pointsAVerifier: [],
            },
      };
    })
    // Le meilleur d'abord : c'est la promesse du produit — trouver LE
    // candidat idéal, pas une liste dans un ordre arbitraire.
    .sort((a, b) => (b.diagnostic.score || 0) - (a.diagnostic.score || 0));

  return NextResponse.json({ success: true, poste, candidats: resultats });
}
