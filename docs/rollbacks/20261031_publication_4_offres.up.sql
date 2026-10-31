-- Publication de 4 offres d'emploi (31/10/2026), sur demande écrite du propriétaire : SYSCOM INSTITUT (1), ONPEC Sénégal (1), KHELCOM BACHES SARL (2 postes).
-- Aucune colonne ni migration : simples lignes dans public.job_offers, comme la publication depuis /admin. Une seule transaction, gardée à 4 lignes.
-- Propriétaire des offres : le compte administrateur (le seul qui existe). Les candidatures de SYSCOM INSTITUT, dont l'affiche ne donne aucun e-mail, arrivent à l'adresse
-- du compte administrateur, lue ici dans le compte au moment de l'exécution (le dépôt est public : aucune adresse personnelle n'est écrite dans ce fichier).
-- Les autres adresses et numéros sont ceux imprimés sur les affiches, donc déjà publics.
-- Retour arrière : 20261031_publication_4_offres.down.sql (MASQUE les offres, ne supprime rien).
BEGIN;

DO $$
DECLARE
  v_admin   uuid;
  v_email   text;
  v_n       integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.user_roles WHERE role = 'admin';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : % compte(s) administrateur au lieu de 1', v_n;
  END IF;
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin';
  SELECT email INTO v_email FROM auth.users WHERE id = v_admin;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Publication annulée : adresse du compte administrateur introuvable';
  END IF;

  IF EXISTS (SELECT 1 FROM public.job_offers WHERE id IN (
    'cf0f37d1-3930-4b80-97c5-5307d739bad4', 'c7c8d329-1804-4956-a84d-ce5acd99b2d3', 'b994aa8d-fe88-46df-8c46-cae606354d97', 'd0568439-14da-4950-b460-67bf9f3ddea1'
  )) THEN
    RAISE EXCEPTION 'Publication annulée : une de ces offres existe déjà';
  END IF;

  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, description, is_active, recruiter_id, image_url, deadline, status, contact_email, contact_phone, requires_cover_letter, listing_type)
  VALUES
    -- 1. SYSCOM INSTITUT : e-mail non précisé sur l'affiche -> compte administrateur ; lettre de motivation demandée
    ('cf0f37d1-3930-4b80-97c5-5307d739bad4', 'Assistant(e) de Direction', 'SYSCOM INSTITUT', 'Tivaouane Peulh, Sénégal', NULL,
     $d$OPPORTUNITÉ DE RECRUTEMENT | SYSCOM INSTITUT

SYSCOM INSTITUT renforce son équipe et lance un appel à candidatures pour le poste d’Assistant(e) de Direction.

Vous êtes organisé(e), dynamique, rigoureux(se) et souhaitez évoluer dans un environnement professionnel stimulant ? Cette opportunité pourrait vous correspondre !

📩 Pour postuler :
Envoyez votre dossier de candidature comprenant :
- Votre CV ;
- Une lettre de motivation.

📌 Après réception des candidatures, les profils présélectionnés seront contactés afin de convenir d’un rendez-vous pour un entretien.

Rejoignez une équipe engagée et contribuez au développement de SYSCOM INSTITUT !

📍 Adresse : Cité APIX, Almadies V.D.N 3, Tivaouane Peulh.
📞 Contact : +221 77 330 15 98

SYSCOM INSTITUT — Ensemble pour votre réussite !$d$,
     true, v_admin, '/syscom_institut_assistante_direction.jpg', NULL, 'approved', v_email, '+221 77 330 15 98', true, 'offre_emploi'),

    -- 2. ONPEC Sénégal : nature de l'engagement « à confirmer » -> type de contrat non renseigné ; date limite du 4 novembre 2026
    ('c7c8d329-1804-4956-a84d-ce5acd99b2d3', 'Assistant(e) administratif(ve) et chargé(e) de coordination', 'ONPEC Sénégal', 'Fann Hock, Dakar', NULL,
     $d$RECRUTEMENT | ONPEC Sénégal recherche un(e) Assistant(e) administratif(ve) et chargé(e) de coordination à Dakar

L’ONPEC Sénégal recherche un profil pour accompagner la gestion administrative de ses activités et renforcer la coordination avec ses partenaires.

PROFIL RECHERCHÉ

• Excellentes capacités rédactionnelles en français.
• Bonne maîtrise des outils bureautiques et collaboratifs.
• Sens de l’organisation et autonomie.
• Aisance relationnelle.
• Intérêt pour l’état civil et l’accès aux droits.
• Une expérience en administration ou en coordination associative constitue un avantage.

PRINCIPALES MISSIONS

Gérer les correspondances, organiser les réunions, assurer le suivi des décisions, coordonner les activités de terrain et contribuer aux relations avec les partenaires.

📍 Lieu : Fann Hock, Dakar.

📄 Nature de l’engagement : À confirmer auprès de l’organisation.

📅 Date limite affichée sur Tekki : 4 novembre 2026.

CANDIDATURE DIRECTE

Envoyer un CV et un court texte de motivation à :

📩 confirmation@onpec-sn.com$d$,
     true, v_admin, NULL, '2026-11-04', 'approved', 'confirmation@onpec-sn.com', NULL, true, 'offre_emploi'),

    -- 3. KHELCOM BACHES SARL : magasiniers (minimum 1 an d'expérience)
    ('b994aa8d-fe88-46df-8c46-cae606354d97', 'Magasiniers', 'KHELCOM BACHES SARL', 'Pikine, Sénégal', NULL,
     $d$KHELCOM BACHES SARL recrute des magasiniers (minimum 1 an d’expérience).

Missions :
• Gestion et rangement du stock
• Décompte et suivi des équipements et du matériel
• Contrôle des entrées et sorties du magasin

📍 Lieu : Pikine.

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com$d$,
     true, v_admin, NULL, NULL, 'approved', 'rh-recrutement@khelcombache.com', NULL, false, 'offre_emploi'),

    -- 4. KHELCOM BACHES SARL : comptable (minimum 5 ans d'expérience)
    ('d0568439-14da-4950-b460-67bf9f3ddea1', 'Comptable', 'KHELCOM BACHES SARL', 'Pikine, Sénégal', NULL,
     $d$KHELCOM BACHES SARL recrute un comptable (minimum 5 ans d’expérience).

Missions :
• Suivi des opérations comptables
• Gestion des pièces comptables et des factures
• Suivi des dépenses et préparation des rapports comptables

📍 Lieu : Pikine.

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com$d$,
     true, v_admin, NULL, NULL, 'approved', 'rh-recrutement@khelcombache.com', NULL, false, 'offre_emploi');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'Publication annulée : % ligne(s) insérée(s) au lieu de 4', v_n;
  END IF;

  -- Garde finale : les 4 offres doivent être approuvées et actives (un déclencheur de modération ne doit pas les avoir remises en attente).
  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id IN ('cf0f37d1-3930-4b80-97c5-5307d739bad4', 'c7c8d329-1804-4956-a84d-ce5acd99b2d3', 'b994aa8d-fe88-46df-8c46-cae606354d97', 'd0568439-14da-4950-b460-67bf9f3ddea1')
     AND status = 'approved' AND is_active = true AND is_test_account = false AND archived_at IS NULL;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'Publication annulée : % offre(s) approuvée(s) et active(s) au lieu de 4', v_n;
  END IF;
END
$$;

COMMIT;
