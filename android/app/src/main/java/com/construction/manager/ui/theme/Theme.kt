package com.construction.manager.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand palette. NOT in sync with tailwind.config.ts -- web moved to a
// Stripe-inspired indigo palette (see "Redesign the admin dashboard in a
// Stripe-inspired visual language"), a deliberately web-only change. Android
// keeps this original blue/cream/near-black identity, matching the Claude
// Design mockup's getColors(). "Forest" names the near-black dark-card tone.
private val Brand = Color(0xFF7DA3D6)      // brand.DEFAULT / brand.500
private val Brand400 = Color(0xFF93B6DE)
private val Brand700 = Color(0xFF5C89C4)
private val Brand800 = Color(0xFF4A70A3)
private val Brand100 = Color(0xFFDCE7F3)
val Forest = Color(0xFF242424)             // forest.DEFAULT -- dark stat-card bg
private val Forest800 = Color(0xFF1A1A1A)
private val Forest100 = Color(0xFFDCDAD7)
private val Ink = Color(0xFF232323)
// Page background and body text, light vs dark -- distinct hex values in the
// design (getColors() in the Claude Design mockup), not the same tone reused.
private val PageLight = Color(0xFFEFE9E1)
private val PageDark = Color(0xFF0E0E0E)
private val TextDark = Color(0xFFEDE7DF)

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
    background = PageLight,
    onBackground = Ink,
)

private val DarkColors = darkColorScheme(
    primary = Brand400,
    onPrimary = Color(0xFF16222E),
    primaryContainer = Brand700,
    onPrimaryContainer = Color.White,
    secondary = Forest100,
    onSecondary = Ink,
    secondaryContainer = Forest800,
    onSecondaryContainer = Forest100,
    surface = Color(0xFF1E1E1E),
    onSurface = TextDark,
    background = PageDark,
    onBackground = TextDark,
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
