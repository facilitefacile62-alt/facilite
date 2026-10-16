-- Recherche insensible aux accents (et aux majuscules) dans le Marketplace.
--
-- Constat (audit des barres de recherche, 16/10/2026) : « creme », « moise » ou « electrique »
-- ne trouvaient rien alors que « Crème », « Moïse » et « électrique » marchaient — la majorité des
-- utilisateurs tape sans accents sur téléphone. La page affichait en plus des articles sans rapport.
--
-- CHANGEMENT
--  * extension unaccent + fonction public.sans_accent() (minuscules, sans accents) ;
--  * deux colonnes calculées pour la recherche par l'API : marketplace_items.recherche_norm
--    (titre + description + catégorie) et marketplace_stores.nom_norm ;
--  * rechercher_articles_proches cherche aussi dans la catégorie et dans le NOM de la boutique
--    (avant : titre et description seulement) ; rechercher_boutiques_proches ignore les accents.
-- Les deux fonctions sont redéfinies à l'identique de la production, sauf ces conditions.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.sans_accent(t TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$ SELECT lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

REVOKE ALL ON FUNCTION public.sans_accent(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sans_accent(TEXT) TO authenticated;

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS recherche_norm TEXT
  GENERATED ALWAYS AS (public.sans_accent(titre || ' ' || coalesce(description, '') || ' ' || coalesce(categorie, ''))) STORED;
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS nom_norm TEXT
  GENERATED ALWAYS AS (public.sans_accent(nom)) STORED;

CREATE OR REPLACE FUNCTION public.rechercher_articles_proches(p_lat double precision, p_lng double precision, p_rayon_km double precision DEFAULT 10, p_categorie text DEFAULT NULL::text, p_texte text DEFAULT NULL::text, p_en_stock boolean DEFAULT false, p_limite integer DEFAULT 40)
 RETURNS TABLE(id uuid, titre text, description text, categorie text, prix_xof integer, quantite integer, statut text, photos jsonb, maj_le timestamp with time zone, boutique_id uuid, boutique_nom text, quartier text, ville text, whatsapp text, distance_km double precision, boutique_lat double precision, boutique_lng double precision, boutique_avatar_config jsonb, boutique_owner_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    i.id, i.titre, i.description, i.categorie, i.prix_xof, i.quantite,
    i.statut, i.photos, i.updated_at,
    s.id, s.nom, s.quartier, s.ville, s.telephone_whatsapp,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision,
    s.latitude, s.longitude, s.avatar_config, s.owner_id
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
      OR public.sans_accent(i.titre) LIKE '%' || public.sans_accent(btrim(p_texte)) || '%'
      OR public.sans_accent(i.description) LIKE '%' || public.sans_accent(btrim(p_texte)) || '%'
      OR public.sans_accent(i.categorie) LIKE '%' || public.sans_accent(btrim(p_texte)) || '%'
      OR public.sans_accent(s.nom) LIKE '%' || public.sans_accent(btrim(p_texte)) || '%'
    )
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC,
           i.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$function$;

CREATE OR REPLACE FUNCTION public.rechercher_boutiques_proches(p_lat double precision, p_lng double precision, p_rayon_km double precision DEFAULT 10, p_texte text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_limite integer DEFAULT 40)
 RETURNS TABLE(id uuid, nom text, quartier text, ville text, type_boutique text, metier text, description_prestation text, categorie_etablissement text, telephone_whatsapp text, distance_km double precision, latitude double precision, longitude double precision, avatar_config jsonb, mode_horaires text, owner_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    s.id, s.nom, s.quartier, s.ville, s.type_boutique,
    s.metier, s.description_prestation, s.categorie_etablissement,
    s.telephone_whatsapp,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision,
    s.latitude, s.longitude, s.avatar_config, s.mode_horaires, s.owner_id
  FROM public.marketplace_stores s
  WHERE s.type_boutique IN ('service', 'etablissement')
    AND s.actif = true
    AND (
      s.verifie = true
      OR (
        (s.categorie_etablissement IS NULL OR s.categorie_etablissement NOT IN ('pharmacie', 'clinique', 'point_wave'))
        AND (s.metier IS NULL OR s.metier NOT IN ('Pharmacien', 'Infirmier/Infirmière', 'Sage-femme'))
      )
    )
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND public.distance_km(p_lat, p_lng, s.latitude, s.longitude) <= p_rayon_km
    AND (p_type IS NULL OR s.type_boutique = p_type)
    AND (
      p_texte IS NULL
      OR btrim(p_texte) = ''
      OR public.sans_accent(s.nom) LIKE '%' || public.sans_accent(btrim(p_texte)) || '%'
      OR public.sans_accent(s.metier) LIKE '%' || public.sans_accent(btrim(p_texte)) || '%'
      OR public.sans_accent(s.description_prestation) LIKE '%' || public.sans_accent(btrim(p_texte)) || '%'
    )
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$function$;
