package com.construction.manager.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand palette, kept in sync with tailwind.config.ts on the web app.
private val Brand = Color(0xFF16A34A)      // brand.DEFAULT / brand.600
private val Brand400 = Color(0xFF4ADE80)
private val Brand700 = Color(0xFF15803D)
private val Brand800 = Color(0xFF166534)
private val Brand100 = Color(0xFFDCFCE7)
private val Forest = Color(0xFF0F1F17)     // forest.DEFAULT / forest.900
private val Forest800 = Color(0xFF15301F)
private val Forest100 = Color(0xFFDBE5DD)
private val Ink = Color(0xFF0F172A)

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
    background = Color(0xFFF4F7F5),        // forest.50
    onBackground = Ink,
)

private val DarkColors = darkColorScheme(
    primary = Brand400,
    onPrimary = Color(0xFF06210F),
    primaryContainer = Brand700,
    onPrimaryContainer = Color.White,
    secondary = Forest100,
    onSecondary = Forest,
    secondaryContainer = Forest800,
    onSecondaryContainer = Forest100,
    surface = Color(0xFF11221A),
    onSurface = Color(0xFFE2E8F0),
    background = Color(0xFF081210),        // forest.950
    onBackground = Color(0xFFE2E8F0),
)

/**
 * Material You dynamic color is deliberately not used: the app is branded
 * Deva Construction green, and device-derived palettes would make that vary
 * per phone.
 */
@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
