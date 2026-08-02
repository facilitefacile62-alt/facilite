-- Protection de la phase de test : des comptes badgés verified_recruiter
-- pour simulation ne doivent jamais voir de vrais CV.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cv_visible_recruteurs BOOLEAN NOT NULL DEFAULT false;

-- is_test_account n'est volontairement PAS ajoutée au GRANT UPDATE ciblé de
-- 20260802060000 (deny-by-default) : aucun utilisateur, y compris via une
-- future fonction SECURITY DEFINER mal écrite, ne doit pouvoir se
-- l'attribuer — seul un accès SQL direct (docs/purge-avant-lancement.md)
-- le peut. cv_visible_recruteurs, elle, doit rester modifiable par son
-- propriétaire (déposer un CV et le rendre visible sont deux actions
-- distinctes, mais toutes deux du ressort du candidat) : ajoutée au GRANT.
GRANT UPDATE (cv_visible_recruteurs) ON public.profiles TO authenticated;

-- =====================================================================
-- Profils candidats fictifs pour les simulations verified_recruiter
-- =====================================================================
-- auth.users réels (nécessaires pour la FK profiles.id) mais emails/mdp
-- non fonctionnels de propos délibéré (pas de compte utilisable, juste des
-- lignes à interroger). cv_visible_recruteurs=true : sans ça, aucune
-- simulation n'obtiendrait le moindre résultat depuis candidats_recherche.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-a000-000000000001',
   'authenticated', 'authenticated', 'test-fictif-1@facilite-demo.local',
   crypt('CompteFictifNonUtilisable2026!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-a000-000000000002',
   'authenticated', 'authenticated', 'test-fictif-2@facilite-demo.local',
   crypt('CompteFictifNonUtilisable2026!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-a000-000000000003',
   'authenticated', 'authenticated', 'test-fictif-3@facilite-demo.local',
   crypt('CompteFictifNonUtilisable2026!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now()
FROM auth.users u
WHERE u.email IN ('test-fictif-1@facilite-demo.local', 'test-fictif-2@facilite-demo.local', 'test-fictif-3@facilite-demo.local')
ON CONFLICT DO NOTHING;

-- handle_new_user() s'est déclenché sur l'INSERT ci-dessus (trigger sur
-- auth.users) et a déjà créé les lignes profiles + user_roles avec les
-- valeurs par défaut ('user'/'active') : on complète ici plutôt que
-- d'insérer, pour ne pas entrer en conflit avec ce que le trigger a fait.
UPDATE public.profiles SET
  full_name = data.full_name,
  headline = data.headline,
  bio = data.bio,
  city = data.city,
  skills = data.skills,
  is_test_account = true,
  cv_visible_recruteurs = true
FROM (VALUES
  ('90000000-0000-4000-a000-000000000001'::uuid, 'Aïssatou Fictive (Test)', 'Développeuse Full-Stack (profil de simulation)',
   'Profil 100% fictif, généré pour les simulations de recherche recruteur. Ne correspond à aucune personne réelle.',
   'Dakar', '["React", "Node.js", "PostgreSQL"]'::jsonb),
  ('90000000-0000-4000-a000-000000000002'::uuid, 'Moussa Fictif (Test)', 'Comptable (profil de simulation)',
   'Profil 100% fictif, généré pour les simulations de recherche recruteur. Ne correspond à aucune personne réelle.',
   'Thiès', '["Comptabilité", "Excel", "SAGE"]'::jsonb),
  ('90000000-0000-4000-a000-000000000003'::uuid, 'Fatou Fictive (Test)', 'Chargée de communication (profil de simulation)',
   'Profil 100% fictif, généré pour les simulations de recherche recruteur. Ne correspond à aucune personne réelle.',
   'Saint-Louis', '["Communication", "Réseaux sociaux", "Canva"]'::jsonb)
) AS data(id, full_name, headline, bio, city, skills)
WHERE profiles.id = data.id;

-- =====================================================================
-- candidats_recherche / match_resumes : isolation bidirectionnelle
-- =====================================================================
-- Un compte de test ne voit QUE des profils de test ; un compte réel ne
-- voit QUE des profils réels — jamais de mélange dans un sens ou l'autre.
-- cv_visible_recruteurs=true requis en plus (opt-in explicite, distinct du
-- simple fait d'avoir déposé un CV).

DROP VIEW IF EXISTS public.candidats_recherche;
CREATE VIEW public.candidats_recherche
WITH (security_invoker = off) AS
SELECT
  id, full_name, headline, bio, city, location, skills, experiences,
  educations, avatar_url, cv_url, cv_name
FROM public.profiles
WHERE cv_visible_recruteurs = true
  AND NOT public.has_badge(id, 'verified_recruiter')
  AND is_test_account = COALESCE(
    (SELECT is_test_account FROM public.profiles caller WHERE caller.id = auth.uid()),
    false
  )
  AND (
    public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
  );

REVOKE ALL ON public.candidats_recherche FROM PUBLIC;
GRANT SELECT ON public.candidats_recherche TO authenticated;

CREATE OR REPLACE FUNCTION public.match_resumes(query_embedding vector, match_threshold double precision, match_count integer)
RETURNS TABLE(id uuid, user_id uuid, candidate_name text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
  SELECT
    resumes.id,
    resumes.user_id,
    profiles.full_name AS candidate_name,
    1 - (resumes.embedding <=> query_embedding) AS similarity
  FROM public.resumes
  JOIN public.profiles ON profiles.id = resumes.user_id
  WHERE resumes.embedding IS NOT NULL
    AND resumes.status = 'completed'
    AND profiles.cv_visible_recruteurs = true
    AND NOT public.has_badge(resumes.user_id, 'verified_recruiter')
    AND profiles.is_test_account = COALESCE(
      (SELECT is_test_account FROM public.profiles caller WHERE caller.id = auth.uid()),
      false
    )
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
    AND 1 - (resumes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
