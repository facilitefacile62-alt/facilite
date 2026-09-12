-- Partie E : "Envoyer un message" (messagerie interne Facilité) sur une
-- fiche boutique/article de la Marketplace. Le mécanisme de conversation
-- existe déjà et n'est pas dupliqué ici (resolveConversationWith /
-- findOrCreateConversation, src/lib/messages.js, déjà utilisé par la
-- vitrine recruteur via /messagerie?recipient=<userId>) — il ne manquait
-- que l'identifiant du propriétaire de la boutique dans les résultats de
-- recherche marketplace, jamais sélectionné jusqu'ici (seul
-- chargerMesBoutiques/obtenirBoutiqueParId, en SELECT *, l'exposait déjà).
--
-- DROP puis CREATE (pas CREATE OR REPLACE) : changement du type de retour,
-- même contrainte déjà documentée dans
-- 20260912010000_marketplace_metiers_reglementes.sql. Nouvelle colonne
-- ajoutée en dernière position dans les deux fonctions, pour ne rien
-- réordonner d'existant.

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
  boutique_avatar_config  JSONB,
  boutique_owner_id       UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
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
      OR i.titre ILIKE '%' || btrim(p_texte) || '%'
      OR i.description ILIKE '%' || btrim(p_texte) || '%'
    )
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC,
           i.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$$;
REVOKE ALL ON FUNCTION public.rechercher_articles_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_articles_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, BOOLEAN, INTEGER) TO anon, authenticated;

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
  avatar_config           JSONB,
  mode_horaires           TEXT,
  owner_id                UUID
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
    s.latitude, s.longitude, s.avatar_config, s.mode_horaires, s.owner_id
  FROM public.marketplace_stores s
  WHERE s.type_boutique IN ('service', 'etablissement')
    AND s.actif = true
    AND (
      s.verifie = true
      OR (
        (s.categorie_etablissement IS NULL OR s.categorie_etablissement NOT IN ('sante', 'finance'))
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
      OR s.nom ILIKE '%' || btrim(p_texte) || '%'
      OR s.metier ILIKE '%' || btrim(p_texte) || '%'
      OR s.description_prestation ILIKE '%' || btrim(p_texte) || '%'
    )
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$$;
REVOKE ALL ON FUNCTION public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER) TO anon, authenticated;
