-- Module 5 de la formation "Rédaction de CV" — Profil professionnel,
-- Modèle 3 : reconversion professionnelle.

INSERT INTO public.formation_redaction_cv_modules (id, titre, description, contenu_texte, video_url, ordre)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  'Profil professionnel — Modèle 3 : Profil de reconversion professionnelle',
  'Comment présenter une reconversion choisie (domaine A vers domaine B) comme une évolution logique, pas une rupture.',
  'Le profil de reconversion professionnelle désigne le résumé de CV adapté aux candidats qui possèdent une expérience solide dans un domaine A, mais choisissent délibérément de se repositionner vers un domaine B — par choix de redirection, pas par nécessité immédiate comme dans le profil d''opportunité.

Caractéristiques clés :
- Traduction de compétences : les compétences acquises dans le domaine A (souvent transversales : gestion, communication, organisation, relation client, gestion de projet) sont reformulées pour parler directement au domaine B visé.
- Fil conducteur cohérent : la reconversion n''est jamais présentée comme une rupture, mais comme une évolution logique, avec une raison claire (formation suivie, intérêt de longue date, opportunité saisie).
- Preuve d''engagement dans le nouveau domaine : mention d''une formation, certification, projet personnel ou stage récent dans le domaine B, qui légitime la démarche au-delà de la simple intention.

Structure d''un profil de reconversion :
1. Ancrage dans le nouveau domaine visé : l''intitulé du poste visé dans le domaine B est présenté en premier — pas l''ancien métier.
2. Passerelle explicite : une phrase courte reliant clairement l''expérience du domaine A au domaine B visé.
3. Compétences transférables : 2 à 3 compétences concrètes issues du domaine A ayant une vraie valeur dans le domaine B.
4. Légitimité nouvelle : la formation, certification ou le projet qui prouve l''engagement réel dans cette reconversion.

Modèle de rédaction pour ce type de profil :
« Fort(e) de [X] années d''expérience en tant que [Métier du domaine A], je me suis récemment formé(e) en [Domaine B / nom de la formation] pour évoluer vers un poste de [Intitulé du poste visé]. Cette transition me permet de mobiliser des compétences solides en [Compétence transférable 1] et [Compétence transférable 2], acquises sur le terrain, au service de [objectif ou secteur visé]. Déterminé(e) à réussir cette reconversion, j''apporte à la fois la maturité professionnelle de mon ancien métier et une motivation renouvelée pour [Domaine B]. »',
  NULL,
  5
);

INSERT INTO public.formation_redaction_cv_quiz_questions (module_id, question, choix, bonne_reponse_index, ordre)
VALUES
  (
    '00000000-0000-4000-8000-000000000005',
    'Qu''est-ce qui distingue le profil de reconversion du profil d''opportunité (Modèle 2) ?',
    '["Le premier est un choix stratégique de redirection, pas une nécessité immédiate", "Les deux sont identiques", "Le profil de reconversion cache toujours son passé", "Il ne mentionne jamais l''ancien métier"]'::jsonb,
    0,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'Dans le profil de reconversion, comment doit-on traiter l''expérience passée (domaine A) ?',
    '["La cacher complètement", "La traduire en compétences transférables utiles au nouveau domaine", "La mettre en toute dernière position", "L''ignorer et ne parler que du domaine B"]'::jsonb,
    1,
    2
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'Quel élément apporte de la légitimité à une reconversion aux yeux du recruteur ?',
    '["Le seul fait de vouloir changer de métier", "Une formation, certification ou projet récent dans le nouveau domaine", "Le nombre d''années dans l''ancien métier uniquement", "Rien n''est nécessaire, l''intention suffit"]'::jsonb,
    1,
    3
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'Dans la structure du profil de reconversion, quel élément vient en premier ?',
    '["L''ancien métier", "Le poste visé dans le nouveau domaine", "Les qualités personnelles", "La situation familiale"]'::jsonb,
    1,
    4
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'Une personne avec 8 ans d''expérience en comptabilité se forme au développement web et vise un poste de développeur. Quel modèle utiliser ?',
    '["Modèle 1 (linéaire)", "Modèle 2 (opportunité)", "Modèle 3 (reconversion)", "Aucun profil n''est nécessaire"]'::jsonb,
    2,
    5
  );
