-- Retour arrière du masquage de 7 offres de test (31/10/2026) : remet les valeurs d'origine (is_active = true, updated_at d'avant).
-- Même garde : exactement 7 lignes, sinon tout est annulé.
BEGIN;

DO $$
DECLARE
  v_touchees integer;
BEGIN
  UPDATE public.job_offers o
     SET is_active = true,
         updated_at = v.ancien_updated_at
    FROM (VALUES
      ('3178ebd8-8d9f-4031-bfdb-e63e875ddb4e'::uuid, '2026-07-30T01:50:24.032162+00:00'::timestamptz),
      ('efd3bba7-0dee-48cb-9e1a-58e9d61123eb'::uuid, '2026-07-30T02:31:53.971321+00:00'::timestamptz),
      ('570d09a0-4f1e-48d0-807c-13ddea3b4a98'::uuid, '2026-07-30T20:37:18.26209+00:00'::timestamptz),
      ('859eb6bb-2ae2-427e-91df-248432240a48'::uuid, '2026-07-30T20:40:49.768635+00:00'::timestamptz),
      ('964fb82a-ac52-4809-8b19-9da032ef4c70'::uuid, '2026-08-07T17:25:37.028317+00:00'::timestamptz),
      ('121a8297-99d1-4a4c-9f70-165b5dc0941d'::uuid, '2026-08-07T17:27:10.667523+00:00'::timestamptz),
      ('c2b3e26c-aa21-44a9-9bb4-9f10422d27ca'::uuid, '2026-08-11T00:42:38.97952+00:00'::timestamptz)
    ) AS v(id, ancien_updated_at)
   WHERE o.id = v.id
     AND o.is_active = false;
  GET DIAGNOSTICS v_touchees = ROW_COUNT;
  IF v_touchees <> 7 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 7', v_touchees;
  END IF;
END
$$;

COMMIT;
