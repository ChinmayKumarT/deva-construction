package com.construction.manager.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable

// Promoted out of OtherDashboards.kt (was private there) so it's reusable
// beyond Labour/Supplier/Client -- shared top bar with sign-out + delete
// account, same shell every non-admin role dashboard uses.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoleScaffold(title: String, vm: AuthViewModel,
                  content: @Composable (PaddingValues) -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                actions = {
                    TextButton(onClick = { vm.signOut() }) { Text("Sign out") }
                    DeleteAccountButton(vm)
                },
            )
        },
    ) { padding -> content(padding) }
}
