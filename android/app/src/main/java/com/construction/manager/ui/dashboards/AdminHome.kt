package com.construction.manager.ui.dashboards

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.construction.manager.data.ProjectRow
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
    Costs("Cost tracking"),
    Reports("Reports"),
    CashFlow("Cash flow"),
    TeamAccess("Team access"),
    Personal("Personal"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminHome(vm: AuthViewModel, isAdmin: Boolean = true, isOwner: Boolean = false) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    // A stack (not a single value) so the system back button retraces the
    // user's actual path through sections instead of exiting the app.
    var sectionStack by remember { mutableStateOf(listOf(AdminSection.Overview)) }
    val section = sectionStack.last()
    fun navigateTo(s: AdminSection) {
        sectionStack = sectionStack + s
    }
    var materialsProjectFilter by remember { mutableStateOf<ProjectRow?>(null) }
    var paymentsProjectFilter by remember { mutableStateOf<ProjectRow?>(null) }
    val visibleSections = remember(isOwner) {
        AdminSection.entries.filter { it != AdminSection.TeamAccess || isOwner }
    }

    BackHandler(enabled = drawerState.isOpen || sectionStack.size > 1) {
        when {
            drawerState.isOpen -> scope.launch { drawerState.close() }
            sectionStack.size > 1 -> sectionStack = sectionStack.dropLast(1)
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Spacer(Modifier.height(16.dp))
                Text(if (isAdmin) "Admin" else "Manager",
                    Modifier.padding(16.dp), style = MaterialTheme.typography.titleMedium)
                Divider()
                // The section list alone (14 entries) is already taller than most
                // phone screens once the header/footer are accounted for, and
                // ModalDrawerSheet doesn't scroll on its own -- scope the scroll to
                // just this middle section so the sign-out/delete footer stays
                // pinned and reachable instead of being pushed off-screen.
                Column(
                    Modifier.weight(1f).verticalScroll(rememberScrollState()),
                ) {
                    visibleSections.forEach { s ->
                        NavigationDrawerItem(
                            label = { Text(s.label) },
                            selected = section == s,
                            onClick = {
                                // A manual drawer pick is a fresh jump, not a drill-down --
                                // reset the back stack so back-from-here always lands on
                                // Overview (the app's true root) rather than retracing
                                // whatever section the user was on before.
                                sectionStack = if (s == AdminSection.Overview) listOf(s)
                                    else listOf(AdminSection.Overview, s)
                                // Jumping from Costs sets a project filter deliberately; a manual
                                // drawer pick means the user wants the unfiltered list.
                                materialsProjectFilter = null
                                paymentsProjectFilter = null
                                scope.launch { drawerState.close() }
                            },
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        )
                    }
                }
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
                    AdminSection.Projects -> AdminProjects(isOwner)
                    AdminSection.Clients -> AdminClients(isOwner)
                    AdminSection.Suppliers -> AdminSuppliers(isOwner)
                    AdminSection.Labourers -> AdminLabourers(isOwner)
                    AdminSection.Materials -> AdminMaterials(isOwner, materialsProjectFilter)
                    AdminSection.Payments -> AdminPayments(isOwner, paymentsProjectFilter)
                    AdminSection.Attendance -> AdminAttendance()
                    AdminSection.Updates -> AdminUpdates(isOwner)
                    AdminSection.Costs -> AdminCosts(
                        onJumpToMaterials = { p -> materialsProjectFilter = p; navigateTo(AdminSection.Materials) },
                        onJumpToPayments = { p -> paymentsProjectFilter = p; navigateTo(AdminSection.Payments) },
                    )
                    AdminSection.Reports -> AdminReports()
                    AdminSection.CashFlow -> AdminCashFlow()
                    AdminSection.TeamAccess -> AdminTeamAccess()
                    AdminSection.Personal -> AdminPersonal(isOwner)
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
                // Headline metric full-width, the rest paired 2-up so the
                // dashboard stays compact on a phone instead of a long column
                // of oversized cards. Mirrors web's grid sm:grid-cols-2.
                StatCard("Total Cost", money(m!!.totalCost), accent = true)
                val two = Arrangement.spacedBy(12.dp)
                Row(horizontalArrangement = two) {
                    StatCard("Total Projects", m!!.totalProjects.toString(), Modifier.weight(1f))
                    StatCard("Active Projects", m!!.activeProjects.toString(), Modifier.weight(1f))
                }
                Row(horizontalArrangement = two) {
                    StatCard("Pending Payments", money(m!!.pendingPayments), Modifier.weight(1f))
                    StatCard("Material Stock", "%,.0f".format(m!!.materialStock), Modifier.weight(1f))
                }
                Row(horizontalArrangement = two) {
                    StatCard("Labour Count", m!!.labourCount.toString(), Modifier.weight(1f))
                    StatCard("Completion %", "%.1f%%".format(m!!.completion), Modifier.weight(1f))
                }
            }
        }
    }
}
