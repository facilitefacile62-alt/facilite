-- profiles.SELECT est aujourd'hui limité à "sa propre ligne" ou "admin" —
-- un agent n'a donc aucun moyen de lire le nom/e-mail du candidat dont il a
-- la charge sur /admin/commandes-agent. Pas de récursion possible : le
-- sous-select porte sur agent_assignments, pas sur profiles lui-même.
DROP POLICY IF EXISTS "Un agent lit le profil de ses candidats assignes" ON public.profiles;
CREATE POLICY "Un agent lit le profil de ses candidats assignes" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_assignments aa
      WHERE aa.candidate_id = profiles.id AND aa.agent_id = auth.uid()
    )
  );
