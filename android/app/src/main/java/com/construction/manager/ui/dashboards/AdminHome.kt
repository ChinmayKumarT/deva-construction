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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.construction.manager.data.ProjectRow
import com.construction.manager.data.Repo
import com.construction.manager.ui.AuthViewModel
import com.construction.manager.ui.DeleteAccountButton
import com.construction.manager.ui.StatCard
import com.construction.manager.ui.components.AccountMenuButton
import com.construction.manager.ui.components.WarningBanner
import com.construction.manager.ui.money
import kotlinx.coroutines.launch

enum class AdminSection(val label: String) {
    Overview("Overview"),
    Search("Search"),
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
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                section.label,
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontFamily = com.construction.manager.ui.theme.Fraunces,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                            )
                            Spacer(Modifier.width(10.dp))
                            Box(
                                Modifier
                                    .background(
                                        MaterialTheme.colorScheme.primaryContainer,
                                        RoundedCornerShape(6.dp),
                                    )
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                            ) {
                                Text(
                                    if (isAdmin) "Admin" else "Manager",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                    letterSpacing = 0.5.sp,
                                )
                            }
                        }
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
                    colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                )
            },
        ) { padding ->
            Box(Modifier.padding(padding)) {
                when (section) {
                    AdminSection.Overview -> AdminOverview()
                    AdminSection.Search -> AdminSearch(onNavigateToProject = { navigateTo(AdminSection.Projects) })
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
                if (m!!.overBudgetCount > 0) {
                    WarningBanner(
                        "${m!!.overBudgetCount} project${if (m!!.overBudgetCount > 1) "s" else ""} over budget: ${m!!.overBudgetNames.joinToString(", ")}",
                    )
                }
                if (m!!.nearBudgetCount > 0) {
                    WarningBanner(
                        "${m!!.nearBudgetCount} project${if (m!!.nearBudgetCount > 1) "s" else ""} approaching budget: ${m!!.nearBudgetNames.joinToString(", ")}",
                    )
                }
            }
        }
    }
}

@Composable
fun AdminSearch(onNavigateToProject: () -> Unit = {}) {
    var query by remember { mutableStateOf("") }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var clients by remember { mutableStateOf<List<com.construction.manager.data.ClientRow>>(emptyList()) }
    var suppliers by remember { mutableStateOf<List<com.construction.manager.data.SupplierRow>>(emptyList()) }
    var labourers by remember { mutableStateOf<List<com.construction.manager.data.LabourerRow>>(emptyList()) }
    var loaded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            projects = Repo.listProjects()
            clients = Repo.listClients()
            suppliers = Repo.listSuppliers()
            labourers = Repo.listLabourers()
            loaded = true
        } catch (_: Exception) { loaded = true }
    }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search projects, clients, suppliers, labour...") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        if (!loaded) {
            CircularProgressIndicator()
            return@Column
        }

        val q = query.trim().lowercase()
        if (q.length < 2) {
            Text("Type at least 2 characters to search.", style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            return@Column
        }

        val matchedProjects = projects.filter { it.name.lowercase().contains(q) }
        val matchedClients = clients.filter { it.name.lowercase().contains(q) || it.email?.lowercase()?.contains(q) == true }
        val matchedSuppliers = suppliers.filter { it.name.lowercase().contains(q) || it.email?.lowercase()?.contains(q) == true }
        val matchedLabourers = labourers.filter { it.name.lowercase().contains(q) || it.category?.lowercase()?.contains(q) == true }
        val total = matchedProjects.size + matchedClients.size + matchedSuppliers.size + matchedLabourers.size

        if (total == 0) {
            Text("No results for \"$q\".", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            return@Column
        }

        Text("$total result${if (total != 1) "s" else ""}", style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)

        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            matchedProjects.forEach { p ->
                SearchResultCard("Project", p.name, "${p.status} · ${p.currentStage ?: "no stage"}")
            }
            matchedClients.forEach { c ->
                SearchResultCard("Client", c.name, listOfNotNull(c.email, c.phone).joinToString(" · ").ifEmpty { "No contact" })
            }
            matchedSuppliers.forEach { s ->
                SearchResultCard("Supplier", s.name, listOfNotNull(s.email, s.phone).joinToString(" · ").ifEmpty { "No contact" })
            }
            matchedLabourers.forEach { l ->
                SearchResultCard("Labour", l.name, listOfNotNull(l.category, l.phone).joinToString(" · ").ifEmpty { "No details" })
            }
        }
    }
}

@Composable
private fun SearchResultCard(type: String, title: String, subtitle: String) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier.background(MaterialTheme.colorScheme.secondaryContainer, RoundedCornerShape(6.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                Text(type, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSecondaryContainer)
            }
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleSmall, maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
