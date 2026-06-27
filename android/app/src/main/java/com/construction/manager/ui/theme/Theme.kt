package com.construction.manager.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val Amber = Color(0xFFF59E0B)
private val AmberDark = Color(0xFFB45309)
private val Slate = Color(0xFF0F172A)
private val SlateLight = Color(0xFF334155)

private val LightColors = lightColorScheme(
    primary = Amber,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFE3B5),
    onPrimaryContainer = AmberDark,
    secondary = Slate,
    onSecondary = Color.White,
    surface = Color.White,
    onSurface = Slate,
    background = Color(0xFFF8FAFC),
    onBackground = Slate,
)

private val DarkColors = darkColorScheme(
    primary = Amber,
    onPrimary = Color.Black,
    primaryContainer = AmberDark,
    onPrimaryContainer = Color.White,
    secondary = SlateLight,
    onSecondary = Color.White,
    surface = Color(0xFF111827),
    onSurface = Color(0xFFE2E8F0),
    background = Color(0xFF0B1220),
    onBackground = Color(0xFFE2E8F0),
)

@Composable
fun AppTheme(
    useDynamic: Boolean = true,
    content: @Composable () -> Unit,
) {
    val dark = isSystemInDarkTheme()
    val scheme = when {
        useDynamic && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val ctx = LocalContext.current
            if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        }
        dark -> DarkColors
        else -> LightColors
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
