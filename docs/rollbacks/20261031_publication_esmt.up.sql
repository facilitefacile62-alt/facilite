-- Publication d'une offre supplémentaire (31/10/2026), sur demande écrite du propriétaire : ESMT, stagiaire au Centre de carrière (Dakar).
-- Même méthode que 20261031_publication_4_offres.up.sql : aucune colonne ni migration, une transaction gardée à 1 ligne, insertion EN ATTENTE de modération
-- (le déclencheur reset_job_offer_moderation() n'est pas contourné ; l'administrateur approuve dans /admin).
-- L'adresse e-mail est celle imprimée sur l'annonce, donc déjà publique. Retour arrière : 20261031_publication_esmt.down.sql (MASQUE, ne supprime rien).
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

  IF EXISTS (SELECT 1 FROM public.job_offers WHERE id = 'ea794a5e-3784-4e00-84a8-cbabf32a25e4') THEN
    RAISE EXCEPTION 'Publication annulée : cette offre existe déjà';
  END IF;

  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, min_education_level, description, is_active, recruiter_id, image_url, deadline, contact_email, requires_cover_letter, listing_type)
  VALUES
    ('ea794a5e-3784-4e00-84a8-cbabf32a25e4', 'Stagiaire au Centre de carrière', 'ESMT', 'Dakar, Sénégal', 'Stage de trois mois renouvelables', 'Bac+3',
     $d$L’ESMT recrute un(e) stagiaire au Centre de carrière à Dakar

L’École supérieure multinationale des télécommunications recherche un profil Bac+3 en ressources humaines, gestion de projets, administration, marketing ou digital.

Le stage porte sur la communication du Centre, l’accueil des étudiants, l’organisation d’événements, le suivi administratif et la gestion de la plateforme Datalumni.

La maîtrise des outils bureautiques, des réseaux sociaux et de la communication visuelle est attendue. Une première expérience de stage est appréciée.

📍 Dakar
📄 Stage de trois mois renouvelables, avec une allocation dont le montant n’est pas précisé.
📅 Prise de poste souhaitée en novembre 2026.
⏳ Date limite : 5 novembre 2026.

Envoyez votre CV, une lettre de motivation et les copies certifiées conformes de vos diplômes à recrutement@esmt.sn.
Objet : « Stagiaire Centre de carrière »$d$,
     true, v_admin, NULL, '2026-11-05', 'recrutement@esmt.sn', true, 'offre_emploi');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : % ligne(s) insérée(s) au lieu de 1', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id = 'ea794a5e-3784-4e00-84a8-cbabf32a25e4'
     AND status = 'pending_review' AND is_active = true AND is_test_account = false AND archived_at IS NULL AND recruiter_id = v_admin;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : offre non conforme';
  END IF;
END
$$;

COMMIT;
