-- Retour arrière de la publication de l'offre GINDI (31/10/2026) : MASQUE (is_active = false), ne supprime rien. Garde : exactement 1 ligne.
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers SET is_active = false WHERE id = '63de30e0-943c-4d06-b97e-22496c22611d' AND is_active = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 1', v_n;
  END IF;
END
$$;

COMMIT;
