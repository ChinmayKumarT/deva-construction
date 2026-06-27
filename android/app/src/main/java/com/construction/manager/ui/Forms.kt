package com.construction.manager.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

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

@Composable
fun NumberField(value: String, onChange: (String) -> Unit, label: String,
                modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = { s -> if (s.isEmpty() || s.toDoubleOrNull() != null) onChange(s) },
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

@Composable
fun FormColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
        content()
    }
}

fun money(d: Double): String = "₹" + "%,.0f".format(d)
