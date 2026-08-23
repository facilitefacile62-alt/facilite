import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

// Outil a — recherche d'offres par domaine (lecture seule, pas de
// confirmation : ne modifie aucune donnée).
const searchOffersByDomain = {
  name: "rechercher_offres_par_domaine",
  description:
    "Recherche des offres d'emploi publiées sur Facilité par domaine ou mot-clé métier (ex. \"comptabilité\", \"développement web\"). Utilise la similarité sémantique (match_job_offers), pas une simple recherche texte.",
  parameters: {
    type: "OBJECT",
    properties: {
      domaine: {
        type: "STRING",
        description: "Le domaine, métier ou mot-clé recherché par le candidat, en français, tel qu'il l'a formulé.",
      },
    },
    required: ["domaine"],
  },
  requiresConfirmation: false,

  // Lecture seule sur des offres déjà publiques (RLS "Anyone can view active
  // job offers") : aucune restriction supplémentaire nécessaire au-delà
  // d'être un utilisateur authentifié, déjà garanti par la route appelante.
  async guard() {
    return true;
  },

  /**
   * @param {{ args: {domaine: string}, supabase: import('@supabase/supabase-js').SupabaseClient }} ctx
   * `supabase` est ici TOUJOURS le client scopé par le token Bearer de
   * l'appelant (jamais service_role) — la RLS s'applique donc exactement
   * comme si le candidat cherchait lui-même depuis /recherche.
   */
  async execute({ args, supabase }) {
    const domaine = (args?.domaine || "").trim();
    if (!domaine) {
      return { success: false, error: "Aucun domaine fourni." };
    }

    // 1. Embedding de la requête texte via l'Edge Function déjà utilisée
    // pour les CV/offres (gemini-orchestrator, action "embed").
    let embedding;
    try {
      const embedRes = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: "embed", text: domaine }),
      });
      const embedJson = await embedRes.json();
      if (!embedJson?.success || !Array.isArray(embedJson.embedding)) {
        return { success: false, error: "Impossible de générer une recherche pour ce domaine pour le moment." };
      }
      embedding = embedJson.embedding;
    } catch (err) {
      return { success: false, error: `Échec de la recherche : ${err.message}` };
    }

    // 2. Correspondance sémantique (même RPC que /recherche et le tableau
    // de bord candidat).
    const embeddingLiteral = `[${embedding.join(",")}]`;
    const { data: matches, error: matchError } = await supabase.rpc("match_job_offers", {
      query_embedding: embeddingLiteral,
      match_threshold: 0.35,
      match_count: 5,
    });

    if (matchError) {
      return { success: false, error: `Erreur de recherche : ${matchError.message}` };
    }
    if (!matches || matches.length === 0) {
      return { success: true, results: [], message: `Aucune offre trouvée pour le domaine "${domaine}".` };
    }

    const { data: offers, error: offersError } = await supabase
      .from("job_offers")
      .select("id, title, company, location, contract_type")
      .in("id", matches.map((m) => m.id));

    if (offersError) {
      return { success: false, error: `Erreur de récupération des offres : ${offersError.message}` };
    }

    const similarityById = new Map(matches.map((m) => [m.id, m.similarity]));
    const results = (offers || [])
      .map((o) => ({ ...o, similarity: similarityById.get(o.id) || 0 }))
      .sort((a, b) => b.similarity - a.similarity);

    return { success: true, results };
  },
};

export default searchOffersByDomain;
