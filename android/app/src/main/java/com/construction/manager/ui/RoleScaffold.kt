package com.construction.manager.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.construction.manager.ui.components.AccountMenuButton
import com.construction.manager.ui.theme.Fraunces

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoleScaffold(title: String, vm: AuthViewModel,
                  content: @Composable (PaddingValues) -> Unit) {
    var showDeleteDialog by remember { mutableStateOf(false) }
    if (showDeleteDialog) {
        DeleteAccountButton(vm, triggerImmediately = true, onDismiss = { showDeleteDialog = false })
    }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        title,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontFamily = Fraunces,
                            fontWeight = FontWeight.SemiBold,
                        ),
                    )
                },
                actions = {
                    AccountMenuButton(
                        initial = title.firstOrNull()?.uppercase() ?: "D",
                        onSignOut = { vm.signOut() },
                        onDeleteAccount = { showDeleteDialog = true },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                },
            )
        },
    ) { padding -> content(padding) }
}
