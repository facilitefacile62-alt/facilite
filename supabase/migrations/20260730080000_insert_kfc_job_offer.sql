-- Script de publication officielle pour l'offre d'emploi KFC Sénégal
-- Insère l'offre "Équipiers Polyvalents en Formation" dans public.job_offers.
--
-- Corrigé : la version initiale référençait des colonnes qui n'existent pas
-- sur cette table (requirements, contact_email, status) — public.job_offers
-- n'a que title/company/location/contract_type/salary_range/description/
-- is_active/image_url/min_education_level/recruiter_id/created_at/updated_at.
-- Le contenu de "requirements" et "contact_email" est repris dans
-- description ; recruiter_id reste NULL (nullable), cette offre n'étant pas
-- rattachée à un compte recruteur précis.

INSERT INTO public.job_offers (
  title,
  company,
  location,
  contract_type,
  description,
  is_active,
  created_at
) VALUES (
  'Équipiers Polyvalents en Formation',
  'KFC Sénégal',
  'Dakar, Sénégal',
  'CDD / Formation',
  E'KFC Sénégal recrute des ÉQUIPIERS POLYVALENTS EN FORMATION pour accompagner ses prochaines ouvertures de restaurants.\n\nCe que nous offrons :\n- Une formation complète et accompagnée\n- Des opportunités d''évolution\n- Un environnement de travail stimulant et bienveillant\n- Avantages repas et autres bénéfices\n\nProfil recherché :\n- Souriant(e) et motivé(e)\n- Dynamique et esprit d''équipe\n- Ponctuel(le) et engagé(e)\n- Désireux(se) d''apprendre\n\nContact : recrutement@kfcsenegal.com',
  true,
  NOW()
);
