-- Ajoute 4 nouvelles catégories d'établissement (Banque et finance, Hôtellerie,
-- Gares et transport, Arrêts et stations de bus), demandées à la suite de
-- 20260925120000 — même principe : elles s'AJOUTENT à la liste existante,
-- ne remplacent rien. point_wave/pharmacie/clinique restent les seules
-- catégories sensibles à vérification admin obligatoire.
--
-- "Restaurant" et "Alimentation" (également demandés dans ce tour) ne
-- nécessitent aucune nouvelle valeur : déjà couverts par
-- restaurant/fast_food/dibiterie et alimentation_boutique/boulangerie/
-- patisserie (20260925120000).
--
-- Granularité volontairement à 4 catégories, pas la centaine de
-- sous-catégories fournies en contexte par l'utilisateur (banque, microfinance,
-- bureau de change, hôtel, auberge, gare routière, arrêt BRT, terminus...) —
-- même niveau de détail que la migration précédente et que la barre de
-- filtres visée (une poignée de pastilles, pas une liste de 100+ entrées).

ALTER TABLE public.marketplace_stores
  DROP CONSTRAINT IF EXISTS marketplace_stores_categorie_etablissement_check;

ALTER TABLE public.marketplace_stores
  ADD CONSTRAINT marketplace_stores_categorie_etablissement_check
    CHECK (categorie_etablissement IS NULL OR categorie_etablissement = ANY (
      ARRAY[
        'point_wave'::text, 'pharmacie'::text, 'clinique'::text, 'autre'::text,
        'restaurant'::text, 'fast_food'::text, 'malibu'::text, 'dibiterie'::text,
        'jus_boissons'::text, 'boulangerie'::text, 'patisserie'::text,
        'beignet_fataya'::text, 'barber'::text, 'tresses'::text, 'parfumerie'::text,
        'esthetique_ongles'::text, 'soins_bio'::text, 'musculation_fitness'::text,
        'terrain_foot'::text, 'terrain_basket'::text, 'alimentation_boutique'::text,
        'cafe_the'::text,
        'banque_finance'::text, 'hotellerie'::text, 'transport_gare'::text,
        'bus_mobilite'::text
      ]
    ));

COMMENT ON COLUMN public.marketplace_stores.categorie_etablissement IS
  'Catégorie pour type_boutique = ''etablissement''. Sensibles (fiche masquée du '
  'public jusqu''à vérification admin, verifie=true) : ''point_wave'' | ''pharmacie'' | '
  '''clinique''. Non sensibles, publication immédiate : ''autre'', ''restaurant'', '
  '''fast_food'', ''malibu'', ''dibiterie'', ''jus_boissons'', ''boulangerie'', '
  '''patisserie'', ''beignet_fataya'', ''barber'', ''tresses'', ''parfumerie'', '
  '''esthetique_ongles'', ''soins_bio'', ''musculation_fitness'', ''terrain_foot'', '
  '''terrain_basket'', ''alimentation_boutique'', ''cafe_the'', ''banque_finance'', '
  '''hotellerie'', ''transport_gare'', ''bus_mobilite''.';

-- modifier_ma_boutique : même signature à 10 paramètres, liste NOT IN
-- resynchronisée avec la contrainte CHECK ci-dessus.
CREATE OR REPLACE FUNCTION public.modifier_ma_boutique(
  p_id                      UUID,
  p_nom                     TEXT,
  p_quartier                TEXT DEFAULT NULL,
  p_ville                   TEXT DEFAULT NULL,
  p_whatsapp                TEXT DEFAULT NULL,
  p_metier                  TEXT DEFAULT NULL,
  p_description_prestation TEXT DEFAULT NULL,
  p_categorie_etablissement TEXT DEFAULT NULL,
  p_mode_horaires           TEXT DEFAULT NULL,
  p_type_boutique           TEXT DEFAULT NULL
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi         UUID := auth.uid();
  v_row         public.marketplace_stores;
  v_type_avant  TEXT;
  v_type        TEXT;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;
  IF p_mode_horaires IS NOT NULL AND p_mode_horaires NOT IN ('indiques', 'toujours_ouvert', 'sur_rendez_vous', 'manuel') THEN
    RAISE EXCEPTION 'Mode d''horaires invalide.';
  END IF;
  IF p_categorie_etablissement IS NOT NULL AND p_categorie_etablissement NOT IN (
    'point_wave', 'pharmacie', 'clinique', 'autre',
    'restaurant', 'fast_food', 'malibu', 'dibiterie', 'jus_boissons', 'boulangerie',
    'patisserie', 'beignet_fataya', 'barber', 'tresses', 'parfumerie',
    'esthetique_ongles', 'soins_bio', 'musculation_fitness', 'terrain_foot',
    'terrain_basket', 'alimentation_boutique', 'cafe_the',
    'banque_finance', 'hotellerie', 'transport_gare', 'bus_mobilite'
  ) THEN
    RAISE EXCEPTION 'Catégorie d''établissement invalide.';
  END IF;
  IF p_type_boutique IS NOT NULL AND p_type_boutique NOT IN ('produit', 'service', 'etablissement') THEN
    RAISE EXCEPTION 'Type de boutique invalide.';
  END IF;

  SELECT type_boutique INTO v_type_avant
  FROM public.marketplace_stores WHERE id = p_id AND owner_id = v_moi;
  IF v_type_avant IS NULL THEN RAISE EXCEPTION 'Boutique introuvable.'; END IF;

  v_type := coalesce(p_type_boutique, v_type_avant);

  UPDATE public.marketplace_stores
  SET nom = btrim(p_nom),
      quartier = nullif(btrim(coalesce(p_quartier, '')), ''),
      ville = nullif(btrim(coalesce(p_ville, '')), ''),
      telephone_whatsapp = nullif(btrim(coalesce(p_whatsapp, '')), ''),
      type_boutique = v_type,
      metier = CASE WHEN v_type = 'service'
                 THEN nullif(btrim(coalesce(p_metier, '')), '')
                 WHEN v_type_avant = 'service'
                 THEN NULL
                 ELSE metier END,
      description_prestation = CASE WHEN v_type = 'service'
                 THEN nullif(btrim(coalesce(p_description_prestation, '')), '')
                 WHEN v_type_avant = 'service'
                 THEN NULL
                 ELSE description_prestation END,
      categorie_etablissement = CASE WHEN v_type = 'etablissement'
                 THEN nullif(btrim(coalesce(p_categorie_etablissement, '')), '')
                 WHEN v_type_avant = 'etablissement'
                 THEN NULL
                 ELSE categorie_etablissement END,
      mode_horaires = CASE WHEN v_type = 'etablissement' AND p_mode_horaires IS NOT NULL
                 THEN p_mode_horaires
                 ELSE mode_horaires END,
      verifie = CASE
                 WHEN v_type IS DISTINCT FROM v_type_avant THEN false
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

REVOKE ALL ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
