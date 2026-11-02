-- Publication d'une offre reçue (02/11/2026), sur demande écrite du propriétaire : ANPEJ (avec le PNUD), Programme Écomobilité – Phase 2, sélection de 80 jeunes conducteurs
-- de motos-taxis (Ziguinchor, Bignona et Matam). Date limite : 11 novembre 2026 à 17 h.
-- Même méthode que les scripts précédents : aucune colonne ni migration, une transaction gardée à 1 ligne, insertion EN ATTENTE de modération (le déclencheur
-- reset_job_offer_moderation() n'est pas contourné ; l'administrateur approuve dans /admin).
-- L'affiche désigne explicitement un lien de candidature (www.paeej.anpej.sn) : il est stocké dans application_url. Aucune adresse e-mail n'y figure : contact_email reste vide.
-- Retour arrière : 20261102_publication_anpej_ecomobilite.down.sql (MASQUE, ne supprime rien).
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

  IF EXISTS (SELECT 1 FROM public.job_offers WHERE id = '33cfe28e-b147-474c-8ee4-862ca524df8f') THEN
    RAISE EXCEPTION 'Publication annulée : cette offre existe déjà';
  END IF;

  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, min_education_level, description, is_active, recruiter_id, image_url, deadline, application_url, requires_cover_letter, listing_type)
  VALUES
    ('33cfe28e-b147-474c-8ee4-862ca524df8f', 'Conducteurs de motos-taxis – Programme Écomobilité (Phase 2)', 'ANPEJ – Agence nationale pour la promotion de l’emploi des jeunes',
     'Ziguinchor, Bignona et Matam, Sénégal', NULL, NULL,
     $d$L’ANPEJ, avec le PNUD, lance un appel à candidatures pour la phase 2 du Programme Écomobilité (« Une initiative d’Écomobilité : ensemble pour une mobilité durable ! ») : sélection de 80 jeunes conducteurs de motos-taxis, répartis entre Ziguinchor, Bignona et Matam.

POSTE

• Conducteur de moto-taxi dans le cadre du Programme Écomobilité – Phase 2.
• 80 places, réparties entre Ziguinchor, Bignona et Matam.

CONDITIONS D’ÉLIGIBILITÉ

• Âge : être âgé(e) de 28 à 35 ans.
• Résidence : résider et exercer une activité de moto-taxi dans les départements de Ziguinchor, de Bignona ou de Matam.
• Permis : être titulaire d’un permis de conduire en cours de validité.
• Inscription : être inscrit dans le Système d’information sur le Marché de l’Emploi (SIME) de l’ANPEJ.

DOSSIER DE CANDIDATURE

• Une demande de candidature mentionnant le numéro d’identification du SIME.
• Une copie du certificat de nationalité de moins de 3 mois.
• Une copie du permis de conduire en cours de validité.
• Un Curriculum Vitae (CV).
• Dépôt : auprès des antennes de l’ANPEJ, avec les dossiers de candidature.

INFORMATIONS PRATIQUES

• Date limite de dépôt : du 2 au 11 novembre 2026, à 17 heures.
• Téléphone : Matam : 77 992 43 33 ; Ziguinchor : 77 967 65 44 ; Bignona : 77 554 90 45.
• Lien de candidature : www.paeej.anpej.sn$d$,
     true, v_admin, '/affiche-anpej-ecomobilite-motos-taxis.webp', '2026-11-11', 'https://www.paeej.anpej.sn', false, 'offre_emploi');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : % ligne(s) insérée(s) au lieu de 1', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id = '33cfe28e-b147-474c-8ee4-862ca524df8f'
     AND status = 'pending_review' AND is_active = true AND is_test_account = false AND archived_at IS NULL AND recruiter_id = v_admin;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : offre non conforme';
  END IF;
END
$$;

COMMIT;
