package com.construction.manager.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.construction.manager.ui.theme.mockupColors
import com.construction.manager.ui.theme.statusBadgeColors

/**
 * Status pill matching the mockup's `badge()` helper exactly: 4x10 padding,
 * fully-rounded, 11sp bold text, color/background from statusBadgeColors().
 * The mockup's statusStyle() capitalizes known statuses ('Active', 'Paid', …)
 * but its other badges (clientRows.linkLabel etc.) pass through raw lowercase
 * text ('linked', 'no login') with no capitalization -- [capitalize] mirrors
 * that distinction instead of uppercasing every badge uniformly.
 */
@Composable
fun StatusBadge(status: String, modifier: Modifier = Modifier, capitalize: Boolean = true) {
    val (fg, bg) = statusBadgeColors(status)
    Text(
        if (capitalize) status.replace("_", " ").replaceFirstChar { it.uppercase() } else status,
        color = fg,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
            .background(bg, RoundedCornerShape(100))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

/**
 * Card matching the mockup's cardStyle/listRowStyle: card-color background,
 * hairline border, 16dp corner radius, 14dp padding -- used in place of
 * Material3's default ElevatedCard shadow-driven look for list rows and
 * detail sections that come from the mockup.
 */
@Composable
fun MockupCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = mockupColors()
    val base = modifier
        .fillMaxWidth()
        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))
        .border(1.dp, colors.border, RoundedCornerShape(16.dp))
        .let { if (onClick != null) it.clickable(onClick = onClick) else it }
        .padding(14.dp)
    Column(base, verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

/** Progress bar matching progressTrackStyle: 6dp tall, fully rounded, divider-colored track. */
@Composable
fun MockupProgressTrack(fraction: Float, color: Color, modifier: Modifier = Modifier) {
    val colors = mockupColors()
    Box(
        modifier
            .fillMaxWidth()
            .height(6.dp)
            .background(colors.divider, RoundedCornerShape(100)),
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                .background(color, RoundedCornerShape(100)),
        )
    }
}

/**
 * A single pill in a chip picker, matching chipBase/mkChip: selected fills
 * with primary + onPrimary text; unselected is transparent with a hairline
 * border. Used to replace Dropdown() for the mockup's project/status/type
 * pickers, which are horizontal chip rows, not native dropdown menus.
 */
@Composable
fun SelectableChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = mockupColors()
    val primary = MaterialTheme.colorScheme.primary
    Text(
        label,
        color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier
            .background(if (selected) primary else Color.Transparent, RoundedCornerShape(100))
            .border(1.dp, if (selected) primary else colors.border, RoundedCornerShape(100))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}

/** A horizontally-wrapping row of SelectableChip -- the mockup's chipRowStyle/tabRowStyle. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun ChipRow(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    androidx.compose.foundation.layout.FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) { content() }
}

/**
 * Single-select chip picker generic over any item type -- pass items, a
 * label renderer, current selection, and a callback. Mirrors the mockup's
 * mkChip-driven pickers (materialProjectChips, paymentTypeChips, etc.)
 * instead of a native Material3 dropdown menu.
 */
@Composable
fun <T> ChipPicker(
    items: List<T>,
    selected: T?,
    render: (T) -> String,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    ChipRow(modifier) {
        items.forEach { item ->
            SelectableChip(render(item), selected == item, onClick = { onSelect(item) })
        }
    }
}

/**
 * Small square toggle matching segBtnBase (30x30, 8dp corner, bordered) --
 * the mockup's present/half-day/absent attendance buttons.
 */
@Composable
fun SegButton(label: String, selected: Boolean, onClick: () -> Unit) {
    val colors = mockupColors()
    val primary = MaterialTheme.colorScheme.primary
    Box(
        Modifier
            .size(30.dp)
            .background(if (selected) primary else Color.Transparent, RoundedCornerShape(8.dp))
            .border(1.dp, if (selected) primary else colors.border, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick),
        contentAlignment = androidx.compose.ui.Alignment.Center,
    ) {
        Text(
            label,
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** ChipPicker with a label above it, mirroring Dropdown()'s call signature so it's a drop-in replacement. */
@Composable
fun <T> LabeledChipPicker(
    label: String,
    items: List<T>,
    selected: T?,
    render: (T) -> String,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
        ChipPicker(items, selected, render, onSelect)
    }
}

/**
 * A create-form that's collapsed behind a "+ Add X" pill by default, per the
 * mockup's actual rendered screens: "Add client"/"Add supplier" etc. are not
 * always-open inline forms -- they're a small outlined trigger button that
 * expands into a "Cancel" + bordered form card, and collapses back after.
 */
@Composable
fun CollapsibleCreateSection(
    label: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (!expanded) {
        OutlinedButton(
            onClick = onToggle,
            shape = RoundedCornerShape(100),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        ) { Text("+ $label") }
    } else {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onToggle, modifier = Modifier.align(androidx.compose.ui.Alignment.Start)) { Text("Cancel") }
            MockupCard(content = content)
        }
    }
}
