-- =====================================================================
-- Comptes e2e-test-*/demo-*/qa-test-* tous role='admin' — trouvé le
-- 2026-08-06 en construisant tests/security/cv-quota.spec.js, confirmé
-- systémique le 2026-08-07 : 24 comptes is_test_account=true en base,
-- TOUS role='admin' (100%), y compris des comptes explicitement nommés
-- "candidat" (demo-candidat-1..10) qui n'ont par construction aucune
-- raison d'avoir un accès administrateur complet.
--
-- Origine probable, sans certitude absolue (aucun journal d'audit DDL
-- disponible pour trancher définitivement) : supabase/seed.sql porte son
-- propre avertissement — "Prévu pour un environnement LOCAL... À NE PAS
-- lancer contre le projet lié en production" — et référence encore
-- profiles.role, colonne supprimée depuis (confirmé absente aujourd'hui).
-- Ces comptes existent pourtant bien dans la base de PRODUCTION liée avec
-- les UUID exacts de seed.sql : le fichier a donc été exécuté contre
-- production au moins une fois, malgré son propre avertissement contraire.
-- La correspondance exacte entre le mécanisme de bascule et 'admin'
-- spécifiquement n'a pas pu être reconstituée avec certitude.
--
-- Rôle cible par compte, déterminé par lecture exhaustive de tests/ (pas
-- deviné) : seul e2e-test-admin est réellement utilisé comme persona admin
-- dans TOUS les tests (grep sur ADMIN_EMAIL) ; e2e-test-agent est utilisé
-- explicitement comme PUBLISHER_EMAIL (tests/e2e/badge-privilege-escalation.spec.js).
-- Aucun autre compte n'est jamais utilisé comme admin nulle part.
-- =====================================================================

UPDATE public.user_roles SET role = 'publisher'
WHERE user_id = '40000000-0000-4000-a000-000000000002'; -- e2e-test-agent

UPDATE public.user_roles SET role = 'user'
WHERE user_id IN (
  '30000000-0000-4000-a000-000000000001', -- e2e-test-candidate
  '40000000-0000-4000-a000-000000000003', -- e2e-test-security
  'dd0dafdc-4e07-4d87-8f1d-b6ec77352815',  -- qa-test-confirm-after-login
  'c077d736-0444-4bf0-810f-ed9d81395ee5',  -- qa-test-confirm2
  '90000000-0000-4000-a000-000000000001',  -- test-fictif-1
  '90000000-0000-4000-a000-000000000002',  -- test-fictif-2
  '90000000-0000-4000-a000-000000000003',  -- test-fictif-3
  '90000000-0000-4000-a000-000000000010',  -- demo-candidat-1
  '90000000-0000-4000-a000-000000000011',  -- demo-candidat-2
  '90000000-0000-4000-a000-000000000012',  -- demo-candidat-3
  '90000000-0000-4000-a000-000000000013',  -- demo-candidat-4
  '90000000-0000-4000-a000-000000000014',  -- demo-candidat-5
  '90000000-0000-4000-a000-000000000015',  -- demo-candidat-6
  '90000000-0000-4000-a000-000000000016',  -- demo-candidat-7
  '90000000-0000-4000-a000-000000000017',  -- demo-candidat-8
  '90000000-0000-4000-a000-000000000018',  -- demo-candidat-9
  '90000000-0000-4000-a000-000000000019',  -- demo-candidat-10
  '90000000-0000-4000-a000-000000000099',  -- demo.investisseur (garde son badge verified_recruiter, vérifié séparément)
  '00000000-0000-4000-a000-000000000001',  -- demo.senetech (idem)
  '00000000-0000-4000-a000-000000000002',  -- demo.dakardigital (idem)
  '00000000-0000-4000-a000-000000000003',  -- demo.terangaconsulting (idem)
  'a729afb9-d8b7-41f9-84c0-e8fd207f8706'    -- facilitefacile@gmail.com, is_test_account=true
);

-- e2e-test-admin (40000000-...-000001) : INCHANGÉ, reste admin — c'est le
-- seul compte réellement utilisé comme persona admin dans tests/.
