-- Logo (photo) d'une boutique, choisi par son propriétaire dans l'application.
--
-- Avant : une boutique n'avait aucune image à elle (l'avatar « Bitmoji » de la carte est un autre champ).
-- Maintenant : `logo_photo` garde le CHEMIN de l'image dans le bucket public « marketplace-photos » (même
-- convention que les photos d'articles : {id du vendeur}/….jpg) ; l'application en déduit l'URL publique.
--
-- Aucune écriture directe (invariant 1) : la colonne ne se modifie que par definir_logo_ma_boutique, qui
-- vérifie que la boutique appartient bien à l'appelant ET que l'image est rangée dans son propre dossier
-- (un vendeur ne peut pas pointer vers le fichier d'un autre).

ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS logo_photo TEXT
  CHECK (logo_photo IS NULL OR char_length(logo_photo) <= 300);

CREATE OR REPLACE FUNCTION public.definir_logo_ma_boutique(p_store_id UUID, p_logo TEXT)
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
  IF p_logo IS NOT NULL AND (char_length(p_logo) > 300 OR p_logo NOT LIKE v_moi::text || '/%') THEN
    RAISE EXCEPTION 'Image de logo invalide.';
  END IF;

  UPDATE public.marketplace_stores
  SET logo_photo = p_logo
  WHERE id = p_store_id AND owner_id = v_moi;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_logo_ma_boutique(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_logo_ma_boutique(UUID, TEXT) TO authenticated;
