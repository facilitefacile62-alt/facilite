-- ===========================================================================
-- Mode démo — génération de données fictives (Étape E du chantier, 2026-08-03)
-- ===========================================================================
-- Rejouable : supprime puis régénère l'intégralité des données rattachées au
-- compte démo avant de les recréer, pour que les dates relatives (30 derniers
-- jours) restent fraîches à chaque exécution. Ne touche AUCUNE donnée en
-- dehors des lignes explicitement marquées is_test_account=true et
-- appartenant au compte démo ci-dessous.
--
-- Exécution : npx supabase db query --linked --yes -f supabase/scripts/generate-demo-data.sql
-- Voir docs/mode-demo.md pour les identifiants de connexion et le détail.

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
  -- Nettoyage préalable (idempotence) : tout ce qui appartient au recruteur
  -- démo, plus les candidatures des candidats fictifs qui lui sont destinées.
  DELETE FROM public.candidatures WHERE recruiter_id = demo_recruiter_id
    OR job_offer_id IN (SELECT id FROM public.job_offers WHERE recruiter_id = demo_recruiter_id);
  DELETE FROM public.job_offers WHERE recruiter_id = demo_recruiter_id;
  DELETE FROM public.recruiter_profiles WHERE user_id = demo_recruiter_id;

  -- Compte recruteur démo (auth.users réel pour la FK, identifiants non
  -- fonctionnels de propos délibéré — même motif que les 3 candidats
  -- fictifs de 20260802150000_test_account_isolation.sql).
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

  -- handle_new_user() a créé profiles + user_roles par défaut ('user'/'active')
  -- sur l'INSERT ci-dessus : on complète, badge, et marque is_test_account.
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

  -- 10 candidats fictifs dédiés au funnel démo (distincts des 3 déjà utilisés
  -- pour la démo CVthèque — 90000000-...-000001 à 000003 — pour ne jamais
  -- entrer en conflit avec test-account-isolation.spec.js).
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

  -- trg_reset_job_offer_moderation force status='pending_review' sur tout
  -- INSERT dont l'appelant n'est pas admin (current_user_role() lit
  -- auth.uid(), NULL sur une connexion SQL privilégiée hors PostgREST) —
  -- désactivé le temps de ce script de confiance, jamais côté client.
  ALTER TABLE public.job_offers DISABLE TRIGGER trg_reset_job_offer_moderation;

  -- 8 offres à des stades de modération différents, échelonnées sur 30 jours.
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

  -- ~38 candidatures réparties sur les 5 offres approuvées, funnel réaliste
  -- (beaucoup en attente, de moins en moins à mesure qu'on avance vers
  -- "Retenu"), horodatées entre la création de l'offre et maintenant.
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
