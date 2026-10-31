-- Retour arrière de 20261031_offres_cartes_et_textes_seo.up.sql : remet la description et l'image d'avant (valeurs lues en base juste avant la mise à jour).
-- Garde : exactement 9 lignes.
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers o
     SET description = v.description,
         image_url = v.image_url
    FROM (VALUES
      ('cf0f37d1-3930-4b80-97c5-5307d739bad4'::uuid, '/syscom_institut_assistante_direction.jpg', $d$OPPORTUNITÉ DE RECRUTEMENT | SYSCOM INSTITUT

SYSCOM INSTITUT renforce son équipe et lance un appel à candidatures pour le poste d’Assistant(e) de Direction.

Vous êtes organisé(e), dynamique, rigoureux(se) et souhaitez évoluer dans un environnement professionnel stimulant ? Cette opportunité pourrait vous correspondre !

📩 Pour postuler :
Envoyez votre dossier de candidature comprenant :
- Votre CV ;
- Une lettre de motivation.

📌 Après réception des candidatures, les profils présélectionnés seront contactés afin de convenir d’un rendez-vous pour un entretien.

Rejoignez une équipe engagée et contribuez au développement de SYSCOM INSTITUT !

📍 Adresse : Cité APIX, Almadies V.D.N 3, Tivaouane Peulh.
📞 Contact : +221 77 330 15 98

SYSCOM INSTITUT — Ensemble pour votre réussite !$d$),
      ('c7c8d329-1804-4956-a84d-ce5acd99b2d3'::uuid, NULL::text, $d$RECRUTEMENT | ONPEC Sénégal recherche un(e) Assistant(e) administratif(ve) et chargé(e) de coordination à Dakar

L’ONPEC Sénégal recherche un profil pour accompagner la gestion administrative de ses activités et renforcer la coordination avec ses partenaires.

PROFIL RECHERCHÉ

• Excellentes capacités rédactionnelles en français.
• Bonne maîtrise des outils bureautiques et collaboratifs.
• Sens de l’organisation et autonomie.
• Aisance relationnelle.
• Intérêt pour l’état civil et l’accès aux droits.
• Une expérience en administration ou en coordination associative constitue un avantage.

PRINCIPALES MISSIONS

Gérer les correspondances, organiser les réunions, assurer le suivi des décisions, coordonner les activités de terrain et contribuer aux relations avec les partenaires.

📍 Lieu : Fann Hock, Dakar.

📄 Nature de l’engagement : À confirmer auprès de l’organisation.

📅 Date limite affichée sur Tekki : 4 novembre 2026.

CANDIDATURE DIRECTE

Envoyer un CV et un court texte de motivation à :

📩 confirmation@onpec-sn.com$d$),
      ('b994aa8d-fe88-46df-8c46-cae606354d97'::uuid, NULL::text, $d$KHELCOM BACHES SARL recrute des magasiniers (minimum 1 an d’expérience).

Missions :
• Gestion et rangement du stock
• Décompte et suivi des équipements et du matériel
• Contrôle des entrées et sorties du magasin

📍 Lieu : Pikine.

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com$d$),
      ('d0568439-14da-4950-b460-67bf9f3ddea1'::uuid, NULL::text, $d$KHELCOM BACHES SARL recrute un comptable (minimum 5 ans d’expérience).

Missions :
• Suivi des opérations comptables
• Gestion des pièces comptables et des factures
• Suivi des dépenses et préparation des rapports comptables

📍 Lieu : Pikine.

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com$d$),
      ('5df5b944-5e1c-47e5-ae65-624475289a1a'::uuid, NULL::text, $d$Auchan Retail Sénégal annonce la tenue de la deuxième édition de son Salon des Métiers et des Associations, prévue du mercredi 18 au vendredi 20 novembre 2026 à l’Auchan Hypermarché Mermoz, à Dakar.

Cet événement gratuit, organisé sur trois jours, sera consacré à l’orientation professionnelle, au recrutement, à la formation, à l’entrepreneuriat et à la responsabilité sociétale des entreprises (RSE).

Le salon s’adresse notamment aux étudiants, aux jeunes diplômés, aux personnes à la recherche d’un emploi, aux professionnels, aux porteurs de projets ainsi qu’aux associations. Il leur permettra de mieux connaître les métiers de la grande distribution, de découvrir les perspectives de carrière chez Auchan Sénégal et de rencontrer des professionnels du secteur.

AU PROGRAMME : MÉTIERS, RECRUTEMENT ET FORMATIONS

Découverte des métiers de la grande distribution
Les participants pourront découvrir les différents métiers de la grande distribution à travers une immersion dans cet univers professionnel. Des présentations permettront également de mieux connaître les possibilités de recrutement et les perspectives d’évolution de carrière au sein d’Auchan Sénégal.

Rencontres professionnelles et réseautage
Le salon offrira un cadre d’échange avec des experts du secteur, des entreprises partenaires et des organisations associatives. Ces rencontres permettront aux visiteurs de développer leur réseau et de découvrir différents parcours professionnels.

Ateliers et formations
Des ateliers et des discussions porteront sur plusieurs thématiques, notamment l’employabilité, l’insertion professionnelle, l’entrepreneuriat des jeunes et les enjeux liés à la responsabilité sociétale des entreprises (RSE).

Partage d’expériences et initiatives à impact
Des initiatives ayant un impact sur la société seront présentées aux participants. Des retours d’expérience permettront également de mettre en lumière des parcours et des projets inspirants.

📍 Le rendez-vous est fixé du 18 au 20 novembre 2026, à l’Auchan Hypermarché Mermoz, à Dakar.

Site officiel du salon : https://salondesmetiers.auchan.sn/$d$),
      ('b11d6e36-0816-4428-840c-9a744d93df43'::uuid, NULL::text, $d$OFFRE D’EMPLOI | TECHNICIENS MÉTALLURGISTES

Talent Flow SUARL accompagne les entreprises et les candidats.

Dans le cadre de recrutements, nous recherchons des Techniciens métallurgistes qualifiés et motivés pour rejoindre une structure professionnelle.

PROFIL RECHERCHÉ

• Formation en métallurgie ou dans un domaine technique connexe ;
• Expérience professionnelle souhaitée dans le domaine ;
• Maîtrise des procédés métallurgiques et des techniques de contrôle, selon le poste ;
• Rigueur, esprit d’équipe et respect des règles de sécurité.

CANDIDATURE

Les personnes intéressées sont invitées à envoyer leur CV à l’adresse suivante :

📩 mansourjrngom@gmail.com

Objet du mail : Candidature – Technicien métallurgiste$d$),
      ('3ebfd875-1baa-474f-a88b-f42a7ae215f5'::uuid, NULL::text, $d$L’Ambassade de Suède au Sénégal recherche un(e) Assistant(e) administratif(ve) et de communication pour renforcer sa section politique, économique et de coopération (PEC).

Le poste associe des responsabilités administratives, la communication digitale, l’organisation d’événements et l’appui aux activités de l’ambassade.

PROFIL RECHERCHÉ

• Formation ou expérience professionnelle confirmée dans des fonctions similaires.
• Excellente maîtrise du français.
• Anglais obligatoire, niveau B2 minimum.
• Bonne maîtrise des outils bureautiques, notamment Outlook et Excel.
• Expérience en gestion des réseaux sociaux et en création de contenus.
• Connaissance de CapCut ou d’un logiciel équivalent.
• Rigueur, autonomie, sens de l’organisation et bonnes capacités rédactionnelles.

PRINCIPALES MISSIONS

• Assurer le suivi administratif et les tâches de secrétariat.
• Participer à l’organisation des réunions, événements et visites officielles.
• Contribuer à la gestion des réseaux sociaux de l’ambassade.
• Appuyer les activités de communication de la section PEC.
• Assurer ponctuellement des fonctions d’assistance auprès de l’Ambassadeur.

📍 Lieu : Dakar, Sénégal.
📄 Contrat : CDD de 12 mois renouvelable.
🕒 Temps de travail : 39 h 45 par semaine.
✅ Avantages : Assurance santé, 28 jours de congés annuels et fonds de retraite.

📅 DATE LIMITE : 11 NOVEMBRE 2026

CANDIDATURE DIRECTE

Envoyer un CV, une lettre de motivation, une pièce d’identité, un permis de séjour si applicable et les éventuelles attestations d’expérience à :

📩 ambassaden.dakar@gov.se

Objet du mail : Candidature – assistent administratif (PEC)

Annonce officielle consultable sur le site de l’Ambassade de Suède.$d$),
      ('63de30e0-943c-4d06-b97e-22496c22611d'::uuid, NULL::text, $d$GINDI RECRUTE | INGÉNIEUR·E AGROALIMENTAIRE – RÉFÉRENT·E TECHNOLOGIQUE

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

Rejoignez GINDI et contribuez à renforcer la performance, la qualité et l’innovation des entreprises agroalimentaires sénégalaises !$d$),
      ('ea794a5e-3784-4e00-84a8-cbabf32a25e4'::uuid, NULL::text, $d$L’ESMT recrute un(e) stagiaire au Centre de carrière à Dakar

L’École supérieure multinationale des télécommunications recherche un profil Bac+3 en ressources humaines, gestion de projets, administration, marketing ou digital.

Le stage porte sur la communication du Centre, l’accueil des étudiants, l’organisation d’événements, le suivi administratif et la gestion de la plateforme Datalumni.

La maîtrise des outils bureautiques, des réseaux sociaux et de la communication visuelle est attendue. Une première expérience de stage est appréciée.

📍 Dakar
📄 Stage de trois mois renouvelables, avec une allocation dont le montant n’est pas précisé.
📅 Prise de poste souhaitée en novembre 2026.
⏳ Date limite : 5 novembre 2026.

Envoyez votre CV, une lettre de motivation et les copies certifiées conformes de vos diplômes à recrutement@esmt.sn.
Objet : « Stagiaire Centre de carrière »$d$)
    ) AS v(id, image_url, description)
   WHERE o.id = v.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 9 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % ligne(s) touchée(s) au lieu de 9', v_n;
  END IF;
END
$$;

COMMIT;
