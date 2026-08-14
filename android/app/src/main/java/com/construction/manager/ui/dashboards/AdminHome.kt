package com.construction.manager.ui.dashboards

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.construction.manager.data.ProjectRow
import com.construction.manager.data.Repo
import com.construction.manager.ui.AuthViewModel
import com.construction.manager.ui.DeleteAccountButton
import com.construction.manager.ui.StatCard
import com.construction.manager.ui.components.AccountMenuButton
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
    Reports("Reports & cash flow"),
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
    var showDeleteDialog by remember { mutableStateOf(false) }
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
                // Mockup's drawerHeaderStyle: an avatar circle + name/role,
                // not just a plain "Admin"/"Manager" label.
                Row(
                    Modifier.fillMaxWidth().padding(18.dp, 22.dp, 18.dp, 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.size(42.dp)
                            .background(com.construction.manager.ui.theme.Forest, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (isAdmin) "A" else "M",
                            color = androidx.compose.ui.graphics.Color.White,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontFamily = com.construction.manager.ui.theme.Fraunces,
                            ),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            if (isAdmin) "Admin" else "Manager",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Text(
                            "Deva Construction",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Divider()
                // The section list alone (14 entries) is already taller than most
                // phone screens once the header/footer are accounted for, and
                // ModalDrawerSheet doesn't scroll on its own -- scope the scroll to
                // just this middle section so the sign-out/delete footer stays
                // pinned and reachable instead of being pushed off-screen.
                Column(
                    Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(vertical = 6.dp, horizontal = 10.dp),
                ) {
                    visibleSections.forEach { s ->
                        val selected = section == s
                        Text(
                            s.label,
                            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.Bold
                                else androidx.compose.ui.text.font.FontWeight.Medium,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.14f) else androidx.compose.ui.graphics.Color.Transparent,
                                    RoundedCornerShape(10.dp),
                                )
                                .clickable(onClick = {
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
                                })
                                .padding(horizontal = 12.dp, vertical = 11.dp),
                        )
                    }
                }
                Divider()
                TextButton(onClick = { vm.signOut() },
                    modifier = Modifier.padding(horizontal = 16.dp)) { Text("Sign out") }
                DeleteAccountButton(vm, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                Spacer(Modifier.height(12.dp))
            }
        },
    ) {
        if (showDeleteDialog) {
            DeleteAccountButton(vm, triggerImmediately = true, onDismiss = { showDeleteDialog = false })
        }
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            section.label,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontFamily = com.construction.manager.ui.theme.Fraunces,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                            ),
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    },
                    actions = {
                        AccountMenuButton(
                            initial = if (isAdmin) "D" else "S",
                            onSignOut = { vm.signOut() },
                            onDeleteAccount = { showDeleteDialog = true },
                            modifier = Modifier.padding(end = 8.dp),
                        )
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
                    AdminSection.Reports -> AdminReportsAndCashFlow()
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
