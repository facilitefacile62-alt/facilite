-- Seed minimal pour les tests E2E sur facilite-e2e-test
-- Ces comptes correspondent à ceux attendus par la suite Playwright (tests/e2e/*, tests/security/*)

-- 0. GRANT USAGE sur le schéma public — sans lui, absolument rien n'est
-- accessible à anon/authenticated dans public, quels que soient les GRANTs
-- table/fonction ou les policies RLS en place. dump-schema-via-introspection.js
-- ne capture que les grants table/fonction/séquence, jamais ce grant au
-- niveau du schéma lui-même (pg_dump l'inclut normalement) — trouvé en
-- lançant la suite complète contre un schéma fraîchement importé (77/150
-- tests en échec, la quasi-totalité à cause de ce seul grant manquant).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 0bis. GRANTs de table — même trou que le GRANT USAGE ci-dessus,
-- dump-schema-via-introspection.js ne capture pas non plus les grants au
-- niveau table. Exportés depuis la production réelle (scripts/export-table-grants.js,
-- information_schema.role_table_grants + role_column_grants pour les UPDATE
-- restreints à des colonnes précises) le 2026-08-08 — reflète l'état APRÈS
-- les corrections Vague 1/2/3 de ce chantier (colonnes UPDATE restreintes),
-- pas l'état large d'avant. Ne pas élargir à la main : régénérer depuis la
-- prod si ça doit changer.
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."agent_assignments" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."agent_assignments" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."ai_usage_daily" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."ai_usage_daily" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."assistant_messages" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."assistant_messages" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."badge_requests" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."badge_requests" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."candidatures" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."candidatures" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."contact_messages" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."contact_messages" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."conversations" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."conversations" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."establishments" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."establishments" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."interviews" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."interviews" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."job_offers" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."job_offers" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."messages" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."messages" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."orders" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."orders" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."profiles" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."profiles" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."recruiter_profiles" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."recruiter_profiles" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."resumes" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."resumes" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."subscriptions" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."subscriptions" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."support_threads" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."support_threads" TO authenticated;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."transactions" TO anon;
GRANT INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."transactions" TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."security_logs" TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."security_logs" TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."user_roles" TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public."user_roles" TO authenticated;
GRANT SELECT ON TABLE public."invariant_status" TO authenticated;
GRANT SELECT ON TABLE public."reports" TO authenticated;
GRANT UPDATE ("agent_id", "completed_cv_url", "status") ON TABLE public."agent_assignments" TO authenticated;
GRANT UPDATE ("avatar_url", "bio", "city", "contact_email", "country", "cover_url", "cv_name", "cv_url", "cv_visible_recruteurs", "education_level", "educations", "email", "experiences", "full_name", "gender", "headline", "id", "interests", "is_public", "languages", "location", "phone", "pinned_details", "profile_views", "show_contact", "skills", "updated_at", "website_url") ON TABLE public."profiles" TO authenticated;
GRANT UPDATE ("banner_url", "company_name", "description", "location", "logo_url", "sector", "website") ON TABLE public."recruiter_profiles" TO authenticated;
GRANT UPDATE ("company", "contract_type", "deadline", "description", "image_url", "is_active", "location", "min_education_level", "salary_range", "title", "updated_at") ON TABLE public."job_offers" TO authenticated;
GRANT UPDATE ("content", "embedding", "status", "updated_at") ON TABLE public."resumes" TO authenticated;
GRANT UPDATE ("is_read") ON TABLE public."messages" TO authenticated;
GRANT UPDATE ("last_message", "updated_at") ON TABLE public."conversations" TO authenticated;
GRANT UPDATE ("payment_reference") ON TABLE public."orders" TO authenticated;
GRANT UPDATE ("provider_reference") ON TABLE public."transactions" TO authenticated;
GRANT UPDATE ("resolved_at", "resolved_by", "status") ON TABLE public."reports" TO authenticated;
GRANT UPDATE ("status") ON TABLE public."candidatures" TO authenticated;
GRANT UPDATE ("status", "updated_at") ON TABLE public."support_threads" TO authenticated;

-- 1. Insertion dans auth.users
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  -- Admin
  (
    '00000000-0000-0000-0000-000000000000',
    '40000000-0000-4000-a000-000000000001',
    'authenticated', 'authenticated',
    'e2e-test-admin@facilite-demo.local',
    crypt('FaciliteE2ETest2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"E2E Admin"}',
    now(), now(), '', '', '', ''
  ),
  -- Agent (Publisher)
  (
    '00000000-0000-0000-0000-000000000000',
    '40000000-0000-4000-a000-000000000002',
    'authenticated', 'authenticated',
    'e2e-test-agent@facilite-demo.local',
    crypt('FaciliteE2ETest2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"E2E Agent"}',
    now(), now(), '', '', '', ''
  ),
  -- Security / Recruiter
  (
    '00000000-0000-0000-0000-000000000000',
    '40000000-0000-4000-a000-000000000003',
    'authenticated', 'authenticated',
    'e2e-test-security@facilite-demo.local',
    crypt('FaciliteE2ETest2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"E2E Security"}',
    now(), now(), '', '', '', ''
  ),
  -- Candidate
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-a000-000000000001',
    'authenticated', 'authenticated',
    'e2e-test-candidate@facilite-demo.local',
    crypt('FaciliteE2ETest2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"E2E Candidate"}',
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Identités
INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now()
FROM auth.users u
WHERE u.email IN (
  'e2e-test-admin@facilite-demo.local',
  'e2e-test-agent@facilite-demo.local',
  'e2e-test-security@facilite-demo.local',
  'e2e-test-candidate@facilite-demo.local'
)
ON CONFLICT DO NOTHING;

-- 3. Mise à jour des rôles et statuts
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '40000000-0000-4000-a000-000000000001';
UPDATE public.user_roles SET role = 'publisher' WHERE user_id = '40000000-0000-4000-a000-000000000002';
UPDATE public.user_roles SET role = 'user' WHERE user_id IN ('40000000-0000-4000-a000-000000000003', '30000000-0000-4000-a000-000000000001');

-- Marquer comme comptes de test et vérifier les badges
UPDATE public.profiles
SET is_test_account = true, is_public = true
WHERE id IN (
  '40000000-0000-4000-a000-000000000001',
  '40000000-0000-4000-a000-000000000002',
  '40000000-0000-4000-a000-000000000003',
  '30000000-0000-4000-a000-000000000001'
);

-- Assigner les badges pour e2e-test-security (recruteur vérifié)
UPDATE public.profiles
SET recruiter_verified = true, badges = '["verified_recruiter"]'::jsonb
WHERE id = '40000000-0000-4000-a000-000000000003';

-- 4. Seed Incomplet: Offres d'emploi, Candidatures, et Profils candidats
-- Offre d'emploi fictive en statut approved
INSERT INTO public.job_offers (
  id, title, company, location, description, status, recruiter_id, is_test_account
) VALUES (
  '10000000-0000-4000-a000-000000000001',
  'Ing�nieur Logiciel E2E',
  'Facilite E2E Corp',
  'Dakar',
  'Description de test',
  'approved',
  '40000000-0000-4000-a000-000000000003',
  true
) ON CONFLICT (id) DO NOTHING;

-- Candidature fictive li�e � l'offre
INSERT INTO public.candidatures (
  id, user_id, job_offer_id, job_title, company, full_name, email, cv_url, recruiter_id, status
) VALUES (
  '20000000-0000-4000-a000-000000000001',
  '30000000-0000-4000-a000-000000000001',
  '10000000-0000-4000-a000-000000000001',
  'Ing�nieur Logiciel E2E',
  'Facilite E2E Corp',
  'E2E Candidate',
  'e2e-test-candidate@facilite-demo.local',
  'https://example.com/cv.pdf',
  '40000000-0000-4000-a000-000000000003',
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- Profil candidat avec cv_visible_recruteurs=true ET is_test_account=true
UPDATE public.profiles
SET cv_visible_recruteurs = true, is_test_account = true
WHERE id = '30000000-0000-4000-a000-000000000001';
