package com.construction.manager.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

// `accent` mirrors CostBox's prop of the same name in components/admin/Page.tsx
// on web -- a near-black dark-card treatment with an oversized serif number,
// used for exactly one headline metric per screen (its "Total cost" stat);
// everything else stays the plain ElevatedCard look.
@Composable
fun StatCard(label: String, value: String, modifier: Modifier = Modifier, accent: Boolean = false, trend: com.construction.manager.data.Repo.TrendData? = null) {
    if (accent) {
        Card(
            modifier = modifier.fillMaxWidth(),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = com.construction.manager.ui.theme.Forest,
                contentColor = androidx.compose.ui.graphics.Color.White,
            ),
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    label.uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.2.sp),
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.6f),
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    value,
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontFamily = com.construction.manager.ui.theme.Fraunces,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    ),
                )
                if (trend != null) {
                    val arrow = if (trend.delta > 0) "↑" else if (trend.delta < 0) "↓" else "→"
                    Text(
                        "$arrow ${trend.label}",
                        style = MaterialTheme.typography.labelSmall,
                        color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.7f),
                    )
                }
            }
        }
        return
    }
    val colors = com.construction.manager.ui.theme.mockupColors()
    Box(
        modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp))
            .border(1.dp, colors.border, RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = colors.muted)
            Spacer(Modifier.height(4.dp))
            Text(
                value,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = com.construction.manager.ui.theme.Fraunces,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    fontSize = 19.sp,
                ),
            )
            if (trend != null) {
                val arrow = if (trend.delta > 0) "↑" else if (trend.delta < 0) "↓" else "→"
                val trendColor = if (trend.delta > 0) androidx.compose.ui.graphics.Color(0xFF059669)
                    else if (trend.delta < 0) androidx.compose.ui.graphics.Color(0xFFEF4444)
                    else colors.muted
                Text(
                    "$arrow ${trend.label}",
                    style = MaterialTheme.typography.labelSmall,
                    color = trendColor,
                )
            }
        }
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
}

@Composable
fun TextField(value: String, onChange: (String) -> Unit, label: String,
              modifier: Modifier = Modifier, maxLength: Int? = null) {
    OutlinedTextField(
        value = value,
        onValueChange = { s -> onChange(if (maxLength != null) s.take(maxLength) else s) },
        label = { Text(label) },
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        singleLine = true,
    )
}

// Money, quantity, and wage fields are never legitimately negative, and a
// percentage (completion_pct) also has an upper bound. [max] is optional --
// pass it for percent fields; leave null for open-ended amounts. Mirrors the
// <input min="0" max="..."> on the web forms (lib/wages.ts / Forms.tsx).
@Composable
fun NumberField(value: String, onChange: (String) -> Unit, label: String,
                modifier: Modifier = Modifier, max: Double? = null) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange@{ s ->
            if (s.isEmpty()) { onChange(s); return@onValueChange }
            val d = s.toDoubleOrNull()
            if (d != null && d >= 0.0 && (max == null || d <= max)) onChange(s)
        },
        label = { Text(label) },
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        singleLine = true,
    )
}

@Composable
fun <T> Dropdown(label: String, items: List<T>, selected: T?, render: (T) -> String,
                 onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBoxImpl(label, selected?.let(render) ?: "— none —", expanded,
        onExpandedChange = { expanded = it }, modifier = modifier) {
        items.forEach { item ->
            DropdownMenuItem(text = { Text(render(item)) },
                onClick = { onSelect(item); expanded = false })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExposedDropdownMenuBoxImpl(
    label: String, current: String,
    expanded: Boolean, onExpandedChange: (Boolean) -> Unit,
    modifier: Modifier, content: @Composable ColumnScope.() -> Unit,
) {
    ExposedDropdownMenuBox(
        expanded = expanded, onExpandedChange = onExpandedChange,
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
    ) {
        OutlinedTextField(
            value = current, onValueChange = {}, readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
            content()
        }
    }
}

/** Picks an ISO yyyy-MM-dd date via Material3's DatePickerDialog. [value] is that same format. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(value: String, onChange: (String) -> Unit, label: String, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value, onValueChange = {}, readOnly = true, label = { Text(label) },
        trailingIcon = {
            IconButton(onClick = { open = true }) {
                Icon(Icons.Default.CalendarMonth, contentDescription = "Pick date")
            }
        },
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
    )
    if (open) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = value.toLocalDateOrNull()
                ?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { millis ->
                        onChange(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString())
                    }
                    open = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancel") } },
        ) { DatePicker(state = state) }
    }
}

private fun String.toLocalDateOrNull(): java.time.LocalDate? =
    if (isBlank()) null else runCatching { java.time.LocalDate.parse(this) }.getOrNull()

@Composable
fun FormColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
        content()
    }
}

fun money(d: Double): String = "₹" + "%,.0f".format(d)

// Locale pinned rather than left as device-default, so output (and this
// file's own unit tests) don't vary with the user's/CI's locale.
private val dateTimeFormatter = DateTimeFormatter.ofPattern("d/M/yyyy, h:mm a", java.util.Locale.US)
private val dateOnlyFormatter = DateTimeFormatter.ofPattern("d/M/yyyy", java.util.Locale.US)

// Materials (ordered_at/delivered_at) and payments (created_at) are
// timestamptz -- they carry a real time of day, so use formatDateTime.
// Attendance is a plain date column with no time stored, so it should use
// formatDateOnly instead of showing a fabricated midnight.
fun formatDateTime(iso: String?): String {
    if (iso == null) return "no date"
    return try {
        OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).format(dateTimeFormatter)
    } catch (e: Exception) {
        iso
    }
}

fun formatDateOnly(iso: String?): String {
    if (iso == null) return "no date"
    return try {
        LocalDate.parse(iso.take(10)).format(dateOnlyFormatter)
    } catch (e: Exception) {
        iso
    }
}

// Money is stored exactly in the DB (numeric(x,2)) but read into Double, so
// multiplying/weighting it can leave sub-paisa float artifacts that then
// accumulate. Round at the multiplication boundary. Mirrors lib/money.ts.
//
// Deliberately java.lang.Math.round, not kotlin.math.round: Kotlin's rounds
// ties to even (banker's rounding), while JS's Math.round -- what the web
// side uses -- rounds ties up. java.lang.Math.round matches JS here.
//
// The epsilon nudge matters too: 1.005 is actually stored as
// 1.00499999999999989.. in IEEE-754, so without it a half-paisa tie rounds
// DOWN (1.00, not 1.01) -- same float representation as JS, same fix as
// Number.EPSILON there.
private const val MONEY_EPSILON = 2.220446049250313e-16
fun roundMoney(d: Double): Double = Math.round((d + MONEY_EPSILON) * 100.0) / 100.0

// A material line total (quantity x unit cost), rounded to paise.
fun lineTotal(quantity: Double, unitCost: Double): Double = roundMoney(quantity * unitCost)
