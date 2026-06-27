package com.construction.manager.ui.dashboards

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.construction.manager.data.*
import com.construction.manager.ui.AuthViewModel
import com.construction.manager.ui.DeleteAccountButton
import com.construction.manager.ui.SectionTitle
import com.construction.manager.ui.StatCard
import com.construction.manager.ui.money
import kotlinx.coroutines.launch
import java.time.LocalDate

private val WageFactor = mapOf("present" to 1.0, "half_day" to 0.5, "absent" to 0.0)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoleScaffold(title: String, vm: AuthViewModel,
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

// ---------- Labour ----------
@Composable
fun LabourDashboard(vm: AuthViewModel) = RoleScaffold("Labour", vm) { padding ->
    var labourer by remember { mutableStateOf<LabourerRow?>(null) }
    var today by remember { mutableStateOf<String?>(null) }
    var history by remember { mutableStateOf<List<AttendanceRow>>(emptyList()) }
    var currentProject by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var version by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    val todayDate = remember { LocalDate.now().toString() }
    val weekAgo = remember { LocalDate.now().minusDays(6).toString() }

    LaunchedEffect(version) {
        try {
            labourer = Repo.myLabourer()
            labourer?.let { l ->
                history = Repo.labourerAttendance(l.id, weekAgo)
                today = history.firstOrNull { it.date == todayDate }?.status
                currentProject = Repo.labourerCurrentProject(l.id)
            }
        } catch (e: Exception) { error = e.message }
    }

    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
        if (labourer == null) {
            Text("Account not linked to a labourer record yet.",
                Modifier.padding(16.dp))
        } else {
            val l = labourer!!
            val wage = l.dailyWage
            val weekly = history.sumOf { (WageFactor[it.status] ?: 0.0) * wage }
            Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Today", today ?: "not marked", Modifier.weight(1f))
                StatCard("Daily wage", money(wage), Modifier.weight(1f))
            }
            Row(Modifier.padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Site", currentProject?.take(8) ?: "unassigned", Modifier.weight(1f))
                StatCard("This week", money(weekly), Modifier.weight(1f))
            }
            SectionTitle("Mark today")
            Row(Modifier.padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("present","half_day","absent").forEach { s ->
                    Button(
                        onClick = {
                            scope.launch {
                                try {
                                    Repo.upsertAttendance(l.id, currentProject, todayDate, s)
                                    version++
                                } catch (e: Exception) { error = e.message }
                            }
                        },
                        enabled = today != s,
                    ) { Text(s.replace("_"," ")) }
                }
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp)) }
            SectionTitle("Last 7 days")
            history.forEach { a ->
                ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Row(Modifier.padding(12.dp)) {
                        Text(a.date, Modifier.weight(1f))
                        Text(a.status.replace("_"," "), Modifier.weight(1f))
                        Text(money((WageFactor[a.status] ?: 0.0) * wage))
                    }
                }
            }
        }
    }
}

// ---------- Supplier ----------
@Composable
fun SupplierDashboard(vm: AuthViewModel) = RoleScaffold("Supplier", vm) { padding ->
    var supplier by remember { mutableStateOf<SupplierRow?>(null) }
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var payments by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var version by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        try {
            supplier = Repo.mySupplier()
            supplier?.let { s ->
                materials = Repo.supplierMaterials(s.id)
                payments = Repo.supplierPayments(s.id)
                projects = Repo.listProjects()
            }
        } catch (e: Exception) { error = e.message }
    }
    val pendingPay = payments.filter { it.status in listOf("pending","approved") }.sumOf { it.amount }
    val paid = payments.filter { it.status == "paid" }.sumOf { it.amount }

    // Delivery form state
    var dProject by remember { mutableStateOf<ProjectRow?>(null) }
    var dName by remember { mutableStateOf("") }
    var dUnit by remember { mutableStateOf("bag") }
    var dQty by remember { mutableStateOf("") }
    var dUnitCost by remember { mutableStateOf("") }
    var dStatus by remember { mutableStateOf("delivered") }

    // Bill form state
    var amount by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var billProject by remember { mutableStateOf<ProjectRow?>(null) }

    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
        if (supplier == null) {
            Text("Account not linked to a supplier record yet.", Modifier.padding(16.dp))
        } else {
            Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Deliveries", materials.count { it.status == "delivered" }.toString(),
                    Modifier.weight(1f))
                StatCard("Pending", money(pendingPay), Modifier.weight(1f))
            }
            Row(Modifier.padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Total received", money(paid), Modifier.weight(1f))
                StatCard("Bills", payments.size.toString(), Modifier.weight(1f))
            }

            SectionTitle("Record delivery")
            com.construction.manager.ui.Dropdown(
                "Project (site)", projects, dProject, { it.name }, { dProject = it },
            )
            com.construction.manager.ui.TextField(dName, { dName = it }, "Material (e.g. Cement)")
            com.construction.manager.ui.TextField(dUnit, { dUnit = it }, "Unit (bag, kg, m³…)")
            com.construction.manager.ui.NumberField(dQty, { dQty = it }, "Quantity")
            com.construction.manager.ui.NumberField(dUnitCost, { dUnitCost = it }, "Unit cost")
            com.construction.manager.ui.Dropdown(
                "Status", listOf("delivered","ordered"), dStatus, { it }, { dStatus = it },
            )
            Button(
                onClick = {
                    val p = dProject ?: return@Button
                    val qty = dQty.toDoubleOrNull() ?: return@Button
                    val uc = dUnitCost.toDoubleOrNull() ?: 0.0
                    if (dName.isBlank() || qty <= 0) return@Button
                    scope.launch {
                        try {
                            Repo.recordSupplierDelivery(p.id, supplier!!.id, dName,
                                dUnit.ifBlank { "unit" }, qty, uc, dStatus)
                            dName = ""; dQty = ""; dUnitCost = ""; version++
                        } catch (e: Exception) { error = e.message }
                    }
                },
                modifier = Modifier.padding(16.dp),
            ) { Text("Record delivery") }

            SectionTitle("Generate bill")
            com.construction.manager.ui.Dropdown(
                "Project",
                projects.filter { p -> materials.any { it.projectId == p.id } },
                billProject, { it.name }, { billProject = it },
            )
            com.construction.manager.ui.NumberField(amount, { amount = it }, "Amount")
            com.construction.manager.ui.TextField(desc, { desc = it }, "Description")
            error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp)) }
            Button(onClick = {
                val p = billProject ?: return@Button
                val a = amount.toDoubleOrNull() ?: return@Button
                scope.launch {
                    try {
                        Repo.createPayment(p.id, "supplier", supplier!!.id, null, a,
                            desc.ifBlank { null })
                        amount = ""; desc = ""; version++
                    } catch (e: Exception) { error = e.message }
                }
            }, modifier = Modifier.padding(16.dp)) { Text("Submit bill") }

            SectionTitle("Deliveries")
            materials.forEach { m ->
                ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Row(Modifier.padding(12.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text(m.name, style = MaterialTheme.typography.titleSmall)
                            Text("${m.quantity} ${m.unit} · ${m.status}",
                                style = MaterialTheme.typography.bodySmall)
                        }
                        Text(money(m.quantity * m.unitCost))
                    }
                }
            }

            SectionTitle("Payments")
            payments.forEach { p ->
                ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Row(Modifier.padding(12.dp)) {
                        Text(p.description ?: "—", Modifier.weight(1f))
                        Text(p.status, Modifier.padding(end = 8.dp))
                        Text(money(p.amount))
                    }
                }
            }
        }
    }
}

// ---------- Client ----------
@Composable
fun ClientDashboard(vm: AuthViewModel) = RoleScaffold("Client", vm) { padding ->
    var client by remember { mutableStateOf<ClientRow?>(null) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var updates by remember { mutableStateOf<List<ProjectUpdateRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try {
            client = Repo.myClient()
            client?.let { c ->
                projects = Repo.myProjects(c.id)
                updates = Repo.myUpdates(projects.map { it.id })
            }
        } catch (e: Exception) { error = e.message }
    }
    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
        if (client == null) {
            Text("Account not linked to a client record yet.", Modifier.padding(16.dp))
        } else {
            error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp)) }
            SectionTitle("Your projects")
            projects.forEach { p ->
                ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(p.name, Modifier.weight(1f),
                                style = MaterialTheme.typography.titleSmall)
                            Text(p.status)
                        }
                        Text("Stage: ${p.currentStage ?: "—"}",
                            style = MaterialTheme.typography.bodySmall)
                        LinearProgressIndicator(
                            progress = { (p.completionPct / 100.0).toFloat().coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                        )
                        Text("${"%.1f".format(p.completionPct)}% · Budget ${money(p.totalCost)}",
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            SectionTitle("Recent updates")
            if (updates.isEmpty()) Text("No updates yet.", Modifier.padding(16.dp))
            updates.forEach { u ->
                ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Text(projects.find { it.id == u.projectId }?.name ?: "—",
                            style = MaterialTheme.typography.titleSmall)
                        if (!u.stage.isNullOrBlank()) Text("Stage: ${u.stage}",
                            style = MaterialTheme.typography.bodySmall)
                        if (!u.note.isNullOrBlank()) Text(u.note,
                            modifier = Modifier.padding(top = 4.dp))
                        u.imageUrl?.let {
                            AsyncImage(it, contentDescription = null,
                                modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp)
                                    .padding(top = 8.dp))
                        }
                    }
                }
            }
        }
    }
}
