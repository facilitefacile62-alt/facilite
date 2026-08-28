-- Livraison d'un document par un administrateur à un candidat.
--
-- Besoin : l'équipe produit un CV pour un candidat (prestation payée, atelier,
-- accompagnement) et doit le déposer dans son espace « Mes documents ».
--
-- Deux contraintes se croisent :
--
--   1. Un administrateur n'a AUCUN droit d'écriture pour autrui — ni sur
--      public.resumes (policy « Creation de ses propres CV », auth.uid() =
--      user_id), ni sur le bucket (policy « Upload de son propre CV »,
--      (storage.foldername(name))[1] = auth.uid()::text). C'est délibéré et
--      ça ne doit pas changer : ouvrir une policy d'écriture large pour les
--      admins rendrait tout l'espace documentaire modifiable depuis un seul
--      compte compromis.
--
--   2. check_resume_quota() plafonne à 5 les documents IMPORTÉS d'un
--      candidat (file_url NOT NULL ; les CV rédigés dans l'éditeur ne
--      comptent pas). Un candidat déjà au plafond ne peut pas recevoir un
--      document de plus sans qu'un autre parte.
--
-- D'où le choix : deux fonctions SECURITY DEFINER étroites plutôt que des
-- policies permissives. Elles sont le seul chemin d'écriture croisée, elles
-- vérifient le rôle elles-mêmes, et chaque livraison laisse une ligne
-- horodatée nominative dans document_deliveries.
--
-- Rien n'est livré de force au-delà du quota : la demande part au candidat,
-- qui choisit lui-même quel document céder la place — ou refuse.

-- ---------------------------------------------------------------------------
-- Table : une ligne par livraison, quel qu'en soit le sort.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_name       TEXT,
  note            TEXT,
  -- delivered            : déposé directement, le candidat était sous le quota
  -- pending_replacement  : quota atteint, en attente du choix du candidat
  -- approved             : le candidat a cédé un document, dépôt effectué
  -- refused              : le candidat a refusé
  status          TEXT NOT NULL DEFAULT 'pending_replacement'
                  CHECK (status IN ('delivered', 'pending_replacement', 'approved', 'refused')),
  replaced_resume_id UUID,
  created_resume_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ
);

-- replaced_resume_id / created_resume_id ne sont volontairement PAS des clés
-- étrangères vers resumes : la ligne de livraison est une trace d'audit, elle
-- doit survivre à la suppression du document qu'elle mentionne.

CREATE INDEX IF NOT EXISTS idx_document_deliveries_candidat
  ON public.document_deliveries (candidate_id, created_at DESC);

ALTER TABLE public.document_deliveries ENABLE ROW LEVEL SECURITY;

-- Lecture : le candidat concerné, ou l'administrateur qui a livré. Pas de
-- policy INSERT/UPDATE/DELETE — l'écriture passe exclusivement par les deux
-- fonctions ci-dessous, ce qui garantit qu'aucune ligne ne peut apparaître
-- sans être passée par les contrôles de rôle et de quota.
DROP POLICY IF EXISTS "Lecture de ses livraisons ou de celles qu'on a faites" ON public.document_deliveries;
CREATE POLICY "Lecture de ses livraisons ou de celles qu'on a faites"
  ON public.document_deliveries FOR SELECT
  USING (auth.uid() = candidate_id OR auth.uid() = admin_id);

-- ---------------------------------------------------------------------------
-- Notifications : nouveau type, même mécanique que document_access.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'jobs', 'posts', 'mentions', 'candidature', 'reponse',
    'badge', 'message', 'system', 'document_access', 'document_delivery'
  ]));

CREATE OR REPLACE FUNCTION public.notify_document_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (
      NEW.candidate_id,
      NEW.admin_id,
      'document_delivery',
      CASE
        WHEN NEW.status = 'delivered'
          THEN 'Un document a été déposé dans votre espace : « ' || NEW.title || ' ».'
        ELSE 'Un document vous est destiné : « ' || NEW.title || ' ». Votre espace documentaire est plein — indiquez quel document remplacer, ou refusez.'
      END,
      '/candidat/securite'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Retour à l'administrateur : c'est lui qui attend la décision.
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (
      NEW.admin_id,
      NEW.candidate_id,
      'document_delivery',
      CASE NEW.status
        WHEN 'approved' THEN 'Livraison acceptée : « ' || NEW.title || ' » a été déposé.'
        WHEN 'refused'  THEN 'Livraison refusée : « ' || NEW.title || ' ».'
        ELSE 'Livraison « ' || NEW.title || ' » : statut ' || NEW.status || '.'
      END,
      '/admin/banque-donnees'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_document_delivery ON public.document_deliveries;
CREATE TRIGGER trg_notify_document_delivery
  AFTER INSERT OR UPDATE ON public.document_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.notify_document_delivery();

-- ---------------------------------------------------------------------------
-- Livraison par l'administrateur.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.livrer_document(
  p_candidate_id UUID,
  p_title        TEXT,
  p_file_path    TEXT,
  p_file_name    TEXT DEFAULT NULL,
  p_note         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin      UUID := auth.uid();
  v_importes   INT;
  v_resume_id  UUID;
  v_id         UUID;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF p_candidate_id = v_admin THEN
    RAISE EXCEPTION 'Utilisez votre espace personnel pour vos propres documents.';
  END IF;
  IF coalesce(btrim(p_title), '') = '' OR coalesce(btrim(p_file_path), '') = '' THEN
    RAISE EXCEPTION 'Titre et fichier obligatoires.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_candidate_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Candidat introuvable.';
  END IF;
  -- Le fichier doit être rangé dans le dossier du candidat : c'est ce qui
  -- permettra au candidat de le lire (policy « Lecture de son propre CV »)
  -- et ce qui empêche de rattacher à un candidat un fichier déposé ailleurs.
  IF (string_to_array(p_file_path, '/'))[1] IS DISTINCT FROM p_candidate_id::text THEN
    RAISE EXCEPTION 'Le fichier doit être déposé dans le dossier du candidat.';
  END IF;

  -- Même règle de comptage que check_resume_quota() : documents importés
  -- seulement. Volontairement recalculée ici plutôt que déduite du
  -- déclencheur : on doit savoir AVANT d'insérer s'il faut demander au
  -- candidat de faire de la place.
  SELECT count(*) INTO v_importes
  FROM public.resumes
  WHERE user_id = p_candidate_id AND file_url IS NOT NULL;

  IF v_importes < 5 THEN
    INSERT INTO public.resumes (user_id, title, type, file_url, content)
    VALUES (p_candidate_id, btrim(p_title), 'CV', p_file_path, '{}'::jsonb)
    RETURNING id INTO v_resume_id;

    INSERT INTO public.document_deliveries
      (admin_id, candidate_id, title, file_path, file_name, note, status, created_resume_id, decided_at)
    VALUES
      (v_admin, p_candidate_id, btrim(p_title), p_file_path, p_file_name, p_note, 'delivered', v_resume_id, now())
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('statut', 'delivered', 'livraison_id', v_id, 'resume_id', v_resume_id);
  END IF;

  INSERT INTO public.document_deliveries
    (admin_id, candidate_id, title, file_path, file_name, note, status)
  VALUES
    (v_admin, p_candidate_id, btrim(p_title), p_file_path, p_file_name, p_note, 'pending_replacement')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('statut', 'pending_replacement', 'livraison_id', v_id, 'documents_importes', v_importes);
END;
$$;

REVOKE ALL ON FUNCTION public.livrer_document(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.livrer_document(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Réponse du candidat.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repondre_livraison(
  p_delivery_id UUID,
  p_decision    TEXT,
  p_resume_id   UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi        UUID := auth.uid();
  v_livraison  public.document_deliveries%ROWTYPE;
  v_resume_id  UUID;
BEGIN
  IF p_decision NOT IN ('approved', 'refused') THEN
    RAISE EXCEPTION 'Décision invalide : % (attendu approved ou refused).', p_decision;
  END IF;

  -- FOR UPDATE : deux clics rapprochés ne doivent pas supprimer deux
  -- documents pour une seule livraison.
  SELECT * INTO v_livraison
  FROM public.document_deliveries
  WHERE id = p_delivery_id AND candidate_id = v_moi AND status = 'pending_replacement'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable, déjà traitée, ou qui ne vous concerne pas.';
  END IF;

  IF p_decision = 'refused' THEN
    UPDATE public.document_deliveries
    SET status = 'refused', decided_at = now()
    WHERE id = p_delivery_id;
    RETURN jsonb_build_object('statut', 'refused');
  END IF;

  IF p_resume_id IS NULL THEN
    RAISE EXCEPTION 'Indiquez le document à remplacer.';
  END IF;
  -- Le document cédé doit appartenir au candidat ET compter dans le quota :
  -- céder un CV de l'éditeur ne libèrerait aucune place.
  IF NOT EXISTS (
    SELECT 1 FROM public.resumes
    WHERE id = p_resume_id AND user_id = v_moi AND file_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Ce document ne peut pas être remplacé.';
  END IF;

  DELETE FROM public.resumes WHERE id = p_resume_id AND user_id = v_moi;

  INSERT INTO public.resumes (user_id, title, type, file_url, content)
  VALUES (v_moi, v_livraison.title, 'CV', v_livraison.file_path, '{}'::jsonb)
  RETURNING id INTO v_resume_id;

  UPDATE public.document_deliveries
  SET status = 'approved', decided_at = now(),
      replaced_resume_id = p_resume_id, created_resume_id = v_resume_id
  WHERE id = p_delivery_id;

  RETURN jsonb_build_object('statut', 'approved', 'resume_id', v_resume_id);
END;
$$;

REVOKE ALL ON FUNCTION public.repondre_livraison(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repondre_livraison(UUID, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage : dépôt du fichier par l'administrateur, strictement borné.
-- ---------------------------------------------------------------------------
-- Un administrateur peut écrire dans le dossier d'un candidat, mais seulement
-- sous le sous-dossier « livraisons/ ». Il ne peut donc ni écraser un CV
-- déposé par le candidat, ni déposer ailleurs que chez un profil existant.
-- La lecture par le candidat est déjà couverte par « Lecture de son propre
-- CV » ((storage.foldername(name))[1] = auth.uid()::text), sans modification.
DROP POLICY IF EXISTS "Un admin depose un document livre" ON storage.objects;
CREATE POLICY "Un admin depose un document livre"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND public.current_user_role() = 'admin'
    AND (storage.foldername(name))[2] = 'livraisons'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
    )
  );
