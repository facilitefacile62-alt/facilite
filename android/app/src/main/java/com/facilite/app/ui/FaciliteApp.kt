package com.facilite.app.ui

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.components.*
import com.facilite.app.ui.navigation.Screen
import com.facilite.app.ui.screens.auth.*
import com.facilite.app.ui.screens.company.*
import com.facilite.app.ui.screens.extractor.ExtractorScreen
import com.facilite.app.ui.screens.features.FeaturesScreen
import com.facilite.app.ui.screens.home.HomeScreen
import com.facilite.app.ui.screens.messages.*
import com.facilite.app.ui.screens.notifications.NotificationsModal
import com.facilite.app.ui.screens.offers.*
import com.facilite.app.ui.screens.profile.*
import com.facilite.app.ui.screens.search.SearchScreen
import com.facilite.app.ui.theme.ScreenBackground

@Composable
fun FaciliteApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    var showDrawerMenu by remember { mutableStateOf(false) }
    var showNotificationsSheet by remember { mutableStateOf(false) }
    var isBusinessMode by remember { mutableStateOf(false) }

    // Check if current screen should show standard TopBar & BottomBar
    val isBottomNavScreen = currentRoute in listOf(
        Screen.Home.route,
        Screen.Extractor.route,
        Screen.Offers.route,
        Screen.Messages.route,
        Screen.Admin.route
    )

    val currentTab = when (currentRoute) {
        Screen.Home.route -> "accueil"
        Screen.Extractor.route -> "extracteur"
        Screen.Offers.route -> "offres"
        Screen.Messages.route -> "messages"
        Screen.Admin.route -> "admin"
        else -> "accueil"
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                if (isBottomNavScreen) {
                    FaciliteTopBar(
                        avatarInitial = "M",
                        badgeText = if (isBusinessMode) "PRO" else "8+",
                        searchPlaceholder = "Rechercher...",
                        onSearchClick = { navController.navigate(Screen.Search.route) },
                        onAvatarClick = { navController.navigate(Screen.ProfileAbout.route) },
                        onMenuClick = { showDrawerMenu = true }
                    )
                }
            },
            bottomBar = {
                if (isBottomNavScreen) {
                    FaciliteBottomNav(
                        currentTab = currentTab,
                        notificationCount = 8,
                        onTabSelected = { tabKey ->
                            when (tabKey) {
                                "accueil" -> navController.navigate(Screen.Home.route) {
                                    popUpTo(Screen.Home.route) { inclusive = true }
                                }
                                "extracteur" -> navController.navigate(Screen.Extractor.route)
                                "offres" -> navController.navigate(Screen.Offers.route)
                                "messages" -> navController.navigate(Screen.Messages.route)
                                "notifs" -> showNotificationsSheet = true
                                "admin" -> navController.navigate(Screen.Features.route)
                            }
                        }
                    )
                }
            },
            floatingActionButton = {
                if (isBottomNavScreen && currentRoute != Screen.Messages.route) {
                    MicFabButton(
                        onClick = { navController.navigate(Screen.Search.route) }
                    )
                }
            },
            containerColor = ScreenBackground
        ) { paddingValues ->
            NavHost(
                navController = navController,
                startDestination = Screen.Home.route,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // 1. Home
                composable(Screen.Home.route) {
                    HomeScreen(
                        onNavigateToSearch = { navController.navigate(Screen.Search.route) },
                        onNavigateToExtractor = { navController.navigate(Screen.Extractor.route) },
                        onNavigateToOffers = { navController.navigate(Screen.Offers.route) },
                        onNavigateToOfferDetail = { jobId ->
                            navController.navigate(Screen.OfferDetail.createRoute(jobId))
                        },
                        onNavigateToSpontaneous = { navController.navigate(Screen.SpontaneousCompanies.route) }
                    )
                }

                // 2. Extractor
                composable(Screen.Extractor.route) {
                    ExtractorScreen(
                        onNavigateToTemplate = { navController.navigate(Screen.Home.route) },
                        onNavigateToCvAnalysis = { navController.navigate(Screen.Offers.route) }
                    )
                }

                // 3. Offers
                composable(Screen.Offers.route) {
                    OffersScreen(
                        onNavigateToOfferDetail = { jobId ->
                            navController.navigate(Screen.OfferDetail.createRoute(jobId))
                        },
                        onNavigateToSearch = { navController.navigate(Screen.Search.route) }
                    )
                }

                // 4. Search
                composable(Screen.Search.route) {
                    SearchScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToOfferDetail = { jobId ->
                            navController.navigate(Screen.OfferDetail.createRoute(jobId))
                        }
                    )
                }

                // 5. Messages
                composable(Screen.Messages.route) {
                    MessagesScreen(
                        onNavigateToChatDetail = { conversationId ->
                            navController.navigate(Screen.ChatDetail.createRoute(conversationId))
                        }
                    )
                }

                // 6. Chat Detail
                composable(
                    route = Screen.ChatDetail.route,
                    arguments = listOf(navArgument("conversationId") { type = NavType.StringType })
                ) { backStackEntry ->
                    val conversationId = backStackEntry.arguments?.getString("conversationId") ?: "1"
                    ChatDetailScreen(
                        conversationId = conversationId,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }

                // 7. Offer Detail
                composable(
                    route = Screen.OfferDetail.route,
                    arguments = listOf(navArgument("jobId") { type = NavType.StringType })
                ) { backStackEntry ->
                    val jobId = backStackEntry.arguments?.getString("jobId") ?: "1"
                    OfferDetailScreen(
                        jobId = jobId,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToCompany = { compId ->
                            navController.navigate(Screen.CompanyDetail.createRoute(compId))
                        }
                    )
                }

                // 8. Features & Tools
                composable(Screen.Features.route) {
                    FeaturesScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onToolSelected = { toolKey ->
                            when (toolKey) {
                                "offres" -> navController.navigate(Screen.Offers.route)
                                "extracteur" -> navController.navigate(Screen.Extractor.route)
                                "spontanee" -> navController.navigate(Screen.SpontaneousCompanies.route)
                                else -> {}
                            }
                        }
                    )
                }

                // 9. Spontaneous Companies
                composable(Screen.SpontaneousCompanies.route) {
                    SpontaneousCompaniesScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onCompanyClick = { companyId ->
                            navController.navigate(Screen.CompanyDetail.createRoute(companyId))
                        }
                    )
                }

                // 10. Company Detail
                composable(
                    route = Screen.CompanyDetail.route,
                    arguments = listOf(navArgument("companyId") { type = NavType.StringType })
                ) { backStackEntry ->
                    val companyId = backStackEntry.arguments?.getString("companyId") ?: "1"
                    CompanyDetailScreen(
                        companyId = companyId,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToOffer = { jobId ->
                            navController.navigate(Screen.OfferDetail.createRoute(jobId))
                        }
                    )
                }

                // 11-15 Profile Sub-screens
                composable(Screen.ProfileAbout.route) {
                    ProfileAboutScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onTabSelected = { tab ->
                            navigateToProfileTab(navController, tab)
                        }
                    )
                }

                composable(Screen.ProfilePersonalInfo.route) {
                    ProfilePersonalInfoScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onTabSelected = { tab ->
                            navigateToProfileTab(navController, tab)
                        }
                    )
                }

                composable(Screen.ProfileLanguages.route) {
                    ProfileLanguagesScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onTabSelected = { tab ->
                            navigateToProfileTab(navController, tab)
                        }
                    )
                }

                composable(Screen.ProfileExperiences.route) {
                    ProfileExperiencesScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onTabSelected = { tab ->
                            navigateToProfileTab(navController, tab)
                        }
                    )
                }

                composable(Screen.ProfileEducation.route) {
                    ProfileEducationScreen(
                        onNavigateBack = { navController.popBackStack() },
                        onTabSelected = { tab ->
                            navigateToProfileTab(navController, tab)
                        }
                    )
                }

                // 16-18 Auth Screens
                composable(Screen.Login.route) {
                    LoginScreen(
                        onLoginSuccess = { navController.navigate(Screen.Home.route) },
                        onNavigateToSignUp = { navController.navigate(Screen.SignUp.route) },
                        onNavigateToForgotPassword = { navController.navigate(Screen.ForgotPassword.route) }
                    )
                }

                composable(Screen.ForgotPassword.route) {
                    ForgotPasswordScreen(
                        onNavigateBack = { navController.popBackStack() }
                    )
                }

                composable(Screen.SignUp.route) {
                    SignUpScreen(
                        onSignUpSuccess = { navController.navigate(Screen.Home.route) },
                        onNavigateToLogin = { navController.navigate(Screen.Login.route) }
                    )
                }
            }
        }

        // Overlay Menu Drawer
        MenuDrawerOverlay(
            isOpen = showDrawerMenu,
            isBusinessMode = isBusinessMode,
            onClose = { showDrawerMenu = false },
            onSwitchMode = { isBusinessMode = !isBusinessMode },
            onNavigate = { routeKey ->
                showDrawerMenu = false
                when (routeKey) {
                    "a-propos" -> navController.navigate(Screen.ProfileAbout.route)
                    "infos-perso" -> navController.navigate(Screen.ProfilePersonalInfo.route)
                    "langues" -> navController.navigate(Screen.ProfileLanguages.route)
                    "experiences" -> navController.navigate(Screen.ProfileExperiences.route)
                    "formation" -> navController.navigate(Screen.ProfileEducation.route)
                    "connexion" -> navController.navigate(Screen.Login.route)
                    "inscription" -> navController.navigate(Screen.SignUp.route)
                    "offres" -> navController.navigate(Screen.Offers.route)
                    "extracteur" -> navController.navigate(Screen.Extractor.route)
                    "spontanee" -> navController.navigate(Screen.SpontaneousCompanies.route)
                    "fonctionnalites" -> navController.navigate(Screen.Features.route)
                    else -> {}
                }
            }
        )

        // Notifications Modal Bottom Sheet
        if (showNotificationsSheet) {
            NotificationsModal(
                onDismiss = { showNotificationsSheet = false },
                onNotificationClick = { notif ->
                    showNotificationsSheet = false
                    if (notif.type == "job") {
                        navController.navigate(Screen.Offers.route)
                    } else {
                        navController.navigate(Screen.Messages.route)
                    }
                }
            )
        }
    }
}

private fun navigateToProfileTab(navController: androidx.navigation.NavController, tab: String) {
    when (tab) {
        "a-propos" -> navController.navigate(Screen.ProfileAbout.route) { popUpTo(Screen.ProfileAbout.route) { inclusive = true } }
        "infos-perso" -> navController.navigate(Screen.ProfilePersonalInfo.route)
        "langues" -> navController.navigate(Screen.ProfileLanguages.route)
        "experiences" -> navController.navigate(Screen.ProfileExperiences.route)
        "formation" -> navController.navigate(Screen.ProfileEducation.route)
    }
}
