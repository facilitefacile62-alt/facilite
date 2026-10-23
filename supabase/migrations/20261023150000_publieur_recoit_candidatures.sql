-- Candidatures : seul un RECRUTEUR vérifié reçoit le message du candidat dans sa messagerie (décision du 23/10/2026).
--
-- Pour tout autre publieur d'offre (compte sans le badge « verified_recruiter ») et pour l'administrateur, la candidature transite
-- uniquement par e-mail : aucun message ni conversation n'est créé dans leur messagerie. La route /api/postuler s'exécute avec le
-- jeton du CANDIDAT, qui ne peut pas lire le profil ni le rôle d'un autre compte (RLS) : cette fonction répond à sa place, par
-- un simple oui/non, sans rien révéler d'autre.
CREATE OR REPLACE FUNCTION public.publieur_recoit_les_candidatures(p_publieur_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT p.badges ? 'verified_recruiter' FROM public.profiles p WHERE p.id = p_publieur_id), false)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_publieur_id AND r.role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.publieur_recoit_les_candidatures(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publieur_recoit_les_candidatures(UUID) TO authenticated;
