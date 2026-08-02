package com.construction.manager.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand palette, kept in sync with tailwind.config.ts on the web app.
// Blue accent replaces the old green identity; "Forest" now names the
// near-black dark-card tone (same slot, new color) rather than a dark green.
private val Brand = Color(0xFF7DA3D6)      // brand.DEFAULT / brand.500
private val Brand400 = Color(0xFF93B6DE)
private val Brand700 = Color(0xFF5C89C4)
private val Brand800 = Color(0xFF4A70A3)
private val Brand100 = Color(0xFFDCE7F3)
val Forest = Color(0xFF242424)             // forest.DEFAULT -- dark stat-card bg
private val Forest800 = Color(0xFF1A1A1A)
private val Forest100 = Color(0xFFDCDAD7)
private val Ink = Color(0xFF232323)
private val Cream = Color(0xFFE8E1DA)

private val LightColors = lightColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    primaryContainer = Brand100,
    onPrimaryContainer = Brand800,
    secondary = Forest,
    onSecondary = Color.White,
    secondaryContainer = Forest100,
    onSecondaryContainer = Forest,
    surface = Color.White,
    onSurface = Ink,
    background = Cream,
    onBackground = Ink,
)

private val DarkColors = darkColorScheme(
    primary = Brand400,
    onPrimary = Color(0xFF16222E),
    primaryContainer = Brand700,
    onPrimaryContainer = Color.White,
    secondary = Forest100,
    onSecondary = Forest,
    secondaryContainer = Forest800,
    onSecondaryContainer = Forest100,
    surface = Color(0xFF1E1E1E),
    onSurface = Cream,
    background = Color(0xFF141414),
    onBackground = Cream,
)

/**
 * Material You dynamic color is deliberately not used: the app is branded
 * Deva Construction blue/cream/near-black, and device-derived palettes would
 * make that vary per phone.
 */
@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = AppTypography,
        content = content,
    )
}
