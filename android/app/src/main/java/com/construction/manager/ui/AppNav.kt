package com.construction.manager.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.lifecycle.viewmodel.compose.viewModel
import com.construction.manager.data.Role
import com.construction.manager.ui.components.OfflineBanner
import com.construction.manager.ui.dashboards.AdminHome
import com.construction.manager.ui.dashboards.ClientDashboard
import com.construction.manager.ui.dashboards.LabourDashboard
import com.construction.manager.ui.dashboards.SupplierDashboard
import com.construction.manager.util.rememberIsOnline

@Composable
fun AppNav(vm: AuthViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val isOnline by rememberIsOnline()

    Box(Modifier.fillMaxSize()) {
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
            AuthState.NeedsPasswordReset -> ResetPasswordScreen(vm)
            AuthState.NeedsRoleSelection -> ChooseRoleScreen(vm)
            is AuthState.SignedIn -> when (s.role) {
                Role.superadmin, Role.admin, Role.manager ->
                    AdminHome(vm, isAdmin = s.role != Role.manager, isOwner = s.isOwner, isSuperadmin = s.role == Role.superadmin)
                Role.client -> ClientDashboard(vm)
                Role.supplier -> SupplierDashboard(vm)
                Role.labour -> LabourDashboard(vm)
            }
        }

        // Floats above every screen so connectivity loss is always visible
        // without blocking taps. On dashboards it sits just below the top
        // app bar (64dp offset) so it doesn't cover the menu/title/avatar;
        // on auth-style screens it hugs the status bar at the very top.
        // zIndex forces it above the Scaffold's TopAppBar surface elevation
        // and the ModalNavigationDrawer scrim on the admin dashboard.
        val isDashboard = state is AuthState.SignedIn
        OfflineBanner(
            visible = !isOnline,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .zIndex(100f)
                .statusBarsPadding()
                .padding(top = if (isDashboard) 64.dp else 0.dp),
        )
    }
}
