-- Coordonnées des boutiques dans les résultats de recherche.
--
-- rechercher_articles_proches renvoyait la distance, jamais la position. Assez
-- pour trier une liste, pas pour placer un point sur une carte : « 2,5 km »
-- ne dit pas dans quelle direction, ce qui est exactement la question que se
-- pose quelqu'un qui ne connaît pas le quartier.
--
-- C'est le même manque que la fonction d'itinéraire avant la migration
-- 20260830210000, et pour la même raison : la position servait au calcul de
-- distance puis était jetée. On cesse de la jeter.
--
-- Rien de nouveau n'est exposé : la position d'une boutique est déjà publique
-- par policy (marketplace_stores, « boutiques actives visibles de tous ») et
-- c'est sa raison d'être — une boutique qu'on ne peut pas situer ne sert à
-- personne.
--
-- DROP puis CREATE : PostgreSQL refuse de remplacer une fonction dont le type
-- de retour change.

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
  id             UUID,
  titre          TEXT,
  description    TEXT,
  categorie      TEXT,
  prix_xof       INTEGER,
  quantite       INTEGER,
  statut         TEXT,
  photos         JSONB,
  maj_le         TIMESTAMPTZ,
  boutique_id    UUID,
  boutique_nom   TEXT,
  quartier       TEXT,
  ville          TEXT,
  whatsapp       TEXT,
  distance_km    DOUBLE PRECISION,
  boutique_lat   DOUBLE PRECISION,
  boutique_lng   DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    i.id, i.titre, i.description, i.categorie, i.prix_xof, i.quantite,
    i.statut, i.photos, i.updated_at,
    s.id, s.nom, s.quartier, s.ville, s.telephone_whatsapp,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision,
    s.latitude, s.longitude
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
