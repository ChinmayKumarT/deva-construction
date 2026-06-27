package com.construction.manager.ui.dashboards

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.construction.manager.data.Repo
import com.construction.manager.ui.AuthViewModel
import com.construction.manager.ui.DeleteAccountButton
import com.construction.manager.ui.StatCard
import com.construction.manager.ui.money
import kotlinx.coroutines.launch

enum class AdminSection(val label: String) {
    Overview("Overview"),
    Projects("Projects"),
    Clients("Clients"),
    Suppliers("Suppliers"),
    Labourers("Labourers"),
    Materials("Materials"),
    Payments("Payments"),
    Attendance("Attendance"),
    Updates("Project updates"),
    Reports("Reports"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminHome(vm: AuthViewModel, isAdmin: Boolean = true) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var section by remember { mutableStateOf(AdminSection.Overview) }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Spacer(Modifier.height(16.dp))
                Text(if (isAdmin) "Admin" else "Manager",
                    Modifier.padding(16.dp), style = MaterialTheme.typography.titleMedium)
                Divider()
                AdminSection.entries.forEach { s ->
                    NavigationDrawerItem(
                        label = { Text(s.label) },
                        selected = section == s,
                        onClick = { section = s; scope.launch { drawerState.close() } },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { vm.signOut() },
                    modifier = Modifier.padding(horizontal = 16.dp)) { Text("Sign out") }
                DeleteAccountButton(vm, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                Spacer(Modifier.height(12.dp))
            }
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(section.label) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    },
                )
            },
        ) { padding ->
            Box(Modifier.padding(padding)) {
                when (section) {
                    AdminSection.Overview -> AdminOverview()
                    AdminSection.Projects -> AdminProjects()
                    AdminSection.Clients -> AdminClients()
                    AdminSection.Suppliers -> AdminSuppliers()
                    AdminSection.Labourers -> AdminLabourers()
                    AdminSection.Materials -> AdminMaterials()
                    AdminSection.Payments -> AdminPayments()
                    AdminSection.Attendance -> AdminAttendance()
                    AdminSection.Updates -> AdminUpdates()
                    AdminSection.Reports -> AdminReports()
                }
            }
        }
    }
}

@Composable
fun AdminOverview() {
    var m by remember { mutableStateOf<Repo.AdminMetrics?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try { m = Repo.adminMetrics() } catch (e: Exception) { err = e.message }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            err != null -> Text("Error: $err")
            m == null -> CircularProgressIndicator()
            else -> {
                StatCard("Total Projects", m!!.totalProjects.toString())
                StatCard("Active Projects", m!!.activeProjects.toString())
                StatCard("Total Cost", money(m!!.totalCost))
                StatCard("Pending Payments", money(m!!.pendingPayments))
                StatCard("Labour Count", m!!.labourCount.toString())
                StatCard("Completion %", "%.1f%%".format(m!!.completion))
            }
        }
    }
}
