-- Publication de 2 offres supplémentaires (31/10/2026), sur demande écrite du propriétaire : TALENT FLOW SUARL (techniciens métallurgistes) et Ambassade de Suède au Sénégal
-- (assistant(e) administratif(ve) et de communication). Même méthode que 20261031_publication_4_offres.up.sql : aucune colonne ni migration, une transaction gardée à 2 lignes,
-- insertion EN ATTENTE de modération (le déclencheur reset_job_offer_moderation() n'est pas contourné ; l'administrateur approuve dans /admin).
-- Les adresses e-mail sont celles imprimées sur les annonces, donc déjà publiques. L'affiche de TALENT FLOW ne donne pas de lieu : « Sénégal » (champ obligatoire).
-- Retour arrière : 20261031_publication_2_offres_bis.down.sql (MASQUE, ne supprime rien).
BEGIN;

DO $$
DECLARE
  v_admin uuid;
  v_n     integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.user_roles WHERE role = 'admin';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : % compte(s) administrateur au lieu de 1', v_n;
  END IF;
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin';

  IF EXISTS (SELECT 1 FROM public.job_offers WHERE id IN ('b11d6e36-0816-4428-840c-9a744d93df43', '3ebfd875-1baa-474f-a88b-f42a7ae215f5')) THEN
    RAISE EXCEPTION 'Publication annulée : une de ces offres existe déjà';
  END IF;

  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, description, is_active, recruiter_id, image_url, deadline, contact_email, requires_cover_letter, listing_type)
  VALUES
    -- 6. TALENT FLOW SUARL : CV seul, objet du mail imposé ; ni lieu, ni contrat, ni date limite sur l'affiche
    ('b11d6e36-0816-4428-840c-9a744d93df43', 'Techniciens métallurgistes', 'Talent Flow SUARL', 'Sénégal', NULL,
     $d$OFFRE D’EMPLOI | TECHNICIENS MÉTALLURGISTES

Talent Flow SUARL accompagne les entreprises et les candidats.

Dans le cadre de recrutements, nous recherchons des Techniciens métallurgistes qualifiés et motivés pour rejoindre une structure professionnelle.

PROFIL RECHERCHÉ

• Formation en métallurgie ou dans un domaine technique connexe ;
• Expérience professionnelle souhaitée dans le domaine ;
• Maîtrise des procédés métallurgiques et des techniques de contrôle, selon le poste ;
• Rigueur, esprit d’équipe et respect des règles de sécurité.

CANDIDATURE

Les personnes intéressées sont invitées à envoyer leur CV à l’adresse suivante :

📩 mansourjrngom@gmail.com

Objet du mail : Candidature – Technicien métallurgiste$d$,
     true, v_admin, NULL, NULL, 'mansourjrngom@gmail.com', false, 'offre_emploi'),

    -- 7. Ambassade de Suède : CDD de 12 mois renouvelable, date limite 11 novembre 2026, CV + lettre + pièces demandés
    ('3ebfd875-1baa-474f-a88b-f42a7ae215f5', 'Assistant(e) administratif(ve) et de communication', 'Ambassade de Suède au Sénégal', 'Dakar, Sénégal', 'CDD de 12 mois renouvelable',
     $d$L’Ambassade de Suède au Sénégal recherche un(e) Assistant(e) administratif(ve) et de communication pour renforcer sa section politique, économique et de coopération (PEC).

Le poste associe des responsabilités administratives, la communication digitale, l’organisation d’événements et l’appui aux activités de l’ambassade.

PROFIL RECHERCHÉ

• Formation ou expérience professionnelle confirmée dans des fonctions similaires.
• Excellente maîtrise du français.
• Anglais obligatoire, niveau B2 minimum.
• Bonne maîtrise des outils bureautiques, notamment Outlook et Excel.
• Expérience en gestion des réseaux sociaux et en création de contenus.
• Connaissance de CapCut ou d’un logiciel équivalent.
• Rigueur, autonomie, sens de l’organisation et bonnes capacités rédactionnelles.

PRINCIPALES MISSIONS

• Assurer le suivi administratif et les tâches de secrétariat.
• Participer à l’organisation des réunions, événements et visites officielles.
• Contribuer à la gestion des réseaux sociaux de l’ambassade.
• Appuyer les activités de communication de la section PEC.
• Assurer ponctuellement des fonctions d’assistance auprès de l’Ambassadeur.

📍 Lieu : Dakar, Sénégal.
📄 Contrat : CDD de 12 mois renouvelable.
🕒 Temps de travail : 39 h 45 par semaine.
✅ Avantages : Assurance santé, 28 jours de congés annuels et fonds de retraite.

📅 DATE LIMITE : 11 NOVEMBRE 2026

CANDIDATURE DIRECTE

Envoyer un CV, une lettre de motivation, une pièce d’identité, un permis de séjour si applicable et les éventuelles attestations d’expérience à :

📩 ambassaden.dakar@gov.se

Objet du mail : Candidature – assistent administratif (PEC)

Annonce officielle consultable sur le site de l’Ambassade de Suède.$d$,
     true, v_admin, NULL, '2026-11-11', 'ambassaden.dakar@gov.se', true, 'offre_emploi');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'Publication annulée : % ligne(s) insérée(s) au lieu de 2', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id IN ('b11d6e36-0816-4428-840c-9a744d93df43', '3ebfd875-1baa-474f-a88b-f42a7ae215f5')
     AND status = 'pending_review' AND is_active = true AND is_test_account = false AND archived_at IS NULL AND recruiter_id = v_admin;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'Publication annulée : % offre(s) conforme(s) au lieu de 2', v_n;
  END IF;
END
$$;

COMMIT;
