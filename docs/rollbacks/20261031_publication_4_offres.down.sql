-- Retour arrière de la publication des 5 offres (31/10/2026) : MASQUE les offres (is_active = false), ne supprime rien. Garde : exactement 5 lignes.
-- Pour les remettre en ligne ensuite : UPDATE public.job_offers SET is_active = true WHERE id IN (les mêmes identifiants).
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers
     SET is_active = false
   WHERE id IN (
     'cf0f37d1-3930-4b80-97c5-5307d739bad4',
     'c7c8d329-1804-4956-a84d-ce5acd99b2d3',
     'b994aa8d-fe88-46df-8c46-cae606354d97',
     'd0568439-14da-4950-b460-67bf9f3ddea1',
     '5df5b944-5e1c-47e5-ae65-624475289a1a'
   )
     AND is_active = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 5', v_n;
  END IF;
END
$$;

COMMIT;
