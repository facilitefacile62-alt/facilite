-- (1) Remplace les cartes générées par les AFFICHES D'ORIGINE (public/affiche-*.webp) pour 7 offres encore en attente de modération.
-- (2) Ajoute 3 offres reçues avec leur affiche : ENABEL (projet SyMAD), SAMA Hotels, ALIMA. FHI 360 n'est PAS ajoutée : son affiche ne donne aucune adresse ni lien de candidature.
-- Même méthode que les scripts précédents : aucune colonne ni migration, une transaction gardée (7 mises à jour, 3 insertions), offres EN ATTENTE de modération (le déclencheur
-- reset_job_offer_moderation() n'est pas contourné ; l'administrateur approuve dans /admin). Adresses et liens : ceux imprimés sur les affiches, donc déjà publics.
-- Retour arrière : 20261031_offres_affiches_et_3_nouvelles.down.sql (remet les cartes, MASQUE les 3 nouvelles offres, ne supprime rien).
BEGIN;

DO $$
DECLARE
  v_admin uuid;
  v_n     integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.user_roles WHERE role = 'admin';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Annulé : % compte(s) administrateur au lieu de 1', v_n;
  END IF;
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin';

  -- (1) Affiches d'origine
  UPDATE public.job_offers o
     SET image_url = v.image_url
    FROM (VALUES
      ('c7c8d329-1804-4956-a84d-ce5acd99b2d3'::uuid, '/affiche-onpec-assistant-administratif.webp'),
      ('b994aa8d-fe88-46df-8c46-cae606354d97'::uuid, '/affiche-khelcom-baches-recrute.webp'),
      ('d0568439-14da-4950-b460-67bf9f3ddea1'::uuid, '/affiche-khelcom-baches-recrute.webp'),
      ('b11d6e36-0816-4428-840c-9a744d93df43'::uuid, '/affiche-talent-flow-metallurgistes.webp'),
      ('3ebfd875-1baa-474f-a88b-f42a7ae215f5'::uuid, '/affiche-ambassade-suede-assistant.webp'),
      ('63de30e0-943c-4d06-b97e-22496c22611d'::uuid, '/affiche-gindi-ingenieur-agroalimentaire.webp'),
      ('ea794a5e-3784-4e00-84a8-cbabf32a25e4'::uuid, '/affiche-esmt-stage-centre-carriere.webp')
    ) AS v(id, image_url)
   WHERE o.id = v.id AND o.status = 'pending_review';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 7 THEN
    RAISE EXCEPTION 'Annulé : % affiche(s) remplacée(s) au lieu de 7', v_n;
  END IF;

  -- (2) Trois nouvelles offres
  IF EXISTS (SELECT 1 FROM public.job_offers WHERE id IN ('7775fbc4-8552-4733-aeb9-33926a9c8848', '346d7c1e-96cb-4a10-8c0b-654956cffd88', 'e036aa9e-fcf1-4515-9b99-100304c714b2')) THEN
    RAISE EXCEPTION 'Annulé : une de ces offres existe déjà';
  END IF;

  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, description, is_active, recruiter_id, image_url, deadline, contact_email, external_link, requires_cover_letter, listing_type)
  VALUES
    -- ENABEL, projet SyMAD : référence 24032, date limite 12 novembre 2026, candidature sur jobs.enabel.be
    ('7775fbc4-8552-4733-aeb9-33926a9c8848', 'Chargé(e) de suivi-évaluation et apprentissage', 'Enabel – Projet SyMAD', 'Dakar, Sénégal', NULL,
     $d$Enabel recrute un(e) Chargé(e) de suivi-évaluation et apprentissage pour le projet SyMAD à Dakar (Sénégal). Référence de l’offre : 24032.

PROFIL RECHERCHÉ

• Master en sciences sociales ou économie
• 3 ans d’expérience en suivi-évaluation
• Analyse de données et gestion des résultats

CONDITIONS

• Lieu : Dakar, Sénégal.
• Référence : 24032.
• Date limite de candidature : 12 novembre 2026.

COMMENT POSTULER

Candidature sur jobs.enabel.be (référence 24032).$d$,
     true, v_admin, '/affiche-enabel-suivi-evaluation-symad.webp', '2026-11-12', NULL, 'https://jobs.enabel.be', false, 'offre_emploi'),

    -- SAMA Hotels : ni lieu ni date limite sur l'affiche (« Sénégal » pour le champ obligatoire) ; CV par e-mail
    ('346d7c1e-96cb-4a10-8c0b-654956cffd88', 'Meeting & Event Coordinator', 'Sama Hotels', 'Sénégal', NULL,
     $d$Sama Hotels recrute un(e) Meeting & Event Coordinator pour assurer l’organisation et la coordination de ses réunions et événements, garantir leur bon déroulement et offrir à ses clients une expérience à la hauteur de ses standards, dans le cadre du développement de son équipe.

PROFIL RECHERCHÉ

• Expérience dans un poste similaire en hôtellerie ou dans l’événementiel.
• Sens du service, de l’accueil et de la satisfaction client.
• Excellentes capacités d’organisation, de planification et de coordination.
• Leadership, esprit d’équipe et bonne communication.
• Capacité à coordonner plusieurs événements simultanément.
• Rigueur, réactivité, autonomie et souci du détail.
• Maîtrise du français et de l’anglais appréciée.

PRINCIPALES MISSIONS

• Organiser et coordonner les réunions, séminaires et événements, de la préparation jusqu’à leur réalisation.
• Assurer le suivi des demandes clients et veiller à la bonne compréhension de leurs besoins.
• Coordonner les différents services impliqués dans l’organisation des événements.
• Veiller à la mise en place des espaces, des équipements et des prestations nécessaires.
• Assurer le suivi logistique et opérationnel des événements.
• Garantir une communication fluide entre les clients, les équipes internes et les prestataires.
• Veiller au respect des standards de qualité et à la satisfaction des clients.

COMMENT POSTULER

Intéressé(e) ? Envoyez votre CV à l’adresse suivante : info@samahotels.com.$d$,
     true, v_admin, '/affiche-sama-hotels-meeting-event-coordinator.webp', NULL, 'info@samahotels.com', NULL, false, 'offre_emploi'),

    -- ALIMA : CDD, Dakar ; candidature sur alliance.alima.ngo (CV PDF + lettre de motivation) ; pas de date limite sur l'affiche
    ('e036aa9e-fcf1-4515-9b99-100304c714b2', 'Référent(e) Ressources Humaines – Desk 3', 'ALIMA (Alliance pour la santé internationale)', 'Dakar, Sénégal', 'CDD',
     $d$ALIMA (Alliance pour la santé internationale) recrute un(e) Référent(e) Ressources Humaines – Desk 3, en CDD, à Dakar (Sénégal). Rejoignez une équipe engagée pour l’accès aux soins et le renforcement des systèmes de santé !

FORMATION ET EXPÉRIENCES

• Licence ou Master en gestion des ressources humaines ou tout autre diplôme équivalent ;
• Expérience d’au moins deux années sur un poste de coordination au sein d’une ONG internationale idéalement humanitaire avec composante RH importante (plus de 200 personnels).

LANGUES

• La maîtrise du français et de l’anglais (lu, écrit, parlé) est obligatoire.

DOSSIER DE CANDIDATURE

Seules les candidatures complètes (CV en format PDF + Lettre de Motivation) seront étudiées.

COMMENT POSTULER

Pour postuler à cette offre d’emploi, veuillez visiter alliance.alima.ngo.

Les candidatures féminines sont fortement encouragées.$d$,
     true, v_admin, '/affiche-alima-referent-rh-desk-3.webp', NULL, NULL, 'https://alliance.alima.ngo', true, 'offre_emploi');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'Annulé : % ligne(s) insérée(s) au lieu de 3', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id IN ('7775fbc4-8552-4733-aeb9-33926a9c8848', '346d7c1e-96cb-4a10-8c0b-654956cffd88', 'e036aa9e-fcf1-4515-9b99-100304c714b2')
     AND status = 'pending_review' AND is_active = true AND is_test_account = false AND archived_at IS NULL AND recruiter_id = v_admin;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'Annulé : % offre(s) conforme(s) au lieu de 3', v_n;
  END IF;
END
$$;

COMMIT;
