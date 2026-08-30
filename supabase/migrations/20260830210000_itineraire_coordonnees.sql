-- Coordonnées des arrêts dans les résultats d'itinéraire.
--
-- rechercher_itineraires renvoyait le NOM de l'arrêt le plus proche et la
-- distance à pied, mais aucune coordonnée. C'était suffisant pour une réponse
-- en texte ; ça ne permet pas de dessiner quoi que ce soit. Impossible, avec
-- ces seules colonnes, de placer un point sur une carte.
--
-- On ajoute donc trois sorties :
--   * arret_lat / arret_lng : où se trouve l'arrêt le plus proche ;
--   * arrets                : le tracé complet de la ligne, pour relier les
--                             points entre eux.
--
-- Ces données sont déjà publiques (transport_routes.arrets est lisible par
-- policy) : la fonction n'expose rien de neuf, elle cesse simplement de jeter
-- ce qu'elle avait déjà lu pour calculer la distance.
--
-- DROP puis CREATE, et non CREATE OR REPLACE : PostgreSQL refuse de remplacer
-- une fonction dont le type de retour change.

DROP FUNCTION IF EXISTS public.rechercher_itineraires(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, INTEGER);

CREATE FUNCTION public.rechercher_itineraires(
  p_destination TEXT,
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION,
  p_mode        TEXT DEFAULT NULL,
  p_rayon_km    DOUBLE PRECISION DEFAULT 5,
  p_limite      INTEGER DEFAULT 10
)
RETURNS TABLE (
  id                UUID,
  mode              TEXT,
  ligne             TEXT,
  operateur         TEXT,
  origine           TEXT,
  destination       TEXT,
  zones             TEXT[],
  tarif_min         INTEGER,
  tarif_max         INTEGER,
  description       TEXT,
  arret_le_plus_proche TEXT,
  distance_km       DOUBLE PRECISION,
  arret_lat         DOUBLE PRECISION,
  arret_lng         DOUBLE PRECISION,
  arrets            JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH cible AS (
    SELECT '%' || btrim(coalesce(p_destination, '')) || '%' AS motif
  ),
  proches AS (
    SELECT
      r.id,
      a.value ->> 'nom' AS arret,
      (a.value ->> 'lat')::double precision AS lat,
      (a.value ->> 'lng')::double precision AS lng,
      public.distance_km(
        p_lat, p_lng,
        (a.value ->> 'lat')::double precision,
        (a.value ->> 'lng')::double precision
      ) AS d
    FROM public.transport_routes r
    CROSS JOIN LATERAL jsonb_array_elements(r.arrets) AS a(value)
    WHERE r.actif = true
      -- Un arrêt sans coordonnées ne peut pas servir au calcul : on l'ignore
      -- plutôt que de laisser le cast échouer et faire tomber la requête.
      AND (a.value ->> 'lat') IS NOT NULL
      AND (a.value ->> 'lng') IS NOT NULL
  ),
  meilleur_arret AS (
    SELECT DISTINCT ON (p.id) p.id, p.arret, p.d, p.lat, p.lng
    FROM proches p
    WHERE p.d <= p_rayon_km
    ORDER BY p.id, p.d ASC
  )
  SELECT
    r.id, r.mode, r.ligne, r.operateur, r.origine, r.destination,
    r.zones, r.tarif_min, r.tarif_max, r.description,
    m.arret, m.d, m.lat, m.lng, r.arrets
  FROM public.transport_routes r
  JOIN meilleur_arret m ON m.id = r.id
  CROSS JOIN cible c
  WHERE r.actif = true
    AND (p_mode IS NULL OR r.mode = p_mode)
    AND (
      r.destination ILIKE c.motif
      OR r.origine ILIKE c.motif
      OR EXISTS (SELECT 1 FROM unnest(r.zones) z WHERE z ILIKE c.motif)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.arrets) a
        WHERE a.value ->> 'nom' ILIKE c.motif
      )
    )
  ORDER BY m.d ASC
  LIMIT greatest(1, least(coalesce(p_limite, 10), 25));
$$;

REVOKE ALL ON FUNCTION public.rechercher_itineraires(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_itineraires(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, INTEGER) TO anon, authenticated;
