-- Disponibilité manuelle instantanée d'une boutique Service/Établissement —
-- distincte des horaires programmés (mode_horaires 'indiques'/'toujours_ouvert'/
-- 'sur_rendez_vous', déjà existants) : un prestataire (livreur, électricien...)
-- peut basculer "Disponible maintenant" / "Indisponible" en un clic, sans passer
-- par une grille horaire. Nouveau mode 'manuel' : le statut affiché suit alors
-- disponible_manuel plutôt que la grille de marketplace_horaires.

ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS disponible_manuel BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.marketplace_stores.disponible_manuel IS
  'Bascule manuelle "Disponible maintenant" — n''a d''effet visible que si mode_horaires = ''manuel''.';

ALTER TABLE public.marketplace_stores DROP CONSTRAINT marketplace_stores_mode_horaires_check;
ALTER TABLE public.marketplace_stores ADD CONSTRAINT marketplace_stores_mode_horaires_check
  CHECK (mode_horaires = ANY (ARRAY['indiques'::text, 'toujours_ouvert'::text, 'sur_rendez_vous'::text, 'manuel'::text]));

-- Bascule dédiée, séparée de enregistrer_mes_horaires/modifier_ma_boutique :
-- un simple appui sur "Disponible maintenant" ne doit ni réinitialiser les
-- horaires déjà configurés (DELETE FROM marketplace_horaires côté
-- enregistrer_mes_horaires) ni exiger de repasser par le formulaire complet.
CREATE OR REPLACE FUNCTION public.definir_disponibilite_boutique(
  p_store_id UUID,
  p_disponible BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.marketplace_stores WHERE id = p_store_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez modifier que la disponibilité de votre propre boutique.';
  END IF;

  UPDATE public.marketplace_stores
  SET mode_horaires = 'manuel',
      disponible_manuel = coalesce(p_disponible, true)
  WHERE id = p_store_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_disponibilite_boutique(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_disponibilite_boutique(UUID, BOOLEAN) TO authenticated;
