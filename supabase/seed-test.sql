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

-- 0bis-suite. Deux écarts trouvés le 2026-08-08 en creusant les échecs
-- restants après 0bis/0ter/0quater (33 échecs sur 150, taux 72,7%) :
-- 1) current_user_role() n'avait EXECUTE que pour authenticated sur le
--    projet de test — la prod l'accorde aussi à anon (lecture publique,
--    ex. la page d'accueil non connectée). export-table-grants.js couvre
--    les tables, pas les GRANTs de fonction par rôle un par un ; celui-ci
--    avait été manqué lors du correctif GRANT EXECUTE initial (49/50
--    fonctions).
-- 2) GRANT INSERT sur reports pour authenticated est column-scoped en prod
--    (migration 20260803040000_moderation_et_suspension.sql) — jamais un
--    GRANT INSERT table entière. export-table-grants.js ne capture QUE les
--    colonnes UPDATE restreintes (role_column_grants filtré à
--    privilege_type='UPDATE'), jamais INSERT — d'où l'absence totale de
--    GRANT INSERT sur reports pour le projet de test (0 colonne, alors que
--    la ligne 62 ci-dessus montre bien un GRANT SELECT ON TABLE reports
--    déjà présent, sans INSERT).
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon;
GRANT INSERT (target_type, target_id, reason) ON public.reports TO authenticated;
GRANT INSERT (reporter_id) ON public.reports TO authenticated;

-- 0bis-suite-2. Décision utilisateur du 2026-08-08 (constat prod documenté
-- dans docs/etat-du-projet.md) : log_security_event() ne doit être
-- appelable que par service_role, jamais par authenticated/anon en direct
-- — les utilisateurs authentifiés passent par des fonctions dédiées
-- (ex. log_own_storage_deletion_failure(), déjà SECURITY DEFINER et déjà
-- correcte) qui forcent auth.uid() comme acteur avant d'appeler
-- log_security_event() en interne. Appliqué pour l'instant UNIQUEMENT sur
-- facilite-e2e-test (validation) — même correctif proposé pour la
-- production dans le rapport de ce point, en attente de validation
-- utilisateur avant toute migration prod.
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, uuid, uuid, jsonb) FROM authenticated, anon;

-- 0bis-suite-3. Décision utilisateur du 2026-08-08 : delete_own_resume(),
-- archive_own_job_offer(), clear_own_assistant_messages() sont des
-- fonctions plpgsql normales en prod (prosecdef=false) qui s'exécutent avec
-- les droits de l'appelant (authenticated) — or la prod n'accorde aucun
-- GRANT DELETE sur resumes/assistant_messages, ni archived_at dans le GRANT
-- UPDATE column-scoped de job_offers (voir docs/etat-du-projet.md, constat
-- "Trois fonctions Vague 2 ne fonctionnent probablement pas en prod
-- aujourd'hui"). Passées en SECURITY DEFINER + SET search_path = '' pour
-- que ces fonctions s'exécutent avec les droits de leur owner (postgres) au
-- lieu de ceux de l'appelant — chaque fonction fait déjà sa propre
-- vérification manuelle de propriété (IF owner_id <> auth.uid() THEN RAISE
-- EXCEPTION) avant toute écriture, donc SECURITY DEFINER ne réintroduit pas
-- de trou : la protection ne dépendait plus des GRANTs mais de cette
-- vérification explicite. Les corps de fonction n'utilisent que des noms
-- pleinement qualifiés (public.xxx, auth.uid()), donc search_path = ''
-- (défense en profondeur contre le search_path hijacking d'une fonction
-- SECURITY DEFINER) ne casse rien. Appliqué pour l'instant UNIQUEMENT sur
-- facilite-e2e-test — même correctif proposé pour la production dans le
-- rapport de ce point, en attente de validation utilisateur.
ALTER FUNCTION public.delete_own_resume(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.archive_own_job_offer(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.clear_own_assistant_messages(uuid) SECURITY DEFINER SET search_path = '';

-- 0bis-suite-4. Diff complet des GRANTs EXECUTE (role_table_grants,
-- role_column_grants et routine_privileges) entre prod et facilite-e2e-test
-- effectué le 2026-08-08 après les correctifs ci-dessus — trouvé 2 écarts
-- de plus, tous deux dans routine_privileges (jamais couverts par
-- export-table-grants.js, qui ne touche qu'aux tables) :
-- 1) 3 fonctions manquaient EXECUTE pour anon (présent en prod) :
--    get_profils_publics(), is_admin() [uniquement la surcharge sans
--    argument — is_admin(check_user_id uuid) reste authenticated
--    seulement, comme en prod], match_job_offers(vector, double precision,
--    integer).
-- 2) 5 fonctions avaient EXECUTE pour authenticated sur le projet de test
--    SANS l'avoir en prod — le projet de test était plus permissif que la
--    prod, seul cas de ce genre trouvé sur write ce chantier. Confirmé par
--    les migrations prod elles-mêmes : deduct_credit et log_access_denial
--    ont un `REVOKE ALL ... FROM PUBLIC, anon, authenticated` explicite
--    dans leur migration d'origine ("seul le code serveur doit pouvoir" —
--    20260801210000_deduct_credit_function.sql,
--    20260806160000_access_denial_detection.sql) ; les 3 autres
--    (purge_old_access_log_ips, set_recruiter_profiles_updated_at,
--    update_updated_at_column) sont des fonctions de trigger/tâche interne
--    jamais censées être appelées directement par un rôle applicatif.
-- Probable sur-octroi accidentel lors du correctif GRANT EXECUTE initial
-- (49/50 fonctions, trop large) plus tôt dans ce chantier.
GRANT EXECUTE ON FUNCTION public.get_profils_publics() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.match_job_offers(vector, double precision, integer) TO anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_access_denial(uuid, text, text, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_access_log_ips() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_recruiter_profiles_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;

-- 0bis-suite-5. Décision utilisateur du 2026-08-08 (Décision 3, même
-- direction que la Décision 1) : get_candidats_recherche() est LANGUAGE sql,
-- prosecdef=false en prod — s'exécute avec les droits de l'appelant, donc
-- soumise à RLS sur public.profiles. Or profiles n'a que 3 policies SELECT
-- (profil propre, admin, agent sur ses candidats assignés) — aucune ne
-- permet à un recruteur badgé verified_recruiter de lire le profil d'un
-- autre candidat. Le filtrage métier interne à la fonction (badge,
-- is_test_account, rôle) n'était donc jamais atteint : RLS bloquait tout
-- accès avant. Passée en SECURITY DEFINER + SET search_path = '' — le
-- corps de la fonction n'utilise que des noms pleinement qualifiés
-- (public.profiles, public.has_badge, public.current_user_role, auth.uid()),
-- donc search_path = '' ne casse rien. Appliqué pour l'instant UNIQUEMENT
-- sur facilite-e2e-test — même correctif proposé pour la production, en
-- attente de validation utilisateur.
ALTER FUNCTION public.get_candidats_recherche() SECURITY DEFINER SET search_path = '';

-- 0ter. Policies RLS storage.objects — même trou de nouveau,
-- dump-schema-via-introspection.js scope tout à nspname='public', jamais
-- storage. Exportées depuis la production (scripts/export-storage-policies.js)
-- le 2026-08-08. Le projet de test avait 6 policies avant ce correctif :
-- 4 correspondaient à de vraies policies de prod (recréées ici à
-- l'identique) et 2 étaient ad hoc, n'existant nulle part en production
-- ("Authenticated upload chat-attachments", "Public select
-- chat-attachments" — cette dernière rendait les pièces jointes de chat
-- lisibles sans authentification) : supprimées avant d'appliquer les 18
-- policies réelles ci-dessous. DROP POLICY IF EXISTS d'abord pour rester
-- idempotent sur un reset répété.
DROP POLICY IF EXISTS "Lecture de ses propres documents de badge" ON storage.objects;
DROP POLICY IF EXISTS "Lecture de son propre CV" ON storage.objects;
DROP POLICY IF EXISTS "Mise a jour de son propre CV" ON storage.objects;
DROP POLICY IF EXISTS "Participants lisent les pieces jointes de leur conversation" ON storage.objects;
DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;
DROP POLICY IF EXISTS "Suppression de son propre CV" ON storage.objects;
DROP POLICY IF EXISTS "Un admin gere tous les cv finalises" ON storage.objects;
DROP POLICY IF EXISTS "Un agent met a jour le cv de son dossier assigne" ON storage.objects;
DROP POLICY IF EXISTS "Un agent televerse le cv de son dossier assigne" ON storage.objects;
DROP POLICY IF EXISTS "Un candidat lit sa propre facture" ON storage.objects;
DROP POLICY IF EXISTS "Un candidat lit son cv finalise" ON storage.objects;
DROP POLICY IF EXISTS "Un moderateur lit les documents de badge" ON storage.objects;
DROP POLICY IF EXISTS "Un recruteur met a jour ses visuels d'offres" ON storage.objects;
DROP POLICY IF EXISTS "Un recruteur supprime ses visuels d'offres" ON storage.objects;
DROP POLICY IF EXISTS "Un recruteur televerse ses visuels d'offres" ON storage.objects;
DROP POLICY IF EXISTS "Upload de sa propre piece jointe de discussion" ON storage.objects;
DROP POLICY IF EXISTS "Upload de ses propres documents de badge" ON storage.objects;
DROP POLICY IF EXISTS "Upload de son propre CV" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public select chat-attachments" ON storage.objects;

CREATE POLICY "Lecture de ses propres documents de badge" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'badge-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Lecture de son propre CV" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Mise a jour de son propre CV" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Participants lisent les pieces jointes de leur conversation" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING (((bucket_id = 'chat-attachments'::text) AND ((EXISTS ( SELECT 1
   FROM messages m
  WHERE ((m.attachment_url = objects.name) AND ((m.sender_id = auth.uid()) OR (m.receiver_id = auth.uid()))))) OR (current_user_role() = ANY (ARRAY['admin'::text, 'publisher'::text])))));
CREATE POLICY "Recruteurs et admins lisent les CV" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'resumes'::text) AND ((auth.uid() = owner) OR (current_user_role() = 'admin'::text) OR ((current_user_role() = 'user'::text) AND has_badge(auth.uid(), 'verified_recruiter'::text) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[1]) AND (p.cv_visible_recruteurs = true)))) OR (EXISTS ( SELECT 1
   FROM candidatures c
  WHERE (((c.user_id)::text = (storage.foldername(objects.name))[1]) AND (c.recruiter_id = auth.uid())))))))));
CREATE POLICY "Suppression de son propre CV" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC USING (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Un admin gere tous les cv finalises" ON storage.objects AS PERMISSIVE FOR ALL TO PUBLIC USING (((bucket_id = 'completed_cvs'::text) AND (current_user_role() = 'admin'::text))) WITH CHECK (((bucket_id = 'completed_cvs'::text) AND (current_user_role() = 'admin'::text)));
CREATE POLICY "Un agent met a jour le cv de son dossier assigne" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((bucket_id = 'completed_cvs'::text) AND (EXISTS ( SELECT 1
   FROM agent_assignments aa
  WHERE ((aa.agent_id = auth.uid()) AND ((aa.candidate_id)::text = (storage.foldername(objects.name))[1]))))));
CREATE POLICY "Un agent televerse le cv de son dossier assigne" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = 'completed_cvs'::text) AND (EXISTS ( SELECT 1
   FROM agent_assignments aa
  WHERE ((aa.agent_id = auth.uid()) AND ((aa.candidate_id)::text = (storage.foldername(objects.name))[1]))))));
CREATE POLICY "Un candidat lit sa propre facture" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING (((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Un candidat lit son cv finalise" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING (((bucket_id = 'completed_cvs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Un moderateur lit les documents de badge" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'badge-documents'::text) AND (current_user_role() = ANY (ARRAY['admin'::text, 'publisher'::text]))));
CREATE POLICY "Un recruteur met a jour ses visuels d'offres" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((bucket_id = 'job-offers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'job-offers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Un recruteur supprime ses visuels d'offres" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC USING (((bucket_id = 'job-offers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Un recruteur televerse ses visuels d'offres" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'job-offers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ((current_user_role() = 'admin'::text) OR ((current_user_role() = 'user'::text) AND has_badge(auth.uid(), 'verified_recruiter'::text)))));
CREATE POLICY "Upload de sa propre piece jointe de discussion" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = 'chat-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Upload de ses propres documents de badge" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'badge-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Upload de son propre CV" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- 0quater. Publication Realtime — même trou de nouveau : dump-schema-via-introspection.js
-- ne capture pas l'appartenance à supabase_realtime. Vérifié sur la production le
-- 2026-08-08 (SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime') :
-- exactement ces 7 tables sont publiées, aucune autre.
ALTER PUBLICATION supabase_realtime ADD TABLE public."agent_assignments";
ALTER PUBLICATION supabase_realtime ADD TABLE public."candidatures";
ALTER PUBLICATION supabase_realtime ADD TABLE public."conversations";
ALTER PUBLICATION supabase_realtime ADD TABLE public."messages";
ALTER PUBLICATION supabase_realtime ADD TABLE public."orders";
ALTER PUBLICATION supabase_realtime ADD TABLE public."resumes";
ALTER PUBLICATION supabase_realtime ADD TABLE public."security_logs";

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
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Agent E2E Test"}',
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

-- 5. Compte démo (demo.investisseur@facilite-demo.local) — trouvé absent de
-- auth.users sur facilite-e2e-test le 2026-08-08 (Groupe A), cause des
-- échecs de demo-mode-isolation.spec.js, recruiter-overview-dashboard.spec.js
-- et responsive-check.spec.js (pas un problème de mot de passe ni de rate
-- limit : le compte n'existait simplement pas). Reprend intégralement
-- scripts/generate-demo-data.sql (déjà écrit pour la prod, idempotent —
-- ON CONFLICT DO NOTHING / DELETE-puis-recréation) tel quel, pour que tout
-- reset de facilite-e2e-test recrée le compte démo, ses 10 candidats
-- fictifs, ses 8 offres et ses ~38 candidatures.
DO $$
DECLARE
  demo_recruiter_id UUID := '90000000-0000-4000-a000-000000000099';
  demo_email TEXT := 'demo.investisseur@facilite-demo.local';
  candidate_ids UUID[] := ARRAY[
    '90000000-0000-4000-a000-000000000010', '90000000-0000-4000-a000-000000000011',
    '90000000-0000-4000-a000-000000000012', '90000000-0000-4000-a000-000000000013',
    '90000000-0000-4000-a000-000000000014', '90000000-0000-4000-a000-000000000015',
    '90000000-0000-4000-a000-000000000016', '90000000-0000-4000-a000-000000000017',
    '90000000-0000-4000-a000-000000000018', '90000000-0000-4000-a000-000000000019'
  ];
  candidate_names TEXT[] := ARRAY[
    'Aminata Diop', 'Moussa Fall', 'Fatou Ndiaye', 'Ibrahima Sarr', 'Aïssatou Ba',
    'Cheikh Diallo', 'Marième Gueye', 'Ousmane Cissé', 'Khady Sow', 'Abdoulaye Faye'
  ];
  candidate_headlines TEXT[] := ARRAY[
    'Développeuse Web Junior', 'Technicien Support IT', 'Chargée de Clientèle',
    'Comptable', 'Assistante Marketing Digital', 'Développeur Full-Stack',
    'Responsable Commercial', 'Livreur / Coursier', 'Assistante RH', 'Vendeur Conseil'
  ];
  offer_ids UUID[];
  offer_created TIMESTAMPTZ[];
  approved_offer_ids UUID[];
  approved_offer_created TIMESTAMPTZ[];
  i INT;
  n_candidatures INT := 38;
  chosen_offer_idx INT;
  chosen_candidate_idx INT;
  offer_age_days NUMERIC;
  applied_at TIMESTAMPTZ;
  final_status TEXT;
  changed_at TIMESTAMPTZ;
  responded_at TIMESTAMPTZ;
  revealed BOOLEAN;
  roll NUMERIC;
BEGIN
  DELETE FROM public.candidatures WHERE recruiter_id = demo_recruiter_id
    OR job_offer_id IN (SELECT id FROM public.job_offers WHERE recruiter_id = demo_recruiter_id);
  DELETE FROM public.job_offers WHERE recruiter_id = demo_recruiter_id;
  DELETE FROM public.recruiter_profiles WHERE user_id = demo_recruiter_id;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', demo_recruiter_id,
    'authenticated', 'authenticated', demo_email,
    crypt('CompteDemoNonUtilisable2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  SELECT gen_random_uuid(), u.id::text, u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now()
  FROM auth.users u WHERE u.id = demo_recruiter_id
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET
    full_name = 'Compte Démo Investisseur',
    is_test_account = true,
    badges = CASE WHEN badges @> '["verified_recruiter"]'::jsonb THEN badges ELSE badges || '["verified_recruiter"]'::jsonb END
  WHERE id = demo_recruiter_id;

  INSERT INTO public.recruiter_profiles (user_id, company_name, sector, location, description, website)
  VALUES (
    demo_recruiter_id, 'Alpha Digital Sénégal', 'Technologies & Services Numériques', 'Dakar, Sénégal',
    'Entreprise de démonstration — jeu de données fictif généré pour les présentations, sans rapport avec une société réelle.',
    'https://exemple.facilite-demo.local'
  );

  FOR i IN 1..10 LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', candidate_ids[i],
      'authenticated', 'authenticated', 'demo-candidat-' || i || '@facilite-demo.local',
      crypt('CompteDemoNonUtilisable2026!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
    SELECT gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now()
    FROM auth.users u WHERE u.id = candidate_ids[i]
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles SET
      full_name = candidate_names[i],
      headline = candidate_headlines[i],
      city = 'Dakar', location = 'Dakar, Sénégal',
      is_test_account = true,
      cv_visible_recruteurs = true,
      cv_url = NULL, cv_name = NULL
    WHERE id = candidate_ids[i];
  END LOOP;

  ALTER TABLE public.job_offers DISABLE TRIGGER trg_reset_job_offer_moderation;

  INSERT INTO public.job_offers (title, company, location, contract_type, salary_range, description, min_education_level, recruiter_id, status, status_updated_at, created_at, is_active, view_count, is_test_account)
  VALUES
    ('Développeur Full-Stack', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'CDI', '600 000 - 900 000 FCFA', 'Rejoignez notre équipe produit pour construire les prochaines fonctionnalités de notre plateforme.', 'Bac+3', demo_recruiter_id, 'approved', now() - interval '27 days', now() - interval '28 days', true, 340, true),
    ('Chargé(e) de Clientèle', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'CDI', '250 000 - 350 000 FCFA', 'Accompagnez nos clients au quotidien et assurez un service de qualité.', 'Bac+2', demo_recruiter_id, 'approved', now() - interval '20 days', now() - interval '21 days', true, 210, true),
    ('Comptable Senior', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'CDI', '450 000 - 600 000 FCFA', 'Pilotez la comptabilité générale et le reporting financier mensuel.', 'Bac+4', demo_recruiter_id, 'approved', now() - interval '13 days', now() - interval '14 days', true, 150, true),
    ('Assistant(e) Marketing Digital', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'CDD', '200 000 - 280 000 FCFA', 'Participez à la création et l''animation de nos campagnes digitales.', 'Bac+2', demo_recruiter_id, 'approved', now() - interval '6 days', now() - interval '7 days', true, 95, true),
    ('Responsable Commercial', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'CDI', '500 000 - 700 000 FCFA', 'Développez notre portefeuille clients B2B sur la région de Dakar.', 'Bac+3', demo_recruiter_id, 'approved', now() - interval '2 days', now() - interval '3 days', true, 40, true),
    ('Stagiaire RH', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'Stage', '75 000 FCFA', 'Stage de 6 mois au sein de notre équipe Ressources Humaines.', 'Bac+3', demo_recruiter_id, 'pending_review', now() - interval '1 day', now() - interval '1 day', true, 0, true),
    ('Technicien Support IT', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'CDI', '250 000 - 320 000 FCFA', 'Assurez le support technique de niveau 1 et 2 pour nos utilisateurs internes.', 'Bac+2', demo_recruiter_id, 'pending_review', now() - interval '12 hours', now() - interval '12 hours', true, 0, true),
    ('Livreur / Coursier', 'Alpha Digital Sénégal', 'Dakar, Sénégal', 'CDD', '100 000 - 130 000 FCFA', 'Livraison de colis dans la région dakaroise.', 'Aucun', demo_recruiter_id, 'rejected', now() - interval '24 days', now() - interval '25 days', false, 5, true);

  ALTER TABLE public.job_offers ENABLE TRIGGER trg_reset_job_offer_moderation;

  SELECT array_agg(id ORDER BY created_at), array_agg(created_at ORDER BY created_at)
  INTO approved_offer_ids, approved_offer_created
  FROM public.job_offers WHERE recruiter_id = demo_recruiter_id AND status = 'approved';

  FOR i IN 1..n_candidatures LOOP
    chosen_offer_idx := 1 + (i % array_length(approved_offer_ids, 1));
    chosen_candidate_idx := 1 + (i % array_length(candidate_ids, 1));
    offer_age_days := GREATEST(1, EXTRACT(EPOCH FROM (now() - approved_offer_created[chosen_offer_idx])) / 86400.0);
    applied_at := approved_offer_created[chosen_offer_idx] + (random() * offer_age_days * interval '1 day');
    IF applied_at > now() THEN applied_at := now() - interval '1 hour'; END IF;

    roll := random();
    IF roll < 0.35 THEN
      final_status := 'pending'; changed_at := applied_at; responded_at := NULL; revealed := false;
    ELSIF roll < 0.55 THEN
      final_status := 'reviewed'; changed_at := applied_at + interval '1 day'; responded_at := changed_at; revealed := false;
    ELSIF roll < 0.70 THEN
      final_status := 'contacted'; changed_at := applied_at + interval '2 days'; responded_at := applied_at + interval '1 day'; revealed := true;
    ELSIF roll < 0.85 THEN
      final_status := 'interview_scheduled'; changed_at := applied_at + interval '3 days'; responded_at := applied_at + interval '1 day'; revealed := true;
    ELSIF roll < 0.93 THEN
      final_status := 'accepted'; changed_at := applied_at + interval '5 days'; responded_at := applied_at + interval '1 day'; revealed := true;
    ELSE
      final_status := 'rejected'; changed_at := applied_at + interval '2 days'; responded_at := applied_at + interval '1 day'; revealed := false;
    END IF;
    IF changed_at > now() THEN changed_at := now(); END IF;
    IF responded_at IS NOT NULL AND responded_at > now() THEN responded_at := now(); END IF;

    INSERT INTO public.candidatures (
      user_id, job_offer_id, job_title, company, full_name, email, cv_url,
      status, created_at, status_changed_at, first_response_at, contact_revealed, cv_match_score
    ) VALUES (
      candidate_ids[chosen_candidate_idx], approved_offer_ids[chosen_offer_idx],
      (SELECT title FROM public.job_offers WHERE id = approved_offer_ids[chosen_offer_idx]),
      'Alpha Digital Sénégal', candidate_names[chosen_candidate_idx],
      'demo-candidat-' || chosen_candidate_idx || '@facilite-demo.local',
      'demo/cv-fictif-' || chosen_candidate_idx || '.pdf',
      final_status, applied_at, changed_at, responded_at, revealed,
      60 + (random() * 40)::int
    );
  END LOOP;
END $$;

-- 6. Les 3 profils fictifs originaux (migration 20260802150000_test_account_isolation.sql)
-- — trouvés absents de facilite-e2e-test le 2026-08-08 (Groupe C), cause de
-- test-account-isolation.spec.js:87 ("les 3 profils fictifs existent").
-- Distincts des 10 candidats démo du Groupe A (section 5 ci-dessus) : ce
-- sont les IDs ...001/002/003 attendus explicitement en dur par ce test.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-a000-000000000001',
   'authenticated', 'authenticated', 'test-fictif-1@facilite-demo.local',
   crypt('CompteFictifNonUtilisable2026!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-a000-000000000002',
   'authenticated', 'authenticated', 'test-fictif-2@facilite-demo.local',
   crypt('CompteFictifNonUtilisable2026!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-a000-000000000003',
   'authenticated', 'authenticated', 'test-fictif-3@facilite-demo.local',
   crypt('CompteFictifNonUtilisable2026!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now()
FROM auth.users u
WHERE u.email IN ('test-fictif-1@facilite-demo.local', 'test-fictif-2@facilite-demo.local', 'test-fictif-3@facilite-demo.local')
ON CONFLICT DO NOTHING;

UPDATE public.profiles SET
  full_name = data.full_name,
  headline = data.headline,
  bio = data.bio,
  city = data.city,
  skills = data.skills,
  is_test_account = true,
  cv_visible_recruteurs = true
FROM (VALUES
  ('90000000-0000-4000-a000-000000000001'::uuid, 'Aïssatou Fictive (Test)', 'Développeuse Full-Stack (profil de simulation)',
   'Profil 100% fictif, généré pour les simulations de recherche recruteur. Ne correspond à aucune personne réelle.',
   'Dakar', '["React", "Node.js", "PostgreSQL"]'::jsonb),
  ('90000000-0000-4000-a000-000000000002'::uuid, 'Moussa Fictif (Test)', 'Comptable (profil de simulation)',
   'Profil 100% fictif, généré pour les simulations de recherche recruteur. Ne correspond à aucune personne réelle.',
   'Thiès', '["Comptabilité", "Excel", "SAGE"]'::jsonb),
  ('90000000-0000-4000-a000-000000000003'::uuid, 'Fatou Fictive (Test)', 'Chargée de communication (profil de simulation)',
   'Profil 100% fictif, généré pour les simulations de recherche recruteur. Ne correspond à aucune personne réelle.',
   'Saint-Louis', '["Communication", "Réseaux sociaux", "Canva"]'::jsonb)
) AS data(id, full_name, headline, bio, city, skills)
WHERE profiles.id = data.id;

-- 7. Groupe D — corrections du 2026-08-08.
--
-- #2/#13 : demo.senetech@facilite-demo.local ("SeneTech Solutions",
-- recruiter_id 00000000-...-001, utilisé par candidate-application.spec.js
-- et xss-joboffer-jsonld.spec.js) avait ses offres en pending_review (donc
-- invisibles publiquement, policy RLS "Anyone can view active job offers"
-- exige status='approved') et aucun badge verified_recruiter (donc INSERT
-- bloqué par la policy RLS "Un recruteur publie ses propres offres"). Le
-- trigger trg_reset_job_offer_moderation force pending_review sur tout
-- INSERT/UPDATE dont l'appelant n'est pas admin (current_user_role() lit
-- auth.uid(), NULL sur cette connexion privilégiée) — désactivé le temps
-- de la mise à jour, même motif que scripts/generate-demo-data.sql.
ALTER TABLE public.job_offers DISABLE TRIGGER trg_reset_job_offer_moderation;
UPDATE public.job_offers SET status = 'approved', status_updated_at = now()
WHERE recruiter_id = '00000000-0000-4000-a000-000000000001';
ALTER TABLE public.job_offers ENABLE TRIGGER trg_reset_job_offer_moderation;

UPDATE public.profiles SET badges = CASE WHEN badges @> '["verified_recruiter"]'::jsonb THEN badges ELSE badges || '["verified_recruiter"]'::jsonb END
WHERE id = '00000000-0000-4000-a000-000000000001';

-- #10 : storage-role-literals-fix.spec.js suppose qu'un recruteur badgé
-- (e2e-test-security jouant le recruteur) peut lire le CV d'un candidat
-- (e2e-test-candidate) sans lien préalable. La policy storage.objects
-- "Recruteurs et admins lisent les CV" (identique à la prod) exige soit
-- cv_visible_recruteurs=true sur le profil du candidat, soit une ligne
-- candidatures liant candidat et recruteur — cette candidature de liaison
-- comble la seconde condition.
--
-- ATTENTION — insuffisant à lui seul, vérifié le 2026-08-08 : les DEUX
-- conditions d'échappement de cette policy (cv_visible_recruteurs=true ET
-- la présence de cette ligne candidatures) échouent quand même, testées
-- en direct. Cause : les sous-requêtes de la policy vers profiles et
-- candidatures sont elles-mêmes filtrées par le RLS de CES tables pour
-- l'appelant (le recruteur ne peut voir ni le profil du candidat, ni sa
-- propre ligne candidatures, via leurs policies SELECT respectives,
-- limitées à "son propre profil"/"sa propre candidature"). Même famille
-- que #7 et la Décision 3, mais dans une policy storage — pas de
-- SECURITY DEFINER possible sur une policy elle-même ; corrigerait
-- vraisemblablement via une fonction SECURITY DEFINER dédiée appelée
-- depuis la policy (comme has_badge()/current_user_role() le sont déjà),
-- hors périmètre de ce qui a été autorisé ce soir. La policy
-- "Recruteurs et admins lisent les CV" est donc non fonctionnelle pour un
-- verified_recruiter réel non-admin, en prod comme en test — signalé,
-- non corrigé. test-account-isolation.spec.js reste rouge tant que ce
-- point n'est pas tranché séparément.
INSERT INTO public.candidatures (id, user_id, job_title, company, full_name, email, cv_url, recruiter_id, status)
VALUES (
  '20000000-0000-4000-a000-000000000099',
  '30000000-0000-4000-a000-000000000001',
  'Poste de test — storage-role-literals-fix',
  'Storage Fix Test SARL',
  'E2E Candidate',
  'e2e-test-candidate@facilite-demo.local',
  'resumes/placeholder.pdf',
  '40000000-0000-4000-a000-000000000003',
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- #7 : get_recruiter_candidatures() — même famille que les Décisions 1 et
-- 3 : LANGUAGE sql, prosecdef=false en prod, exécutée avec les droits de
-- l'appelant. candidatures n'a que 2 policies SELECT (propre candidature,
-- admin) — aucune ne permet à un recruteur de lire les candidatures liées
-- à ses propres offres, identique en prod. Passée en SECURITY DEFINER +
-- SET search_path = '' — corps déjà entièrement qualifié
-- (public.candidatures, public.job_offers, public.current_user_role,
-- public.has_badge, auth.uid()). Vérifié : les 5 tests de
-- recruiter-candidate-data-protection.spec.js passent. Correctif
-- équivalent proposé pour la production, en attente de validation.
ALTER FUNCTION public.get_recruiter_candidatures(uuid, integer) SECURITY DEFINER SET search_path = '';

-- 8. Corrections du 2026-08-08 (suite) sur les 6 derniers échecs.
--
-- #1 : education_level manquant sur e2e-test-candidate, requis par
-- candidate-application.spec.js (offre "Développeur Full-Stack React /
-- Node.js" exige min_education_level='Licence').
UPDATE public.profiles SET education_level = 'Licence'
WHERE id = '30000000-0000-4000-a000-000000000001';

-- #2 : demo-mode-isolation.spec.js utilisait e2e-test-security comme "vrai
-- recruteur" pour vérifier qu'aucun profil de test ne lui fuite — mais
-- e2e-test-security est lui-même is_test_account=true (utilisé comme tel
-- ailleurs, ex. test-account-isolation.spec.js). Compte dédié créé
-- uniquement pour ce test, jamais is_test_account=true, jamais réutilisé
-- ailleurs. Le badge verified_recruiter est accordé dynamiquement par le
-- test lui-même (beforeAll), pas ici.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-4000-a000-000000000001',
  'authenticated', 'authenticated', 'e2e-test-real-recruiter@facilite-demo.local',
  crypt('FaciliteE2ETest2026!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Real Recruiter E2E Test"}',
  now(), now(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now()
FROM auth.users u WHERE u.id = '60000000-0000-4000-a000-000000000001'
ON CONFLICT DO NOTHING;

-- #4 : recruiter-verification.spec.js badge e2e-test-candidate comme
-- recruteur pour vérifier que la CVthèque renvoie des candidats réels —
-- mais e2e-test-candidate a lui-même is_test_account qui varie selon
-- l'ordre d'exécution (mis à true par le seed, remis à false par
-- test-account-isolation.spec.js:afterAll). Un candidat séparé,
-- exclusivement is_test_account=false + cv_visible_recruteurs=true,
-- garantit qu'au moins un profil réel est toujours trouvable, quel que
-- soit l'ordre d'exécution des fichiers.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-4000-a000-000000000002',
  'authenticated', 'authenticated', 'e2e-test-real-candidate@facilite-demo.local',
  crypt('FaciliteE2ETest2026!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Real Candidate E2E Test"}',
  now(), now(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now()
FROM auth.users u WHERE u.id = '60000000-0000-4000-a000-000000000002'
ON CONFLICT DO NOTHING;

UPDATE public.profiles SET
  is_test_account = false,
  cv_visible_recruteurs = true
WHERE id = '60000000-0000-4000-a000-000000000002';
