-- Retour arrière de la publication de l'offre ANPEJ – Écomobilité (02/11/2026) : MASQUE (is_active = false), ne supprime rien. Garde : exactement 1 ligne.
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers SET is_active = false WHERE id = '33cfe28e-b147-474c-8ee4-862ca524df8f' AND is_active = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 1', v_n;
  END IF;
END
$$;

COMMIT;
