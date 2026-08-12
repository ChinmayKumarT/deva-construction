package com.construction.manager.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Semantic colors from the Claude Design mockup's getColors(theme) that
// MaterialTheme's ColorScheme has no slot for (success/warning/danger,
// muted text, hairline border/divider, tinted backgrounds for badges/chips).
// Exact hex values pulled from the mockup, not approximated -- see
// getColors() in "Deva Construction App.dc.html".
data class MockupColors(
    val border: Color,
    val divider: Color,
    val muted: Color,
    val success: Color,
    val successTint: Color,
    val warning: Color,
    val warningTint: Color,
    val danger: Color,
    val dangerTint: Color,
    val primaryTint: Color,
)

private val LightMockupColors = MockupColors(
    border = Color(0x1A232323),       // rgba(35,35,35,0.10)
    divider = Color(0x14232323),      // rgba(35,35,35,0.08)
    muted = Color(0xFF726C64),
    success = Color(0xFF16A34A),
    successTint = Color(0xFFDCFCE7),
    warning = Color(0xFFD97706),
    warningTint = Color(0xFFFEF3C7),
    danger = Color(0xFFDC2626),
    dangerTint = Color(0xFFFEE2E2),
    primaryTint = Color(0xFFDCE7F3),
)

private val DarkMockupColors = MockupColors(
    border = Color(0x17FFFFFF),       // rgba(255,255,255,0.09)
    divider = Color(0x14FFFFFF),      // rgba(255,255,255,0.08)
    muted = Color(0x99EDE7DF),        // rgba(237,231,223,0.6)
    success = Color(0xFF34D399),
    successTint = Color(0x2634D399),  // rgba(52,211,153,0.15)
    warning = Color(0xFFFBBF24),
    warningTint = Color(0x26FBBF24),  // rgba(251,191,36,0.15)
    danger = Color(0xFFF87171),
    dangerTint = Color(0x26F87171),   // rgba(248,113,113,0.15)
    primaryTint = Color(0x2993B6DE),  // rgba(147,182,222,0.16)
)

@Composable
fun mockupColors(): MockupColors = if (isSystemInDarkTheme()) DarkMockupColors else LightMockupColors

// Mirrors statusStyle(status, c) in the mockup: each known status maps to a
// (foreground, background-tint) pair; anything unrecognized falls back to
// muted/divider exactly like the mockup's `map[status] || {...}` default.
@Composable
fun statusBadgeColors(status: String): Pair<Color, Color> {
    val c = mockupColors()
    val primary = androidx.compose.material3.MaterialTheme.colorScheme.primary
    return when (status) {
        "active", "approved" -> primary to c.primaryTint
        "completed", "paid", "delivered", "linked" -> c.success to c.successTint
        "pending", "ordered" -> c.warning to c.warningTint
        "cancelled", "rejected", "returned" -> c.danger to c.dangerTint
        else -> c.muted to c.divider
    }
}
