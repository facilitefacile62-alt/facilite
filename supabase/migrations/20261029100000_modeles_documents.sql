-- « Modèles de documents » (onglet du Profil de Facilité, application) : catalogue simple de modèles de CV et de lettres de motivation, publiés par
-- l'administrateur depuis /admin/modeles-documents. Aucun paiement : un modèle choisi ouvre WhatsApp vers Facilité (le prix est indicatif, pour l'équipe).
--
-- Lecture : les comptes connectés lisent les modèles ACTIFS (colonnes publiques seulement). Aucune écriture depuis le client : seule la route
-- /api/admin/modeles-documents (service_role, après contrôle admin) crée, modifie ou supprime — donc ni GRANT INSERT/UPDATE/DELETE, ni policy d'écriture.
-- Une story peut être publiée en même temps (story_id garde le lien, sans écriture côté client).

CREATE TABLE IF NOT EXISTS public.modeles_documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text        NOT NULL DEFAULT 'cv' CHECK (type IN ('cv', 'lettre')),
  nom         text        NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 2 AND 60),
  description text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  prix_xof    integer     NOT NULL DEFAULT 0 CHECK (prix_xof BETWEEN 0 AND 1000000),
  image_url   text        NOT NULL CHECK (char_length(image_url) <= 500 AND image_url ~* '^https://'),
  actif       boolean     NOT NULL DEFAULT true,
  ordre       integer     NOT NULL DEFAULT 0,
  story_id    uuid        REFERENCES public.stories (id) ON DELETE SET NULL,
  created_by  uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS modeles_documents_actifs ON public.modeles_documents (ordre, created_at DESC) WHERE actif;

ALTER TABLE public.modeles_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les modèles actifs sont lisibles par les comptes connectés" ON public.modeles_documents;
CREATE POLICY "Les modèles actifs sont lisibles par les comptes connectés"
  ON public.modeles_documents FOR SELECT
  TO authenticated
  USING (actif = true);

REVOKE ALL ON public.modeles_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, type, nom, description, prix_xof, image_url, actif, ordre, created_at) ON public.modeles_documents TO authenticated;

-- Bucket des affiches : public en lecture (visuels marketing), 5 Mo, images seulement. Aucune policy sur storage.objects : le dépôt se fait par URL
-- signée générée par la route admin (service_role), jamais directement par un client.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('modeles-documents', 'modeles-documents', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
