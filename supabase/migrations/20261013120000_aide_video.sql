-- Vidéo d'aide « comment postuler », la MÊME sous toutes les publications
-- (bouton « Aide » des cartes d'offres, site et application). Gérée depuis
-- l'espace admin /admin/aide-video : l'administrateur téléverse un fichier ou
-- indique un lien YouTube, sans toucher au code.
--
-- Une seule ligne (id = 1). Lecture publique : la vidéo doit être visible de
-- tout visiteur, connecté ou non. Aucune écriture depuis le client : seule la
-- route /api/admin/aide-video (service_role, après contrôle admin) modifie la
-- ligne — donc ni GRANT INSERT/UPDATE/DELETE, ni policy d'écriture.

CREATE TABLE IF NOT EXISTS public.aide_video (
  id          integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  type        text        NOT NULL DEFAULT 'aucune' CHECK (type IN ('aucune', 'fichier', 'youtube')),
  url         text,
  youtube_id  text,
  duree       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Cohérence : un fichier a une URL, un lien YouTube a un identifiant.
  CONSTRAINT aide_video_source_coherente CHECK (
    (type = 'aucune')
    OR (type = 'fichier' AND url IS NOT NULL)
    OR (type = 'youtube' AND youtube_id IS NOT NULL)
  )
);

INSERT INTO public.aide_video (id, type) VALUES (1, 'aucune') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.aide_video ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "La video d'aide est lisible par tous" ON public.aide_video;
CREATE POLICY "La video d'aide est lisible par tous"
  ON public.aide_video FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON public.aide_video FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aide_video TO anon, authenticated;

-- Bucket des fichiers vidéo d'aide : public en lecture (la vidéo est le même
-- contenu marketing pour tout le monde), plafonné à 100 Mo, vidéos
-- uniquement. Aucune policy sur storage.objects : le dépôt se fait par URL
-- signée générée par la route admin (service_role), jamais directement par un
-- client.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('aide-videos', 'aide-videos', true, 104857600, ARRAY['video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
