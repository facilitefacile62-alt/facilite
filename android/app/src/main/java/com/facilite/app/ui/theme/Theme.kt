package com.facilite.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = RoyalBlue,
    onPrimary = CardSurface,
    primaryContainer = MintGreenLight,
    onPrimaryContainer = MintGreenDark,
    secondary = MintGreen,
    onSecondary = CardSurface,
    background = ScreenBackground,
    onBackground = TextPrimary,
    surface = CardSurface,
    onSurface = TextPrimary,
    surfaceVariant = ScreenBackground,
    onSurfaceVariant = TextSecondary,
    outline = BorderLight
)

private val DarkColorScheme = darkColorScheme(
    primary = RoyalBlue,
    onPrimary = CardSurface,
    secondary = MintGreen,
    onSecondary = CardSurface,
    background = DarkFrameBackground,
    onBackground = CardSurface,
    surface = DarkSurface,
    onSurface = CardSurface,
    outline = DarkBorder
)

@Composable
fun FaciliteTheme(
    darkTheme: Boolean = false, // Fond clair #F2F0EA par défaut selon le Handoff
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = colorScheme.surface.toArgb()
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = Shapes,
        content = content
    )
}
