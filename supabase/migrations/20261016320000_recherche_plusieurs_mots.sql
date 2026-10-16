-- Recherche Marketplace : plusieurs mots, dans n'importe quel ordre (suite de 20261016280000).
--
-- Constat (audit, 16/10/2026) : la recherche par photo (et toute saisie de plusieurs mots) cherchait la
-- PHRASE entière comme un seul bloc : « Crème Hydratante Visage Bio 200ml » ne correspondait à aucun
-- produit. Désormais chaque mot doit être présent, sans accents ni majuscules, dans le produit
-- (titre, description, catégorie) ou le nom de la boutique. Fonctions redéfinies à l'identique de
-- 20261016280000, sauf cette condition.

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
      OR NOT EXISTS (
        SELECT 1 FROM unnest(string_to_array(public.sans_accent(btrim(p_texte)), ' ')) AS mot
        WHERE mot IS DISTINCT FROM ''
          AND public.sans_accent(i.titre || ' ' || coalesce(i.description, '') || ' ' || coalesce(i.categorie, '') || ' ' || s.nom) NOT LIKE '%' || mot || '%'
      )
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
      OR NOT EXISTS (
        SELECT 1 FROM unnest(string_to_array(public.sans_accent(btrim(p_texte)), ' ')) AS mot
        WHERE mot IS DISTINCT FROM ''
          AND public.sans_accent(s.nom || ' ' || coalesce(s.metier, '') || ' ' || coalesce(s.description_prestation, '')) NOT LIKE '%' || mot || '%'
      )
    )
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$function$;
