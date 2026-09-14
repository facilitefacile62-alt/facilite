-- Confidentialité Marketplace (côté vendeur) : jusqu'ici, marketplace_stores.actif
-- existait déjà et gate réellement l'affichage (chargerTousLesArticles,
-- rechercher_boutiques_proches, etc. filtrent tous sur actif = true), mais
-- aucune fonction ne permettait au vendeur de le faire varier lui-même —
-- seule la création (creer_ma_boutique, actif = true par défaut) l'écrivait.
-- Ajouté pour la nouvelle section "Confidentialité" des Réglages Marketplace
-- (14/09/2026, demande utilisateur : séparer la confidentialité "achat/vente"
-- de celle du profil candidat sur /profil, gérée indépendamment).
--
-- Fonction dédiée plutôt qu'un paramètre de plus sur modifier_ma_boutique :
-- même esprit que modifier_mon_avatar_boutique (voir 20260910090000) — un nom
-- de RPC neuf pour une préoccupation distincte, jamais un paramètre optionnel
-- de plus sur une fonction déjà large.
CREATE OR REPLACE FUNCTION public.definir_visibilite_boutique(p_id UUID, p_actif BOOLEAN)
RETURNS public.marketplace_stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_stores;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  UPDATE public.marketplace_stores
  SET actif = p_actif
  WHERE id = p_id AND owner_id = v_moi
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Boutique introuvable.';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_visibilite_boutique(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_visibilite_boutique(UUID, BOOLEAN) TO authenticated;
