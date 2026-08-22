-- Similarité cosinus directe entre UN CV et UNE offre (comparaison
-- ponctuelle, pas une recherche parmi plusieurs lignes comme
-- match_resumes/match_job_offers) — utilisée au moment de candidater pour
-- calculer candidatures.cv_match_score à partir des embeddings réels
-- plutôt que de l'heuristique mot-à-mot calculateCvMatchScore()
-- (src/lib/eligibility.js). SECURITY INVOKER (défaut), même posture que
-- match_resumes/match_job_offers (20260730100000_ai_infrastructure.sql) :
-- respecte la RLS de l'appelant (le candidat ne lit que son propre CV via
-- "Users can manage their own resumes").
CREATE OR REPLACE FUNCTION public.resume_offer_similarity(
  p_resume_id uuid,
  p_offer_id uuid
)
RETURNS float
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT 1 - (r.embedding <=> o.embedding)
  FROM public.resumes r, public.job_offers o
  WHERE r.id = p_resume_id
    AND o.id = p_offer_id
    AND r.embedding IS NOT NULL
    AND o.embedding IS NOT NULL;
$$;
