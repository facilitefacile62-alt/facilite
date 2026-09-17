-- Remplace les catégories d'établissement génériques (Santé/Finance/Beauté/
-- Autre) par des types concrets et reconnaissables : Point Wave / Pharmacie /
-- Clinique / Autre — alignés sur le vocabulaire déjà utilisé par
-- /mon-activite (src/lib/activiteData.js, TYPES_ACTIVITE), un système
-- entièrement séparé (table profiles, pas marketplace_stores) mais qui
-- décrit les mêmes réalités de terrain. Décision utilisateur : renommer
-- uniquement côté Marketplace, ne pas fusionner les deux systèmes.
--
-- Aucune ligne existante ne porte de valeur categorie_etablissement à ce
-- jour (vérifié par introspection avant d'écrire cette migration : 0
-- boutique de type 'etablissement' en production) — changement de valeurs
-- sans migration de données, contrairement à un renommage a posteriori.
--
-- categorie_etablissement n'avait jusqu'ici AUCUNE contrainte CHECK en base
-- (validation seulement côté client) : on en ajoute une, par la même
-- occasion.
--
-- Les catégories sensibles (nécessitant vérification admin avant d'être
-- visibles du public) étaient 'sante' et 'finance' — elles deviennent
-- 'pharmacie', 'clinique' (santé) et 'point_wave' (agent financier), mêmes
-- règles, nouveaux noms. Répercuté dans modifier_ma_boutique,
-- rechercher_boutiques_proches et les deux policies RLS qui référencent
-- cette liste (marketplace_stores, marketplace_horaires).

ALTER TABLE public.marketplace_stores
  ADD CONSTRAINT marketplace_stores_categorie_etablissement_check
    CHECK (categorie_etablissement IS NULL OR categorie_etablissement = ANY (
      ARRAY['point_wave'::text, 'pharmacie'::text, 'clinique'::text, 'autre'::text]
    ));

COMMENT ON COLUMN public.marketplace_stores.categorie_etablissement IS
  'Catégorie pour type_boutique = ''etablissement'' : ''point_wave'' | ''pharmacie'' | ''clinique'' | ''autre''. '
  '''pharmacie''/''clinique''/''point_wave'' sont sensibles : fiche masquée du public jusqu''à vérification admin (verifie=true).';

-- 1. modifier_ma_boutique — même signature que 20260911220000, seul le
-- contenu du CASE verifie change (sante/finance -> pharmacie/clinique/point_wave).
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
  IF p_mode_horaires IS NOT NULL AND p_mode_horaires NOT IN ('indiques', 'toujours_ouvert', 'sur_rendez_vous', 'manuel') THEN
    RAISE EXCEPTION 'Mode d''horaires invalide.';
  END IF;
  IF p_categorie_etablissement IS NOT NULL AND p_categorie_etablissement NOT IN ('point_wave', 'pharmacie', 'clinique', 'autre') THEN
    RAISE EXCEPTION 'Catégorie d''établissement invalide.';
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
                      AND p_categorie_etablissement IN ('pharmacie', 'clinique', 'point_wave')
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

-- 2. rechercher_boutiques_proches — même 15 colonnes que 20260912040000
-- (celle réellement active en production, confirmée par introspection
-- directe avant d'écrire cette migration : owner_id en dernière position,
-- absent de la version antérieure 20260912010000), seul le NOT IN change.
DROP FUNCTION IF EXISTS public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER);

CREATE FUNCTION public.rechercher_boutiques_proches(
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_rayon_km  DOUBLE PRECISION DEFAULT 10,
  p_texte     TEXT DEFAULT NULL,
  p_type      TEXT DEFAULT NULL,
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
      OR s.nom ILIKE '%' || btrim(p_texte) || '%'
      OR s.metier ILIKE '%' || btrim(p_texte) || '%'
      OR s.description_prestation ILIKE '%' || btrim(p_texte) || '%'
    )
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$$;

REVOKE ALL ON FUNCTION public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_boutiques_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER) TO anon, authenticated;

-- 3. Policies RLS — même condition mise à jour.
DROP POLICY IF EXISTS "boutiques actives visibles de tous" ON public.marketplace_stores;
CREATE POLICY "boutiques actives visibles de tous" ON public.marketplace_stores
  FOR SELECT USING (
    (actif = true AND (
      verifie = true
      OR (
        (categorie_etablissement IS NULL OR categorie_etablissement NOT IN ('pharmacie', 'clinique', 'point_wave'))
        AND (metier IS NULL OR metier NOT IN ('Pharmacien', 'Infirmier/Infirmière', 'Sage-femme'))
      )
    ))
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "horaires visibles si boutique visible" ON public.marketplace_horaires;
CREATE POLICY "horaires visibles si boutique visible" ON public.marketplace_horaires
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = marketplace_horaires.store_id
        AND (
          (s.actif = true AND (
            s.verifie = true
            OR (
              (s.categorie_etablissement IS NULL OR s.categorie_etablissement NOT IN ('pharmacie', 'clinique', 'point_wave'))
              AND (s.metier IS NULL OR s.metier NOT IN ('Pharmacien', 'Infirmier/Infirmière', 'Sage-femme'))
            )
          ))
          OR s.owner_id = auth.uid()
        )
    )
  );
