-- Nombre de candidatures reçues, par offre, consultable publiquement.
--
-- Pourquoi une fonction et pas une lecture directe : la RLS de
-- public.candidatures n'autorise que le candidat lui-même et les
-- administrateurs (policies « Lecture de ses propres candidatures » et
-- « Un admin lit toutes les candidatures »). Un visiteur anonyme compte donc
-- 0, et un recruteur ne peut même pas compter celles de sa propre annonce —
-- vérifié le 2026-08-30 : anon obtient 0 là où la table en contient 174.
--
-- Cette fonction ne renvoie QUE des agrégats : un identifiant d'offre et un
-- nombre. Aucun nom, aucune adresse, aucun CV. C'est le strict nécessaire
-- pour afficher « 8 personnes ont postulé » sous une annonce.
--
-- LES CANDIDATURES DE TEST SONT EXCLUES, et elles le sont ICI plutôt qu'à
-- l'affichage. Sur les 174 candidatures enregistrées, 102 proviennent du
-- compte e2e-test-candidate@facilite-demo.local — dont les 64 d'une seule
-- offre, qui n'en a aucune réelle. Filtrer côté interface aurait laissé la
-- porte ouverte à leur réapparition au premier composant qui interrogerait
-- la table autrement. Un recruteur qui consulte son annonce doit lire un
-- chiffre vrai, y compris quand ce chiffre est zéro.

CREATE OR REPLACE FUNCTION public.compter_candidatures_par_offre(p_offres UUID[])
RETURNS TABLE (job_offer_id UUID, nombre INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    o.id AS job_offer_id,
    count(cd.id)::INTEGER AS nombre
  FROM unnest(coalesce(p_offres, ARRAY[]::UUID[])) AS o(id)
  -- Les exclusions vivent dans la condition de jointure, pas dans un WHERE :
  -- un WHERE transformerait la jointure externe en jointure interne et ferait
  -- disparaître les offres à zéro candidature, précisément celles qu'on veut
  -- pouvoir afficher honnêtement.
  LEFT JOIN public.candidatures cd
    ON cd.job_offer_id = o.id
   AND NOT EXISTS (
     SELECT 1 FROM auth.users u
     WHERE u.id = cd.user_id AND u.email LIKE '%facilite-demo.local'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.profiles p
     WHERE p.id = cd.user_id AND p.is_test_account IS TRUE
   )
  GROUP BY o.id;
$$;

REVOKE ALL ON FUNCTION public.compter_candidatures_par_offre(UUID[]) FROM PUBLIC;
-- anon compris : les offres sont consultables sans compte, le compteur doit
-- l'être aussi. Sinon un visiteur venu par un lien partagé — le cas d'usage
-- même de ce compteur — ne verrait rien.
GRANT EXECUTE ON FUNCTION public.compter_candidatures_par_offre(UUID[]) TO anon, authenticated;
