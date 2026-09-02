-- Une seule position offerte par boutique.
--
-- POURQUOI VERROUILLER
--
-- La position est la promesse du service : « en stock, à 400 m de chez vous ».
-- Elle est prise depuis le navigateur du vendeur, donc là où il se trouve au
-- moment du clic. Rien n'empêchait jusqu'ici de la redéplacer à volonté — un
-- vendeur pouvait se placer au centre-ville depuis son salon, et tous les
-- acheteurs du quartier auraient vu sa boutique en tête de liste.
--
-- Le verrou n'est donc pas qu'une règle commerciale : c'est ce qui rend la
-- distance croyable. Le premier emplacement est offert, les suivants sont
-- payants — un déménagement est rare, et le rendre coûteux décourage
-- exactement l'usage abusif.
--
-- CE QUI RESTE MODIFIABLE
--
-- Nom, quartier, ville et numéro WhatsApp restent librement modifiables : ce
-- sont des corrections d'étiquette, pas des déplacements. Seules les
-- coordonnées sont figées.
--
-- SEUIL DE 50 MÈTRES
--
-- Un relevé GPS bouge de dix à trente mètres d'une lecture à l'autre, sans
-- que personne n'ait marché. Refuser toute différence rendrait impossible de
-- corriger une faute de frappe dans le nom depuis la boutique elle-même. On
-- ne compte comme déplacement qu'un écart supérieur à 50 m.

ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS position_definie_le TIMESTAMPTZ,
  -- Nombre de déplacements consommés. Reste à 0 tant que la boutique n'a
  -- jamais bougé : le premier enregistrement est offert, pas décompté.
  ADD COLUMN IF NOT EXISTS changements_position INTEGER NOT NULL DEFAULT 0,
  -- Précision annoncée par l'appareil, en mètres. Conservée pour pouvoir
  -- expliquer plus tard une boutique mal placée : un relevé à 800 m de
  -- précision n'a pas la même valeur qu'un relevé à 12 m.
  ADD COLUMN IF NOT EXISTS position_precision_m DOUBLE PRECISION;

-- Les boutiques déjà positionnées comptent comme ayant consommé leur
-- emplacement offert : sans cette ligne, elles bénéficieraient d'un
-- déplacement gratuit supplémentaire.
UPDATE public.marketplace_stores
SET position_definie_le = coalesce(position_definie_le, created_at)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND position_definie_le IS NULL;

CREATE OR REPLACE FUNCTION public.enregistrer_ma_boutique(
  p_nom          TEXT,
  p_quartier     TEXT DEFAULT NULL,
  p_ville        TEXT DEFAULT NULL,
  p_whatsapp     TEXT DEFAULT NULL,
  p_lat          DOUBLE PRECISION DEFAULT NULL,
  p_lng          DOUBLE PRECISION DEFAULT NULL,
  p_precision_m  DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi      UUID := auth.uid();
  v_row      public.marketplace_stores;
  v_deplace  BOOLEAN := false;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;

  SELECT * INTO v_row FROM public.marketplace_stores WHERE owner_id = v_moi LIMIT 1;

  IF FOUND THEN
    -- Y a-t-il vraiment déplacement ? Il faut une position déjà fixée, une
    -- nouvelle position fournie, et plus de 50 m entre les deux.
    IF v_row.latitude IS NOT NULL
       AND p_lat IS NOT NULL AND p_lng IS NOT NULL
       AND public.distance_km(v_row.latitude, v_row.longitude, p_lat, p_lng) > 0.05 THEN
      v_deplace := true;
    END IF;

    IF v_deplace AND v_row.position_definie_le IS NOT NULL THEN
      RAISE EXCEPTION 'Votre boutique est déjà positionnée. Un seul emplacement est offert : déplacer une boutique nécessite l''option payante.'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.marketplace_stores
    SET nom = btrim(p_nom),
        quartier = nullif(btrim(coalesce(p_quartier, '')), ''),
        ville = nullif(btrim(coalesce(p_ville, '')), ''),
        telephone_whatsapp = nullif(btrim(coalesce(p_whatsapp, '')), ''),
        -- La position n'est écrasée que si elle n'était pas encore fixée.
        -- Un appel sans coordonnées ne l'efface donc jamais.
        latitude = CASE WHEN position_definie_le IS NULL THEN coalesce(p_lat, latitude) ELSE latitude END,
        longitude = CASE WHEN position_definie_le IS NULL THEN coalesce(p_lng, longitude) ELSE longitude END,
        position_precision_m = CASE WHEN position_definie_le IS NULL THEN coalesce(p_precision_m, position_precision_m) ELSE position_precision_m END,
        position_definie_le = CASE
          WHEN position_definie_le IS NOT NULL THEN position_definie_le
          WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN now()
          ELSE NULL END
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.marketplace_stores
      (owner_id, nom, quartier, ville, telephone_whatsapp, latitude, longitude,
       position_precision_m, position_definie_le)
    VALUES (
      v_moi, btrim(p_nom),
      nullif(btrim(coalesce(p_quartier, '')), ''),
      nullif(btrim(coalesce(p_ville, '')), ''),
      nullif(btrim(coalesce(p_whatsapp, '')), ''),
      p_lat, p_lng, p_precision_m,
      CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN now() ELSE NULL END
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- L'ancienne signature à six paramètres disparaît : la laisser vivante
-- rouvrirait le déplacement libre pour tout appelant qui l'utiliserait encore.
DROP FUNCTION IF EXISTS public.enregistrer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
