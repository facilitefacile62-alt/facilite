-- Amélioration des 9 offres publiées le 31/10/2026 (encore en attente de modération), sur demande écrite du propriétaire : texte restructuré pour la recherche Google et image par offre.
-- Aucune colonne ni migration : mise à jour de description (et image_url pour 8 offres) dans public.job_offers, une transaction gardée à 9 lignes.
-- Aucun fait nouveau : seulement ce qui figurait sur les annonces d'origine, réorganisé (phrase d'ouverture avec poste, entreprise, ville et pays, puis rubriques).
-- Les images sont des cartes générées avec les seules données de l'offre (public/carte-*.webp) ; elles seront remplacées par les affiches d'origine dès qu'elles seront transmises.
-- Les offres restent « pending_review » (le déclencheur de modération n'est pas contourné) : l'administrateur les approuve ensuite dans /admin.
-- Retour arrière : 20261031_offres_cartes_et_textes_seo.down.sql (valeurs d'avant).
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers o
     SET description = v.description,
         image_url = coalesce(v.image_url, o.image_url)
    FROM (VALUES
      ('cf0f37d1-3930-4b80-97c5-5307d739bad4'::uuid, NULL::text,
       $d$SYSCOM INSTITUT, institut de formation professionnelle, recrute un(e) Assistant(e) de Direction à Tivaouane Peulh (Dakar), au Sénégal.

SYSCOM INSTITUT renforce son équipe et lance un appel à candidatures pour le poste d’Assistant(e) de Direction. Vous êtes organisé(e), dynamique, rigoureux(se) et souhaitez évoluer dans un environnement professionnel stimulant ? Cette opportunité pourrait vous correspondre !

QUALITÉS RECHERCHÉES

• Sens de l’organisation
• Dynamisme
• Rigueur

LIEU DE TRAVAIL

Cité APIX, Almadies V.D.N 3, Tivaouane Peulh.

COMMENT POSTULER

Envoyez votre dossier de candidature comprenant :
• Votre CV ;
• Une lettre de motivation.

Contact : +221 77 330 15 98.

APRÈS VOTRE CANDIDATURE

Après réception des candidatures, les profils présélectionnés seront contactés afin de convenir d’un rendez-vous pour un entretien.

SYSCOM INSTITUT — Ensemble pour votre réussite !$d$),

      ('c7c8d329-1804-4956-a84d-ce5acd99b2d3'::uuid, '/carte-offre-onpec-assistant-administratif.webp',
       $d$L’ONPEC Sénégal recrute un(e) Assistant(e) administratif(ve) et chargé(e) de coordination à Fann Hock, Dakar, pour accompagner la gestion administrative de ses activités et renforcer la coordination avec ses partenaires.

MISSIONS PRINCIPALES

• Gérer les correspondances
• Organiser les réunions
• Assurer le suivi des décisions
• Coordonner les activités de terrain
• Contribuer aux relations avec les partenaires

PROFIL RECHERCHÉ

• Excellentes capacités rédactionnelles en français.
• Bonne maîtrise des outils bureautiques et collaboratifs.
• Sens de l’organisation et autonomie.
• Aisance relationnelle.
• Intérêt pour l’état civil et l’accès aux droits.
• Une expérience en administration ou en coordination associative constitue un avantage.

CONDITIONS

• Lieu : Fann Hock, Dakar.
• Nature de l’engagement : à confirmer auprès de l’organisation.
• Date limite : 4 novembre 2026 (date affichée sur Tekki).

COMMENT POSTULER

Envoyez un CV et un court texte de motivation à confirmation@onpec-sn.com.$d$),

      ('b994aa8d-fe88-46df-8c46-cae606354d97'::uuid, '/carte-offre-khelcom-magasiniers.webp',
       $d$KHELCOM BACHES SARL recrute des magasiniers à Pikine (Dakar), au Sénégal. Une expérience minimale d’un an est demandée.

MISSIONS

• Gestion et rangement du stock
• Décompte et suivi des équipements et du matériel
• Contrôle des entrées et sorties du magasin

PROFIL RECHERCHÉ

• Minimum 1 an d’expérience

LIEU DE TRAVAIL

Pikine.

COMMENT POSTULER

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com.$d$),

      ('d0568439-14da-4950-b460-67bf9f3ddea1'::uuid, '/carte-offre-khelcom-comptable.webp',
       $d$KHELCOM BACHES SARL recrute un comptable à Pikine (Dakar), au Sénégal. Une expérience minimale de cinq ans est demandée.

MISSIONS

• Suivi des opérations comptables
• Gestion des pièces comptables et des factures
• Suivi des dépenses et préparation des rapports comptables

PROFIL RECHERCHÉ

• Minimum 5 ans d’expérience

LIEU DE TRAVAIL

Pikine.

COMMENT POSTULER

Intéressé(e) ? Envoyez votre CV à rh-recrutement@khelcombache.com.$d$),

      ('5df5b944-5e1c-47e5-ae65-624475289a1a'::uuid, '/carte-evenement-salon-auchan-2026.webp',
       $d$Salon des Métiers et des Associations, 2e édition, du mercredi 18 au vendredi 20 novembre 2026 à l’Auchan Hypermarché Mermoz, à Dakar (Sénégal). Événement gratuit organisé par Auchan Retail Sénégal, consacré à l’orientation professionnelle, au recrutement, à la formation, à l’entrepreneuriat et à la responsabilité sociétale des entreprises (RSE).

À QUI S’ADRESSE LE SALON

Aux étudiants, aux jeunes diplômés, aux personnes à la recherche d’un emploi, aux professionnels, aux porteurs de projets ainsi qu’aux associations. Il permet de mieux connaître les métiers de la grande distribution, de découvrir les perspectives de carrière chez Auchan Sénégal et de rencontrer des professionnels du secteur.

AU PROGRAMME : MÉTIERS, RECRUTEMENT ET FORMATIONS

Découverte des métiers de la grande distribution
Les participants pourront découvrir les différents métiers de la grande distribution à travers une immersion dans cet univers professionnel. Des présentations permettront également de mieux connaître les possibilités de recrutement et les perspectives d’évolution de carrière au sein d’Auchan Sénégal.

Rencontres professionnelles et réseautage
Le salon offrira un cadre d’échange avec des experts du secteur, des entreprises partenaires et des organisations associatives. Ces rencontres permettront aux visiteurs de développer leur réseau et de découvrir différents parcours professionnels.

Ateliers et formations
Des ateliers et des discussions porteront sur plusieurs thématiques, notamment l’employabilité, l’insertion professionnelle, l’entrepreneuriat des jeunes et les enjeux liés à la responsabilité sociétale des entreprises (RSE).

Partage d’expériences et initiatives à impact
Des initiatives ayant un impact sur la société seront présentées aux participants. Des retours d’expérience permettront également de mettre en lumière des parcours et des projets inspirants.

DATE ET LIEU

Du 18 au 20 novembre 2026, à l’Auchan Hypermarché Mermoz, à Dakar.

Site officiel du salon : https://salondesmetiers.auchan.sn/$d$),

      ('b11d6e36-0816-4428-840c-9a744d93df43'::uuid, '/carte-offre-talent-flow-metallurgistes.webp',
       $d$Talent Flow SUARL recrute des Techniciens métallurgistes qualifiés et motivés pour rejoindre une structure professionnelle, au Sénégal. Talent Flow accompagne les entreprises et les candidats.

PROFIL RECHERCHÉ

• Formation en métallurgie ou dans un domaine technique connexe ;
• Expérience professionnelle souhaitée dans le domaine ;
• Maîtrise des procédés métallurgiques et des techniques de contrôle, selon le poste ;
• Rigueur, esprit d’équipe et respect des règles de sécurité.

COMMENT POSTULER

Les personnes intéressées sont invitées à envoyer leur CV à mansourjrngom@gmail.com.
Objet du mail : Candidature – Technicien métallurgiste.$d$),

      ('3ebfd875-1baa-474f-a88b-f42a7ae215f5'::uuid, '/carte-offre-ambassade-suede-assistant.webp',
       $d$L’Ambassade de Suède au Sénégal recrute un(e) Assistant(e) administratif(ve) et de communication à Dakar, en CDD de 12 mois renouvelable, pour renforcer sa section politique, économique et de coopération (PEC). Le poste associe des responsabilités administratives, la communication digitale, l’organisation d’événements et l’appui aux activités de l’ambassade.

PRINCIPALES MISSIONS

• Assurer le suivi administratif et les tâches de secrétariat.
• Participer à l’organisation des réunions, événements et visites officielles.
• Contribuer à la gestion des réseaux sociaux de l’ambassade.
• Appuyer les activités de communication de la section PEC.
• Assurer ponctuellement des fonctions d’assistance auprès de l’Ambassadeur.

PROFIL RECHERCHÉ

• Formation ou expérience professionnelle confirmée dans des fonctions similaires.
• Excellente maîtrise du français.
• Anglais obligatoire, niveau B2 minimum.
• Bonne maîtrise des outils bureautiques, notamment Outlook et Excel.
• Expérience en gestion des réseaux sociaux et en création de contenus.
• Connaissance de CapCut ou d’un logiciel équivalent.
• Rigueur, autonomie, sens de l’organisation et bonnes capacités rédactionnelles.

CONDITIONS

• Lieu : Dakar, Sénégal.
• Contrat : CDD de 12 mois renouvelable.
• Temps de travail : 39 h 45 par semaine.
• Avantages : assurance santé, 28 jours de congés annuels et fonds de retraite.
• Date limite : 11 novembre 2026.

COMMENT POSTULER

Envoyez un CV, une lettre de motivation, une pièce d’identité, un permis de séjour si applicable et les éventuelles attestations d’expérience à ambassaden.dakar@gov.se.
Objet du mail : Candidature – assistent administratif (PEC).

Annonce officielle consultable sur le site de l’Ambassade de Suède.$d$),

      ('63de30e0-943c-4d06-b97e-22496c22611d'::uuid, '/carte-offre-gindi-ingenieur-agroalimentaire.webp',
       $d$Le Groupe d’Initiatives pour un Développement Intégré (GINDI) recrute un·e Ingénieur·e Agroalimentaire – Référent·e Technologique à Dakar (Sénégal), avec des déplacements réguliers à Thiès, pour accompagner les TPE et PME du secteur dans l’amélioration de leurs procédés, la maîtrise de la qualité, l’innovation et l’adoption de solutions technologiques durables.

Vous êtes ingénieur·e ou technologue en agroalimentaire et souhaitez mettre votre expertise au service du développement des PME agroalimentaires au Sénégal ? Cette opportunité est pour vous !

PROFIL RECHERCHÉ

• Formation en ingénierie ou technologie agroalimentaire ;
• 2 à 3 ans d’expérience professionnelle ;
• Compétences en procédés de transformation, qualité, hygiène et sécurité alimentaire ;
• Autonomie, rigueur et bonnes capacités de communication.

CONDITIONS

• Lieu : Dakar, avec des déplacements réguliers à Thiès.
• Contrat : 10 mois renouvelable, à temps plein.
• Prise de poste : novembre 2026.

COMMENT POSTULER

Envoyez votre CV et votre lettre de motivation à contact.gindi@gmail.com.
Informations complémentaires : 33 824 73 88.

Rejoignez GINDI et contribuez à renforcer la performance, la qualité et l’innovation des entreprises agroalimentaires sénégalaises !$d$),

      ('ea794a5e-3784-4e00-84a8-cbabf32a25e4'::uuid, '/carte-stage-esmt-centre-carriere.webp',
       $d$L’ESMT (École supérieure multinationale des télécommunications) recrute un(e) stagiaire au Centre de carrière à Dakar (Sénégal), pour un stage de trois mois renouvelables. Le stage porte sur la communication du Centre, l’accueil des étudiants, l’organisation d’événements, le suivi administratif et la gestion de la plateforme Datalumni.

PROFIL RECHERCHÉ

• Niveau Bac+3 en ressources humaines, gestion de projets, administration, marketing ou digital.
• Maîtrise des outils bureautiques, des réseaux sociaux et de la communication visuelle.
• Une première expérience de stage est appréciée.

CONDITIONS

• Lieu : Dakar.
• Stage de trois mois renouvelables, avec une allocation dont le montant n’est pas précisé.
• Prise de poste souhaitée : novembre 2026.
• Date limite : 5 novembre 2026.

COMMENT POSTULER

Envoyez votre CV, une lettre de motivation et les copies certifiées conformes de vos diplômes à recrutement@esmt.sn.
Objet : « Stagiaire Centre de carrière ».$d$)
    ) AS v(id, image_url, description)
   WHERE o.id = v.id AND o.status = 'pending_review';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 9 THEN
    RAISE EXCEPTION 'Mise à jour annulée : % ligne(s) touchée(s) au lieu de 9', v_n;
  END IF;
END
$$;

COMMIT;
