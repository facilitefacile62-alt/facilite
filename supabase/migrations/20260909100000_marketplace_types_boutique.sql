-- Extension du Marketplace au-delà de la vente de produits : boutiques de
-- type 'service' (métier freelance, ex. plombier — pas de stock, pas de
-- marketplace_items) et 'etablissement' (clinique, salon, point Wave... —
-- horaires d'ouverture, vérification manuelle obligatoire pour les
-- catégories sensibles avant apparition publique).
--
-- Aucune migration de données : DEFAULT 'produit' sur type_boutique, donc
-- toutes les boutiques existantes (uniquement des vendeurs de produits à ce
-- jour) continuent de fonctionner exactement comme avant, sans changement
-- de comportement pour elles.

-- ---------------------------------------------------------------------------
-- 1. Nouvelles colonnes sur marketplace_stores
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS type_boutique TEXT NOT NULL DEFAULT 'produit'
    CHECK (type_boutique IN ('produit', 'service', 'etablissement'));

-- Service : pas de table séparée pour deux champs texte seulement (moins de
-- jointures pour un cas d'usage simple — table séparée réservée à
-- marketplace_horaires, qui a une vraie relation un-à-plusieurs).
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS metier TEXT,
  ADD COLUMN IF NOT EXISTS description_prestation TEXT;

-- Établissement. categorie_etablissement est volontairement TEXT libre (pas
-- de CHECK IN (...) exhaustif) : la demande initiale ne donne les valeurs
-- ('sante', 'finance', 'beaute', 'autre') qu'à titre d'exemple, et une
-- nouvelle catégorie ne doit pas nécessiter une migration. Seules 'sante' et
-- 'finance' sont réellement des CONSTANTES exploitées par le code (policy
-- RLS ci-dessous + fonction rechercher_boutiques_proches) : elles doivent
-- rester exactement ces deux chaînes partout où elles apparaissent.
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS categorie_etablissement TEXT,
  ADD COLUMN IF NOT EXISTS verifie BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.marketplace_stores.verifie IS
  'Pertinent uniquement quand categorie_etablissement IN (''sante'', ''finance'') : '
  'tant que false, la fiche est invisible du public (voir policy SELECT et '
  'rechercher_boutiques_proches). Ignoré pour les autres types/catégories, qui '
  'restent publiés immédiatement comme avant cette migration.';

-- ---------------------------------------------------------------------------
-- 2. marketplace_horaires — une ligne par jour de la semaine par boutique
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_horaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  -- 0 = dimanche ... 6 = samedi (convention ISO/JS Date.getDay()), une seule
  -- ligne par jour et par boutique.
  jour_semaine    SMALLINT NOT NULL CHECK (jour_semaine BETWEEN 0 AND 6),
  heure_ouverture TIME,
  heure_fermeture TIME,
  ferme_ce_jour   BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (store_id, jour_semaine)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_horaires_store ON public.marketplace_horaires(store_id);

ALTER TABLE public.marketplace_horaires ENABLE ROW LEVEL SECURITY;

-- Visible dans les mêmes conditions que la boutique elle-même (même logique
-- que marketplace_items vis-à-vis de marketplace_stores) : actif + pas
-- caché par le verrou de vérification, ou propriétaire.
CREATE POLICY "horaires visibles si boutique visible" ON public.marketplace_horaires
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = marketplace_horaires.store_id
        AND (
          (s.actif = true AND (
            s.categorie_etablissement IS NULL
            OR s.categorie_etablissement NOT IN ('sante', 'finance')
            OR s.verifie = true
          ))
          OR s.owner_id = auth.uid()
        )
    )
  );

-- Policies d'écriture gardées par cohérence (même schéma qu'ailleurs dans le
-- Marketplace) mais sans portée pratique : comme pour marketplace_stores/
-- marketplace_items, aucun GRANT INSERT/UPDATE/DELETE n'est donné à
-- authenticated/anon plus bas — toute écriture passe par
-- enregistrer_mes_horaires (SECURITY DEFINER), qui revérifie la même
-- condition de propriété.
CREATE POLICY "un vendeur gere ses horaires" ON public.marketplace_horaires
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = marketplace_horaires.store_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = marketplace_horaires.store_id AND s.owner_id = auth.uid())
  );

GRANT SELECT ON public.marketplace_horaires TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policy SELECT de marketplace_stores : ajoute le verrou de vérification
-- ---------------------------------------------------------------------------
-- Remplace la policy de 20260901190000_marketplace_reelle.sql — même
-- condition qu'avant (actif = true OR owner_id = auth.uid()), avec en plus
-- le verrou : un établissement 'sante'/'finance' non vérifié n'est visible
-- que de son propriétaire, même si actif = true.
DROP POLICY IF EXISTS "boutiques actives visibles de tous" ON public.marketplace_stores;
CREATE POLICY "boutiques actives visibles de tous" ON public.marketplace_stores
  FOR SELECT USING (
    (actif = true AND (
      categorie_etablissement IS NULL
      OR categorie_etablissement NOT IN ('sante', 'finance')
      OR verifie = true
    ))
    OR owner_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 4. rechercher_boutiques_proches — pendant de rechercher_articles_proches
--    pour les boutiques SANS article (service/etablissement). Nécessaire :
--    rechercher_articles_proches part de marketplace_items, donc une
--    boutique sans aucun article y est structurellement invisible, quel que
--    soit son statut. Même schéma que rechercher_articles_proches
--    (SECURITY DEFINER, filtre manuel car RLS contournée) pour rester
--    cohérent avec le reste du Marketplace.
-- ---------------------------------------------------------------------------
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
  longitude               DOUBLE PRECISION
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
    s.latitude, s.longitude
  FROM public.marketplace_stores s
  WHERE s.type_boutique IN ('service', 'etablissement')
    AND s.actif = true
    -- Même verrou que la policy SELECT ci-dessus, répété ici car cette
    -- fonction SECURITY DEFINER contourne RLS.
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

-- ---------------------------------------------------------------------------
-- 5. enregistrer_mes_horaires — écriture des horaires par le propriétaire
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.enregistrer_mes_horaires(p_store_id UUID, p_horaires JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner UUID;
  v_item  JSONB;
BEGIN
  SELECT owner_id INTO v_owner FROM public.marketplace_stores WHERE id = p_store_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez modifier que les horaires de votre propre boutique.';
  END IF;

  DELETE FROM public.marketplace_horaires WHERE store_id = p_store_id;

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

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_mes_horaires(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_mes_horaires(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. moderate_marketplace_store — vérification admin des établissements
--    sensibles. Même schéma que moderate_job_offer
--    (20260803040000_moderation_et_suspension.sql) : préfixe "moderate_"
--    délibéré, il matche déjà le motif /moderat/i que
--    tests/security/invariants.spec.js utilise pour repérer automatiquement
--    les fonctions critiques de modération — inutile de modifier ce
--    fichier de test pour que l'Invariant 13 couvre cette fonction.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.moderate_marketplace_store(p_store_id UUID, p_decision TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Décision invalide.';
  END IF;

  IF p_decision = 'approved' THEN
    UPDATE public.marketplace_stores SET verifie = true WHERE id = p_store_id;
  ELSE
    -- Rejeté : ni vérifié, ni publié tel quel — désactivé plutôt que
    -- supprimé, pour que le vendeur retrouve son brouillon et puisse le
    -- corriger avant de redemander une vérification.
    UPDATE public.marketplace_stores SET verifie = false, actif = false WHERE id = p_store_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_marketplace_store(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_marketplace_store(UUID, TEXT) TO authenticated;
