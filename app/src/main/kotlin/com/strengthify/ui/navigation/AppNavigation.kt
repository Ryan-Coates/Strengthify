package com.strengthify.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.strengthify.ui.home.HomeScreen
import com.strengthify.ui.logging.LoggingScreen
import com.strengthify.ui.onboarding.OnboardingScreen
import com.strengthify.ui.profile.ProfileScreen
import com.strengthify.ui.progress.ProgressScreen
import com.strengthify.ui.results.ResultsScreen

// ── Routes ────────────────────────────────────────────────────────────────────

sealed class Screen(val route: String, val label: String? = null) {
    object Onboarding : Screen("onboarding")
    object Home       : Screen("home",     "Home")
    object Logging    : Screen("logging")
    object Results    : Screen("results/{sessionId}") {
        fun createRoute(sessionId: Long) = "results/$sessionId"
    }
    object Progress   : Screen("progress", "Progress")
    object Profile    : Screen("profile",  "Profile")
}

private data class BottomNavItem(
    val screen: Screen,
    val icon: @Composable () -> Unit,
)

private val bottomNavItems = listOf(
    BottomNavItem(Screen.Home)     { Icon(Icons.Default.Home,        "Home") },
    BottomNavItem(Screen.Progress) { Icon(Icons.Default.ShowChart,   "Progress") },
    BottomNavItem(Screen.Profile)  { Icon(Icons.Default.Person,      "Profile") },
)

private val bottomNavRoutes = setOf(Screen.Home.route, Screen.Progress.route, Screen.Profile.route)

// ── Navigation host ───────────────────────────────────────────────────────────

@Composable
fun AppNavigation(hasProfile: Boolean) {
    val navController = rememberNavController()
    val navBackStack by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStack?.destination

    Scaffold(
        bottomBar = {
            if (currentDestination?.route in bottomNavRoutes) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            selected = currentDestination?.hierarchy
                                ?.any { it.route == item.screen.route } == true,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState    = true
                                }
                            },
                            icon  = item.icon,
                            label = { Text(item.screen.label ?: "") },
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController    = navController,
            startDestination = if (hasProfile) Screen.Home.route else Screen.Onboarding.route,
            // padding consumed inside each screen via WindowInsets / padding param
        ) {
            composable(Screen.Onboarding.route) {
                OnboardingScreen(onProfileSaved = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Onboarding.route) { inclusive = true }
                    }
                })
            }

            composable(Screen.Home.route) {
                HomeScreen(
                    contentPadding = padding,
                    onStartWorkout = { navController.navigate(Screen.Logging.route) },
                )
            }

            composable(Screen.Logging.route) {
                LoggingScreen(
                    onSessionSaved = { sessionId ->
                        navController.navigate(Screen.Results.createRoute(sessionId)) {
                            popUpTo(Screen.Logging.route) { inclusive = true }
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route     = Screen.Results.route,
                arguments = listOf(navArgument("sessionId") { type = NavType.LongType }),
            ) { backStack ->
                val sessionId = backStack.arguments?.getLong("sessionId") ?: 0L
                ResultsScreen(
                    sessionId = sessionId,
                    onDone    = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Home.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Progress.route) {
                ProgressScreen(contentPadding = padding)
            }

            composable(Screen.Profile.route) {
                ProfileScreen(contentPadding = padding)
            }
        }
    }
}
