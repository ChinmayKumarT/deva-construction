package com.construction.manager.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.construction.manager.R

// Bundled statically (not the Google Fonts downloadable-font provider) so it
// works with no Play Services dependency and renders identically on every
// device. Mirrors app/layout.tsx's next/font/google Fraunces import on web --
// display headlines only, body text stays the default sans-serif for
// data-dense dashboard readability.
val Fraunces = FontFamily(
    Font(R.font.fraunces_medium, FontWeight.Medium),
    Font(R.font.fraunces_semibold, FontWeight.SemiBold),
    Font(R.font.fraunces_bold, FontWeight.Bold),
)

private val defaultTypography = Typography()

val AppTypography = Typography(
    headlineSmall = defaultTypography.headlineSmall.copy(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold),
    headlineMedium = defaultTypography.headlineMedium.copy(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold),
    headlineLarge = defaultTypography.headlineLarge.copy(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold),
    titleLarge = defaultTypography.titleLarge.copy(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold),
)

// For one-off serif display text outside the standard Typography slots (e.g.
// big bold numbers on a DarkStatCard) -- see ui/components/DarkStatCard.kt.
val displayNumberStyle = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold)
