-- Plusieurs boutiques par commerçant, la première offerte.
--
-- CE QUE J'AVAIS MAL COMPRIS
--
-- La migration 20260902220000 traitait le sujet comme un déplacement : une
-- boutique, une position, figée. Ce n'était pas la demande. Un commerçant qui
-- réussit ouvre un SECOND point de vente — souvent sous la même enseigne, dans
-- un autre quartier. Ce qui se paie, c'est le point de vente supplémentaire,
-- pas le droit de bouger.
--
-- Ce modèle est plus simple, et il supprime une complexité que j'avais
-- introduite : si la position est fixée à la création et n'est jamais
-- modifiable, le seuil de tolérance de 50 mètres n'a plus de raison d'être.
-- Une boutique ne bouge pas ; on en ouvre une autre.
--
-- La table acceptait déjà plusieurs lignes par propriétaire — aucune
-- contrainte d'unicité sur owner_id. Seules les fonctions supposaient le
-- contraire, avec un LIMIT 1 hérité du premier jet.
--
-- Le nom n'est délibérément pas unique : « Chez Fatou » à Guinaw Rail et
-- « Chez Fatou » à Pikine sont la même enseigne, et c'est le quartier plus la
-- distance qui les distinguent pour l'acheteur.

-- Quota offert. Une constante en dur plutôt qu'une table de configuration :
-- il n'y a qu'un chiffre, et le changer demande de toute façon une migration.
CREATE OR REPLACE FUNCTION public.quota_boutiques_offert()
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 1 $$;

-- ---------------------------------------------------------------------------
-- Ouvrir une boutique
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creer_ma_boutique(
  p_nom         TEXT,
  p_quartier    TEXT DEFAULT NULL,
  p_ville       TEXT DEFAULT NULL,
  p_whatsapp    TEXT DEFAULT NULL,
  p_lat         DOUBLE PRECISION DEFAULT NULL,
  p_lng         DOUBLE PRECISION DEFAULT NULL,
  p_precision_m DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi   UUID := auth.uid();
  v_deja  INTEGER;
  v_row   public.marketplace_stores;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;
  -- La position est exigée à la création, et à la création seulement : une
  -- boutique sans emplacement n'apparaît dans aucune recherche, elle serait
  -- invisible sans que son propriétaire comprenne pourquoi.
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'Relevez la position de la boutique avant de la créer.';
  END IF;

  SELECT count(*)::int INTO v_deja
  FROM public.marketplace_stores WHERE owner_id = v_moi;

  IF v_deja >= public.quota_boutiques_offert() THEN
    RAISE EXCEPTION 'Vous avez déjà % boutique(s). Ouvrir un point de vente supplémentaire nécessite l''option payante.', v_deja
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.marketplace_stores
    (owner_id, nom, quartier, ville, telephone_whatsapp, latitude, longitude,
     position_precision_m, position_definie_le)
  VALUES (
    v_moi, btrim(p_nom),
    nullif(btrim(coalesce(p_quartier, '')), ''),
    nullif(btrim(coalesce(p_ville, '')), ''),
    nullif(btrim(coalesce(p_whatsapp, '')), ''),
    p_lat, p_lng, p_precision_m, now()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ---------------------------------------------------------------------------
-- Corriger l'étiquette d'une boutique
-- ---------------------------------------------------------------------------
-- Nom, quartier, ville, WhatsApp. Jamais la position : elle n'est pas un champ
-- de formulaire, c'est un relevé fait sur place.
CREATE OR REPLACE FUNCTION public.modifier_ma_boutique(
  p_id       UUID,
  p_nom      TEXT,
  p_quartier TEXT DEFAULT NULL,
  p_ville    TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_stores;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;

  UPDATE public.marketplace_stores
  SET nom = btrim(p_nom),
      quartier = nullif(btrim(coalesce(p_quartier, '')), ''),
      ville = nullif(btrim(coalesce(p_ville, '')), ''),
      telephone_whatsapp = nullif(btrim(coalesce(p_whatsapp, '')), '')
  WHERE id = p_id AND owner_id = v_moi
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Boutique introuvable.'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Publier un article DANS UNE boutique précise
-- ---------------------------------------------------------------------------
-- L'ancienne version déduisait la boutique du propriétaire avec un LIMIT 1.
-- Avec deux points de vente, elle aurait rangé tous les articles dans le
-- premier créé, en silence. La boutique devient donc un paramètre — mais son
-- appartenance est vérifiée ici, jamais supposée.
DROP FUNCTION IF EXISTS public.publier_mon_article(TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB);

CREATE FUNCTION public.publier_mon_article(
  p_store_id    UUID,
  p_titre       TEXT,
  p_categorie   TEXT,
  p_prix        INTEGER,
  p_quantite    INTEGER DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_photos      JSONB DEFAULT '[]'::jsonb
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
    (store_id, titre, description, categorie, prix_xof, quantite, photos)
  VALUES (
    p_store_id, btrim(p_titre),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_categorie,
    greatest(0, coalesce(p_prix, 0)),
    greatest(0, coalesce(p_quantite, 0)),
    coalesce(p_photos, '[]'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- L'ancienne fonction disparaît
-- ---------------------------------------------------------------------------
-- enregistrer_ma_boutique faisait un upsert sur « la » boutique du compte.
-- La garder vivante ferait silencieusement écraser la première boutique d'un
-- commerçant qui en a deux.
DROP FUNCTION IF EXISTS public.enregistrer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.enregistrer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
