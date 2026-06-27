package com.construction.manager.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.construction.manager.data.Role
import com.construction.manager.ui.dashboards.AdminHome
import com.construction.manager.ui.dashboards.ClientDashboard
import com.construction.manager.ui.dashboards.LabourDashboard
import com.construction.manager.ui.dashboards.SupplierDashboard

@Composable
fun AppNav(vm: AuthViewModel = viewModel()) {
    val state by vm.state.collectAsState()

    when (val s = state) {
        AuthState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        AuthState.SignedOut -> AuthScreen(vm)
        is AuthState.NeedsLink -> Column(Modifier.fillMaxSize().padding(24.dp)) {
            Text("Welcome", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Text(s.message)
            Spacer(Modifier.height(16.dp))
            Button(onClick = { vm.signOut() }) { Text("Sign out") }
        }
        is AuthState.SignedIn -> when (s.role) {
            Role.admin, Role.manager -> AdminHome(vm, isAdmin = s.role == Role.admin)
            Role.client -> ClientDashboard(vm)
            Role.supplier -> SupplierDashboard(vm)
            Role.labour -> LabourDashboard(vm)
        }
    }
}

