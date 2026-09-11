-- Mode d'horaires d'un établissement : 'indiques' (grille 7 jours dans
-- marketplace_horaires), 'toujours_ouvert' (24h/24, 7j/7), ou 'sur_rendez_vous'
-- (accueil sur rendez-vous uniquement).
--
-- Champ stocké sur marketplace_stores au niveau boutique (pas par jour), avec
-- DEFAULT 'indiques' pour rétro-compatibilité totale avec les établissements
-- déjà enregistrés.

-- 1. Ajout de la colonne mode_horaires sur marketplace_stores
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS mode_horaires TEXT NOT NULL DEFAULT 'indiques'
    CHECK (mode_horaires IN ('indiques', 'toujours_ouvert', 'sur_rendez_vous'));

COMMENT ON COLUMN public.marketplace_stores.mode_horaires IS
  'Mode d''ouverture pour type_boutique = ''etablissement'' : '
  '''indiques'' (utilise la table marketplace_horaires), '
  '''toujours_ouvert'' (24h/24, 7j/7), '
  '''sur_rendez_vous'' (uniquement sur rendez-vous).';

-- 2. Mise à jour de enregistrer_mes_horaires pour persister le mode et les horaires
CREATE OR REPLACE FUNCTION public.enregistrer_mes_horaires(
  p_store_id UUID,
  p_horaires JSONB,
  p_mode_horaires TEXT DEFAULT 'indiques'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner UUID;
  v_item  JSONB;
  v_mode  TEXT := coalesce(p_mode_horaires, 'indiques');
BEGIN
  IF v_mode NOT IN ('indiques', 'toujours_ouvert', 'sur_rendez_vous') THEN
    RAISE EXCEPTION 'Mode d''horaires invalide.';
  END IF;

  SELECT owner_id INTO v_owner FROM public.marketplace_stores WHERE id = p_store_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez modifier que les horaires de votre propre boutique.';
  END IF;

  UPDATE public.marketplace_stores
  SET mode_horaires = v_mode
  WHERE id = p_store_id;

  DELETE FROM public.marketplace_horaires WHERE store_id = p_store_id;

  IF v_mode = 'indiques' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_horaires, '[]'::jsonb))
    LOOP
      INSERT INTO public.marketplace_horaires (store_id, jour_semaine, heure_ouverture, heure_fermeture, ferme_ce_jour)
      VALUES (
        p_store_id,
        (v_item->>'jour_semaine')::SMALLINT,
        NULLIF(v_item->>'heure_ouverture', '')::TIME,
        NULLIF(v_item->>'heure_fermeture', '')::TIME,
        coalesce((v_item->>'ferme_ce_jour')::BOOLEAN, false)
      );
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_mes_horaires(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_mes_horaires(UUID, JSONB, TEXT) TO authenticated;

-- 3. Mise à jour de creer_ma_boutique avec p_mode_horaires
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
  p_categorie_etablissement TEXT DEFAULT NULL,
  p_mode_horaires           TEXT DEFAULT 'indiques'
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi   UUID := auth.uid();
  v_deja  INTEGER;
  v_row   public.marketplace_stores;
  v_type  TEXT := coalesce(p_type_boutique, 'produit');
  v_mode  TEXT := coalesce(p_mode_horaires, 'indiques');
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;
  IF v_type NOT IN ('produit', 'service', 'etablissement') THEN
    RAISE EXCEPTION 'Type de boutique invalide.';
  END IF;
  IF v_mode NOT IN ('indiques', 'toujours_ouvert', 'sur_rendez_vous') THEN
    RAISE EXCEPTION 'Mode d''horaires invalide.';
  END IF;
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
     description_prestation, categorie_etablissement, mode_horaires)
  VALUES (
    v_moi, btrim(p_nom),
    nullif(btrim(coalesce(p_quartier, '')), ''),
    nullif(btrim(coalesce(p_ville, '')), ''),
    nullif(btrim(coalesce(p_whatsapp, '')), ''),
    p_lat, p_lng, p_precision_m, now(),
    v_type,
    CASE WHEN v_type = 'service' THEN nullif(btrim(coalesce(p_metier, '')), '') ELSE NULL END,
    CASE WHEN v_type = 'service' THEN nullif(btrim(coalesce(p_description_prestation, '')), '') ELSE NULL END,
    CASE WHEN v_type = 'etablissement' THEN nullif(btrim(coalesce(p_categorie_etablissement, '')), '') ELSE NULL END,
    CASE WHEN v_type = 'etablissement' THEN v_mode ELSE 'indiques' END
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 4. Mise à jour de modifier_ma_boutique avec p_mode_horaires
CREATE OR REPLACE FUNCTION public.modifier_ma_boutique(
  p_id                      UUID,
  p_nom                     TEXT,
  p_quartier                TEXT DEFAULT NULL,
  p_ville                   TEXT DEFAULT NULL,
  p_whatsapp                TEXT DEFAULT NULL,
  p_metier                  TEXT DEFAULT NULL,
  p_description_prestation TEXT DEFAULT NULL,
  p_categorie_etablissement TEXT DEFAULT NULL,
  p_mode_horaires           TEXT DEFAULT NULL
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
  IF p_mode_horaires IS NOT NULL AND p_mode_horaires NOT IN ('indiques', 'toujours_ouvert', 'sur_rendez_vous') THEN
    RAISE EXCEPTION 'Mode d''horaires invalide.';
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
      mode_horaires = CASE WHEN v_type = 'etablissement' AND p_mode_horaires IS NOT NULL
                 THEN p_mode_horaires
                 ELSE mode_horaires END,
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

REVOKE ALL ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 5. Mise à jour de rechercher_boutiques_proches pour renvoyer mode_horaires
DROP FUNCTION IF EXISTS public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER);

CREATE FUNCTION public.rechercher_boutiques_proches(
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_rayon_km  DOUBLE PRECISION DEFAULT 10,
  p_texte     TEXT DEFAULT NULL,
  p_type      TEXT DEFAULT NULL, -- 'service' | 'etablissement' | NULL (les deux)
  p_limite    INTEGER DEFAULT 40
)
RETURNS TABLE (
  id                      UUID,
  nom                     TEXT,
  quartier                TEXT,
  ville                   TEXT,
  type_boutique           TEXT,
  metier                  TEXT,
  description_prestation  TEXT,
  categorie_etablissement TEXT,
  telephone_whatsapp      TEXT,
  distance_km             DOUBLE PRECISION,
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  mode_horaires           TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.id, s.nom, s.quartier, s.ville, s.type_boutique,
    s.metier, s.description_prestation, s.categorie_etablissement,
    s.telephone_whatsapp,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision,
    s.latitude, s.longitude,
    s.mode_horaires
  FROM public.marketplace_stores s
  WHERE s.type_boutique IN ('service', 'etablissement')
    AND s.actif = true
    AND (
      s.categorie_etablissement IS NULL
      OR s.categorie_etablissement NOT IN ('sante', 'finance')
      OR s.verifie = true
    )
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND public.distance_km(p_lat, p_lng, s.latitude, s.longitude) <= p_rayon_km
    AND (p_type IS NULL OR s.type_boutique = p_type)
    AND (
      p_texte IS NULL
      OR btrim(p_texte) = ''
      OR s.nom ILIKE '%' || btrim(p_texte) || '%'
      OR s.metier ILIKE '%' || btrim(p_texte) || '%'
      OR s.description_prestation ILIKE '%' || btrim(p_texte) || '%'
    )
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$$;

REVOKE ALL ON FUNCTION public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER) TO anon, authenticated;
