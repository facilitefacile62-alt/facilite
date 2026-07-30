-- Script de publication officielle pour l'offre d'emploi KFC Sénégal
-- Insère l'offre complète "Équipiers Polyvalents en Formation" dans public.job_offers

INSERT INTO public.job_offers (
  title,
  company,
  location,
  contract_type,
  description,
  requirements,
  contact_email,
  status,
  is_active,
  created_at
) VALUES (
  'Équipiers Polyvalents en Formation',
  'KFC Sénégal',
  'Dakar, Sénégal',
  'CDD / Formation',
  'KFC Sénégal recrute des ÉQUIPIERS POLYVALENTS EN FORMATION pour accompagner ses prochaines ouvertures de restaurants.\n\nCe que nous offrons :\n- Une formation complète et accompagnée\n- Des opportunités d''évolution\n- Un environnement de travail stimulant et bienveillant\n- Avantages repas et autres bénéfices',
  '- Souriant(e) et motivé(e)\n- Dynamique et esprit d''équipe\n- Ponctuel(le) et engagé(e)\n- Désireux(se) d''apprendre',
  'recrutement@kfcsenegal.com',
  'published',
  true,
  NOW()
);
