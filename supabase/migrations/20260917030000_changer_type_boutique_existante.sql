-- Autorise à changer le type_boutique (Produit / Service / Établissement)
-- d'une boutique déjà créée, depuis les réglages.
--
-- Jusqu'ici définitif dès la création (voir 20260909110000 : "changer le
-- type d'une boutique déjà référencée avec du stock ou des horaires
-- créerait un état incohérent"). Décision reconsidérée à la demande de
-- l'utilisateur : un vendeur ne sait pas toujours d'emblée si son activité
-- est un service ou un établissement physique, et une boutique créée en
-- 'produit' par défaut (avant l'ajout du choix de type, ou par erreur)
-- n'avait ensuite AUCUN moyen d'obtenir un onglet Service/Établissement
-- fonctionnel — l'onglet existait déjà dans l'interface (affiché pour
-- toutes les boutiques, quel que soit leur type) mais restait un
-- cul-de-sac silencieux : rien n'y était jamais enregistrable. Signalé par
-- l'utilisateur, bloquant avant une inauguration réelle imminente.
--
-- Même signature que 20260917020000, un seul paramètre ajouté EN FIN de
-- liste avec DEFAULT NULL (NULL = aucun changement de type demandé, donc
-- tous les appelants existants qui n'envoient pas ce paramètre gardent un
-- comportement strictement identique). Ajouter un paramètre change la
-- liste de types de la fonction : comme lors des deux incidents précédents
-- (20260909111000, 20260911223000), CREATE OR REPLACE ne remplace PAS
-- l'ancienne signature dans ce cas, il crée une seconde surcharge — d'où
-- le DROP explicite de l'ancienne signature à 9 paramètres en fin de
-- fichier.

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
  IF p_categorie_etablissement IS NOT NULL AND p_categorie_etablissement NOT IN ('point_wave', 'pharmacie', 'clinique', 'autre') THEN
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
      -- On quitte 'service' : le métier ne s'applique plus au nouveau
      -- type, on l'efface plutôt que de laisser une valeur fantôme.
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
                 -- Changer de type force une nouvelle vérification : sans
                 -- ça, une fiche déjà validée pourrait changer de nature
                 -- sans jamais repasser par l'écran admin.
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

DROP FUNCTION IF EXISTS public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
