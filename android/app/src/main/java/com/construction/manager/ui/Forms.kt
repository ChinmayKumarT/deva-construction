package com.construction.manager.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneOffset

@Composable
fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    ElevatedCard(modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(6.dp))
            Text(value, style = MaterialTheme.typography.titleLarge)
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
              modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) },
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

// Money is stored exactly in the DB (numeric(x,2)) but read into Double, so
// multiplying/weighting it can leave sub-paisa float artifacts that then
// accumulate. Round at the multiplication boundary. Mirrors lib/money.ts.
fun roundMoney(d: Double): Double = kotlin.math.round(d * 100.0) / 100.0

// A material line total (quantity x unit cost), rounded to paise.
fun lineTotal(quantity: Double, unitCost: Double): Double = roundMoney(quantity * unitCost)
