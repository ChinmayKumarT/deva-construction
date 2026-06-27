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

    TextButton(
        onClick = { open = true },
        colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFB00020)),
        modifier = modifier,
    ) { Text("Delete account") }

    if (open) {
        AlertDialog(
            onDismissRequest = { open = false; typed = "" },
            title = { Text("Delete your account?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("This is permanent. Your login is deleted and you are signed out. " +
                            "Business records stay with the company but are unlinked from you.")
                    Text("Type DELETE to confirm:")
                    OutlinedTextField(
                        value = typed, onValueChange = { typed = it },
                        singleLine = true, modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = typed == "DELETE",
                    onClick = {
                        vm.deleteAccount()
                        open = false; typed = ""
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFB00020)),
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { open = false; typed = "" }) { Text("Cancel") }
            },
        )
    }
}
