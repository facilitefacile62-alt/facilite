-- Publication de la dernière offre reçue (01/11/2026), sur demande écrite du propriétaire : FHI 360, Assistant(e) de programme (Dakar), référence 2026201564.
-- Même méthode que les scripts précédents : aucune colonne ni migration, une transaction gardée à 1 ligne, insertion EN ATTENTE de modération (le déclencheur
-- reset_job_offer_moderation() n'est pas contourné ; l'administrateur approuve dans /admin).
-- L'affiche ne donne NI e-mail NI lien (« Candidature en ligne », lien dans la publication LinkedIn). Comme pour SYSCOM INSTITUT et sur la même décision du propriétaire, les
-- candidatures arrivent à l'adresse du compte administrateur, lue ici dans le compte à l'exécution (le dépôt est public : aucune adresse personnelle n'est écrite).
-- À REMPLACER dès que le lien ou l'e-mail de FHI 360 est connu. Retour arrière : 20261101_publication_fhi360.down.sql (MASQUE, ne supprime rien).
BEGIN;

DO $$
DECLARE
  v_admin uuid;
  v_email text;
  v_n     integer;
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

  IF EXISTS (SELECT 1 FROM public.job_offers WHERE id = '5629089e-b877-4dba-8433-7350e5005b5e') THEN
    RAISE EXCEPTION 'Publication annulée : cette offre existe déjà';
  END IF;

  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, min_education_level, description, is_active, recruiter_id, image_url, deadline, contact_email, requires_cover_letter, listing_type)
  VALUES
    ('5629089e-b877-4dba-8433-7350e5005b5e', 'Assistant(e) de programme', 'FHI 360', 'Dakar, Sénégal', NULL, 'Bac+2',
     $d$FHI 360 recrute un(e) Assistant(e) de programme à Dakar (Sénégal), pour un appui administratif et logistique aux projets. Référence de l’offre : 2026201564.

PROFIL RECHERCHÉ

• Bac+2 dans un domaine pertinent
• Expérience débutante acceptée
• Français courant

MISSION

• Appui administratif et logistique aux projets

CONDITIONS

• Lieu : Dakar, Sénégal.
• Référence : 2026201564.
• Date limite de candidature : 4 novembre 2026.

COMMENT POSTULER

Candidature en ligne (référence 2026201564). L’annonce complète et le lien direct figurent dans la publication LinkedIn de FHI 360.$d$,
     true, v_admin, '/affiche-fhi-360-assistant-programme.webp', '2026-11-04', v_email, false, 'offre_emploi');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : % ligne(s) insérée(s) au lieu de 1', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id = '5629089e-b877-4dba-8433-7350e5005b5e'
     AND status = 'pending_review' AND is_active = true AND is_test_account = false AND archived_at IS NULL AND recruiter_id = v_admin;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : offre non conforme';
  END IF;
END
$$;

COMMIT;
