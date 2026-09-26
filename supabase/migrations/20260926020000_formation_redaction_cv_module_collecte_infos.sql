-- Deuxième module de la formation "Rédaction de CV" — nouveau module
-- (distinct du module 1 "Structure du CV"), ordre=2.
--
-- Écart signalé : l'énoncé fourni par l'utilisateur annonce "5 questions de
-- quiz" mais n'en liste réellement que 4 (numérotées 1 à 4). Insérées
-- telles quelles, aucune 5e question inventée pour compléter le compte —
-- même principe "n'invente jamais" que celui appliqué au prompt
-- d'extraction IA des affiches (commit 6f184a6). À confirmer avec
-- l'utilisateur si une 5e question doit être ajoutée plus tard.

INSERT INTO public.formation_redaction_cv_modules (id, titre, description, contenu_texte, video_url, ordre)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'Collecte des informations — Informations personnelles',
  'Les informations personnelles exactes à demander au client, et les deux informations à ne jamais inclure sur un CV.',
  'Lors de la collecte des informations personnelles auprès du client, le rédacteur doit demander exactement :
- Nom
- Prénom
- Numéro de téléphone
- Adresse e-mail
- Adresse de localité
- Permis de conduire (uniquement si le candidat en possède un)

Deux informations ne doivent JAMAIS être demandées ni incluses sur le CV : l''âge et la situation matrimoniale — même si c''est un réflexe courant sur un CV classique, ce n''est pas la pratique retenue ici.',
  NULL,
  2
);

INSERT INTO public.formation_redaction_cv_quiz_questions (module_id, question, choix, bonne_reponse_index, ordre)
VALUES
  (
    '00000000-0000-4000-8000-000000000002',
    'Quelles informations personnelles doit-on collecter chez le client ?',
    '["Nom, Prénom, Âge, E-mail", "Nom, Prénom, Numéro, E-mail, Adresse de localité, Permis", "Nom, Prénom, Situation matrimoniale, Numéro", "Nom, Prénom, Numéro, Date de naissance"]'::jsonb,
    1,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Laquelle de ces informations ne doit JAMAIS être demandée au client ?',
    '["Le numéro de téléphone", "L''adresse e-mail", "L''âge", "L''adresse de localité"]'::jsonb,
    2,
    2
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Le permis de conduire doit-il toujours figurer sur le CV ?',
    '["Oui, systématiquement obligatoire", "Non, uniquement si le candidat en possède un", "Non, jamais inclus", "Oui, mais seulement pour les postes de chauffeur"]'::jsonb,
    1,
    3
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Un rédacteur ajoute par réflexe "Situation matrimoniale : Célibataire" sur un CV. Est-ce correct ?',
    '["Oui, c''est une bonne pratique standard", "Non, cette information ne doit jamais être incluse", "Oui, si le client est marié seulement", "Non, seulement si le candidat est mineur"]'::jsonb,
    1,
    4
  );
