-- Retour arrière de la publication de l'offre FHI 360 (01/11/2026) : MASQUE (is_active = false), ne supprime rien. Garde : exactement 1 ligne.
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers SET is_active = false WHERE id = '5629089e-b877-4dba-8433-7350e5005b5e' AND is_active = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 1', v_n;
  END IF;
END
$$;

COMMIT;
