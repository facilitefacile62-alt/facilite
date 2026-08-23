-- Point 4 (2026-08-23) : 3 offres publiées par le Publieur d'Offres/Scanner
-- IA restaient invisibles publiquement (status pas 'approved' et/ou
-- is_active=false), victimes du même bug de fond que 04f9437
-- (trg_reset_job_offer_moderation ne voyait jamais l'admin comme admin
-- lors d'un INSERT via service_role — corrigé côté route, mais ces 3
-- lignes avaient déjà été insérées avant le correctif).
--
-- Idempotent et robuste indépendamment de l'état actuel de ces 3 lignes :
-- trg_reset_job_offer_moderation rejette (RAISE EXCEPTION) tout changement
-- de status par un rôle non-admin, or une migration appliquée via
-- runIntrospectionSql n'a pas de session admin (current_user_role() NULL,
-- pas de auth.uid()) — désactivation ciblée et réactivation immédiate du
-- trigger, plutôt qu'une dépendance au fait que ces lignes soient déjà
-- corrigées par ailleurs (script non tracé de l'autre session).
ALTER TABLE public.job_offers DISABLE TRIGGER trg_reset_job_offer_moderation;

UPDATE public.job_offers
SET status = 'approved',
    is_active = true,
    archived_at = NULL,
    status_updated_at = now(),
    updated_at = now()
WHERE id IN (
  'a7ccd61a-5661-4e7d-bc40-bc725ae4fa63', -- SENSAT — Ingénieur(e) Logiciel Embarqué (GAINDESAT-1A)
  'b8ec7721-89f2-4a12-bb41-958bcf7d6392', -- Grant Thornton Technologies — Architecte d'Entreprise Junior
  'b69b4b86-859f-4cff-a508-b2c21c74e765'  -- Entreprise Industrielle & Automatisme — Électrotechnicien(ne)
)
AND (status IS DISTINCT FROM 'approved' OR is_active IS DISTINCT FROM true OR archived_at IS NOT NULL);

ALTER TABLE public.job_offers ENABLE TRIGGER trg_reset_job_offer_moderation;
