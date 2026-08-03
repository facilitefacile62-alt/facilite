-- =====================================================================
-- VAGUE 2 (Partie 1 du chantier) — remplacement des 3 DELETE client par
-- des fonctions SECURITY DEFINER, prérequis à la révocation de DELETE sur
-- authenticated. Voir docs/grants-matrix.md.
-- =====================================================================

-- 1. Suppression d'un CV déposé (droit à l'oubli) : supprime la ligne et
-- renvoie le chemin Storage associé pour que l'appelant supprime le fichier
-- via l'API Storage. Ne PAS toucher storage.objects directement en SQL : un
-- trigger plateforme Supabase (storage.protect_delete()) bloque tout DELETE
-- direct sur cette table, y compris depuis une fonction SECURITY DEFINER
-- ("Direct deletion from storage tables is not allowed. Use the Storage API
-- instead.") — découvert en écrivant le test qui prouve cette fonction.
CREATE OR REPLACE FUNCTION public.delete_own_resume(resume_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  stored_path text;
BEGIN
  SELECT user_id, file_url INTO owner_id, stored_path
  FROM public.resumes WHERE id = resume_id;

  IF owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez supprimer que vos propres documents.';
  END IF;

  DELETE FROM public.resumes WHERE id = resume_id;

  PERFORM public.log_security_event(
    'resume_deleted', 'info', auth.uid(), auth.uid(),
    jsonb_build_object('resume_id', resume_id, 'had_file', stored_path IS NOT NULL)
  );

  RETURN stored_path;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_resume(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_resume(uuid) TO authenticated;

-- 2. Archivage d'une offre (pas une suppression) : les candidatures déjà
-- reçues gardent leur contexte, le candidat sait toujours à quoi il a
-- postulé. `archived_at` distinct de `is_active` (qui reste le bouton
-- pause/reprise du recruteur, réversible) — une offre archivée ne doit
-- jamais redevenir visible via ce même bouton.
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.archive_own_job_offer(offer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT recruiter_id INTO owner_id FROM public.job_offers WHERE id = offer_id;

  IF owner_id IS NULL THEN
    RETURN false;
  END IF;

  IF owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez archiver que vos propres offres.';
  END IF;

  UPDATE public.job_offers
  SET archived_at = now(), is_active = false, updated_at = now()
  WHERE id = offer_id;

  PERFORM public.log_security_event(
    'job_offer_archived', 'info', auth.uid(), NULL,
    jsonb_build_object('offer_id', offer_id)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_own_job_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_own_job_offer(uuid) TO authenticated;

-- Correction d'une faille RLS trouvée en construisant ce correctif : une
-- politique de lecture publique "Lecture publique des offres" USING (true)
-- coexistait avec "Anyone can view active job offers" USING (is_active =
-- true) — en PostgreSQL les policies permissives d'une même commande (ici
-- SELECT) sont combinées en OR, donc la politique USING (true) rendait la
-- seconde totalement inopérante : TOUTE offre (y compris inactive) était
-- lisible par quiconque via l'API directe. Sans ce correctif, une offre
-- "archivée" resterait publiquement lisible malgré archived_at.
DROP POLICY IF EXISTS "Lecture publique des offres" ON public.job_offers;
DROP POLICY IF EXISTS "Anyone can view active job offers" ON public.job_offers;
CREATE POLICY "Anyone can view active job offers" ON public.job_offers
  FOR SELECT USING (is_active = true AND archived_at IS NULL);

-- Sans cette policy, un recruteur perd l'accès en lecture à ses PROPRES
-- offres dès qu'il les met en pause ou les archive (découvert en écrivant
-- le test ci-dessus : "Lecture publique des offres" USING (true), en plus
-- d'exposer tout à tout le monde, masquait accidentellement ce trou pour
-- le recruteur lui-même). "Mes offres" (recruteur/page.js) a besoin de
-- voir l'intégralité de son propre historique, actif ou non.
CREATE POLICY "Un recruteur lit ses propres offres" ON public.job_offers
  FOR SELECT USING (auth.uid() = recruiter_id);

-- 3. Effacement de l'historique de chat IA (par conversation, propre à
-- l'utilisateur) — pas un droit à l'oubli global, juste "vider cette
-- conversation", d'où DELETE ciblé plutôt qu'archivage.
CREATE OR REPLACE FUNCTION public.clear_own_assistant_messages(conv_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.assistant_messages
  WHERE user_id = auth.uid() AND conversation_id = conv_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  PERFORM public.log_security_event(
    'assistant_messages_cleared', 'info', auth.uid(), auth.uid(),
    jsonb_build_object('conversation_id', conv_id, 'deleted_count', deleted_count)
  );

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_own_assistant_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_own_assistant_messages(uuid) TO authenticated;
