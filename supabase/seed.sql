-- Données de démonstration pour la vitrine recruteur (recruiter_profiles +
-- job_offers). Idempotent : UUID fixes + ON CONFLICT partout, ré-exécutable
-- sans dupliquer quoi que ce soit.
--
-- ⚠️ Ce fichier crée de vrais comptes auth.users (déclenchant le trigger
-- handle_new_user() -> profiles avec role='recruteur'). Adresses e-mail sous
-- @facilite-demo.local (TLD invalide, ne peut jamais entrer en collision
-- avec un vrai utilisateur) pour rester facilement identifiables/purgeables.
-- Prévu pour un environnement local (`supabase db reset` / `supabase start`,
-- qui l'exécute automatiquement) — À NE PAS lancer contre le projet lié en
-- production sans le vouloir explicitement (ex.
-- `supabase db execute --linked -f supabase/seed.sql`), sous peine
-- d'injecter ces comptes et offres factices dans la vraie base.

-- =============================================================================
-- 1. Comptes recruteurs de démonstration (auth.users -> profiles via trigger)
-- =============================================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000001',
    'authenticated', 'authenticated',
    'demo.senetech@facilite-demo.local',
    crypt('FaciliteDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"recruteur","full_name":"SeneTech Solutions"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000002',
    'authenticated', 'authenticated',
    'demo.dakardigital@facilite-demo.local',
    crypt('FaciliteDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"recruteur","full_name":"Dakar Digital Agency"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000003',
    'authenticated', 'authenticated',
    'demo.terangaconsulting@facilite-demo.local',
    crypt('FaciliteDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"recruteur","full_name":"Teranga Consulting"}',
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- Identité de connexion locale (auth.identities) — requise par GoTrue pour
-- que ces comptes soient réellement utilisables via signInWithPassword,
-- pas seulement présents en base.
-- email est une colonne générée (dérivée de identity_data->>'email' dans
-- cette version de Supabase) : ne pas l'insérer explicitement.
INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now()
FROM auth.users u
WHERE u.email IN (
  'demo.senetech@facilite-demo.local',
  'demo.dakardigital@facilite-demo.local',
  'demo.terangaconsulting@facilite-demo.local'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. Profils vitrine (recruiter_profiles)
-- =============================================================================

INSERT INTO public.recruiter_profiles (
  id, user_id, company_name, sector, location, logo_url, banner_url, description, website
) VALUES
  (
    '10000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000001',
    'SeneTech Solutions',
    'Technologies & Développement Logiciel',
    'Dakar, Sénégal',
    'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=256&h=256&fit=crop',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=400&fit=crop',
    E'SeneTech Solutions est une entreprise sénégalaise spécialisée dans le développement logiciel sur mesure, le conseil en transformation digitale et l\'intégration de solutions cloud pour les entreprises d\'Afrique de l\'Ouest.\n\nNous accompagnons nos clients dans la conception d\'applications web et mobiles robustes, avec une équipe d\'ingénieurs passionnés basée à Dakar.',
    'www.senetech-solutions.sn'
  ),
  (
    '10000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000002',
    'Dakar Digital Agency',
    'Marketing Digital & Communication',
    'Dakar, Sénégal',
    'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=256&h=256&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop',
    E'Dakar Digital Agency accompagne les marques sénégalaises et internationales dans leur stratégie de communication digitale : gestion de réseaux sociaux, création de contenu, campagnes publicitaires et référencement.\n\nUne équipe créative et data-driven au service de la visibilité de nos clients.',
    'www.dakardigital.sn'
  ),
  (
    '10000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000003',
    'Teranga Consulting',
    'Conseil en Ressources Humaines',
    'Dakar, Sénégal',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&h=256&fit=crop',
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&h=400&fit=crop',
    E'Teranga Consulting est un cabinet de conseil en ressources humaines et en recrutement, dédié à connecter les talents sénégalais avec les meilleures opportunités professionnelles du pays.\n\nNous proposons également des services d\'accompagnement RH, de formation et de gestion de carrière pour les entreprises et les candidats.',
    'www.terangaconsulting.sn'
  )
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  sector = EXCLUDED.sector,
  location = EXCLUDED.location,
  logo_url = EXCLUDED.logo_url,
  banner_url = EXCLUDED.banner_url,
  description = EXCLUDED.description,
  website = EXCLUDED.website,
  updated_at = now();

-- =============================================================================
-- 3. Affiches d'emploi (job_offers) — 2 à 3 par recruteur, niveaux variés,
--    dates limites dans le futur (interval depuis now() pour rester valide
--    quelle que soit la date d'exécution du script).
-- =============================================================================

INSERT INTO public.job_offers (
  id, recruiter_id, title, company, location, contract_type, salary_range,
  min_education_level, description, image_url, is_active, deadline, created_at
) VALUES
  (
    '20000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000001',
    'Développeur Full-Stack React / Node.js',
    'SeneTech Solutions',
    'Dakar, Sénégal',
    'CDI',
    '450 000 - 650 000 FCFA / mois',
    'Licence',
    E'Nous recherchons un développeur full-stack expérimenté pour renforcer notre équipe technique.\n\nMissions :\n- Développement d\'applications web avec React et Node.js\n- Intégration d\'API REST et de bases de données PostgreSQL\n- Participation aux revues de code et à l\'amélioration continue\n\nCompétences clés : JavaScript/TypeScript, React, Node.js, PostgreSQL, Git.',
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop',
    true,
    (now() + interval '45 days')::date,
    now()
  ),
  (
    '20000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000001',
    'Ingénieur DevOps Cloud',
    'SeneTech Solutions',
    'Dakar, Sénégal',
    'CDI',
    '600 000 - 800 000 FCFA / mois',
    'Master',
    E'Rejoignez notre équipe infrastructure pour automatiser et sécuriser nos déploiements cloud.\n\nMissions :\n- Gestion de l\'infrastructure AWS/GCP\n- Mise en place de pipelines CI/CD\n- Supervision et amélioration de la fiabilité des services\n\nCompétences clés : Docker, Kubernetes, Terraform, CI/CD, Linux.',
    'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&h=600&fit=crop',
    true,
    (now() + interval '30 days')::date,
    now()
  ),
  (
    '20000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000002',
    'Chargé(e) de Community Management',
    'Dakar Digital Agency',
    'Dakar, Sénégal',
    'CDD',
    '250 000 - 350 000 FCFA / mois',
    'BAC',
    E'Vous serez en charge de l\'animation des réseaux sociaux de nos clients et de la création de contenus engageants.\n\nMissions :\n- Planification et publication de contenus\n- Veille et analyse des tendances digitales\n- Reporting de performance mensuel\n\nCompétences clés : Réseaux sociaux, Canva/CapCut, sens créatif, rédaction.',
    'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&h=600&fit=crop',
    true,
    (now() + interval '20 days')::date,
    now()
  ),
  (
    '20000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000002',
    'Chef de Projet Marketing Digital',
    'Dakar Digital Agency',
    'Dakar, Sénégal',
    'CDI',
    '500 000 - 700 000 FCFA / mois',
    'Master',
    E'Pilotez des projets de communication digitale pour nos clients grands comptes, de la stratégie à l\'exécution.\n\nMissions :\n- Élaboration de stratégies digitales sur mesure\n- Coordination des équipes créatives et techniques\n- Suivi budgétaire et reporting client\n\nCompétences clés : Gestion de projet, marketing digital, leadership, anglais professionnel.',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
    true,
    (now() + interval '60 days')::date,
    now()
  ),
  (
    '20000000-0000-4000-a000-000000000005',
    '00000000-0000-4000-a000-000000000003',
    'Chargé(e) de Recrutement',
    'Teranga Consulting',
    'Dakar, Sénégal',
    'CDI',
    '350 000 - 500 000 FCFA / mois',
    'Licence',
    E'Accompagnez nos clients dans leurs recrutements, du sourcing à l\'intégration des candidats.\n\nMissions :\n- Sourcing et présélection de candidats\n- Conduite d\'entretiens\n- Suivi de la relation client et candidat\n\nCompétences clés : Recrutement, relationnel, organisation, outils RH.',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=600&fit=crop',
    true,
    (now() + interval '25 days')::date,
    now()
  ),
  (
    '20000000-0000-4000-a000-000000000006',
    '00000000-0000-4000-a000-000000000003',
    'Assistant(e) Administratif(ve) RH',
    'Teranga Consulting',
    'Dakar, Sénégal',
    'Stage',
    '100 000 - 150 000 FCFA / mois',
    'BAC',
    E'Une opportunité de stage idéale pour découvrir les métiers RH au sein d\'un cabinet de conseil dynamique.\n\nMissions :\n- Appui administratif aux consultants RH\n- Gestion des dossiers candidats\n- Participation à l\'organisation d\'événements recrutement\n\nCompétences clés : Rigueur, sens de l\'organisation, bon relationnel.',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
    true,
    (now() + interval '15 days')::date,
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  contract_type = EXCLUDED.contract_type,
  salary_range = EXCLUDED.salary_range,
  min_education_level = EXCLUDED.min_education_level,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  is_active = EXCLUDED.is_active,
  deadline = EXCLUDED.deadline,
  updated_at = now();

-- =============================================================================
-- 4. Comptes de test back-office (admin + agent) pour tests E2E
--    (tests/e2e/admin-and-candidate.spec.js). Le trigger handle_new_user()
--    force toujours 'candidat' pour un rôle hors candidat/recruteur au
--    signup — le rôle admin/agent est donc affecté ici par un UPDATE direct
--    (exécuté en migration/seed, hors contexte PostgREST : le trigger
--    anti-escalade prevent_role_self_escalation ne s'applique qu'aux
--    requêtes authentifiées via auth.role(), absent ici).
-- =============================================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '40000000-0000-4000-a000-000000000001',
    'authenticated', 'authenticated',
    'e2e-test-admin@facilite-demo.local',
    crypt('FaciliteE2ETest2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"candidat","full_name":"Admin E2E Test"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '40000000-0000-4000-a000-000000000002',
    'authenticated', 'authenticated',
    'e2e-test-agent@facilite-demo.local',
    crypt('FaciliteE2ETest2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"candidat","full_name":"Agent E2E Test"}',
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now()
FROM auth.users u
WHERE u.email IN ('e2e-test-admin@facilite-demo.local', 'e2e-test-agent@facilite-demo.local')
ON CONFLICT DO NOTHING;

UPDATE public.profiles SET role = 'admin' WHERE id = '40000000-0000-4000-a000-000000000001';
UPDATE public.profiles SET role = 'agent' WHERE id = '40000000-0000-4000-a000-000000000002';

-- =============================================================================
-- 5. Commande accompagnée "payée" de démonstration, pour que le workflow
--    d'attribution agent (tests/e2e/admin-and-candidate.spec.js) ait un
--    dossier "unassigned" réel à traiter. Rattachée au candidat de test créé
--    par une session précédente (e2e-test-candidate@facilite-demo.local) —
--    ON CONFLICT DO NOTHING si ce candidat n'existe pas encore dans cet
--    environnement, la commande est simplement ignorée sans erreur.
-- =============================================================================

INSERT INTO public.orders (
  id, user_id, cv_model_id, has_agent_option, amount, currency,
  payment_status, payment_method, payment_reference, created_at, updated_at
)
SELECT
  '50000000-0000-4000-a000-000000000001',
  id, 'modern', true, 2000, 'XOF', 'paid', 'card', 'qa-e2e-agent-flow-001', now(), now()
FROM public.profiles WHERE email = 'e2e-test-candidate@facilite-demo.local'
ON CONFLICT (id) DO UPDATE SET payment_status = 'paid';

-- DO UPDATE (pas DO NOTHING) : remet le dossier à "unassigned" à chaque
-- ré-exécution, pour que le test d'attribution reste rejouable même après
-- qu'un run précédent l'ait fait avancer vers in_progress/completed.
INSERT INTO public.agent_assignments (id, order_id, candidate_id, status, agent_id, completed_cv_url)
SELECT '50000000-0000-4000-a000-000000000002', '50000000-0000-4000-a000-000000000001', id, 'unassigned', NULL, NULL
FROM public.profiles WHERE email = 'e2e-test-candidate@facilite-demo.local'
ON CONFLICT (id) DO UPDATE SET status = 'unassigned', agent_id = NULL, completed_cv_url = NULL;

-- =============================================================================
-- 6. Compte de test dédié à l'onglet Sécurité du profil
--    (tests/e2e/security-profile.spec.js). Isolé des autres comptes de démo
--    pour que les tests de changement de mot de passe/dissociation ne
--    perturbent jamais un compte utilisé ailleurs. Email uniquement (pas de
--    téléphone) : la confirmation téléphone dépend d'un provider SMS non
--    configurable depuis ce script — voir le composant SecurityTabContent.jsx.
-- =============================================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '40000000-0000-4000-a000-000000000003',
  'authenticated', 'authenticated',
  'e2e-test-security@facilite-demo.local',
  crypt('FaciliteE2ETest2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"candidat","full_name":"Sécurité E2E Test"}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now()
FROM auth.users u
WHERE u.email = 'e2e-test-security@facilite-demo.local'
ON CONFLICT DO NOTHING;
