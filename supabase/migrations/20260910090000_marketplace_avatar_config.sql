-- Avatars personnalisables façon Bitmoji pour les boutiques (anonymat, pas
-- de vraie photo obligatoire). On stocke les PARAMÈTRES choisis (JSON), pas
-- une image rendue : le SVG est généré côté client par DiceBear
-- (@dicebear/core + @dicebear/collection, en local, aucun appel réseau) à
-- partir de ce config — regénérable/modifiable à tout moment sans perdre
-- l'historique des choix. N'a rien à voir avec les photos de produits
-- (marketplace_items.photos, catalogue d'articles) : cet avatar représente
-- la boutique/le vendeur.
--
-- NULL par défaut, aucune migration de données : les boutiques existantes
-- gardent leur affichage actuel (photo ou icône générique) tant que le
-- propriétaire n'a pas explicitement configuré un avatar.

ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS avatar_config JSONB;

-- ---------------------------------------------------------------------------
-- Écriture : fonction dédiée plutôt qu'étendre modifier_ma_boutique — un nom
-- de fonction neuf ne peut pas créer de collision de surcharge (voir
-- l'incident du 2026-09-09, migration 20260909111000, où l'ajout de
-- paramètres à une fonction existante via CREATE OR REPLACE avait créé une
-- seconde surcharge fantôme au lieu de remplacer la première).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modifier_mon_avatar_boutique(
  p_store_id      UUID,
  p_avatar_config JSONB
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_stores;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;

  UPDATE public.marketplace_stores
  SET avatar_config = p_avatar_config
  WHERE id = p_store_id AND owner_id = v_moi
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Boutique introuvable.'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.modifier_mon_avatar_boutique(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_mon_avatar_boutique(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- Lecture : rechercher_articles_proches et rechercher_boutiques_proches
-- doivent renvoyer avatar_config pour que les cartes puissent l'afficher.
-- DROP obligatoire avant recréation : contrairement aux paramètres d'entrée
-- (qui acceptent des ajouts via CREATE OR REPLACE tant qu'ils ont un
-- DEFAULT), Postgres interdit de changer les COLONNES DE SORTIE d'une
-- fonction RETURNS TABLE par un simple CREATE OR REPLACE.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rechercher_articles_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, BOOLEAN, INTEGER);

CREATE FUNCTION public.rechercher_articles_proches(
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_rayon_km  DOUBLE PRECISION DEFAULT 10,
  p_categorie TEXT DEFAULT NULL,
  p_texte     TEXT DEFAULT NULL,
  p_en_stock  BOOLEAN DEFAULT false,
  p_limite    INTEGER DEFAULT 40
)
RETURNS TABLE (
  id                      UUID,
  titre                   TEXT,
  description             TEXT,
  categorie               TEXT,
  prix_xof                INTEGER,
  quantite                INTEGER,
  statut                  TEXT,
  photos                  JSONB,
  maj_le                  TIMESTAMPTZ,
  boutique_id             UUID,
  boutique_nom            TEXT,
  quartier                TEXT,
  ville                   TEXT,
  whatsapp                TEXT,
  distance_km             DOUBLE PRECISION,
  boutique_lat            DOUBLE PRECISION,
  boutique_lng            DOUBLE PRECISION,
  boutique_avatar_config  JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    i.id, i.titre, i.description, i.categorie, i.prix_xof, i.quantite,
    i.statut, i.photos, i.updated_at,
    s.id, s.nom, s.quartier, s.ville, s.telephone_whatsapp,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision,
    s.latitude, s.longitude, s.avatar_config
  FROM public.marketplace_items i
  JOIN public.marketplace_stores s ON s.id = i.store_id
  WHERE i.actif = true
    AND s.actif = true
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND public.distance_km(p_lat, p_lng, s.latitude, s.longitude) <= p_rayon_km
    AND (p_categorie IS NULL OR i.categorie = p_categorie)
    AND (p_en_stock = false OR i.quantite > 0)
    AND (
      p_texte IS NULL
      OR btrim(p_texte) = ''
      OR i.titre ILIKE '%' || btrim(p_texte) || '%'
      OR i.description ILIKE '%' || btrim(p_texte) || '%'
    )
  -- Le plus proche d'abord : c'est la promesse du produit. À distance égale,
  -- le stock confirmé le plus récemment passe devant.
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC,
           i.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$$;
REVOKE ALL ON FUNCTION public.rechercher_articles_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_articles_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, BOOLEAN, INTEGER) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER);

CREATE FUNCTION public.rechercher_boutiques_proches(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_rayon_km DOUBLE PRECISION DEFAULT 10,
  p_texte    TEXT DEFAULT NULL,
  p_type     TEXT DEFAULT NULL,
  p_limite   INTEGER DEFAULT 40
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
  avatar_config           JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    s.id, s.nom, s.quartier, s.ville, s.type_boutique,
    s.metier, s.description_prestation, s.categorie_etablissement,
    s.telephone_whatsapp,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision,
    s.latitude, s.longitude, s.avatar_config
  FROM public.marketplace_stores s
  WHERE s.type_boutique IN ('service', 'etablissement')
    AND s.actif = true
    -- Même verrou que la policy SELECT de marketplace_stores, répété ici car
    -- cette fonction SECURITY DEFINER contourne RLS.
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
