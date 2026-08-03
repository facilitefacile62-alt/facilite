-- Étape D du chantier (2026-08-03) : verified_recruiter va conditionner
-- TOUT l'espace /recruteur (RLS + middleware), plus seulement la CVthèque.
-- Audit préalable (voir rapport du chantier) : 5 comptes 'user' sans badge
-- perdraient l'accès à des offres/candidatures existantes — aucun n'est
-- marqué is_test_account, donc aucun n'est couvert par le mode démo à venir
-- (Étape E). Décision validée par l'opérateur : badger les 5 avant bascule,
-- plutôt que de couper l'accès à du contenu réel/démo déjà en place.
-- Action administrative ponctuelle, pas un contournement de la demande de
-- badge normale (badge_requests/approve_badge_request) — journalisée
-- explicitement ci-dessous pour ne pas laisser de trou dans l'audit trail.

UPDATE public.profiles
SET badges = CASE
  WHEN badges @> '["verified_recruiter"]'::jsonb THEN badges
  ELSE badges || '["verified_recruiter"]'::jsonb
END
WHERE id IN (
  'a729afb9-d8b7-41f9-84c0-e8fd207f8706', -- facilitefacile@gmail.com — compte réel, 4 offres actives
  '00000000-0000-4000-a000-000000000001', -- demo.senetech — 11 offres, 57 candidatures
  '00000000-0000-4000-a000-000000000002', -- demo.dakardigital — 2 offres
  '00000000-0000-4000-a000-000000000003', -- demo.terangaconsulting — 2 offres
  '30000000-0000-4000-a000-000000000001'  -- e2e-test-candidate — débris de tests, badgé pour continuité des specs existantes
);

DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN SELECT unnest(ARRAY[
    'a729afb9-d8b7-41f9-84c0-e8fd207f8706',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003',
    '30000000-0000-4000-a000-000000000001'
  ]::uuid[])
  LOOP
    PERFORM public.log_security_event(
      'badge_approved', 'info', NULL, uid,
      jsonb_build_object('badge', 'verified_recruiter', 'reason', 'Bascule gate badge espace recruteur (Étape D) — compte préexistant à préserver, hors flux badge_requests normal')
    );
  END LOOP;
END $$;
