-- Modules 3 et 4 de la formation "Rédaction de CV" — les deux modèles de
-- profil professionnel. Le module 4 inclut le complément (profil universel
-- "Polyvalence & Adaptabilité" + règle valeur-ajoutée-vs-demande + tableau
-- de synthèse) directement dans sa leçon, en un seul texte continu, comme
-- demandé explicitement par l'utilisateur.

INSERT INTO public.formation_redaction_cv_modules (id, titre, description, contenu_texte, video_url, ordre)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  'Profil professionnel — Modèle 1 : Profil linéaire (expert spécialisé)',
  'Le profil linéaire (expert spécialisé) : pour les candidats dont diplôme, spécialisation et carrière s''inscrivent dans une continuité parfaite.',
  'Le profil professionnel linéaire (ou profil d''expert spécialisé) désigne le résumé rédigé en tête de CV pour les candidats dont les diplômes, la spécialisation et la carrière s''inscrivent dans une continuité parfaite au sein d''un même domaine.

Caractéristiques clés :
- Alignement complet : les diplômes obtenus correspondent directement aux postes occupés en entreprise.
- Capitalisation de l''expérience : chaque étape professionnelle renforce l''expertise acquise lors des études et lors des fonctions précédentes.
- Objectif recruteur : valoriser une maîtrise technique éprouvée, une crédibilité immédiate et une progression constante dans le secteur.

Structure d''un profil d''expert qualifié :
1. Intitulé du poste & niveau d''expérience : titre clair accompagné du nombre d''années de pratique.
2. Ancrage académique et sectoriel : mention de la formation initiale ou du diplôme de référence venant appuyer la pratique sur le terrain.
3. Cœur d''expertise : présentation des compétences majeures développées à travers la diversité des entreprises fréquentées.
4. Valeur ajoutée : résultat clé ou bénéfice concret que le candidat apporte à l''organisation cible.

Modèle de rédaction pour ce type de profil :
« [Intitulé du poste] diplômé(e) en [Domaine d''études], fort(e) de [X] années d''expérience continue dans le secteur de [Secteur d''activité]. Fort(e) d''un parcours accompli au sein de plusieurs entreprises du secteur, j''ai développé une expertise solide en [Compétence 1], [Compétence 2] et [Compétence 3]. Reconnu(e) pour [Projet majeur ou qualité professionnelle], je mets ma maîtrise technique au service de [Objectif de l''entreprise recruteuse]. »',
  NULL,
  3
);

INSERT INTO public.formation_redaction_cv_quiz_questions (module_id, question, choix, bonne_reponse_index, ordre)
VALUES
  (
    '00000000-0000-4000-8000-000000000003',
    'Le profil professionnel linéaire s''applique à quel type de candidat ?',
    '["Quelqu''un qui change souvent de secteur", "Quelqu''un dont diplôme, spécialisation et carrière sont dans la continuité d''un même domaine", "Un jeune diplômé sans expérience", "Quelqu''un en reconversion professionnelle"]'::jsonb,
    1,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Quel est l''objectif recruteur du profil linéaire ?',
    '["Montrer de la polyvalence", "Valoriser une maîtrise technique éprouvée, une crédibilité immédiate et une progression constante", "Cacher un manque d''expérience", "Mettre en avant des qualités humaines uniquement"]'::jsonb,
    1,
    2
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Quels sont les 4 éléments de la structure d''un profil d''expert qualifié, dans l''ordre ?',
    '["Compétences, Diplôme, Poste, Valeur ajoutée", "Intitulé du poste & expérience, Ancrage académique/sectoriel, Cœur d''expertise, Valeur ajoutée", "Objectif, Formation, Expérience, Qualités", "Poste, Salaire souhaité, Compétences, Contact"]'::jsonb,
    1,
    3
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Dans le modèle de rédaction, que doit-on préciser juste après l''intitulé du poste ?',
    '["Le nom de l''entreprise actuelle", "Le domaine d''études et le nombre d''années d''expérience", "Les qualités personnelles", "La date de naissance"]'::jsonb,
    1,
    4
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Qu''est-ce qui caractérise la "capitalisation de l''expérience" dans ce modèle ?',
    '["Chaque étape professionnelle renforce l''expertise acquise lors des études et fonctions précédentes", "Chaque expérience est indépendante des autres", "Seule la dernière expérience compte", "L''expérience ne compte pas, seul le diplôme importe"]'::jsonb,
    0,
    5
  );

INSERT INTO public.formation_redaction_cv_modules (id, titre, description, contenu_texte, video_url, ordre)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  'Profil professionnel — Modèle 2 : Profil d''opportunité (débutant / job étudiant)',
  'Le profil d''opportunité et sa version universelle "Polyvalence & Adaptabilité", pour tout candidat hors de son domaine de formation.',
  'Le profil d''opportunité (ou profil débutant / job étudiant) désigne le résumé de CV adapté aux personnes qui occupent ou postulent un emploi en dehors de leur formation initiale ou sans expérience préalable (premier emploi, job d''appoint, opportunité de transition).

Caractéristiques clés :
- Focus sur le savoir-être (Soft Skills) : la rigueur, le sens du service client, la ponctualité et la réactivité remplacent l''expérience technique.
- Valorisation des compétences transversales : exploitation des atouts développés au cours du parcours scolaire ou personnel (sens de l''organisation, aisance relationnelle, capacité à travailler sous pression).
- Objectif d''efficacité immédiate : l''accent est mis sur la capacité d''apprentissage rapide, la polyvalence et la volonté de répondre aux besoins opérationnels de l''entreprise.

Structure d''un profil d''opportunité :
1. Statut actuel & Disponibilité : la situation (ex. élève en Terminale, étudiant, candidat en recherche) et la motivation.
2. Atouts personnels majeurs : dynamisme, sérieux, aisance relationnelle, capacité d''adaptation.
3. Aptitudes opérationnelles : capacité à accueillir la clientèle, gérer la caisse, respecter des consignes ou maintenir la tenue d''un commerce.
4. Engagement professionnel : volonté explicite d''apporter une valeur concrète à l''équipe dès la prise de poste.

Modèle de rédaction (exemple : élève de Terminale pour un poste de caisse/vente) :
« Élève en classe de Terminale, [dynamique / rigoureux(se) / motivé(e)] et doté(e) d''un excellent sens du relationnel. À la recherche d''une opportunité en tant que [ex. Caissier(ère) / Vendeur(se) en boutique], je souhaite mettre mon enthousiasme, ma ponctualité et ma rapidité d''apprentissage au service de votre enseigne. Volontaire et appliqué(e), je m''adapte rapidement aux consignes de travail, à la tenue de la caisse et à l''accueil des clients pour assurer un service fluide et soigné. »

Règle de rédaction importante, valable pour tous les profils professionnels : on n''écrit jamais « à la recherche d''un stage » (ou d''un autre type de contrat) dans le profil professionnel. Le profil professionnel décrit la valeur ajoutée du candidat (ce qu''il apporte), jamais sa demande (ce qu''il cherche). La demande explicite (type de contrat, stage, disponibilité) trouve sa place dans le titre du CV (ex. « CV — Élève de Terminale — Recherche de stage ») et dans la lettre de motivation.

Synthèse des 2 modèles de profil professionnel :

• Profil cible
  - Modèle 1 (Expertise) : professionnel expérimenté/diplômé dans son domaine
  - Modèle 2 (Opportunité) : élève, étudiant, reconversion, ou poste hors domaine

• Levier principal
  - Modèle 1 : diplômes alignés + années d''expérience validées
  - Modèle 2 : savoir-être, capacité d''apprentissage, rigueur, motivation

• Objectif de l''accroche
  - Modèle 1 : prouver une maîtrise technique immédiate
  - Modèle 2 : rassurer sur la capacité d''adaptation et le sérieux

• Message transmis
  - Modèle 1 : « J''ai la formation et l''expérience exacte pour ce poste »
  - Modèle 2 : « Je n''ai pas le parcours type, mais j''ai la rigueur et l''énergie nécessaires »

Important : le Modèle 2 ne concerne pas que les étudiants — il concerne toute personne en recherche d''emploi (profil intermédiaire, adulte en transition, candidat polyvalent) qui accepte un poste hors de son domaine, par nécessité ou opportunité. Ce modèle universel s''appelle « Profil Polyvalence & Adaptabilité », porté par 3 valeurs clés : l''adaptabilité, la polyvalence et la détermination.

Structure du profil Polyvalence & Adaptabilité (tous profils) :
1. Posture professionnelle : réactivité, sérieux, détermination (plutôt qu''un diplôme spécifique).
2. Atouts comportementaux : organisation, apprentissage rapide, résistance au rythme de travail, sens du service.
3. Engagement opérationnel : application des consignes, respect des procédures, intégration rapide en équipe.

Modèle de rédaction universel (adulte / profil intermédiaire) :
« Professionnel(le) polyvalent(e) et déterminé(e), reconnu(e) pour ma grande capacité d''adaptation et mon sens de l''engagement. Habitué(e) à assimiler rapidement de nouvelles procédures, je mets ma rigueur, mon aisance relationnelle et mon efficacité opérationnelle au service du poste de [Intitulé du poste]. Fiable et réactif(ve), je m''intègre immédiatement pour garantir un service fluide et la satisfaction des clients. »',
  NULL,
  4
);

INSERT INTO public.formation_redaction_cv_quiz_questions (module_id, question, choix, bonne_reponse_index, ordre)
VALUES
  (
    '00000000-0000-4000-8000-000000000004',
    'À qui s''adresse le profil d''opportunité ?',
    '["Un expert avec 10 ans d''expérience dans son domaine", "Quelqu''un qui occupe/postule un emploi en dehors de sa formation ou sans expérience préalable", "Un cadre en poste de direction", "Un candidat avec plusieurs diplômes dans le même secteur"]'::jsonb,
    1,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Sur quoi ce profil met-il l''accent, plutôt que sur l''expérience technique ?',
    '["Le salaire souhaité", "Le savoir-être : rigueur, sens du service, ponctualité, réactivité", "Les diplômes uniquement", "L''ancienneté dans l''entreprise"]'::jsonb,
    1,
    2
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Un élève de Terminale postule comme caissier sans expérience du domaine. Quel modèle de profil professionnel utiliser ?',
    '["Le profil linéaire (expert spécialisé)", "Le profil d''opportunité", "Aucun profil n''est nécessaire dans ce cas", "Le même que pour un cadre expérimenté"]'::jsonb,
    1,
    3
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Quel est le premier élément de la structure d''un profil d''opportunité ?',
    '["Aptitudes opérationnelles", "Statut actuel et disponibilité", "Engagement professionnel", "Diplôme de référence"]'::jsonb,
    1,
    4
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Que signifie "valorisation des compétences transversales" dans ce modèle ?',
    '["Mettre en avant uniquement les diplômes techniques", "Exploiter les atouts développés dans le parcours scolaire/personnel, même hors du domaine visé", "Ignorer le parcours scolaire", "Se concentrer sur l''expérience professionnelle passée uniquement"]'::jsonb,
    1,
    5
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Doit-on écrire "à la recherche d''un stage" dans le profil professionnel ?',
    '["Oui toujours", "Non, cette demande va dans le titre du CV et la lettre de motivation", "Oui mais seulement pour les stages", "Non, les stages ne doivent jamais être mentionnés nulle part"]'::jsonb,
    1,
    6
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Quelle est la règle de fond derrière cette interdiction ?',
    '["Le profil doit décrire la valeur ajoutée, pas la demande", "Le profil doit toujours rester très court", "Les stages ne sont pas autorisés sur Facilité", "Le profil professionnel remplace la lettre de motivation"]'::jsonb,
    0,
    7
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Où doit-on préciser le type de contrat recherché (ex : stage) ?',
    '["Dans les compétences clés", "Dans le titre du CV et la lettre de motivation", "Dans la section Contact", "Nulle part"]'::jsonb,
    1,
    8
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Le Modèle 2 (profil d''opportunité) concerne-t-il uniquement les étudiants ?',
    '["Oui, exclusivement les étudiants", "Non, toute personne en recherche d''emploi prenant un poste hors de son domaine", "Oui, sauf les élèves de Terminale", "Non, uniquement les cadres"]'::jsonb,
    1,
    9
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Quelles sont les 3 valeurs clés du modèle universel "Polyvalence & Adaptabilité" ?',
    '["Diplôme, expérience, salaire", "Adaptabilité, polyvalence, détermination", "Âge, situation matrimoniale, permis", "Ancienneté, spécialisation, diplôme"]'::jsonb,
    1,
    10
  );
