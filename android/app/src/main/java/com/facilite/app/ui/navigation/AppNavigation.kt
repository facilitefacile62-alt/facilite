package com.facilite.app.ui.navigation

sealed class Screen(val route: String) {
    // Bottom Nav Primary Tabs
    data object Home : Screen("home")
    data object Extractor : Screen("extractor")
    data object Offers : Screen("offers")
    data object Messages : Screen("messages")
    data object Admin : Screen("admin")

    // Sub-screens & Details
    data object Search : Screen("search")
    data object ChatDetail : Screen("chat_detail/{conversationId}") {
        fun createRoute(conversationId: String) = "chat_detail/$conversationId"
    }
    data object OfferDetail : Screen("offer_detail/{jobId}") {
        fun createRoute(jobId: String) = "offer_detail/$jobId"
    }
    data object Features : Screen("features")
    data object SpontaneousCompanies : Screen("spontaneous_companies")
    data object CompanyDetail : Screen("company_detail/{companyId}") {
        fun createRoute(companyId: String) = "company_detail/$companyId"
    }

    // Profile Screens
    data object ProfileAbout : Screen("profile_about")
    data object ProfilePersonalInfo : Screen("profile_personal_info")
    data object ProfileLanguages : Screen("profile_languages")
    data object ProfileExperiences : Screen("profile_experiences")
    data object ProfileEducation : Screen("profile_education")

    // Auth Screens
    data object Login : Screen("login")
    data object ForgotPassword : Screen("forgot_password")
    data object SignUp : Screen("signup")
}
