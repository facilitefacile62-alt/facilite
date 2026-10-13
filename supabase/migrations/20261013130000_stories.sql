-- Stories du fil d'actualité (site et application) : les pastilles rondes en
-- tête du fil, qui ouvrent un visuel plein écran avec un bouton d'action
-- (« Commander via WhatsApp », « Créer mon CV »…). Gérées depuis l'espace admin
-- /admin/stories : l'administrateur ajoute, modifie, réordonne, masque ou
-- supprime ses stories sans toucher au code.
--
-- Lecture publique des stories ACTIVES uniquement (un visiteur non connecté les
-- voit aussi). Aucune écriture depuis le client : seule la route
-- /api/admin/stories (service_role, après contrôle admin) crée/modifie/supprime
-- — donc ni GRANT INSERT/UPDATE/DELETE, ni policy d'écriture. Tant qu'aucune
-- story n'est active, le fil garde son carrousel de modèles de CV.

CREATE TABLE IF NOT EXISTS public.stories (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titre          text        NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 40),
  image_url      text        NOT NULL,
  libelle_bouton text        NOT NULL DEFAULT 'Commander via WhatsApp' CHECK (char_length(libelle_bouton) BETWEEN 1 AND 40),
  lien           text        CHECK (lien IS NULL OR (char_length(lien) <= 500 AND lien ~* '^https?://')),
  ordre          integer     NOT NULL DEFAULT 0,
  actif          boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS stories_actif_ordre_idx ON public.stories (actif, ordre, created_at DESC);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les stories actives sont lisibles par tous" ON public.stories;
CREATE POLICY "Les stories actives sont lisibles par tous"
  ON public.stories FOR SELECT
  TO anon, authenticated
  USING (actif = true);

REVOKE ALL ON public.stories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stories TO anon, authenticated;

-- Bucket des visuels de stories : public en lecture (ce sont des visuels
-- marketing affichés à tous), plafonné à 5 Mo, images uniquement. Aucune policy
-- sur storage.objects : le dépôt se fait par URL signée générée par la route
-- admin (service_role), jamais directement par un client.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stories-media', 'stories-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
