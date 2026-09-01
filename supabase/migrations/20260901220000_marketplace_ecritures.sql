-- Marketplace : écritures par fonctions, lectures par GRANT SELECT.
--
-- POURQUOI CETTE MIGRATION EXISTE
--
-- La 20260901190000 a créé les tables et leurs policies RLS, mais aucun GRANT :
-- sans privilège de table, `authenticated` se heurtait à « permission denied
-- for table marketplace_stores » quelles que soient les policies. Les policies
-- filtrent des lignes ; elles n'accordent pas l'accès à la table.
--
-- Le réflexe serait d'ajouter GRANT INSERT/UPDATE/DELETE à authenticated. Ce
-- dépôt ne le fait nulle part : la liste blanche de l'invariant 1
-- (tests/security/invariants.spec.js) est VIDE, aucune table n'accorde UPDATE
-- ou DELETE à authenticated ni à anon. Toutes les écritures passent par des
-- fonctions SECURITY DEFINER qui vérifient elles-mêmes l'appartenance.
--
-- On s'aligne : SELECT ouvert (la RLS filtre les lignes visibles), écritures
-- par quatre fonctions. Les policies d'écriture déjà posées sont conservées —
-- elles ne servent plus au chemin nominal, mais restent une seconde barrière
-- si un GRANT était ajouté par erreur un jour.

GRANT SELECT ON public.marketplace_stores TO anon, authenticated;
GRANT SELECT ON public.marketplace_items  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Créer ou mettre à jour SA boutique
-- ---------------------------------------------------------------------------
-- Une seule boutique par personne pour l'instant : le second appel met à jour
-- la première. Le jour où un commerçant tiendra deux échoppes, cette fonction
-- prendra un identifiant en paramètre — pas avant, faute de cas réel.
CREATE OR REPLACE FUNCTION public.enregistrer_ma_boutique(
  p_nom      TEXT,
  p_quartier TEXT DEFAULT NULL,
  p_ville    TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.marketplace_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_stores;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF btrim(coalesce(p_nom, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de la boutique est obligatoire.';
  END IF;

  SELECT * INTO v_row FROM public.marketplace_stores WHERE owner_id = v_moi LIMIT 1;

  IF FOUND THEN
    UPDATE public.marketplace_stores
    SET nom = btrim(p_nom),
        quartier = nullif(btrim(coalesce(p_quartier, '')), ''),
        ville = nullif(btrim(coalesce(p_ville, '')), ''),
        telephone_whatsapp = nullif(btrim(coalesce(p_whatsapp, '')), ''),
        latitude = p_lat,
        longitude = p_lng
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.marketplace_stores
      (owner_id, nom, quartier, ville, telephone_whatsapp, latitude, longitude)
    VALUES (
      v_moi, btrim(p_nom),
      nullif(btrim(coalesce(p_quartier, '')), ''),
      nullif(btrim(coalesce(p_ville, '')), ''),
      nullif(btrim(coalesce(p_whatsapp, '')), ''),
      p_lat, p_lng
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ---------------------------------------------------------------------------
-- Publier un article dans SA boutique
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publier_mon_article(
  p_titre       TEXT,
  p_categorie   TEXT,
  p_prix        INTEGER,
  p_quantite    INTEGER DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_photos      JSONB DEFAULT '[]'::jsonb
)
RETURNS public.marketplace_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi   UUID := auth.uid();
  v_store UUID;
  v_row   public.marketplace_items;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  -- La boutique n'est jamais choisie par l'appelant : elle est déduite de son
  -- identité. Accepter un store_id en paramètre rouvrirait exactement la
  -- brèche que la fonction est censée fermer.
  SELECT id INTO v_store FROM public.marketplace_stores WHERE owner_id = v_moi LIMIT 1;
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Créez d''abord votre boutique.';
  END IF;

  INSERT INTO public.marketplace_items
    (store_id, titre, description, categorie, prix_xof, quantite, photos)
  VALUES (
    v_store, btrim(p_titre),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_categorie,
    greatest(0, coalesce(p_prix, 0)),
    greatest(0, coalesce(p_quantite, 0)),
    coalesce(p_photos, '[]'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.publier_mon_article(TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_mon_article(TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- Réactualiser le stock
-- ---------------------------------------------------------------------------
-- Le geste le plus fréquent du vendeur, et celui dont dépend la confiance de
-- l'acheteur : `updated_at` est reposé par le trigger, ce qui alimente le
-- « stock confirmé il y a 20 min » affiché sur la fiche.
CREATE OR REPLACE FUNCTION public.maj_stock_article(p_id UUID, p_quantite INTEGER)
RETURNS public.marketplace_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_items;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  UPDATE public.marketplace_items i
  SET quantite = greatest(0, coalesce(p_quantite, 0))
  WHERE i.id = p_id
    AND EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = i.store_id AND s.owner_id = v_moi
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article introuvable ou hors de votre boutique.';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.maj_stock_article(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maj_stock_article(UUID, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Retirer un article
-- ---------------------------------------------------------------------------
-- Désactivation, pas suppression : l'annonce sort des recherches mais la ligne
-- reste, ce qui permet de la remettre en vente et de garder une trace en cas
-- de litige avec un acheteur.
CREATE OR REPLACE FUNCTION public.retirer_mon_article(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  UPDATE public.marketplace_items i
  SET actif = false
  WHERE i.id = p_id
    AND EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = i.store_id AND s.owner_id = v_moi
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.retirer_mon_article(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirer_mon_article(UUID) TO authenticated;
