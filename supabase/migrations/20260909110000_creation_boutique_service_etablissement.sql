-- Permet au commerçant de choisir son type_boutique et de renseigner les
-- champs service/établissement dès la création, puis de les corriger à
-- l'édition — jusqu'ici seule la migration 20260909100000 avait ajouté les
-- colonnes ; aucun chemin d'écriture ne les remplissait encore, donc
-- l'écran Marketplace ne pouvait créer que des boutiques 'produit'.
--
-- Nouveaux paramètres ajoutés EN FIN de liste avec DEFAULT : CREATE OR
-- REPLACE FUNCTION autorise l'ajout de paramètres par défaut sans casser
-- l'appelant existant (marketplaceData.js, avant cette passe, n'envoyait
-- que les 7/5 premiers arguments).
--
-- Le type_boutique n'est modifiable qu'à la création, jamais à l'édition —
-- même logique que la position (20260902240000) : changer le type d'une
-- boutique déjà référencée avec du stock ou des horaires créerait un état
-- incohérent (ex. des marketplace_items sur une boutique 'service').

CREATE OR REPLACE FUNCTION public.creer_ma_boutique(
  p_nom                     TEXT,
  p_quartier                TEXT DEFAULT NULL,
  p_ville                   TEXT DEFAULT NULL,
  p_whatsapp                TEXT DEFAULT NULL,
  p_lat                     DOUBLE PRECISION DEFAULT NULL,
  p_lng                     DOUBLE PRECISION DEFAULT NULL,
  p_precision_m             DOUBLE PRECISION DEFAULT NULL,
  p_type_boutique           TEXT DEFAULT 'produit',
  p_metier                  TEXT DEFAULT NULL,
  p_description_prestation TEXT DEFAULT NULL,
  p_categorie_etablissement TEXT DEFAULT NULL
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi   UUID := auth.uid();
  v_deja  INTEGER;
  v_row   public.marketplace_stores;
  v_type  TEXT := coalesce(p_type_boutique, 'produit');
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;
  IF v_type NOT IN ('produit', 'service', 'etablissement') THEN
    RAISE EXCEPTION 'Type de boutique invalide.';
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
     position_precision_m, position_definie_le, type_boutique, metier,
     description_prestation, categorie_etablissement)
  VALUES (
    v_moi, btrim(p_nom),
    nullif(btrim(coalesce(p_quartier, '')), ''),
    nullif(btrim(coalesce(p_ville, '')), ''),
    nullif(btrim(coalesce(p_whatsapp, '')), ''),
    p_lat, p_lng, p_precision_m, now(),
    v_type,
    CASE WHEN v_type = 'service' THEN nullif(btrim(coalesce(p_metier, '')), '') ELSE NULL END,
    CASE WHEN v_type = 'service' THEN nullif(btrim(coalesce(p_description_prestation, '')), '') ELSE NULL END,
    CASE WHEN v_type = 'etablissement' THEN nullif(btrim(coalesce(p_categorie_etablissement, '')), '') ELSE NULL END
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Corriger l'étiquette d'une boutique — désormais aussi metier / description
-- de prestation / catégorie d'établissement, jamais le type_boutique lui-même.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modifier_ma_boutique(
  p_id                      UUID,
  p_nom                     TEXT,
  p_quartier                TEXT DEFAULT NULL,
  p_ville                   TEXT DEFAULT NULL,
  p_whatsapp                TEXT DEFAULT NULL,
  p_metier                  TEXT DEFAULT NULL,
  p_description_prestation TEXT DEFAULT NULL,
  p_categorie_etablissement TEXT DEFAULT NULL
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi  UUID := auth.uid();
  v_row  public.marketplace_stores;
  v_type TEXT;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;

  SELECT type_boutique INTO v_type
  FROM public.marketplace_stores WHERE id = p_id AND owner_id = v_moi;
  IF v_type IS NULL THEN RAISE EXCEPTION 'Boutique introuvable.'; END IF;

  UPDATE public.marketplace_stores
  SET nom = btrim(p_nom),
      quartier = nullif(btrim(coalesce(p_quartier, '')), ''),
      ville = nullif(btrim(coalesce(p_ville, '')), ''),
      telephone_whatsapp = nullif(btrim(coalesce(p_whatsapp, '')), ''),
      metier = CASE WHEN v_type = 'service'
                 THEN nullif(btrim(coalesce(p_metier, '')), '')
                 ELSE metier END,
      description_prestation = CASE WHEN v_type = 'service'
                 THEN nullif(btrim(coalesce(p_description_prestation, '')), '')
                 ELSE description_prestation END,
      categorie_etablissement = CASE WHEN v_type = 'etablissement'
                 THEN nullif(btrim(coalesce(p_categorie_etablissement, '')), '')
                 ELSE categorie_etablissement END,
      -- Changer de catégorie sensible force une nouvelle vérification : sans
      -- ça, un établissement validé sous 'beaute' pourrait basculer vers
      -- 'sante' et rester visible sans jamais repasser par l'écran admin.
      verifie = CASE
                 WHEN v_type = 'etablissement'
                      AND p_categorie_etablissement IN ('sante', 'finance')
                      AND p_categorie_etablissement IS DISTINCT FROM categorie_etablissement
                 THEN false
                 ELSE verifie END
  WHERE id = p_id AND owner_id = v_moi
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Boutique introuvable.'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
