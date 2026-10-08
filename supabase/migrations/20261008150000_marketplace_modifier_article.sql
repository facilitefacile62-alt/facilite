-- ---------------------------------------------------------------------------
-- Modifier un article publié (titre, catégorie, prix, quantité, description,
-- photos)
-- ---------------------------------------------------------------------------
-- Bug signalé : la modification d'un article (ex. changer le prix) depuis le
-- site échouait toujours avec « permission denied for table
-- marketplace_items ». Cause : src/lib/marketplaceData.js#modifierArticle
-- faisait un .update() direct sur la table depuis le client — aucune policy
-- RLS n'autorise d'UPDATE direct (invariant 1 : aucune table n'accorde
-- jamais INSERT/UPDATE/DELETE à authenticated/anon), et aucune fonction
-- SECURITY DEFINER n'existait pour cette écriture précise (seules la
-- création, l'ajustement du stock et le retrait en avaient une — voir
-- publier_mon_article / maj_stock_article / retirer_mon_article,
-- 20260901220000_marketplace_ecritures.sql et
-- 20260902240000_boutiques_multiples.sql). Cette migration ajoute la
-- fonction manquante, même patron que les autres écritures du domaine :
-- appartenance revérifiée ici (jamais supposée), jamais de GRANT direct sur
-- la table.
CREATE OR REPLACE FUNCTION public.modifier_mon_article(
  p_id          UUID,
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
  v_moi UUID := auth.uid();
  v_row public.marketplace_items;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  IF btrim(coalesce(p_titre, '')) = '' THEN
    RAISE EXCEPTION 'Le titre est obligatoire.';
  END IF;

  UPDATE public.marketplace_items i
  SET titre       = btrim(p_titre),
      categorie   = p_categorie,
      prix_xof    = greatest(0, coalesce(p_prix, 0)),
      quantite    = greatest(0, coalesce(p_quantite, 0)),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      photos      = coalesce(p_photos, '[]'::jsonb),
      updated_at  = now()
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

REVOKE ALL ON FUNCTION public.modifier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB) TO authenticated;
