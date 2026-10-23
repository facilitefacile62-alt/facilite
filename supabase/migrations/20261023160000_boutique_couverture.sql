-- Photo de couverture d'une boutique, choisie par son propriétaire dans l'application et visible par les visiteurs de la boutique.
--
-- Même convention et mêmes garde-fous que le logo (20261018140000_boutique_logo.sql) : `cover_photo` garde le CHEMIN de l'image dans le
-- bucket public « marketplace-photos » ({id du vendeur}/….jpg) ; aucune écriture directe (invariant 1), la colonne ne se modifie que par
-- definir_couverture_ma_boutique, qui vérifie que la boutique appartient à l'appelant ET que l'image est dans son propre dossier.

ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS cover_photo TEXT
  CHECK (cover_photo IS NULL OR char_length(cover_photo) <= 300);

CREATE OR REPLACE FUNCTION public.definir_couverture_ma_boutique(p_store_id UUID, p_cover TEXT)
RETURNS VOID
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
  IF p_cover IS NOT NULL AND (char_length(p_cover) > 300 OR p_cover NOT LIKE v_moi::text || '/%') THEN
    RAISE EXCEPTION 'Image de couverture invalide.';
  END IF;

  UPDATE public.marketplace_stores
  SET cover_photo = p_cover
  WHERE id = p_store_id AND owner_id = v_moi;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_couverture_ma_boutique(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_couverture_ma_boutique(UUID, TEXT) TO authenticated;
