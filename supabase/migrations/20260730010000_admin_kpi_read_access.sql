-- Accès en lecture admin pour les KPI du tableau de bord /admin.
-- Utilise la fonction public.current_user_role() (SECURITY DEFINER,
-- introduite dans 20260730000200) pour éviter toute récursion RLS.
--
-- assistant_messages est délibérément exclue : ce sont des conversations
-- personnelles (questions au CV/coach IA), pas une donnée d'exploitation
-- administrative. Les KPI "Assistant IA & CV" se basent uniquement sur
-- public.resumes (comptage), jamais sur le contenu des échanges IA.

DROP POLICY IF EXISTS "Un admin lit toutes les candidatures" ON public.candidatures;
CREATE POLICY "Un admin lit toutes les candidatures" ON public.candidatures
  FOR SELECT USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Un admin lit tous les CV" ON public.resumes;
CREATE POLICY "Un admin lit tous les CV" ON public.resumes
  FOR SELECT USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Un admin lit toutes les offres" ON public.job_offers;
CREATE POLICY "Un admin lit toutes les offres" ON public.job_offers
  FOR SELECT USING (public.current_user_role() = 'admin');
