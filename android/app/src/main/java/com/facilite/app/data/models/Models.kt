package com.facilite.app.data.models

// 1. Modèle pour les offres d'emploi (01-accueil, 03-offres, 07-fiche-offre)
data class JobOffer(
    val id: String,
    val title: String,
    val companyName: String,
    val publicationDate: String,
    val location: String = "Dakar, Sénégal",
    val contractType: String = "Plein Temps",
    val category: String = "Opportunité",
    val descriptionShort: String,
    val descriptionFull: String = "",
    val salary: String = "Selon profil",
    val deadline: String = "30/09/2026",
    val flyerUrl: String? = null,
    val companyLogoUrl: String? = null,
    val requiredSkills: List<String> = emptyList(),
    val isApplied: Boolean = false,
    val isSaved: Boolean = false,
    val isExpired: Boolean = false
)

// 2. Modèle pour le carrousel des modèles CV (01-accueil)
data class CvTemplateModel(
    val id: String,
    val name: String,
    val previewGradientColors: List<Long> = listOf(0xFFE8C77A, 0xFFD9B567)
)

// 3. Modèle pour le répertoire des candidatures spontanées (10, 11)
data class Company(
    val id: String,
    val name: String,
    val sector: String,
    val city: String = "Dakar",
    val address: String = "Route de l'Aéroport, Dakar",
    val logoUrl: String? = null,
    val applicationEmail: String = "recrutement@entreprise.sn",
    val requiredDocuments: List<String> = listOf("CV Professionnel", "Lettre de Motivation"),
    val domains: List<String> = listOf("Commerce", "Logistique", "Finance")
)

// 4. Modèle pour les messages et discussions (05, 06)
data class Conversation(
    val id: String,
    val partnerName: String,
    val partnerRole: String, // ex: "Support RH Facilité", "Recruteur Vérifié"
    val lastMessage: String,
    val timestamp: String,
    val unreadCount: Int = 0,
    val isSupport: Boolean = false,
    val isAiEnabled: Boolean = true
)

data class ChatMessage(
    val id: String,
    val text: String,
    val isFromMe: Boolean,
    val timestamp: String,
    val isAiSuggested: Boolean = false,
    val audioDurationSeconds: Int? = null
)

// 5. Modèle pour les notifications (13)
data class NotificationItem(
    val id: String,
    val title: String,
    val description: String,
    val timestamp: String,
    val isRead: Boolean = false,
    val type: String = "offre" // "offre", "candidature", "message"
)

// 6. Modèle pour les fonctionnalités & outils (09)
data class FeatureTool(
    val id: String,
    val title: String,
    val description: String,
    val category: String, // "PDF", "IA", "CV"
    val iconName: String,
    val badge: String? = null
)

// 7. Modèles pour le profil candidat (12a à 12e)
data class UserProfile(
    val id: String = "usr_1",
    val fullName: String = "Mamadou Diop",
    val headline: String = "Juriste d'Affaires & Consultant RH Senior",
    val location: String = "Dakar, Sénégal",
    val phone: String = "+221 77 123 45 67",
    val email: String = "mamadou.diop@email.sn",
    val nationality: String = "Sénégalaise",
    val isVerified: Boolean = true,
    val isAdmin: Boolean = true,
    val cvBannerText: String = "CV Professionnel Validé (Format Canadien & Sénégalais)",
    val aboutSummary: String = "Passionné par le droit des affaires, la gestion contractuelle et le recrutement stratégique de talents en Afrique de l'Ouest."
)

data class Experience(
    val id: String,
    val jobTitle: String,
    val company: String,
    val location: String,
    val startDate: String,
    val endDate: String = "Présent",
    val isCurrent: Boolean = false,
    val description: String
)

data class Education(
    val id: String,
    val degree: String,
    val institution: String,
    val year: String,
    val city: String = "Dakar"
)

data class LanguageSkill(
    val id: String,
    val language: String,
    val proficiency: String // "Langue maternelle", "Bilingue / C2", "Courant / B2"
)
