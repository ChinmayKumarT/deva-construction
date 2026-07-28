package com.construction.manager.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun DeleteAccountButton(vm: AuthViewModel, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    var typed by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val error by vm.error.collectAsState()

    TextButton(
        onClick = { open = true },
        colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFB00020)),
        modifier = modifier,
    ) { Text("Delete account") }

    if (open) {
        AlertDialog(
            onDismissRequest = { if (!busy) { open = false; typed = "" } },
            title = { Text("Delete your account?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("This is permanent. Your login is deleted and you are signed out. " +
                            "Business records stay with the company but are unlinked from you.")
                    Text("Type DELETE to confirm:")
                    OutlinedTextField(
                        value = typed, onValueChange = { typed = it },
                        singleLine = true, enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = typed == "DELETE" && !busy,
                    onClick = {
                        busy = true
                        vm.deleteAccount {
                            busy = false
                            // vm.error was cleared before the call and is only
                            // set again on failure -- null here means it
                            // succeeded (refresh() already flipped auth state
                            // to SignedOut), so it's safe to close the dialog.
                            if (vm.error.value == null) { open = false; typed = "" }
                        }
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFB00020)),
                ) { Text(if (busy) "Deleting…" else "Delete") }
            },
            dismissButton = {
                TextButton(enabled = !busy, onClick = { open = false; typed = "" }) { Text("Cancel") }
            },
        )
    }
}
