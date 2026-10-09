-- =====================================================================
-- Vidéo d'un article Marketplace (maquette 22 « Photos & vidéo »).
--
-- La maquette montre une vidéo du produit à côté des photos ; les articles
-- n'avaient qu'une colonne `photos`. Le client a tranché le 09/10/2026
-- (note de pages-apk-complet/LISTE.md) : « ajouter un champ vidéo à
-- l'article en base (url_video) et un lecteur dans la visionneuse ».
--
-- Trois pièces : la colonne, un bucket dédié, et le passage du champ par
-- les deux fonctions d'écriture existantes. Comme toujours ici, aucune
-- écriture directe sur marketplace_items n'est accordée au client
-- (invariant 1) : tout passe par les fonctions SECURITY DEFINER, qui
-- revérifient l'appartenance de la boutique.
-- =====================================================================

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS url_video TEXT;

COMMENT ON COLUMN public.marketplace_items.url_video IS
  'Chemin de la vidéo dans le bucket marketplace-videos (ou URL complète). NULL = article sans vidéo.';

-- ---------------------------------------------------------------------------
-- Bucket dédié : une vidéo ne tient pas dans marketplace-photos
-- ---------------------------------------------------------------------------
-- marketplace-photos plafonne à 2 Mo et n'accepte que des images. Une vidéo
-- de produit de quelques secondes pèse bien davantage, d'où un bucket
-- séparé — 30 Mo, formats vidéo courants des téléphones (mp4, mov, webm).
-- Public en lecture comme les photos : un article visible l'est en entier.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketplace-videos', 'marketplace-videos', true, 31457280,
        ARRAY['video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 31457280,
      allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm'];

-- Pas de policy SELECT : le bucket est public, les objets sont servis par
-- URL directe sans passer par la RLS — marketplace-photos fonctionne
-- exactement ainsi et n'en a aucune. Une policy « bucket_id seul » serait
-- redondante et userait pour rien le détecteur de l'invariant 7. Voir
-- 20261009110000, qui retire celle créée ici par erreur.

-- Contrainte de préfixe identique à celle des photos : chaque vendeur écrit dans un
-- dossier à son nom, sinon n'importe qui écraserait la vidéo d'un concurrent.
DROP POLICY IF EXISTS "un vendeur depose ses videos" ON storage.objects;
CREATE POLICY "un vendeur depose ses videos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'marketplace-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "un vendeur remplace ses videos" ON storage.objects;
CREATE POLICY "un vendeur remplace ses videos" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'marketplace-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "un vendeur supprime ses videos" ON storage.objects;
CREATE POLICY "un vendeur supprime ses videos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'marketplace-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Publication : p_url_video en dernier paramètre, avec défaut
-- ---------------------------------------------------------------------------
-- L'ancienne signature est supprimée explicitement avant de recréer la
-- fonction : laisser les deux versions cohabiter rendrait l'appel ambigu
-- pour PostgREST. Le paramètre ayant un DEFAULT, les appels existants du
-- site (sept paramètres nommés) continuent de fonctionner sans changement.
DROP FUNCTION IF EXISTS public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB);

CREATE FUNCTION public.publier_mon_article(
  p_store_id    UUID,
  p_titre       TEXT,
  p_categorie   TEXT,
  p_prix        INTEGER,
  p_quantite    INTEGER DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_photos      JSONB DEFAULT '[]'::jsonb,
  p_url_video   TEXT DEFAULT NULL
)
RETURNS public.marketplace_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_items;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.marketplace_stores s
    WHERE s.id = p_store_id AND s.owner_id = v_moi
  ) THEN
    RAISE EXCEPTION 'Boutique introuvable ou qui ne vous appartient pas.';
  END IF;

  INSERT INTO public.marketplace_items
    (store_id, titre, description, categorie, prix_xof, quantite, photos, url_video)
  VALUES (
    p_store_id, btrim(p_titre),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_categorie,
    greatest(0, coalesce(p_prix, 0)),
    greatest(0, coalesce(p_quantite, 0)),
    coalesce(p_photos, '[]'::jsonb),
    nullif(btrim(coalesce(p_url_video, '')), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Modification : même ajout
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.modifier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB);

CREATE FUNCTION public.modifier_mon_article(
  p_id          UUID,
  p_titre       TEXT,
  p_categorie   TEXT,
  p_prix        INTEGER,
  p_quantite    INTEGER DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_photos      JSONB DEFAULT '[]'::jsonb,
  p_url_video   TEXT DEFAULT NULL
)
RETURNS public.marketplace_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_items;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  IF btrim(coalesce(p_titre, '')) = '' THEN
    RAISE EXCEPTION 'Le titre est obligatoire.';
  END IF;

  UPDATE public.marketplace_items i
  SET titre       = btrim(p_titre),
      categorie   = p_categorie,
      prix_xof    = greatest(0, coalesce(p_prix, 0)),
      quantite    = greatest(0, coalesce(p_quantite, 0)),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      photos      = coalesce(p_photos, '[]'::jsonb),
      url_video   = nullif(btrim(coalesce(p_url_video, '')), ''),
      updated_at  = now()
  WHERE i.id = p_id
    AND EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = i.store_id AND s.owner_id = v_moi
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article introuvable ou hors de votre boutique.';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.modifier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TEXT) TO authenticated;
