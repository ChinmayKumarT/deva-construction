package com.construction.manager.ui.dashboards

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import com.construction.manager.ui.CashFlowBarChart
import com.construction.manager.ui.CashFlowCategory
import com.construction.manager.ui.CashFlowDailyPoint
import com.construction.manager.ui.CashFlowTrendChart
import com.construction.manager.ui.DeleteAccountButton
import com.construction.manager.ui.SectionTitle
import com.construction.manager.ui.StatCard
import com.construction.manager.ui.lineTotal
import com.construction.manager.ui.money
import com.construction.manager.ui.RoleScaffold
import com.construction.manager.ui.components.LabeledChipPicker
import com.construction.manager.ui.components.MockupCard
import com.construction.manager.ui.components.StatusBadge
import com.construction.manager.util.ImageSaver
import kotlinx.coroutines.launch

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
    val context = LocalContext.current
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
    // Always "delivered" -- see the note where the Status picker used to be.
    val dStatus = "delivered"
    // Optional photo of what was actually delivered, so admin can check it.
    var dPickedUri by remember { mutableStateOf<Uri?>(null) }
    val dPhotoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> dPickedUri = uri }

    // Bill form state
    // amount / desc / billProject lived here for the removed "Generate bill"
    // form; recordSupplierDelivery derives all three from the delivery now.

    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
        if (supplier == null) {
            Text("Account not linked to a supplier record yet.", Modifier.padding(16.dp))
        } else {
            Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Deliveries", materials.count { it.status == "delivered" }.toString(),
                    Modifier.weight(1f))
                StatCard("Remaining", money(pendingPay), Modifier.weight(1f))
            }
            Row(Modifier.padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Total received", money(paid), Modifier.weight(1f))
                StatCard("Bills", payments.size.toString(), Modifier.weight(1f))
            }

            SectionTitle("Record delivery")
            LabeledChipPicker(
                "Project (site)", projects, dProject, { it.name }, { dProject = it },
            )
            com.construction.manager.ui.TextField(dName, { dName = it }, "Material (e.g. Cement)")
            com.construction.manager.ui.TextField(dUnit, { dUnit = it }, "Unit (bag, kg, m³…)")
            com.construction.manager.ui.NumberField(dQty, { dQty = it }, "Quantity")
            com.construction.manager.ui.NumberField(dUnitCost, { dUnitCost = it }, "Unit cost")
            // The Status picker (delivered / ordered) used to sit here.
            // Recording a delivery now raises the bill for it, and you don't
            // bill for goods that have only been ordered -- an "ordered" row
            // would never bill and there is no supplier-side action to later
            // mark it delivered and fix that. This form is "Record delivery";
            // the admin can still enter ordered materials from the admin side.
            Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = {
                    dPhotoPicker.launch(PickVisualMediaRequest(
                        ActivityResultContracts.PickVisualMedia.ImageOnly
                    ))
                }) { Text(if (dPickedUri == null) "Pick photo (optional)" else "Change photo") }
                if (dPickedUri != null) {
                    AsyncImage(dPickedUri, contentDescription = null,
                        modifier = Modifier.size(56.dp))
                    TextButton(onClick = { dPickedUri = null }) { Text("Clear") }
                }
            }
            Button(
                onClick = {
                    val p = dProject ?: return@Button
                    val qty = dQty.toDoubleOrNull() ?: return@Button
                    val uc = dUnitCost.toDoubleOrNull() ?: 0.0
                    if (dName.isBlank() || qty <= 0) return@Button
                    scope.launch {
                        try {
                            var url: String? = null
                            val uri = dPickedUri
                            if (uri != null) {
                                val bytes = context.contentResolver.openInputStream(uri)
                                    ?.use { it.readBytes() } ?: byteArrayOf()
                                val ext = context.contentResolver.getType(uri)
                                    ?.substringAfter("/", "jpg") ?: "jpg"
                                url = Repo.uploadProjectImage(p.id, bytes, ext)
                            }
                            Repo.recordSupplierDelivery(p.id, supplier!!.id, dName,
                                dUnit.ifBlank { "unit" }, qty, uc, dStatus, url)
                            dName = ""; dQty = ""; dUnitCost = ""; dPickedUri = null; version++
                        } catch (e: Exception) { error = e.message }
                    }
                },
                modifier = Modifier.padding(16.dp),
            ) { Text("Record delivery") }

            com.construction.manager.util.friendlyError(error)?.let { Text(it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp)) }

            // A "Generate bill" form used to follow, asking the supplier to
            // pick the project again and retype the amount and description for
            // a delivery they had just recorded above. Repo.recordSupplierDelivery
            // now raises that bill itself, so the bills below are read-only.

            SectionTitle("Deliveries")
            materials.forEach { m ->
                MockupCard(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(m.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        StatusBadge(m.status)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${m.quantity} ${m.unit}", style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f))
                        Text(money(lineTotal(m.quantity, m.unitCost)))
                    }
                }
            }

            SectionTitle("Payments")
            payments.forEach { p ->
                MockupCard(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(p.description ?: "—", Modifier.weight(1f))
                        StatusBadge(p.status)
                        Text(money(p.amount), modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }
        }
    }
}

// Buckets a flat list of (date, amount) pairs by day, filling every day
// between the data's own earliest and latest entry (even 0s) so
// CashFlowTrendChart's line stays continuous. Mirrors web's
// dailyTotalsFromDatedAmounts in lib/paymentsChart.ts -- unlike web's
// CashFlowTrendChart, Android's version cumulates internally, so this
// intentionally returns raw per-day totals, not a running total.
private fun dailyTotalsFromDatedAmounts(rows: List<Pair<String, Double>>): List<CashFlowDailyPoint> {
    if (rows.isEmpty()) return emptyList()
    val byDate = rows.groupingBy { it.first }.fold(0.0) { acc, r -> acc + r.second }
    val dates = byDate.keys.sorted()
    var cur = java.time.LocalDate.parse(dates.first())
    val end = java.time.LocalDate.parse(dates.last())
    val points = mutableListOf<CashFlowDailyPoint>()
    while (!cur.isAfter(end)) {
        val d = cur.toString()
        points.add(CashFlowDailyPoint(d, byDate[d] ?: 0.0))
        cur = cur.plusDays(1)
    }
    return points
}

// ---------- Client ----------
@Composable
fun ClientDashboard(vm: AuthViewModel) = RoleScaffold("Client", vm) { padding ->
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uriHandler = androidx.compose.ui.platform.LocalUriHandler.current
    var client by remember { mutableStateOf<ClientRow?>(null) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var updates by remember { mutableStateOf<List<ProjectUpdateRow>>(emptyList()) }
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var clientPayments by remember { mutableStateOf<List<ClientPaymentRow>>(emptyList()) }
    var wageTotals by remember { mutableStateOf<List<ProjectWageTotalRow>>(emptyList()) }
    var projectLabourers by remember { mutableStateOf<List<LabourOnProjectRow>>(emptyList()) }
    var changeOrders by remember { mutableStateOf<List<ProjectChangeOrderRow>>(emptyList()) }
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
                clientPayments = Repo.myClientPayments(ids)
                wageTotals = Repo.myProjectWageTotals()
                projectLabourers = Repo.myProjectLabourers()
                changeOrders = Repo.myChangeOrders(ids)
            }
        } catch (e: Exception) { error = e.message }
    }
    val wageByProject = wageTotals.associate { it.projectId to it.wageTotal }
    // Category + headcount, not individual names -- clients want to know
    // coverage, not who specifically is on site.
    val labourCategoryCountsByProject = projectLabourers.groupBy { it.projectId }
        .mapValues { (_, ls) -> ls.groupingBy { it.category ?: "Uncategorized" }.eachCount() }
    val receivedByProject = projects.associate { p ->
        p.id to clientPayments.filter { it.projectId == p.id }.sumOf { it.amount }
    }

    val rp = reportProject
    BackHandler(enabled = rp != null) { reportProject = null }
    if (rp != null) {
        ClientReportDetail(
            project = rp,
            onBack = { reportProject = null },
        )
        return@RoleScaffold
    }

    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
        if (client == null) {
            Text("Account not linked to a client record yet.", Modifier.padding(16.dp))
        } else {
            com.construction.manager.util.friendlyError(error)?.let { Text(it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp)) }
            SectionTitle("Your projects")
            projects.forEach { p ->
                MockupCard(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(p.name, Modifier.weight(1f),
                                style = MaterialTheme.typography.titleSmall)
                            StatusBadge(p.status)
                        }
                        Text("Stage: ${p.currentStage ?: "—"}",
                            style = MaterialTheme.typography.bodySmall)
                        com.construction.manager.ui.components.MockupProgressTrack(
                            fraction = (p.completionPct / 100.0).toFloat(),
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            "${"%.1f".format(p.completionPct)}% · Budget ${money(p.totalCost)} · " +
                                "Remaining ${money(p.totalCost - (receivedByProject[p.id] ?: 0.0))}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                        val received = receivedByProject[p.id] ?: 0.0
                        if (received > 0) {
                            BudgetPie("Paid vs remaining", p.totalCost, received)
                            val projectDaily = dailyTotalsFromDatedAmounts(
                                clientPayments.filter { it.projectId == p.id }
                                    .mapNotNull { cp -> cp.paidOn?.let { it to cp.amount } },
                            )
                            if (projectDaily.isNotEmpty()) CashFlowTrendChart(projectDaily)
                        }
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
                                "Next payment due: $due" +
                                    (p.nextPaymentAmount?.let { " · ${money(it)}" } ?: ""),
                                style = MaterialTheme.typography.bodySmall,
                                color = androidx.compose.ui.graphics.Color(0xFFF59E0B),
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        labourCategoryCountsByProject[p.id]?.takeIf { it.isNotEmpty() }?.let { counts ->
                            Text(
                                "LABOUR ON SITE",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                            Text(
                                counts.entries.joinToString(", ") { (category, count) -> "$category · $count" },
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                        changeOrders.filter { it.projectId == p.id }.takeIf { it.isNotEmpty() }?.let { orders ->
                            Text(
                                "ADDITIONAL WORK REQUESTED",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                            orders.forEach { co ->
                                Text(
                                    co.description + (co.createdAt?.take(10)?.let { " · $it" } ?: "") +
                                        (if (co.extraCost > 0.0) " · +${money(co.extraCost)}" else ""),
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                            }
                        }
                        Row {
                            TextButton(
                                onClick = { reportProject = p },
                                modifier = Modifier.padding(top = 4.dp),
                            ) { Text("View report") }
                            p.agreementImageUrl?.let { url ->
                                TextButton(
                                    onClick = { uriHandler.openUri(url) },
                                    modifier = Modifier.padding(top = 4.dp),
                                ) { Text("View agreement") }
                            }
                        }
                }
            }
            SectionTitle("Recent updates")
            if (updates.isEmpty()) Text("No updates yet.", Modifier.padding(16.dp))
            updates.forEach { u ->
                MockupCard(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                        Text(projects.find { it.id == u.projectId }?.name ?: "—",
                            style = MaterialTheme.typography.titleSmall)
                        if (!u.stage.isNullOrBlank()) Text("Stage: ${u.stage}",
                            style = MaterialTheme.typography.bodySmall)
                        if (!u.note.isNullOrBlank()) Text(u.note,
                            modifier = Modifier.padding(top = 4.dp))
                        u.imageUrl?.let { url ->
                            AsyncImage(url, contentDescription = null,
                                modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp)
                                    .padding(top = 8.dp))
                            TextButton(onClick = {
                                scope.launch {
                                    ImageSaver.saveToDownloads(context, url, "update-${u.id}.jpg")
                                }
                            }) { Text("Save image") }
                        }
                }
            }

            if (clientPayments.isNotEmpty()) {
                SectionTitle("Payment timeline")
                CashFlowBarChart(
                    clientPayments.map { cp ->
                        CashFlowCategory(cp.paidOn ?: "—", cp.amount, androidx.compose.ui.graphics.Color(0xFF16A34A))
                    },
                )
            }
        }
    }
}

@Composable
private fun ClientReportDetail(
    project: ProjectRow,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        TextButton(onClick = onBack, modifier = Modifier.padding(horizontal = 8.dp)) { Text("← Reports") }
        SectionTitle(project.name)

        project.agreementImageUrl?.let { url ->
            ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text("Agreement", style = MaterialTheme.typography.titleSmall)
                    AsyncImage(url, contentDescription = null,
                        modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp).padding(top = 8.dp))
                    TextButton(
                        onClick = {
                            scope.launch {
                                ImageSaver.saveToDownloads(context, url, "agreement-${project.id}.jpg")
                            }
                        },
                        modifier = Modifier.padding(top = 4.dp),
                    ) { Text("Download agreement") }
                }
            }
            Divider()
        }
    }
}
