-- Retour arrière de la publication de l'offre ESMT (31/10/2026) : MASQUE (is_active = false), ne supprime rien. Garde : exactement 1 ligne.
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers SET is_active = false WHERE id = 'ea794a5e-3784-4e00-84a8-cbabf32a25e4' AND is_active = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 1', v_n;
  END IF;
END
$$;

COMMIT;
