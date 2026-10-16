-- Refuser une position de livreur hors du Sénégal.
--
-- Constat (état des lieux de la livraison, 16/10/2026) : la route /api/marketplace/livraison-position
-- vérifie que la position est dans le Sénégal, mais la fonction en base ne vérifiait rien : un appel
-- direct pouvait enregistrer n'importe quelle coordonnée (ou NaN), diffusée ensuite en temps réel à
-- l'acheteur. Les mêmes limites que la route sont appliquées ici (latitude 12.2 à 16.8, longitude
-- -17.9 à -11.2).
--
-- La fonction est redéfinie à l'identique de 20261005140000, plus cette vérification.

CREATE OR REPLACE FUNCTION public.mettre_a_jour_position_livraison(
  p_commande_id UUID,
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION
)
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
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat = 'NaN'::double precision OR p_lng = 'NaN'::double precision
     OR p_lat NOT BETWEEN 12.2 AND 16.8 OR p_lng NOT BETWEEN -17.9 AND -11.2 THEN
    RAISE EXCEPTION 'Position hors du Sénégal : non enregistrée.';
  END IF;

  UPDATE public.marketplace_commandes
  SET livreur_position_lat = p_lat,
      livreur_position_lng = p_lng,
      livreur_position_maj_le = now()
  WHERE id = p_commande_id AND livreur_id = v_moi AND statut = 'en_livraison';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mettre_a_jour_position_livraison(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mettre_a_jour_position_livraison(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
