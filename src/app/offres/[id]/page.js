/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { getSupabasePublicClient } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { safeJsonLdString } from "@/lib/jsonLd";
import OffreDetailClient from "./OffreDetailClient";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

const FALLBACK_STATIC_OFFERS = {
  "4d9b3e21-789a-4c2e-8123-bc9a1f284901": {
    id: "4d9b3e21-789a-4c2e-8123-bc9a1f284901",
    title: "AGEROUTE SÉNÉGAL recrute un Comptable (Projet PCZA / Banque Mondiale)",
    company: "AGEROUTE SÉNÉGAL (Projet PCZA - Banque Mondiale)",
    location: "Dakar & Régions (Nord & Centre), Sénégal",
    contract_type: "CDD / Projet Banque Mondiale",
    salary_range: "Selon grille AGEROUTE & Banque Mondiale",
    description: `Dans le cadre du Projet d’Amélioration de la Connectivité des Zones de Production Agricole (PCZA) du Nord et du Centre initié par le Gouvernement du Sénégal avec l’appui financier de la Banque Mondiale, l’AGEROUTE SÉNÉGAL souhaite recruter, pour disponibilité immédiate, un(e) Comptable.

📌 PRINCIPALES ACTIVITÉS :
• Effectuer les saisies des différentes pièces comptables.
• Contrôler et suivre les journaux comptables, suivre et justifier les comptes de tiers.
• Tenir à jour les comptes de trésorerie du projet et préparer les Demandes de Retrait de Fonds (DRF).
• Contribuer à l’élaboration des Rapports de Suivi Financier du projet et des PTBA.
• Préparer les pièces justificatives, chèques, ordres de virement et demandes de décaissement Banque Mondiale.
• Participer à la gestion des immobilisations et veiller au respect des procédures financières.
• Établir les états mensuels de paie et déclarations fiscales/sociales.

🎯 QUALIFICATIONS REQUISES :
• Diplôme : Bac+3 en Comptabilité, Finance ou BTS/DUT ou équivalent.
• Expérience : Au minimum 3 ans d’expérience pertinente à un poste similaire ou en cabinet d’audit.
• Maîtrise des logiciels SAARI, TOMPRO et du système SYSCOHADA / SYCEBNL.
• Expérience en projet Banque Mondiale / IDA vivement appréciée.

📅 CANDIDATURES :
• Date limite : 31 août 2026
• Dossier : Demande écrite + CV détaillé + copies légalisées des diplômes
• Dépôt physique sous pli fermé à : B.P. : 25242 Dakar-Fann (mentionner la référence du poste).`,
    image_url: "/ageroute_recrutement_comptable_pcza.jpg",
    min_education_level: "Bac+3 en Comptabilité / Finance ou BTS/DUT + 3 ans d'expérience",
    deadline: "2026-08-31",
    contact_email: "recrutement@ageroute.sn",
    contact_phone: "+221 33 869 07 51",
    external_link: "https://ageroute.sn",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "5e869719-79a6-4a4e-9b2f-90e633d7b420": {
    id: "5e869719-79a6-4a4e-9b2f-90e633d7b420",
    title: "Simplon Sénégal recrute un(e) Chauffeur à Kédougou",
    company: "Simplon Sénégal (Projet Yaakaar - CJS)",
    location: "Kédougou, Sénégal",
    contract_type: "CDD / Plein temps",
    salary_range: "Selon profil & grille Simplon Sénégal",
    description: `Simplon Sénégal recrute un(e) Chauffeur à Kédougou dans le cadre du programme Yaakaar Jeunesse & Citoyenneté, en collaboration avec le Consortium Jeunesse Sénégal (CJS).

📌 MISSIONS & PROFIL RECHERCHÉ :
• Permis de conduire catégorie B minimum obligatoire.
• Au moins 3 ans d’expérience confirmée en tant que chauffeur.
• Bonne connaissance du territoire national et des axes régionaux.
• Maîtrise des règles de sécurité routière et de conduite défensive.
• Ponctualité, discrétion et sens aigu de l’organisation.
• Disponibilité pour des déplacements interrégionaux fréquents.

📅 MODALITÉS & CANDIDATURES :
• Date limite : 20 août 2026
• Dépôt e-mail : cyk@simplon.co
• Dépôt physique : Centre Yaakaar Kédougou, à côté de l’Hôtel Bedik
• Téléphones : (+221) 78 468 34 34 / 33 824 05 15
• Fiche de poste : https://simplon-co.odoo.com/jobs/detail/chauffeur-kedougou-108

📩 Envoyez votre CV ou postulez directement via Facilité !`,
    image_url: "/simplon_senegal_chauffeur_kedougou.jpg",
    min_education_level: "Permis B minimum + 3 ans d'expérience",
    deadline: "2026-08-20",
    contact_email: "cyk@simplon.co",
    contact_phone: "+221 78 468 34 34",
    external_link: "https://simplon-co.odoo.com/jobs/detail/chauffeur-kedougou-108",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "30e060ee-6c17-48f8-b3bf-5e744d03e911": {
    id: "30e060ee-6c17-48f8-b3bf-5e744d03e911",
    title: "Youth Linguists Programme (YLP) – JOJ Dakar 2026 / ONFP",
    company: "Comité d'Organisation JOJ Dakar 2026 & ONFP",
    location: "Dakar, Sénégal",
    contract_type: "Programme Jeunesse / Mission Internationale",
    salary_range: "Prise en charge & Mission Olympique",
    description: `🌍🗣️ Tu as entre 21 et 35 ans, tu es Sénégalais(e) et trilingue ?

Le Youth Linguists Programme des Jeux Olympiques de la Jeunesse (JOJ Dakar 2026) recrute en partenariat avec l'ONFP et l'Association Sénégalaise des Traducteurs (Astra) ! Rejoins une équipe de jeunes talents linguistiques (Junior Linguist Operators - JLO) et vis une expérience humaine et professionnelle unique au cœur des premiers Jeux Olympiques organisés en Afrique.

📌 MISSIONS PRINCIPALES :
• Assurer l'assistance et les services linguistiques multilingues (interprétariat d'accueil, accompagnement des délégations, traduction).
• Faciliter la communication entre les délégations internationales, les athlètes, les officiels et le comité d'organisation.
• Participer aux opérations linguistiques sur les sites de compétition et villages olympiques.

🎯 CRITÈRES D'ÉLIGIBILITÉ & PROFIL :
• Âge : Entre 21 et 35 ans.
• Nationalité : Être de nationalité sénégalaise.
• Langues : Maîtrise d'au moins 3 langues (Français, Anglais, Wolof ou autres langues internationales : Espagnol, Arabe, etc.).
• Excellente aisance relationnelle, diplomatie et sens du protocole.

📅 MODALITÉS & CANDIDATURES :
• Période d'inscription : Du 17 au 23 août 2026
• Portail officiel de candidature : https://sigof.onfp.sn/ylp
• Informations complémentaires : www.dakar2026.org | E-mail : YLP@dakar2026.org

🔗 Postulez en ligne dès maintenant sur la plateforme dédiée SIGOF ONFP !`,
    image_url: "/joj_dakar_2026_youth_linguists.jpg",
    min_education_level: "Bac +2 à Bac +5 (Langues / Traduction / Relations Internationales)",
    deadline: "2026-08-23",
    external_link: "https://sigof.onfp.sn/ylp",
    contact_email: "YLP@dakar2026.org",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "14390fbb-528a-4bd1-bba2-114bead8c2f9": {
    id: "14390fbb-528a-4bd1-bba2-114bead8c2f9",
    title: "Recrutement Massif BTP : 30 Profils Différents pour Un Grand Projet BTP",
    company: "ICS Industrial (Société de Placement & BTP)",
    location: "Sénégal (Chantier BTP)",
    contract_type: "CDD / Plein temps / Chantier",
    salary_range: "Selon grille BTP & expérience",
    description: `Une société de placement de personnel de la place recrute pour le compte d’un client, dans le cadre d’un projet d’envergure dans le secteur du Bâtiment et Travaux Publics (BTP), plusieurs profils qualifiés.

🏗️ 30 PROFILS RECHERCHÉS :

🏥 Santé, Sécurité & Administration :
• Infirmier(ère)s
• Agent douane / transit
• Assistant(e) de bureau
• Superviseur Sécurité (HSE)

📐 Encadrement, Supervision & Ingénierie :
• Géomètre
• Chefs d’Équipe & Chef d’Équipe Général
• Superviseur Génie Civil
• Superviseur Mécanique
• Superviseur Électrique
• Superviseur Soudage

🔧 Logistique, Maintenance & Flotte :
• Chef Mécanicien & Chef d’Atelier
• Mécanicien Engins Lourds
• Coordinateur Équipements
• Coordinateur Flotte

🚜 Conducteurs d’Engins & Chauffeurs :
• Chauffeur Camion & Chauffeur Porte-engins
• Conducteur Pelle, Bulldozer, Sideboom, Chargeuse, Pipe Layer
• Grutier & Cariste

⚙️ Métiers Techniques & Support Chantier :
• Tuyauteur, Électricien, Échafaudeur
• Signaleur (Banksman), Technicien Instrumentation

📩 COMMENT POSTULER :
Envoyez votre dossier de candidature par e-mail à : crewcoordinator@icsindustrial.com
📌 Objet du mail : Candidature [Indiquer le poste souhaité]`,
    image_url: "/recrutement_massif_btp_30_profils.png",
    min_education_level: "Tous niveaux (Ouvriers, Techniciens, Ingénieurs)",
    deadline: "2026-09-30",
    contact_email: "crewcoordinator@icsindustrial.com",
    external_link: "mailto:crewcoordinator@icsindustrial.com?subject=Candidature%20%5BIndiquer%20le%20poste%20souhait%C3%A9%5D",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "962a37cc-55ff-422f-87d4-402f096483f4": {
    id: "962a37cc-55ff-422f-87d4-402f096483f4",
    title: "AFRI-MOOV recrute un(e) Agent Livreur / Coursier (H/F)",
    company: "AFRI-MOOV (Mobilité & Logistique)",
    location: "Dakar, Sénégal",
    contract_type: "Stage puis CDD",
    salary_range: "Indemnité de stage + primes puis salaire CDD",
    description: `AFRI-MOOV est une entreprise sénégalaise spécialisée dans les solutions de mobilité, de transport et de logistique. Nous accompagnons les particuliers, les entreprises et les administrations avec des services fiables, rapides et disponibles 24h/24, 7j/7.

📌 MISSIONS DU POSTE :
• Assurer la collecte et la livraison de colis et de marchandises dans les délais convenus.
• Vérifier la conformité des colis (état, quantité, destinataire) avant et après livraison.
• Communiquer avec le service client sur l’avancement des livraisons.
• Entretenir et utiliser correctement le véhicule ou l’engin confié (moto / utilitaire).
• Respecter le code de la route et les consignes de sécurité.

🎯 PROFIL RECHERCHÉ :
• Permis de conduire valide (catégorie adaptée) apprécié.
• Bonne connaissance de Dakar et de ses environs.
• Sens de l’organisation, ponctualité et rigueur.
• Aisance avec un smartphone (application de suivi, GPS).
• Sens du service client et présentation soignée.
• Expérience appréciée, débutants motivés acceptés.

📅 HORAIRES & CONDITIONS :
• Type de contrat : Stage ensuite CDD
• Horaires flexibles (y compris samedis)

📩 COMMENT POSTULER :
Envoyez votre CV à : Afrimoovsn@gmail.com
📌 Objet du mail : Candidature – Agent Livreur / Coursier
Ou postulez directement via Facilité avec votre CV !`,
    image_url: "/mobilite_senegal_livreur_coursier.jpg",
    min_education_level: "Permis 2 roues valide",
    deadline: "2026-09-15",
    contact_email: "Afrimoovsn@gmail.com",
    external_link: "mailto:Afrimoovsn@gmail.com?subject=Candidature%20%E2%80%93%20Agent%20Livreur%20%2F%20Coursier",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "000d9a92-0af4-4c51-af40-e748db51c89d": {
    id: "000d9a92-0af4-4c51-af40-e748db51c89d",
    title: "Stagiaire Informaticien(ne) - Connaissances ERP Sage & Odoo",
    company: "Zenith International Audit & Conseil (ZIAC)",
    location: "Dakar, Sénégal",
    contract_type: "Stage / Plein temps",
    salary_range: "Indemnité de stage légale",
    description: `Le cabinet Zenith International Audit & Conseil (ZIAC) recrute un(e) Stagiaire Informaticien(ne) avec de solides connaissances sur les solutions ERP (Sage & Odoo).

🎯 MISSIONS PRINCIPALES :
• Participer au paramétrage, à l'intégration et au support des solutions ERP (Sage et Odoo).
• Accompagner les équipes dans la maintenance des systèmes d'information.
• Assurer l'assistance aux utilisateurs et la rédaction de documentations techniques.

📌 PROFIL RECHERCHÉ :
• Formation en Informatique, Génie Logiciel ou domaine équivalent (Bac+2 à Bac+5).
• Connaissances pratiques sur les ERP Sage & Odoo.
• Esprit d’analyse, rigueur, autonomie et curiosité technique.
• Goût prononcé pour le travail en équipe et l’apprentissage continu.

📅 DATE LIMITE : 23 août 2026
📩 COMMENT POSTULER :
Envoyez votre CV à : rh@ziac.sn
📌 Objet du mail : « Candidature – Stagiaire Informaticien(ne) ERP »`,
    image_url: "/ziac_stagiaire_informaticien.jpg",
    min_education_level: "Bac+2 à Bac+5 (Informatique / Génie Logiciel)",
    deadline: "2026-08-23",
    contact_email: "rh@ziac.sn",
    external_link: "mailto:rh@ziac.sn?subject=Candidature%20%E2%80%93%20Stagiaire%20Informaticien(ne)%20ERP",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "8119367c-e0e0-4279-ba9f-ec1a6063bae0": {
    id: "8119367c-e0e0-4279-ba9f-ec1a6063bae0",
    title: "Cadre infirmier(ère) référent(e) senior en prévention et contrôle des infections",
    company: "Établissement de Santé (Secteur Hospitalier)",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & grille cadre hospitalier",
    description: `Un établissement de santé recrute un(e) Cadre infirmier(ère) référent(e) senior chargé(e) de piloter son programme de prévention et de contrôle des infections (PCI).

🎯 PRINCIPALES RESPONSABILITÉS :
• Prévenir et surveiller les infections associées aux soins (IAS).
• Superviser les audits, les procédures et les plans d’amélioration.
• Coordonner la réponse aux épidémies et aux risques infectieux.
• Collaborer avec le laboratoire de microbiologie.
• Suivre la résistance aux antimicrobiens et micro-organismes multirésistants.
• Former et accompagner les équipes de soins.
• Contribuer aux démarches de qualité, de gestion des risques et d’accréditation.

📌 PROFIL RECHERCHÉ :
• Diplôme d’infirmier(ère) et autorisation professionnelle valide.
• Formation ou certification en prévention et contrôle des infections (PCI).
• Au moins 7 à 10 ans d’expérience clinique.
• Expérience confirmée en prévention des infections en milieu hospitalier.
• Solides compétences en leadership, épidémiologie, microbiologie et analyse des données.

🔗 COMMENT POSTULER :
Déposez votre candidature directement en ligne :
https://lnkd.in/gv6pvNJq`,
    image_url: "/cadre_infirmier_infections.jpg",
    min_education_level: "Diplôme d'infirmier(ère) + Certification PCI",
    deadline: "2026-09-30",
    external_link: "https://lnkd.in/gv6pvNJq",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "df1477a7-88df-4817-a130-25b681c32413": {
    id: "df1477a7-88df-4817-a130-25b681c32413",
    title: "SEMI SARL recrute un(e) Chef(fe) de Chantier (BTP & Construction)",
    company: "SEMI SARL",
    location: "Sénégal (Pôles aquacoles)",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & expérience BTP",
    description: `Dans le cadre de son projet de construction de pôles aquacoles, SEMI SARL recrute un(e) Chef(fe) de Chantier pour le suivi opérationnel et la supervision des travaux.

📌 MISSIONS PRINCIPALES :
• Organiser et superviser les travaux sur le chantier.
• Coordonner les équipes et assurer la bonne exécution des activités.
• Suivre quotidiennement l’avancement et veiller au respect des plans et délais.
• Contrôler la qualité des travaux et faire respecter les règles HSE.
• Assurer le reporting auprès de la Direction des Travaux.

🎯 PROFIL RECHERCHÉ :
• Expérience confirmée en tant que Chef de Chantier (BTP / Génie Civil).
• Forte capacité d'organisation, de coordination et de gestion d'équipe.
• Sens des responsabilités, rigueur et autonomie.
• Disponibilité pour mobilité sur les différents sites du projet.

📩 COMMENT POSTULER :
Envoyez votre CV à : sarrsoda@semisenegal.sn
📌 Objet du mail : « Candidature – Chef de Chantier »`,
    image_url: "/semi_sarl_chef_chantier.jpg",
    min_education_level: "Bac+2 à Bac+5 (Génie Civil / BTP)",
    deadline: "2026-09-15",
    contact_email: "sarrsoda@semisenegal.sn",
    external_link: "mailto:sarrsoda@semisenegal.sn?subject=Candidature%20%E2%80%93%20Chef%20de%20Chantier",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "72ce49fa-efa7-4aa4-95ec-b1f73e6c581f": {
    id: "72ce49fa-efa7-4aa4-95ec-b1f73e6c581f",
    title: "Le Terrou-Bi Dakar recrute un(e) Agent de Réservation Individuelle (H/F)",
    company: "Hôtel & Resort Terrou-Bi Dakar",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & grille hôtelière 5 étoiles",
    description: `L’Hôtel & Resort Terrou-Bi Dakar recherche un(e) Agent de Réservation Individuelle (H/F) dynamique et orienté client pour assurer la gestion optimale des réservations et sublimer l'expérience client avant séjour.

📌 MISSIONS PRINCIPALES :
• Traitement et confirmation des réservations (téléphone, e-mail, site web, OTA & GDS).
• Application des techniques d'upselling et valorisation des offres du Resort.
• Accueil personnalisé, conseil client et respect des standards LQA de luxe.
• Préparation des confirmations, factures pro forma et réconciliation extranet.
• Coordination avec la réception, conciergerie et housekeeping.

🎯 PROFIL & QUALIFICATIONS :
• Formation : Bac+3 en Hôtellerie, Tourisme, Commerce ou Marketing.
• Expérience : Minimum 2 ans dans une fonction similaire en hôtellerie.
• Compétences : Maîtrise des PMS, OTA et GDS, gestion tarifaire & facturation.
• Langues : Très bonne maîtrise du français et de l'anglais.
• Disponibilité : Flexibilité horaire (travail en soirée, nuit ou week-ends).

🔗 COMMENT POSTULER :
Remplissez directement le formulaire de candidature officiel en ligne :
https://docs.google.com/forms/d/e/1FAIpQLScGI6d43s6A-rrjORx8BlwuN_K-gTRYgcYw3MCf_8XAfBM8RQ/viewform`,
    image_url: "/terrou_bi_reservation.jpg",
    min_education_level: "Bac+3 (Hôtellerie / Tourisme / Commerce)",
    deadline: "2026-08-31",
    external_link: "https://docs.google.com/forms/d/e/1FAIpQLScGI6d43s6A-rrjORx8BlwuN_K-gTRYgcYw3MCf_8XAfBM8RQ/viewform",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "9d28564d-7084-4f71-8a71-f1c8a7796ff9": {
    id: "9d28564d-7084-4f71-8a71-f1c8a7796ff9",
    title: "BCEAO recrute 03 Assistants de direction à Dakar",
    company: "BCEAO (Banque Centrale des États de l'Afrique de l'Ouest)",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Grille Institutionnelle BCEAO",
    description: `La Banque Centrale des États de l'Afrique de l'Ouest (BCEAO) recrute pour son Siège basé à Dakar (Sénégal) 03 Secrétaires / Assistants de direction.

📌 MISSIONS PRINCIPALES :
• Accueil téléphonique et physique des visiteurs.
• Gestion du courrier, classement et archivage.
• Gestion des agendas, réunions et constitution des dossiers.
• Saisie et mise en forme des documents officiels.

🎯 CRITÈRES D'ÉLIGIBILITÉ & PROFIL :
• Être ressortissant(e) d’un État membre de l’UMOA (18 à 40 ans).
• Niveau d'études : Bac +2 à Bac +4 en Assistanat de direction ou domaine connexe.
• Expérience : 2 ans minimum d’expérience en tant qu'Assistant(e) de direction.
• Langue : La maîtrise de l’anglais constitue un atout important.

📅 DATE LIMITE : 24 août 2026

🔗 COMMENT POSTULER :
Postulez directement sur la plateforme officielle de la BCEAO :
https://bceao2.tzportal.io//fr/jobs/1960-64`,
    image_url: "/bceao_assistant_direction.jpg",
    min_education_level: "Bac+2 à Bac+4",
    deadline: "2026-08-24",
    external_link: "https://bceao2.tzportal.io//fr/jobs/1960-64",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "ddc8c73d-7d1e-4ff0-a7af-153e5b5aa8a6": {
    id: "ddc8c73d-7d1e-4ff0-a7af-153e5b5aa8a6",
    title: "Recrutement Chantier (12 Profils Engins & BTP) - SECAM S.A.",
    company: "SECAM S.A.",
    location: "Kédougou, Sénégal",
    contract_type: "CDD (2 ans)",
    salary_range: "Selon profil & expérience",
    description: `Pour les besoins d’un chantier situé à Kédougou, SECAM S.A. recrute du personnel qualifié pour un contrat de deux (02) ans avec prise de fonction immédiate.

🏗️ 12 POSTES À POURVOIR :
• 06 Conducteurs de chargeurs
• 02 Conducteurs de tractopelles
• 01 Conducteur de compacteur lisse
• 01 Conducteur de bulldozer
• 01 Conducteur de niveleuse CAT 140K
• 01 Mécanicien hydraulicien

📌 PROFIL RECHERCHÉ :
• Expérience avérée dans le domaine visé.
• Disponibilité immédiate pour affectation à Kédougou.

📁 DOSSIER DE CANDIDATURE :
• Demande manuscrite + CV à jour
• Copie des diplômes / attestations + CNI

📅 MODALITÉS & CONTACTS :
• Date limite : 20 août 2026
• Dépôt physique : Siège SECAM S.A., Almadies (Dakar)
• Dépôt e-mail : secam.sa@secam.sn ou kancouba.ba@secam.sn
• Téléphones : +221 33 844 30 41 / +221 77 531 33 48`,
    image_url: "/secam_chantier_kedougou.jpg",
    min_education_level: "Professionnel / Technique",
    deadline: "2026-08-20",
    contact_email: "secam.sa@secam.sn",
    contact_whatsapp: "+221775313348",
    external_link: "mailto:secam.sa@secam.sn?cc=kancouba.ba@secam.sn&subject=Candidature%20Chantier%20SECAM%20Kedougou",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "f302e044-0ff5-4d60-9b33-b9db11fa2df7": {
    id: "f302e044-0ff5-4d60-9b33-b9db11fa2df7",
    title: "Chauffeur (Motor Pool) - Ambassade des États-Unis",
    company: "Ambassade des États-Unis au Sénégal",
    location: "Dakar, Sénégal",
    contract_type: "CDI",
    salary_range: "7 508 035 FCFA / an (~625 000 FCFA/mois)",
    description: `L’Ambassade des États-Unis à Dakar recrute un(e) Chauffeur (Motor Pool Chauffeur) pour assurer le transport sécurisé du personnel diplomatique, des visiteurs et du fret.

📌 PROFIL RECHERCHÉ :
• Expérience : Au moins 3 ans d'expérience continue comme chauffeur.
• Permis : Permis de conduire valide obligatoire.
• Connaissances : Excellente maîtrise des itinéraires et du trafic de Dakar.
• Langues : Français (bon niveau de travail) et notions d'anglais.

💰 SALAIRE & AVANTAGES :
• Salaire annuel : 7 508 035 FCFA / an (~625 000 FCFA / mois).
• Avantages : Assurance santé complète et indemnités de la Mission Américaine.

🔗 COMMENT POSTULER :
Postulez directement en ligne sur le portail officiel ERA de l'Ambassade des États-Unis :
https://erajobs.state.gov/dos-era/vacancy/viewVacancyDetail.hms?_ref=vtb5rmp3pt0&returnToSearch=true&jnum=76919&orgId=17`,
    image_url: "/chauffeur_ambassade_usa.jpg",
    min_education_level: "Primaire",
    deadline: "2026-09-30",
    contact_email: "DakarHR@state.gov",
    external_link: "https://erajobs.state.gov/dos-era/vacancy/viewVacancyDetail.hms?_ref=vtb5rmp3pt0&returnToSearch=true&jnum=76919&orgId=17",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "82dd1b8a-8234-4862-8580-dfe4e47897b0": {
    id: "82dd1b8a-8234-4862-8580-dfe4e47897b0",
    title: "Programme de Stages Internationaux - UNICEF 2026",
    company: "UNICEF",
    location: "International (Multi-pays)",
    contract_type: "Stage",
    salary_range: "Indemnité selon grille UNICEF",
    description: `L'UNICEF offre à des étudiants et jeunes diplômés du monde entier des opportunités de stage international.

📌 PROFIL & ÉLIGIBILITÉ :
• Niveau d'études : Bac+1 à Bac+8.
• Lieux : Divers bureaux internationaux UNICEF.
• Date limite : Candidatures ouvertes en continu tout au long de l'année.

🔗 CANDIDATURE :
Retrouvez toutes les informations et postulez sur :
https://youthmedia.net/opportunites/programme-de-stages-unicef-2026`,
    image_url: "/unicef_stage_2026.jpg",
    min_education_level: "Bac+1 à Bac+8",
    deadline: "2026-12-31",
    contact_email: "info@youthmedia.net",
    external_link: "https://youthmedia.net/opportunites/programme-de-stages-unicef-2026",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "9b125270-1234-4567-89ab-cdef25272026": {
    id: "9b125270-1234-4567-89ab-cdef25272026",
    title: "Concours de Recrutement Spécial de 2 527 Enseignants (Préscolaire, Élémentaire, Moyen-Secondaire)",
    company: "Ministère de l'Éducation Nationale (MEN - DRH / MIRADOR)",
    location: "Sénégal (National)",
    contract_type: "Concours / Fonction Publique",
    salary_range: "Grille Fonction Publique",
    description: `Dans le cadre de la mise en œuvre du plan de résorption du déficit en personnel enseignant, le Gouvernement a autorisé un recrutement spécial complémentaire de 2 527 ENSEIGNANTS pour le Préscolaire, l'Élémentaire et le Moyen-Secondaire général.

🎯 CORPS & POSTES CONCERNÉS :
• Préscolaire et Élémentaire : Titulaires du Baccalauréat, diplôme professionnel CEAP ou CAP.
• Moyen et Secondaire général : Titulaires du Bac S1/S2, niveau Bac+2, Licence, Maîtrise ou Master d'enseignement (CAE-CEM, CAEM, CAES, CAPEPS, CAMEPS).

📋 CONDITIONS À REMPLIR :
1. Être de nationalité sénégalaise ;
2. Âge : 18 à 33 ans au plus au 31/12/2026 (né entre le 31/12/1993 et le 31/12/2008) pour les non-titulaires de diplômes professionnels ;
3. Âge : 18 à 34 ans au plus au 31/12/2026 (né entre le 31/12/1992 et le 31/12/2008) pour les titulaires de diplômes professionnels d'enseignement ;
4. Être prêt à servir partout sur le territoire national.

📅 CALENDRIER DU CONCOURS :
• Candidatures en ligne : Du 15 au 28 août 2026 (Date limite : 28 août 2026) sur https://mirador.education.gouv.sn/recr26
• Dépôt physique des dossiers des présélectionnés : Du 01 au 04 septembre 2026 à l'IEF choisie lors de la candidature.

📁 DOSSIER À FOURNIR POUR LES PRÉSÉLECTIONNÉS :
1. Demande adressée à Monsieur le Ministre
2. Copie légalisée du diplôme académique requis
3. Copie légalisée du diplôme professionnel ou arrêté d'admission
4. Certificat médical d'aptitude à l'Enseignement
5. Copie légalisée de la Carte Nationale d'Identité
6. Copie légalisée du certificat de nationalité
7. Certificat de bonne vie et mœurs
8. Attestation d'exercice signée par l'IA ou l'IEF (au besoin)

🌐 Lien officiel de postulation : https://mirador.education.gouv.sn/recr26`,
    image_url: "/concours_enseignants_2026.png",
    min_education_level: "Bac / Bac+2 / Licence / Master",
    deadline: "2026-08-28",
    contact_email: "contact@education.sn",
    external_link: "https://mirador.education.gouv.sn/recr26",
    is_active: true,
    created_at: new Date().toISOString(),
  }
};

async function fetchOffer(id) {
  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch {
      supabase = getSupabasePublicClient();
    }

    const { data, error } = await supabase
      .from("job_offers")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      let recruiterVerified = false;
      if (data.recruiter_id) {
        try {
          const { data: verified } = await supabase.rpc("has_badge", {
            check_user_id: data.recruiter_id,
            badge_name: "verified_recruiter",
          });
          recruiterVerified = verified === true;
        } catch (e) {}
      }
      return { ...data, recruiterVerified };
    }
  } catch (err) {
    console.error("fetchOffer DB error:", err);
  }

  if (FALLBACK_STATIC_OFFERS[id]) {
    return { ...FALLBACK_STATIC_OFFERS[id], recruiterVerified: true };
  }

  return null;
}

// schema.org JobPosting.employmentType n'a pas d'équivalent 1:1 avec
// contract_type (texte libre saisi par le recruteur, ex. "CDD / Formation") :
// mapping best-effort, FULL_TIME par défaut plutôt qu'une valeur inventée.
function mapEmploymentType(contractType) {
  const normalized = (contractType || "").toUpperCase();
  if (normalized.includes("STAGE") || normalized.includes("INTERN")) return "INTERN";
  if (normalized.includes("CDD")) return "TEMPORARY";
  if (normalized.includes("FREELANCE") || normalized.includes("INDÉPENDANT")) return "CONTRACTOR";
  if (normalized.includes("TEMPS PARTIEL") || normalized.includes("PART")) return "PART_TIME";
  return "FULL_TIME";
}

function formatJobDescriptionToHtml(text) {
  if (!text) return "";
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith("•") || trimmed.startsWith("-") || /^\d+\./.test(trimmed)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      const itemContent = trimmed.replace(/^[•\-\d\.]+\s*/, "");
      html += `<li>${itemContent}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<p>${trimmed}</p>`;
    }
  }

  if (inList) {
    html += "</ul>";
  }

  return html || `<p>${text}</p>`;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const offer = await fetchOffer(id);

  if (!offer) {
    return { title: "Offre d'emploi introuvable | Facilité" };
  }

  const title = `${offer.title} - ${offer.company} | Offre d'emploi Facilité`;
  const cleanDesc = (offer.description || "")
    .replace(/[#*•_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const description =
    cleanDesc.slice(0, 160) ||
    `Découvrez l'offre d'emploi ${offer.title} chez ${offer.company} à ${offer.location}. Postulez directement en ligne sur Facilité.`;
  const url = `${SITE_URL}/offres/${offer.id}`;
  const imageUrl = offer.image_url
    ? offer.image_url.startsWith("http")
      ? offer.image_url
      : `${SITE_URL}${offer.image_url}`
    : `${SITE_URL}/logo.jpeg`;

  return {
    title,
    description,
    keywords: [
      offer.title,
      offer.company,
      offer.location || "Sénégal",
      "Offre d'emploi Sénégal",
      "Recrutement Dakar",
      "Concours Sénégal",
      "Facilité",
    ],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      locale: "fr_SN",
      siteName: "Facilité",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: offer.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function OffreDetailPage({ params }) {
  const { id } = await params;
  const offer = await fetchOffer(id);

  if (!offer) {
    notFound();
  }

  const formattedDescription = formatJobDescriptionToHtml(offer.description || offer.title);
  const datePosted = offer.created_at ? new Date(offer.created_at).toISOString() : new Date().toISOString();
  const validThrough = offer.deadline
    ? new Date(offer.deadline).toISOString()
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const logoUrl = offer.image_url
    ? offer.image_url.startsWith("http")
      ? offer.image_url
      : `${SITE_URL}${offer.image_url}`
    : `${SITE_URL}/logo.jpeg`;

  const jobPostingSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: offer.title,
    description: formattedDescription,
    datePosted: datePosted,
    validThrough: validThrough,
    employmentType: mapEmploymentType(offer.contract_type),
    hiringOrganization: {
      "@type": "Organization",
      name: offer.company || "Facilité",
      sameAs: offer.external_link || SITE_URL,
      logo: logoUrl,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: offer.location || "Sénégal",
        addressLocality: offer.location || "Dakar",
        addressRegion: offer.location || "Dakar",
        addressCountry: "SN",
      },
    },
    applicantLocationRequirements: {
      "@type": "Country",
      name: "Sénégal",
    },
    directApply: true,
    identifier: {
      "@type": "PropertyValue",
      name: "Facilité",
      value: offer.id,
    },
    url: `${SITE_URL}/offres/${offer.id}`,
    ...(offer.salary_range
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "XOF",
            value: {
              "@type": "QuantitativeValue",
              value: offer.salary_range,
              unitText: "MONTH",
            },
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(jobPostingSchema) }}
      />
      <OffreDetailClient initialOffer={offer} />
    </>
  );
}
