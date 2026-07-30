-- Corrections issues d'un audit de sécurité/RLS complet de la plateforme.
--
-- 1. FUITE DE DONNÉES CRITIQUE — bucket Storage "resumes" (CV des candidats).
--
-- Trois policies "Public Select/Upload/Update Resumes" (roles: public,
-- qual/with_check limités à `bucket_id = 'resumes'`, sans AUCUNE restriction
-- de dossier) coexistaient avec les policies correctement scopées
-- ("Lecture/Mise a jour/Upload de son propre CV", filtrées sur
-- `(storage.foldername(name))[1] = auth.uid()::text`). Les policies RLS
-- étant PERMISSIVE et combinées par OR, la présence de ces trois policies
-- larges suffisait à elle seule à rendre TOUS les CV de TOUS les candidats
-- lisibles ET modifiables par n'importe quel utilisateur, authentifié ou
-- non — malgré le bucket documenté comme "privé" partout ailleurs dans le
-- code (getSignedCvUrl existe précisément pour ce modèle "privé").
--
-- Ces trois policies n'apparaissent dans AUCUNE migration de ce dépôt
-- (créées hors migration, probablement via le Dashboard) : leur suppression
-- ne casse aucun flux applicatif, tous vérifiés pour n'écrire/lire que sous
-- `${user.id}/...` (profil, importer-cv, creer-cv, /api/postuler,
-- /api/send-application, /api/process-resume) — donc déjà couverts par les
-- policies "de son propre CV" + "Recruteurs et admins lisent les CV".
DROP POLICY IF EXISTS "Public Select Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Resumes" ON storage.objects;

-- 2. match_resumes (20260730100000_ai_infrastructure.sql,
-- 20260730110000_resume_processing_status.sql) est LANGUAGE SQL STABLE sans
-- SECURITY DEFINER, donc exécutée avec les droits RLS de l'appelant. Or
-- `profiles` n'a aucune policy autorisant un recruteur à lire les lignes
-- d'AUTRES utilisateurs (seule `candidats_recherche`, une vue, contourne ce
-- point via les privilèges de son propriétaire) : le JOIN vers profiles
-- filtrait donc silencieusement TOUTES les lignes candidates pour tout
-- recruteur réel, renvoyant systématiquement un résultat vide en
-- production — alors que les tests via une connexion admin/service
-- (db query --linked, qui contourne la RLS) donnaient l'illusion que la
-- fonction fonctionnait. Passage en SECURITY DEFINER + garde de rôle
-- explicite dans la clause WHERE (même logique que le WHERE de
-- candidats_recherche), pour que seuls recruteur/admin obtiennent des
-- résultats, sans pour autant élargir l'accès RLS direct à `profiles`.
DROP FUNCTION IF EXISTS public.match_resumes(extensions.vector, float, int);

CREATE OR REPLACE FUNCTION public.match_resumes (
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  candidate_name text,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, extensions
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
    AND current_user_role() = ANY (ARRAY['recruteur', 'admin'])
    AND 1 - (resumes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
