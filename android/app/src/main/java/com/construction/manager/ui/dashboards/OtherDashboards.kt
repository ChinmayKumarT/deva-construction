package com.construction.manager.ui.dashboards

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import coil3.compose.AsyncImage
import com.construction.manager.data.*
import com.construction.manager.ui.AuthViewModel
import com.construction.manager.ui.BudgetPie
import com.construction.manager.ui.CompletionAndSpendPies
import com.construction.manager.ui.DeleteAccountButton
import com.construction.manager.ui.SectionTitle
import com.construction.manager.ui.StatCard
import com.construction.manager.ui.money
import com.construction.manager.util.PdfExporter
import com.construction.manager.util.PdfSiteDetail
import com.construction.manager.util.PdfTransaction
import com.construction.manager.util.PdfUpdate
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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
// Deliberately a dead end: labourers are records the site manager maintains,
// not users of the app. Attendance and wages are recorded for them on the
// admin Attendance screen, and the matching RLS policies were dropped in
// supabase/15_retire_labour_self_access.sql -- so this screen reads nothing.
// Kept (rather than removing Role.labour) so existing accounts still land
// somewhere sane instead of a dead route.
@Composable
fun LabourDashboard(vm: AuthViewModel) = RoleScaffold("Labour", vm) { padding ->
    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
        SectionTitle("You're signed in")
        Text(
            "Your attendance and wages are recorded by your site manager — " +
                "there's nothing for you to fill in here.",
            Modifier.padding(horizontal = 16.dp),
        )
        Text(
            "To check your days worked or wages owed, please speak to your site manager.",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(16.dp),
        )
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
                            desc.ifBlank { null }, null)
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
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var payments by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var reportProject by remember { mutableStateOf<ProjectRow?>(null) }
    LaunchedEffect(Unit) {
        try {
            client = Repo.myClient()
            client?.let { c ->
                projects = Repo.myProjects(c.id)
                val ids = projects.map { it.id }
                updates = Repo.myUpdates(ids)
                materials = Repo.myMaterials(ids)
                payments = Repo.myPayments(ids)
            }
        } catch (e: Exception) { error = e.message }
    }
    val spentByProject = projects.associate { p ->
        val mat = materials.filter { it.projectId == p.id && it.status != "returned" }
            .sumOf { it.quantity * it.unitCost }
        // Labour only: supplier payments settle already-counted material costs.
        val pay = payments.filter {
            it.projectId == p.id && it.status in listOf("paid", "approved") &&
                it.payeeType == "labour"
        }.sumOf { it.amount }
        p.id to mat + pay
    }

    val rp = reportProject
    if (rp != null) {
        ClientReportDetail(
            project = rp,
            spent = spentByProject[rp.id] ?: 0.0,
            materials = materials.filter { it.projectId == rp.id },
            payments = payments.filter { it.projectId == rp.id },
            updates = updates.filter { it.projectId == rp.id },
            onBack = { reportProject = null },
        )
        return@RoleScaffold
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
                        p.endDate?.let { end ->
                            if (p.finishDateExtended) {
                                Text(
                                    "Finish date extended: was ${p.originalEndDate}, now $end",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                                p.extensionReason?.ifBlank { null }?.let { reason ->
                                    Text(
                                        "Reason: $reason",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            } else {
                                Text(
                                    "Expected finish: $end",
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                        p.nextPaymentDate?.let { due ->
                            Text(
                                "Next payment due: $due",
                                style = MaterialTheme.typography.bodySmall,
                                color = androidx.compose.ui.graphics.Color(0xFFF59E0B),
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        TextButton(
                            onClick = { reportProject = p },
                            modifier = Modifier.padding(top = 4.dp),
                        ) { Text("View report") }
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

@Composable
private fun ClientReportDetail(
    project: ProjectRow,
    spent: Double,
    materials: List<MaterialRow>,
    payments: List<PaymentRow>,
    updates: List<ProjectUpdateRow>,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var exporting by remember { mutableStateOf(false) }

    val transactions = remember(materials, payments) {
        val materialTx = materials.map {
            PdfTransaction(
                type = "Material",
                description = "${it.name} (${it.quantity} ${it.unit})",
                date = it.deliveredAt ?: it.orderedAt ?: "no date",
                status = it.status,
                amount = it.quantity * it.unitCost,
            )
        }
        val paymentTx = payments.map {
            PdfTransaction(
                type = if (it.payeeType == "labour") "Payment · labour" else "Payment · supplier",
                description = it.description?.ifBlank { null } ?: "—",
                date = it.createdAt ?: "no date",
                status = it.status,
                amount = it.amount,
            )
        }
        (materialTx + paymentTx).sortedByDescending { it.date }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onBack) { Text("← Reports") }
            TextButton(
                enabled = !exporting,
                onClick = {
                    exporting = true
                    scope.launch {
                        val pdfUpdates = updates.map { u ->
                            PdfUpdate(
                                stage = u.stage,
                                note = u.note,
                                date = u.createdAt ?: "no date",
                                image = u.imageUrl?.let { PdfExporter.downloadBitmap(it) },
                            )
                        }
                        val uri = withContext(kotlinx.coroutines.Dispatchers.IO) {
                            PdfExporter.exportSiteReport(
                                context,
                                projectName = project.name,
                                status = project.status,
                                completionPct = project.completionPct,
                                budget = project.totalCost,
                                spent = spent,
                                detail = PdfSiteDetail(
                                    client = null,
                                    address = project.address,
                                    stage = project.currentStage,
                                    endDate = project.endDate,
                                    extended = project.finishDateExtended,
                                    originalEndDate = project.originalEndDate,
                                    extensionReason = project.extensionReason,
                                ),
                                transactions = transactions,
                                updates = pdfUpdates,
                            )
                        }
                        PdfExporter.share(context, uri)
                        exporting = false
                    }
                },
            ) { Text(if (exporting) "Preparing…" else "Download PDF") }
        }
        SectionTitle(project.name)

        CompletionAndSpendPies(
            project.name, project.completionPct,
            if (project.totalCost > 0) (spent / project.totalCost * 100)
            else if (spent > 0) 999.0 else 0.0,
        )
        Divider()
        BudgetPie(project.name, project.totalCost, spent)
        Divider()

        SectionTitle("Transactions (${transactions.size})")
        if (transactions.isEmpty()) {
            Text("No materials or payments recorded for this project yet.", Modifier.padding(16.dp))
        } else {
            transactions.forEach { t ->
                ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Row(
                        Modifier.padding(12.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("${t.type} · ${t.description}", style = MaterialTheme.typography.titleSmall)
                            Text("${t.date} · ${t.status}", style = MaterialTheme.typography.bodySmall)
                        }
                        Text(money(t.amount), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}
