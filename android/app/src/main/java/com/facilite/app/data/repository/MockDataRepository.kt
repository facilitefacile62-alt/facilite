package com.facilite.app.data.repository

import com.facilite.app.data.models.*

object MockDataRepository {

    val cvTemplates = listOf(
        CvTemplateModel("cv_1", "Moderne"),
        CvTemplateModel("cv_2", "Minimaliste"),
        CvTemplateModel("cv_3", "Classique")
    )

    val jobOffers = listOf(
        JobOffer(
            id = "off_1",
            title = "Opérateur Polyvalent — Conducteur de Bétonnière & Tractopelle",
            companyName = "Challenge 2000 SARL (via C2K Staffing SARL)",
            publicationDate = "03/09/2026",
            location = "Thiès, Sénégal",
            contractType = "Plein Temps",
            category = "Opportunité",
            descriptionShort = "La société Challenge 2000 SARL (via C2K Staffing SARL) recherche un Opérateur Polyvalent qualifié pour des chantiers d'envergure nationale.",
            descriptionFull = "Dans le cadre de l'expansion de ses projets de construction et d'infrastructures routières à Thiès, la société Challenge 2000 SARL recrute un Opérateur Polyvalent qualifié.\n\n" +
                    "Missions principales :\n" +
                    "• Conduite et manœuvre experte de la bétonnière et du tractopelle sur site.\n" +
                    "• Respect strict des protocoles de sécurité HSE sur les zones de coulage.\n" +
                    "• Entretien de premier niveau et signalement immédiat des pannes techniques.",
            salary = "250 000 - 350 000 FCFA",
            deadline = "30/09/2026",
            requiredSkills = listOf("Permis Poids Lourd (C/D/E)", "CACES Engins de Chantier", "Rigueur HSE", "3+ ans d'expérience")
        ),
        JobOffer(
            id = "off_2",
            title = "Comptable Général & Trésorerie Senior",
            companyName = "TotalEnergies Sénégal",
            publicationDate = "02/09/2026",
            location = "Dakar, Sénégal",
            contractType = "CDI",
            category = "Finance & Comptabilité",
            descriptionShort = "TotalEnergies recrute un Comptable Général pour la gestion des écritures, bilans fiscaux et rapprochements bancaires.",
            salary = "600 000 - 850 000 FCFA",
            requiredSkills = listOf("SYSCOHADA Révisé", "SAP / Sage 1000", "Bilan & Déclarations Fiscales", "Master Finance")
        ),
        JobOffer(
            id = "off_3",
            title = "Conseiller Clientèle Bilingue (Français / Anglais)",
            companyName = "Foundever Dakar",
            publicationDate = "01/09/2026",
            location = "Almadies, Dakar",
            contractType = "CDD / CDI",
            category = "Relation Client",
            descriptionShort = "Rejoignez une équipe dynamique pour le support multicanal de marques internationales.",
            salary = "300 000 FCFA + Primes",
            requiredSkills = listOf("Bilinguisme Parfait", "Sens de l'écoute", "Aisance relationnelle")
        )
    )

    val companies = listOf(
        Company(
            id = "comp_1",
            name = "TotalEnergies Sénégal",
            sector = "Pétrole, Énergie & Stations-Services",
            city = "Dakar",
            address = "Route des Almadies, Dakar",
            applicationEmail = "recrutement.senegal@totalenergies.com",
            domains = listOf("Distribution Carburant", "Boutiques Bonjour", "Lubrifiants", "Finance"),
            requiredDocuments = listOf("CV Détaillé", "Lettre de Motivation", "Copie des Diplômes")
        ),
        Company(
            id = "comp_2",
            name = "Orange Sénégal (Sonatel)",
            sector = "Télécommunications & Numérique",
            city = "Dakar",
            address = "VDN Mermoz, Dakar",
            applicationEmail = "candidatures@orange-sonatel.com",
            domains = listOf("Réseaux & Télécoms", "Orange Money", "Service Client", "Marketing"),
            requiredDocuments = listOf("CV à jour", "Lettre de motivation ciblée")
        ),
        Company(
            id = "comp_3",
            name = "BCEAO (Siège)",
            sector = "Banque Centrale & Institutions Publiques",
            city = "Dakar Plateau",
            address = "Avenue Abdoulaye Fadiga, Dakar",
            applicationEmail = "recrutement@bceao.int",
            domains = listOf("Stabilité Monétaire", "Audit & Risques", "Informatique Bancaire"),
            requiredDocuments = listOf("CV Europass / Standard", "Copies certifiées", "Casier judiciaire")
        )
    )

    val conversations = listOf(
        Conversation(
            id = "conv_1",
            partnerName = "Support RH Facilité (Assistance IA)",
            partnerRole = "Conseiller Carrière & Optimisation CV",
            lastMessage = "✨ Votre CV a été analysé avec succès ! Souhaitez-vous postuler directement aux 3 offres suggérées ?",
            timestamp = "14:20",
            unreadCount = 1,
            isSupport = true
        ),
        Conversation(
            id = "conv_2",
            partnerName = "C2K Staffing SARL",
            partnerRole = "Recruteur Vérifié",
            lastMessage = "Bonjour Mamadou, votre profil correspond parfaitement à l'offre d'Opérateur Polyvalent.",
            timestamp = "Hier",
            unreadCount = 0
        )
    )

    val sampleChatMessages = listOf(
        ChatMessage(
            id = "msg_1",
            text = "Bonjour ! Je suis l'Assistant RH Intelligent de Facilité. Comment puis-je vous aider aujourd'hui ?",
            isFromMe = false,
            timestamp = "14:15"
        ),
        ChatMessage(
            id = "msg_2",
            text = "Bonjour, j'aimerais vérifier si mon CV est bien optimisé pour les offres de conducteurs d'engins.",
            isFromMe = true,
            timestamp = "14:18"
        ),
        ChatMessage(
            id = "msg_3",
            text = "✨ Analyse terminée : Votre profil possède un excellent score de 88%. Je vous recommande d'ajouter la mention de votre CACES R482.",
            isFromMe = false,
            timestamp = "14:20",
            isAiSuggested = true
        )
    )

    val notifications = listOf(
        NotificationItem(
            id = "notif_1",
            title = "Nouvelle offre correspondante !",
            description = "Challenge 2000 SARL recherche un Opérateur Polyvalent à Thiès.",
            timestamp = "Il y a 10 min",
            isRead = false,
            type = "offre"
        ),
        NotificationItem(
            id = "notif_2",
            title = "Candidature consultée",
            description = "Votre candidature chez Foundever a été ouverte par le recruteur.",
            timestamp = "Il y a 2 heures",
            isRead = false,
            type = "candidature"
        ),
        NotificationItem(
            id = "notif_3",
            title = "Rappel Entretien Vidéo",
            description = "N'oubliez pas votre session d'entraînement IA prévue aujourd'hui.",
            timestamp = "Hier",
            isRead = true,
            type = "message"
        )
    )

    val featureTools = listOf(
        FeatureTool("feat_1", "Extracteur 1-Click IA", "Scannez n'importe quelle photo ou texte d'offre et postulez instantanément.", "IA", "fa-bolt", "Populaire"),
        FeatureTool("feat_2", "Compresser mon CV PDF", "Réduisez la taille de votre fichier PDF sans perte de qualité visuelle.", "PDF", "fa-file-zipper"),
        FeatureTool("feat_3", "Fusionner Documents PDF", "Combinez votre CV, Lettre et Diplômes en un seul PDF prêt à l'envoi.", "PDF", "fa-object-group"),
        FeatureTool("feat_4", "Générateur de Lettre de Motivation", "Rédigez une lettre personnalisée adaptée à l'offre en 10 secondes.", "IA", "fa-pen-nib", "Nouveau"),
        FeatureTool("feat_5", "Répertoire 77 Entreprises", "Accédez aux canaux de candidature directe des grandes sociétés du Sénégal.", "Candidature", "fa-building-user")
    )

    val userProfile = UserProfile()

    val experiences = listOf(
        Experience(
            id = "exp_1",
            jobTitle = "Consultant Juridique & RH Senior",
            company = "Cabinet Sylla & Associés",
            location = "Dakar, Sénégal",
            startDate = "Janvier 2023",
            endDate = "Présent",
            isCurrent = true,
            description = "Conseil en droit social, rédaction des contrats de travail et structuration des campagnes de recrutement cadres."
        ),
        Experience(
            id = "exp_2",
            jobTitle = "Juriste d'Entreprise",
            company = "Société Sénégalaise de Distribution (SSD)",
            location = "Dakar",
            startDate = "Mars 2020",
            endDate = "Décembre 2022",
            description = "Gestion du contentieux commercial, conformité réglementaire et veille juridique OHADA."
        )
    )

    val educations = listOf(
        Education(
            id = "edu_1",
            degree = "Master 2 en Droit des Affaires & Fiscalité",
            institution = "Université Cheikh Anta Diop (UCAD)",
            year = "2019",
            city = "Dakar"
        ),
        Education(
            id = "edu_2",
            degree = "Licence en Droit Privé",
            institution = "Université Gaston Berger (UGB)",
            year = "2017",
            city = "Saint-Louis"
        )
    )

    val languages = listOf(
        LanguageSkill("lang_1", "Français", "Langue officielle / Bilingue C2"),
        LanguageSkill("lang_2", "Wolof", "Langue maternelle"),
        LanguageSkill("lang_3", "Anglais", "Professionnel courant / B2")
    )
}
