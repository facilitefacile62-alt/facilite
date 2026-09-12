-- Liste structurée de métiers pour les boutiques type_boutique='service'
-- (remplace le champ texte libre côté formulaire, voir FormulaireBoutique) et
-- vérification admin des métiers réglementés (santé), même mécanisme déjà en
-- place pour categorie_etablissement IN ('sante','finance').
--
-- Aucun changement de schéma : `metier` (TEXT) et `verifie` (BOOLEAN)
-- existent déjà sur marketplace_stores depuis 20260909100000. Seules les
-- règles de VISIBILITÉ changent : une boutique service dont le métier est
-- Pharmacien/Infirmier(ère)/Sage-femme reste masquée du public tant que
-- verifie=false, exactement comme un établissement santé/finance non vérifié.
--
-- Ces chaînes DOIVENT rester identiques à METIERS_REGLEMENTES
-- (src/lib/marketplaceData.js) — toute nouvelle profession de santé ajoutée
-- ici doit l'être aussi côté client, jamais l'un sans l'autre.
--
-- rechercher_boutiques_proches est DROP puis CREATE (pas CREATE OR REPLACE) :
-- vérifié par introspection directe avant d'écrire cette migration que sa
-- définition réellement en production (13 colonnes, avatar_config en
-- dernière position) était en réalité celle de 20260910090000
-- (marketplace_avatar_config), PAS celle de 20260911220000
-- (marketplace_mode_horaires) qui ajoutait mode_horaires à la place —
-- cette dernière n'a semble-t-il jamais pris effet. Conséquence concrète
-- observée : chercherServicesEtEtablissements (marketplaceData.js) lit déjà
-- r.mode_horaires en plus de r.avatar_config, donc mode_horaires était
-- toujours undefined (repli silencieux sur "indiques") pour toute boutique
-- remontée par cette fonction — corrigé ici en gardant LES DEUX colonnes.
-- CREATE OR REPLACE FUNCTION échoue ("cannot change return type") dès qu'une
-- colonne de retour change ; DROP FUNCTION d'abord est le seul moyen fiable.

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
  mode_horaires           TEXT
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
    s.latitude, s.longitude, s.avatar_config, s.mode_horaires
  FROM public.marketplace_stores s
  WHERE s.type_boutique IN ('service', 'etablissement')
    AND s.actif = true
    -- Même verrou que la policy SELECT de marketplace_stores ci-dessous,
    -- répété ici car cette fonction SECURITY DEFINER contourne RLS.
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

-- ---------------------------------------------------------------------------
-- Policies RLS étendues au métier réglementé (même condition que ci-dessus)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "boutiques actives visibles de tous" ON public.marketplace_stores;
CREATE POLICY "boutiques actives visibles de tous" ON public.marketplace_stores
  FOR SELECT USING (
    (actif = true AND (
      verifie = true
      OR (
        (categorie_etablissement IS NULL OR categorie_etablissement NOT IN ('sante', 'finance'))
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
              (s.categorie_etablissement IS NULL OR s.categorie_etablissement NOT IN ('sante', 'finance'))
              AND (s.metier IS NULL OR s.metier NOT IN ('Pharmacien', 'Infirmier/Infirmière', 'Sage-femme'))
            )
          ))
          OR s.owner_id = auth.uid()
        )
    )
  );
