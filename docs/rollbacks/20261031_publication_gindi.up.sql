-- Publication d'une offre supplémentaire (31/10/2026), sur demande écrite du propriétaire : GINDI, Ingénieur·e agroalimentaire – Référent·e technologique.
-- Même méthode que 20261031_publication_4_offres.up.sql : aucune colonne ni migration, une transaction gardée à 1 ligne, insertion EN ATTENTE de modération
-- (le déclencheur reset_job_offer_moderation() n'est pas contourné ; l'administrateur approuve dans /admin).
-- L'adresse e-mail et le numéro sont ceux imprimés sur l'annonce, donc déjà publics. Aucune date limite n'est donnée (prise de poste en novembre 2026).
-- Retour arrière : 20261031_publication_gindi.down.sql (MASQUE, ne supprime rien).
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

  IF EXISTS (SELECT 1 FROM public.job_offers WHERE id = '63de30e0-943c-4d06-b97e-22496c22611d') THEN
    RAISE EXCEPTION 'Publication annulée : cette offre existe déjà';
  END IF;

  INSERT INTO public.job_offers
    (id, title, company, location, contract_type, description, is_active, recruiter_id, image_url, deadline, contact_email, contact_phone, requires_cover_letter, listing_type)
  VALUES
    ('63de30e0-943c-4d06-b97e-22496c22611d', 'Ingénieur·e agroalimentaire – Référent·e technologique', 'GINDI', 'Dakar, Sénégal', '10 mois renouvelable, à temps plein',
     $d$GINDI RECRUTE | INGÉNIEUR·E AGROALIMENTAIRE – RÉFÉRENT·E TECHNOLOGIQUE

Vous êtes ingénieur·e ou technologue en agroalimentaire et souhaitez mettre votre expertise au service du développement des PME agroalimentaires au Sénégal ? Cette opportunité est pour vous !

Le Groupe d’Initiatives pour un Développement Intégré (GINDI) recrute un·e Ingénieur·e Agroalimentaire – Référent·e Technologique pour accompagner les TPE et PME du secteur dans l’amélioration de leurs procédés, la maîtrise de la qualité, l’innovation et l’adoption de solutions technologiques durables.

🎯 PROFIL RECHERCHÉ :
- Formation en ingénierie ou technologie agroalimentaire ;
- 2 à 3 ans d’expérience professionnelle ;
- Compétences en procédés de transformation, qualité, hygiène et sécurité alimentaire ;
- Autonomie, rigueur et bonnes capacités de communication.

📍 Lieu : Dakar, avec des déplacements réguliers à Thiès
📄 Contrat : 10 mois renouvelable, à temps plein
📅 Prise de poste : Novembre 2026

📩 POUR POSTULER :

Envoyez votre CV et votre lettre de motivation à : contact.gindi@gmail.com

📞 Informations complémentaires : 33 824 73 88

Rejoignez GINDI et contribuez à renforcer la performance, la qualité et l’innovation des entreprises agroalimentaires sénégalaises !$d$,
     true, v_admin, NULL, NULL, 'contact.gindi@gmail.com', '33 824 73 88', true, 'offre_emploi');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : % ligne(s) insérée(s) au lieu de 1', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.job_offers
   WHERE id = '63de30e0-943c-4d06-b97e-22496c22611d'
     AND status = 'pending_review' AND is_active = true AND is_test_account = false AND archived_at IS NULL AND recruiter_id = v_admin;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Publication annulée : offre non conforme';
  END IF;
END
$$;

COMMIT;
