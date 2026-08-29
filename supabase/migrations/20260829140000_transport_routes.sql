-- Lignes de transport de Dakar : référentiel interrogeable par l'assistant.
--
-- Objet : répondre « comment aller à X depuis là où je suis » avec des lignes
-- RÉELLEMENT enregistrées, jamais inventées par le modèle. Toute la valeur du
-- dispositif tient à cette contrainte : un itinéraire plausible mais faux
-- envoie quelqu'un attendre un bus qui n'existe pas.
--
-- Choix de conception, tranchés le 2026-08-29 :
--
--  * Haversine en SQL plutôt que PostGIS. À l'échelle de Dakar — quelques
--    centaines d'arrêts — le calcul trigonométrique direct suffit largement,
--    et il évite d'installer une extension qu'il faudrait ensuite maintenir.
--
--  * Les arrêts vivent dans une colonne `arrets` en jsonb, pas dans une table
--    fille. Une ligne de transport se lit et s'édite d'un bloc ; séparer les
--    arrêts imposerait une jointure à chaque lecture et un formulaire à deux
--    niveaux côté admin pour un gain nul à cette échelle.
--
--  * Saisie par les administrateurs uniquement. Aucune colonne de statut ni
--    de modération : elles seraient vides et donneraient l'illusion d'un
--    circuit de validation inexistant. À ajouter le jour où des utilisateurs
--    proposeront des lignes, pas avant.
--
--  * ÉCRITURE PAR FONCTION, PAS PAR POLICY. L'invariant 1
--    (tests/security/invariants.spec.js) interdit tout GRANT UPDATE/DELETE à
--    `authenticated`, avec une liste blanche volontairement vide. Accorder ces
--    droits pour les administrateurs le ferait passer au rouge. Les écritures
--    passent donc par deux fonctions SECURITY DEFINER qui vérifient le rôle
--    elles-mêmes — même patron que livrer_document (20260828210000). La
--    lecture, elle, reste une policy RLS ordinaire.

CREATE TABLE IF NOT EXISTS public.transport_routes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode          TEXT NOT NULL CHECK (mode IN ('tata', 'ter', 'brt', 'vtc', 'car_rapide')),
  ligne         TEXT,
  operateur     TEXT,
  origine       TEXT NOT NULL,
  destination   TEXT NOT NULL,
  -- [{ "nom": "Petersen", "lat": 14.6731, "lng": -17.4406, "ordre": 1 }, …]
  -- L'ordre est porté par le champ plutôt que par la position dans le tableau :
  -- réordonner un arrêt dans le formulaire ne doit pas dépendre d'un tri
  -- implicite que rien ne garantit après un aller-retour JSON.
  arrets        JSONB NOT NULL DEFAULT '[]'::jsonb,
  zones         TEXT[] NOT NULL DEFAULT '{}',
  tarif_min     INTEGER CHECK (tarif_min IS NULL OR tarif_min >= 0),
  tarif_max     INTEGER CHECK (tarif_max IS NULL OR tarif_max >= 0),
  description   TEXT,
  actif         BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tarifs_coherents CHECK (tarif_min IS NULL OR tarif_max IS NULL OR tarif_min <= tarif_max)
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_mode_actif ON public.transport_routes (mode, actif);
CREATE INDEX IF NOT EXISTS idx_transport_routes_zones ON public.transport_routes USING GIN (zones);

ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;

-- Lecture publique des lignes actives : un candidat doit pouvoir consulter
-- l'information sans compte, comme pour les offres d'emploi.
DROP POLICY IF EXISTS "Lecture publique des lignes actives" ON public.transport_routes;
CREATE POLICY "Lecture publique des lignes actives"
  ON public.transport_routes FOR SELECT
  USING (actif = true);

-- Un administrateur voit aussi les lignes désactivées, pour pouvoir les
-- réactiver depuis la Banque d'information.
DROP POLICY IF EXISTS "Un admin lit toutes les lignes" ON public.transport_routes;
CREATE POLICY "Un admin lit toutes les lignes"
  ON public.transport_routes FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Distance à vol d'oiseau, formule de Haversine.
-- ---------------------------------------------------------------------------
-- IMMUTABLE à juste titre, contrairement à normaliser_niveau_etudes : cette
-- fonction ne lit aucune table, elle ne dépend que de ses arguments.
CREATE OR REPLACE FUNCTION public.distance_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 6371 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Recherche d'itinéraires.
-- ---------------------------------------------------------------------------
-- Renvoie les lignes actives dont un arrêt est proche du point de départ ET
-- qui mènent vers la destination cherchée. Le rapprochement sur la destination
-- accepte trois formes, parce qu'un utilisateur nomme indifféremment un
-- terminus, un quartier ou un arrêt intermédiaire.
CREATE OR REPLACE FUNCTION public.rechercher_itineraires(
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
  distance_km       DOUBLE PRECISION
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
    SELECT DISTINCT ON (p.id) p.id, p.arret, p.d
    FROM proches p
    WHERE p.d <= p_rayon_km
    ORDER BY p.id, p.d ASC
  )
  SELECT
    r.id, r.mode, r.ligne, r.operateur, r.origine, r.destination,
    r.zones, r.tarif_min, r.tarif_max, r.description,
    m.arret, m.d
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

-- ---------------------------------------------------------------------------
-- Écriture réservée aux administrateurs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_ligne_transport(
  p_id          UUID,
  p_mode        TEXT,
  p_ligne       TEXT,
  p_operateur   TEXT,
  p_origine     TEXT,
  p_destination TEXT,
  p_arrets      JSONB,
  p_zones       TEXT[],
  p_tarif_min   INTEGER,
  p_tarif_max   INTEGER,
  p_description TEXT,
  p_actif       BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_id    UUID;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF coalesce(btrim(p_origine), '') = '' OR coalesce(btrim(p_destination), '') = '' THEN
    RAISE EXCEPTION 'Origine et destination sont obligatoires.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.transport_routes
      (mode, ligne, operateur, origine, destination, arrets, zones,
       tarif_min, tarif_max, description, actif, created_by)
    VALUES
      (p_mode, p_ligne, p_operateur, btrim(p_origine), btrim(p_destination),
       coalesce(p_arrets, '[]'::jsonb), coalesce(p_zones, '{}'),
       p_tarif_min, p_tarif_max, p_description, coalesce(p_actif, true), v_admin)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.transport_routes SET
      mode = p_mode,
      ligne = p_ligne,
      operateur = p_operateur,
      origine = btrim(p_origine),
      destination = btrim(p_destination),
      arrets = coalesce(p_arrets, '[]'::jsonb),
      zones = coalesce(p_zones, '{}'),
      tarif_min = p_tarif_min,
      tarif_max = p_tarif_max,
      description = p_description,
      actif = coalesce(p_actif, true),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Ligne de transport introuvable.';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_ligne_transport(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT[], INTEGER, INTEGER, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_ligne_transport(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT[], INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.supprimer_ligne_transport(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_id    UUID;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  DELETE FROM public.transport_routes WHERE id = p_id RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.supprimer_ligne_transport(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supprimer_ligne_transport(UUID) TO authenticated;
