-- Premier vrai contenu de la formation "Rédaction de CV" — remplace le
-- module factice (00000000-0000-4000-8000-000000000001, 20260925140000) par
-- le premier vrai module fourni par l'utilisateur : "Structure du CV".
-- Réutilise le même id/ordre plutôt que d'en créer un second (pas de raison
-- de garder les deux : le contenu factice n'a jamais été vu par un vrai
-- utilisateur, seulement testé pendant la construction de l'écran).
--
-- "D'autres modules suivront" (dixit l'utilisateur) : ajoute donc
-- contenu_texte, une leçon texte qui tient lieu de vidéo en attendant le
-- vrai contenu vidéo — distincte de "description" (déjà utilisée comme
-- résumé court affiché dans la liste des modules, écran 2) pour ne pas lui
-- faire porter deux rôles différents.

ALTER TABLE public.formation_redaction_cv_modules
  ADD COLUMN IF NOT EXISTS contenu_texte TEXT;

UPDATE public.formation_redaction_cv_modules
SET
  titre = 'Structure du CV',
  description = 'Les 7 sections obligatoires d''un CV, et la seule condition pour en ajouter une 8e, facultative.',
  contenu_texte = 'Un CV doit toujours contenir 7 sections obligatoires : Profil professionnel, Expériences professionnelles, Formation et diplômes, Compétences clés, Langues, Contact (numéro, e-mail, adresse/localité, permis si disponible), et Informatique.

Une section supplémentaire, Qualités professionnelles, n''est PAS obligatoire — elle ne doit être ajoutée que si les 4 sections suivantes sont déjà toutes présentes et remplies : Profil professionnel, Expériences professionnelles, Formation et diplôme, Compétences clés.'
WHERE id = '00000000-0000-4000-8000-000000000001';

-- Les 2 questions factices ("longueur du CV", "orthographe") ne portaient
-- pas sur ce contenu réel : remplacées, pas conservées à côté (un quiz
-- mélangeant deux sujets n'aurait aucun sens).
DELETE FROM public.formation_redaction_cv_quiz_questions
WHERE module_id = '00000000-0000-4000-8000-000000000001';

INSERT INTO public.formation_redaction_cv_quiz_questions (module_id, question, choix, bonne_reponse_index, ordre)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'Combien de sections sont considérées comme obligatoires de base dans un CV ?',
    '["5", "6", "7", "8"]'::jsonb,
    2,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'Laquelle de ces sections n''est PAS obligatoire de base ?',
    '["Langues", "Compétences clés", "Qualités professionnelles", "Formation et diplômes"]'::jsonb,
    2,
    2
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'Un candidat a un Profil professionnel, des Expériences professionnelles et une Formation renseignés, mais pas encore de Compétences clés. Peut-on ajouter la section Qualités professionnelles ?',
    '["Oui toujours", "Non, il manque une des 4 sections requises", "Oui si le candidat le demande", "Non jamais"]'::jsonb,
    1,
    3
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'Que doit contenir la section Contact d''un CV ?',
    '["Numéro et e-mail uniquement", "Numéro, e-mail, adresse/localité et permis si disponible", "Numéro, e-mail et réseaux sociaux", "Adresse complète et date de naissance"]'::jsonb,
    1,
    4
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'Quelles sont les 4 sections qui, une fois toutes présentes, autorisent l''ajout de Qualités professionnelles ?',
    '["Profil, Contact, Langues, Informatique", "Profil, Expériences professionnelles, Formation et diplôme, Compétences clés", "Expériences, Formation, Langues, Contact", "Profil, Compétences clés, Langues, Informatique"]'::jsonb,
    1,
    5
  );

-- L'exercice factice existant ("Rédigez un résumé professionnel") n'est pas
-- spécifique à ce module et reste pertinent tel quel — non touché, pas
-- demandé par l'utilisateur pour ce point.
