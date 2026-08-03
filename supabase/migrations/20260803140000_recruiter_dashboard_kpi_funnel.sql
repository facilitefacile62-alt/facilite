-- Étape F du chantier (2026-08-03) : KPI + entonnoir du tableau de bord
-- recruteur. Toute l'agrégation tient en base (SECURITY DEFINER, scoping
-- par recruiter_id = auth.uid()) — jamais une boucle côté client sur des
-- lignes brutes non paginées.
--
-- "Vues des offres (7j/30j)" volontairement absent : job_offers.view_count
-- est un compteur cumulatif sans granularité temporelle (pas de journal
-- d'événements de vue) — impossible d'en dériver une variation par
-- période sans fabriquer un chiffre. Seul le total cumulé est exposé.
-- Idem "quota restant" : aucun concept de quota recruteur n'existe dans ce
-- schéma (seul un quota IA candidat existe, aiQuota.js, sans rapport) —
-- omis plutôt qu'inventé.

-- Étape D (badge gate) réappliqué explicitement ici : ces fonctions étant
-- SECURITY DEFINER, elles bypassent la RLS de job_offers/candidatures — un
-- compte qui possédait déjà des offres avant de perdre son badge pourrait
-- sinon continuer à lire ses statistiques via ce chemin.
CREATE OR REPLACE FUNCTION public.is_authorized_recruiter()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'));
$$;

CREATE OR REPLACE FUNCTION public.get_recruiter_overview_stats()
RETURNS TABLE(
  active_offers_count integer,
  candidatures_7j integer,
  candidatures_prev_7j integer,
  candidatures_30j integer,
  candidatures_prev_30j integer,
  total_views integer,
  conversion_rate numeric,
  avg_first_response_hours numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH mine AS (
    SELECT id, view_count FROM public.job_offers
    WHERE recruiter_id = auth.uid() AND public.is_authorized_recruiter()
  ),
  cands AS (
    SELECT c.created_at, c.first_response_at
    FROM public.candidatures c
    WHERE (c.job_offer_id IN (SELECT id FROM mine) OR c.recruiter_id = auth.uid())
      AND public.is_authorized_recruiter()
  )
  SELECT
    (SELECT count(*)::int FROM public.job_offers
       WHERE recruiter_id = auth.uid() AND status = 'approved' AND is_active = true AND archived_at IS NULL
       AND public.is_authorized_recruiter()),
    (SELECT count(*)::int FROM cands WHERE created_at >= now() - interval '7 days'),
    (SELECT count(*)::int FROM cands WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'),
    (SELECT count(*)::int FROM cands WHERE created_at >= now() - interval '30 days'),
    (SELECT count(*)::int FROM cands WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'),
    (SELECT COALESCE(sum(view_count), 0)::int FROM mine),
    (SELECT CASE WHEN COALESCE(sum(view_count), 0) = 0 THEN 0
       ELSE round((SELECT count(*) FROM cands)::numeric / sum(view_count) * 100, 1) END FROM mine),
    (SELECT round(avg(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600)::numeric, 1)
       FROM cands WHERE first_response_at IS NOT NULL AND created_at >= now() - interval '30 days');
$$;

CREATE OR REPLACE FUNCTION public.get_recruiter_daily_candidatures(p_days integer DEFAULT 30)
RETURNS TABLE(day date, count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT d.day::date, COALESCE(count(c.created_at), 0)::int
  FROM generate_series(
    (now() - (LEAST(GREATEST(p_days, 1), 90) - 1) * interval '1 day')::date,
    now()::date,
    interval '1 day'
  ) AS d(day)
  LEFT JOIN public.candidatures c
    ON c.created_at::date = d.day
    AND (
      c.job_offer_id IN (SELECT id FROM public.job_offers WHERE recruiter_id = auth.uid())
      OR c.recruiter_id = auth.uid()
    )
    AND public.is_authorized_recruiter()
  GROUP BY d.day
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.get_recruiter_funnel()
RETURNS TABLE(
  job_offer_id uuid, title text, view_count integer,
  pending_count integer, reviewed_count integer, contacted_count integer,
  interview_count integer, accepted_count integer, rejected_count integer,
  avg_response_hours numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    jo.id, jo.title, jo.view_count,
    count(*) FILTER (WHERE c.status = 'pending')::int,
    count(*) FILTER (WHERE c.status = 'reviewed')::int,
    count(*) FILTER (WHERE c.status = 'contacted')::int,
    count(*) FILTER (WHERE c.status = 'interview_scheduled')::int,
    count(*) FILTER (WHERE c.status = 'accepted')::int,
    count(*) FILTER (WHERE c.status = 'rejected')::int,
    round(avg(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 3600)
      FILTER (WHERE c.first_response_at IS NOT NULL)::numeric, 1)
  FROM public.job_offers jo
  LEFT JOIN public.candidatures c ON c.job_offer_id = jo.id
  WHERE jo.recruiter_id = auth.uid()
    AND jo.status = 'approved' AND jo.is_active = true AND jo.archived_at IS NULL
    AND public.is_authorized_recruiter()
  GROUP BY jo.id, jo.title, jo.view_count
  ORDER BY jo.created_at DESC;
$$;
