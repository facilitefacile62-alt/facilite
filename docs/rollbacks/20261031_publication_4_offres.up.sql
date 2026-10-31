-- Publication de 5 offres (31/10/2026), sur demande écrite du propriétaire : SYSCOM INSTITUT (1), ONPEC Sénégal (1), KHELCOM BACHES SARL (2 postes), Salon des Métiers Auchan (1 événement).
-- Aucune colonne ni migration : simples lignes dans public.job_offers, comme la publication depuis /admin. Une seule transaction, gardée à 5 lignes.
-- MODÉRATION : le déclencheur reset_job_offer_moderation() remet toute offre insérée « pending_review » sauf si l'insertion vient d'un administrateur connecté. Il n'est PAS
-- contourné : les 5 offres sont insérées en attente (comportement normal) et l'administrateur les approuve dans la file de modération de /admin. Tant qu'elles ne sont pas
-- approuvées, elles ne sont pas publiques.
-- Propriétaire des offres : le compte administrateur (le seul qui existe). Les candidatures de SYSCOM INSTITUT, dont l'affiche ne donne aucun e-mail, arrivent à l'adresse du compte
-- administrateur, lue ici dans le compte au moment de l'exécution (le dépôt est public : aucune adresse personnelle n'est écrite dans ce fichier). Les autres adresses et numéros
-- sont ceux imprimés sur les affiches, donc déjà publics.
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
    'cf0f37d1-3930-4b80-97c5-5307d739bad4', 'c7c8d329-1804-4956-a84d-ce5acd99b2d3', 'b994aa8d-fe88-46df-8c46-cae606354d97', 'd0568439-14da-4950-b460-67bf9f3ddea1',
    '5df5b944-5e1c-47e5-ae65-624475289a1a'
  )) THEN
    RAISE EXCEPTION 'Publication annulée : une de ces offres existe déjà';
  END IF;

  -- status n'est pas renseigné : la valeur par défaut est « pending_review » (file de modération).
  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, description, is_active, recruiter_id, image_url, deadline, contact_email, contact_phone, external_link, requires_cover_letter, listing_type)
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
     true, v_admin, '/syscom_institut_assistante_direction.jpg', NULL, v_email, '+221 77 330 15 98', NULL, true, 'offre_emploi'),

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
     true, v_admin, NULL, '2026-11-04', 'confirmation@onpec-sn.com', NULL, NULL, true, 'offre_emploi'),

    -- 3. KHELCOM BACHES SARL : magasiniers (minimum 1 an d'expérience)
    ('b994aa8d-fe88-46df-8c46-cae606354d97', 'Magasiniers', 'KHELCOM BACHES SARL', 'Pikine, Sénégal', NULL,
     $d$KHELCOM BACHES SARL recrute des magasiniers (minimum 1 an d’expérience).

Missions :
• Gestion et rangement du stock
• Décompte et suivi des équipements et du matériel
• Contrôle des entrées et sorties du magasin

📍 Lieu : Pikine.

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com$d$,
     true, v_admin, NULL, NULL, 'rh-recrutement@khelcombache.com', NULL, NULL, false, 'offre_emploi'),

    -- 4. KHELCOM BACHES SARL : comptable (minimum 5 ans d'expérience)
    ('d0568439-14da-4950-b460-67bf9f3ddea1', 'Comptable', 'KHELCOM BACHES SARL', 'Pikine, Sénégal', NULL,
     $d$KHELCOM BACHES SARL recrute un comptable (minimum 5 ans d’expérience).

Missions :
• Suivi des opérations comptables
• Gestion des pièces comptables et des factures
• Suivi des dépenses et préparation des rapports comptables

📍 Lieu : Pikine.

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com$d$,
     true, v_admin, NULL, NULL, 'rh-recrutement@khelcombache.com', NULL, NULL, false, 'offre_emploi'),

    -- 5. Auchan Retail Sénégal : salon (événement gratuit, pas un emploi) -> type « autre » ; destination = site officiel du salon ; l'événement se termine le 20 novembre 2026
    ('5df5b944-5e1c-47e5-ae65-624475289a1a', 'Salon des Métiers et des Associations – 2e édition', 'Auchan Retail Sénégal', 'Auchan Hypermarché Mermoz, Dakar', NULL,
     $d$Auchan Retail Sénégal annonce la tenue de la deuxième édition de son Salon des Métiers et des Associations, prévue du mercredi 18 au vendredi 20 novembre 2026 à l’Auchan Hypermarché Mermoz, à Dakar.

Cet événement gratuit, organisé sur trois jours, sera consacré à l’orientation professionnelle, au recrutement, à la formation, à l’entrepreneuriat et à la responsabilité sociétale des entreprises (RSE).

Le salon s’adresse notamment aux étudiants, aux jeunes diplômés, aux personnes à la recherche d’un emploi, aux professionnels, aux porteurs de projets ainsi qu’aux associations. Il leur permettra de mieux connaître les métiers de la grande distribution, de découvrir les perspectives de carrière chez Auchan Sénégal et de rencontrer des professionnels du secteur.

AU PROGRAMME : MÉTIERS, RECRUTEMENT ET FORMATIONS

Découverte des métiers de la grande distribution
Les participants pourront découvrir les différents métiers de la grande distribution à travers une immersion dans cet univers professionnel. Des présentations permettront également de mieux connaître les possibilités de recrutement et les perspectives d’évolution de carrière au sein d’Auchan Sénégal.

Rencontres professionnelles et réseautage
Le salon offrira un cadre d’échange avec des experts du secteur, des entreprises partenaires et des organisations associatives. Ces rencontres permettront aux visiteurs de développer leur réseau et de découvrir différents parcours professionnels.

Ateliers et formations
Des ateliers et des discussions porteront sur plusieurs thématiques, notamment l’employabilité, l’insertion professionnelle, l’entrepreneuriat des jeunes et les enjeux liés à la responsabilité sociétale des entreprises (RSE).

Partage d’expériences et initiatives à impact
Des initiatives ayant un impact sur la société seront présentées aux participants. Des retours d’expérience permettront également de mettre en lumière des parcours et des projets inspirants.

📍 Le rendez-vous est fixé du 18 au 20 novembre 2026, à l’Auchan Hypermarché Mermoz, à Dakar.

Site officiel du salon : https://salondesmetiers.auchan.sn/$d$,
     true, v_admin, NULL, '2026-11-20', NULL, NULL, 'https://salondesmetiers.auchan.sn/', false, 'autre');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'Publication annulée : % ligne(s) insérée(s) au lieu de 5', v_n;
  END IF;

  -- Garde finale : les 5 offres existent, actives, en attente de modération, rattachées au compte administrateur.
  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id IN ('cf0f37d1-3930-4b80-97c5-5307d739bad4', 'c7c8d329-1804-4956-a84d-ce5acd99b2d3', 'b994aa8d-fe88-46df-8c46-cae606354d97', 'd0568439-14da-4950-b460-67bf9f3ddea1', '5df5b944-5e1c-47e5-ae65-624475289a1a')
     AND status = 'pending_review' AND is_active = true AND is_test_account = false AND archived_at IS NULL AND recruiter_id = v_admin;
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'Publication annulée : % offre(s) conforme(s) au lieu de 5', v_n;
  END IF;
END
$$;

COMMIT;
