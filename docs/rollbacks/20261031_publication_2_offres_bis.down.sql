-- Retour arrière de la publication des 2 offres supplémentaires (31/10/2026) : MASQUE (is_active = false), ne supprime rien. Garde : exactement 2 lignes.
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers
     SET is_active = false
   WHERE id IN ('b11d6e36-0816-4428-840c-9a744d93df43', '3ebfd875-1baa-474f-a88b-f42a7ae215f5')
     AND is_active = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 2', v_n;
  END IF;
END
$$;

COMMIT;
