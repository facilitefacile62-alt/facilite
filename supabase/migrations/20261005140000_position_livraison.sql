-- Suivi de position du livreur (Point 9/12 du chantier « livraison
-- Marketplace ») : premier champ de position VRAIMENT mutable en continu de
-- ce dépôt — toutes les autres positions (boutique, activité établissement)
-- sont verrouillées après un premier relevé. Ici, le livreur bouge pendant
-- toute la durée d'une livraison, la colonne doit donc être réécrite à
-- chaque tick, uniquement pendant que statut='en_livraison'.
--
-- Diffusée à l'acheteur côté frontend via Supabase Realtime sur
-- marketplace_commandes (déjà ajoutée à la publication, migration
-- 20261005100000) — aucun mécanisme supplémentaire nécessaire ici, la RLS
-- SELECT existante filtre déjà qui reçoit quoi.

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
