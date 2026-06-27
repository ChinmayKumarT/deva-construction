package com.construction.manager.ui.dashboards

import android.net.Uri
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.construction.manager.data.*
import com.construction.manager.ui.*
import kotlinx.coroutines.launch
import java.time.LocalDate

private suspend fun safe(block: suspend () -> Unit, onError: (String) -> Unit) {
    try { block() } catch (e: Exception) { onError(e.message ?: "error") }
}

@Composable
private fun ItemCard(title: String, sub: String, trailing: String? = null,
                     actions: (@Composable RowScope.() -> Unit)? = null) {
    ElevatedCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleSmall)
                    Text(sub, style = MaterialTheme.typography.bodySmall)
                }
                if (trailing != null) Text(trailing, style = MaterialTheme.typography.bodyMedium)
            }
            if (actions != null) {
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { actions() }
            }
        }
    }
}

// ---------- Projects ----------
@Composable
fun AdminProjects() {
    var rows by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var clients by remember { mutableStateOf<List<ClientRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var version by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(version) {
        safe({ rows = Repo.listProjects(); clients = Repo.listClients() }) { error = it }
    }

    var name by remember { mutableStateOf("") }
    var stage by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    var completion by remember { mutableStateOf("0") }
    var status by remember { mutableStateOf("planned") }
    var client by remember { mutableStateOf<ClientRow?>(null) }

    FormColumn {
        SectionTitle("Create project")
        TextField(name, { name = it }, "Name")
        TextField(stage, { stage = it }, "Current stage")
        NumberField(cost, { cost = it }, "Total cost")
        NumberField(completion, { completion = it }, "Completion %")
        Dropdown("Status", listOf("planned","active","on_hold","completed","cancelled"), status,
            { it }, { status = it })
        Dropdown("Client", clients, client, { it.name }, { client = it })
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Button(
            onClick = {
                scope.launch {
                    safe({
                        Repo.createProject(name, client?.id, status,
                            stage.ifBlank { null },
                            cost.toDoubleOrNull() ?: 0.0,
                            completion.toDoubleOrNull() ?: 0.0)
                        name = ""; stage = ""; cost = ""; completion = "0"
                        version++
                    }) { error = it }
                }
            },
            modifier = Modifier.padding(16.dp),
        ) { Text("Create") }
        Divider()
        SectionTitle("Projects (${rows.size})")
        rows.forEach { p ->
            ItemCard(p.name,
                "${p.status} · ${p.currentStage ?: "—"} · ${"%.1f".format(p.completionPct)}%",
                money(p.totalCost))
        }
    }
}

// ---------- Clients ----------
@Composable
fun AdminClients() {
    var rows by remember { mutableStateOf<List<ClientRow>>(emptyList()) }
    var profiles by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        safe({
            rows = Repo.listClients()
            profiles = Repo.listProfilesByRole(Role.client)
        }) { error = it }
    }
    val linked = rows.mapNotNull { it.profileId }.toSet()
    val unlinked = profiles.filter { it.id !in linked }

    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var profile by remember { mutableStateOf<Profile?>(null) }

    FormColumn {
        SectionTitle("Add client")
        TextField(name, { name = it }, "Name")
        TextField(email, { email = it }, "Email")
        TextField(phone, { phone = it }, "Phone")
        Dropdown("Link to login (optional)", unlinked, profile,
            { it.fullName ?: it.id.take(8) }, { profile = it })
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Button(onClick = {
            scope.launch {
                safe({
                    Repo.createClient(name, email.ifBlank { null }, phone.ifBlank { null },
                        profile?.id)
                    name = ""; email = ""; phone = ""; profile = null; version++
                }) { error = it }
            }
        }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        Divider()
        SectionTitle("Clients (${rows.size})")
        rows.forEach { c ->
            ItemCard(c.name, "${c.email ?: "—"} · ${c.phone ?: "—"}",
                if (c.profileId != null) "linked" else "no login")
        }
    }
}

// ---------- Suppliers ----------
@Composable
fun AdminSuppliers() {
    var rows by remember { mutableStateOf<List<SupplierRow>>(emptyList()) }
    var profiles by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        safe({
            rows = Repo.listSuppliers()
            profiles = Repo.listProfilesByRole(Role.supplier)
        }) { error = it }
    }
    val linked = rows.mapNotNull { it.profileId }.toSet()
    val unlinked = profiles.filter { it.id !in linked }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var profile by remember { mutableStateOf<Profile?>(null) }

    FormColumn {
        SectionTitle("Add supplier")
        TextField(name, { name = it }, "Name")
        TextField(email, { email = it }, "Email")
        TextField(phone, { phone = it }, "Phone")
        Dropdown("Link to login (optional)", unlinked, profile,
            { it.fullName ?: it.id.take(8) }, { profile = it })
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Button(onClick = {
            scope.launch {
                safe({
                    Repo.createSupplier(name, email.ifBlank { null }, phone.ifBlank { null },
                        profile?.id)
                    name = ""; email = ""; phone = ""; profile = null; version++
                }) { error = it }
            }
        }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        Divider()
        SectionTitle("Suppliers (${rows.size})")
        rows.forEach { s ->
            ItemCard(s.name, "${s.email ?: "—"} · ${s.phone ?: "—"}",
                if (s.profileId != null) "linked" else "no login")
        }
    }
}

// ---------- Labourers ----------
@Composable
fun AdminLabourers() {
    var rows by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var profiles by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        safe({
            rows = Repo.listLabourers()
            profiles = Repo.listProfilesByRole(Role.labour)
        }) { error = it }
    }
    val linked = rows.mapNotNull { it.profileId }.toSet()
    val unlinked = profiles.filter { it.id !in linked }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var wage by remember { mutableStateOf("") }
    var profile by remember { mutableStateOf<Profile?>(null) }
    var active by remember { mutableStateOf(true) }

    FormColumn {
        SectionTitle("Add labourer")
        TextField(name, { name = it }, "Name")
        TextField(phone, { phone = it }, "Phone")
        NumberField(wage, { wage = it }, "Daily wage")
        Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Checkbox(active, { active = it }); Text("Active")
        }
        Dropdown("Link to login (optional)", unlinked, profile,
            { it.fullName ?: it.id.take(8) }, { profile = it })
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Button(onClick = {
            scope.launch {
                safe({
                    Repo.createLabourer(name, phone.ifBlank { null },
                        wage.toDoubleOrNull() ?: 0.0, active, profile?.id)
                    name = ""; phone = ""; wage = ""; profile = null; version++
                }) { error = it }
            }
        }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        Divider()
        SectionTitle("Labourers (${rows.size})")
        rows.forEach { l ->
            ItemCard(l.name, "${l.phone ?: "—"} · ${if (l.active) "active" else "inactive"}",
                money(l.dailyWage))
        }
    }
}

// ---------- Materials ----------
@Composable
fun AdminMaterials() {
    var rows by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var suppliers by remember { mutableStateOf<List<SupplierRow>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        safe({
            rows = Repo.listMaterials()
            projects = Repo.listProjects()
            suppliers = Repo.listSuppliers()
        }) { error = it }
    }
    var name by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("unit") }
    var qty by remember { mutableStateOf("") }
    var unitCost by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("ordered") }
    var project by remember { mutableStateOf<ProjectRow?>(null) }
    var supplier by remember { mutableStateOf<SupplierRow?>(null) }

    FormColumn {
        SectionTitle("Add material")
        TextField(name, { name = it }, "Name")
        TextField(unit, { unit = it }, "Unit (kg, bag…)")
        NumberField(qty, { qty = it }, "Quantity")
        NumberField(unitCost, { unitCost = it }, "Unit cost")
        Dropdown("Status", listOf("ordered","delivered","returned"), status, { it }, { status = it })
        Dropdown("Project", projects, project, { it.name }, { project = it })
        Dropdown("Supplier", suppliers, supplier, { it.name }, { supplier = it })
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Button(onClick = {
            val p = project ?: return@Button
            scope.launch {
                safe({
                    Repo.createMaterial(p.id, supplier?.id, name, unit,
                        qty.toDoubleOrNull() ?: 0.0, unitCost.toDoubleOrNull() ?: 0.0, status)
                    name = ""; qty = ""; unitCost = ""; version++
                }) { error = it }
            }
        }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        Divider()
        SectionTitle("Materials (${rows.size})")
        rows.forEach { m ->
            ItemCard(m.name,
                "${m.quantity} ${m.unit} · ${m.status}",
                money(m.quantity * m.unitCost),
                actions = if (m.status == "ordered") {
                    {
                        TextButton(onClick = {
                            scope.launch {
                                safe({ Repo.markMaterialDelivered(m.id); version++ }) { error = it }
                            }
                        }) { Text("Mark delivered") }
                    }
                } else null,
            )
        }
    }
}

// ---------- Payments ----------
@Composable
fun AdminPayments() {
    var rows by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var suppliers by remember { mutableStateOf<List<SupplierRow>>(emptyList()) }
    var labourers by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        safe({
            rows = Repo.listPayments()
            projects = Repo.listProjects()
            suppliers = Repo.listSuppliers()
            labourers = Repo.listLabourers()
        }) { error = it }
    }
    var payeeType by remember { mutableStateOf("supplier") }
    var amount by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var project by remember { mutableStateOf<ProjectRow?>(null) }
    var supplier by remember { mutableStateOf<SupplierRow?>(null) }
    var labourer by remember { mutableStateOf<LabourerRow?>(null) }

    FormColumn {
        SectionTitle("Create payment")
        Dropdown("Payee type", listOf("supplier","labour"), payeeType, { it }, { payeeType = it })
        Dropdown("Project", projects, project, { it.name }, { project = it })
        if (payeeType == "supplier")
            Dropdown("Supplier", suppliers, supplier, { it.name }, { supplier = it })
        else
            Dropdown("Labourer", labourers, labourer, { it.name }, { labourer = it })
        NumberField(amount, { amount = it }, "Amount")
        TextField(desc, { desc = it }, "Description")
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Button(onClick = {
            scope.launch {
                safe({
                    Repo.createPayment(project?.id, payeeType,
                        supplier?.id, labourer?.id,
                        amount.toDoubleOrNull() ?: 0.0, desc.ifBlank { null })
                    amount = ""; desc = ""; version++
                }) { error = it }
            }
        }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        Divider()
        SectionTitle("Payments (${rows.size})")
        rows.forEach { p ->
            ItemCard("${p.payeeType} · ${p.description ?: "—"}",
                p.status, money(p.amount),
                actions = {
                    when (p.status) {
                        "pending" -> {
                            TextButton(onClick = {
                                scope.launch {
                                    safe({ Repo.approvePayment(p.id); version++ }) { error = it }
                                }
                            }) { Text("Approve") }
                            TextButton(onClick = {
                                scope.launch {
                                    safe({ Repo.rejectPayment(p.id); version++ }) { error = it }
                                }
                            }) { Text("Reject") }
                        }
                        "approved" -> TextButton(onClick = {
                            scope.launch {
                                safe({ Repo.markPaymentPaid(p.id); version++ }) { error = it }
                            }
                        }) { Text("Mark paid") }
                    }
                },
            )
        }
    }
}

// ---------- Attendance ----------
@Composable
fun AdminAttendance() {
    val today = remember { LocalDate.now().toString() }
    var labourers by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var marks by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var error by remember { mutableStateOf<String?>(null) }
    var version by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        safe({
            labourers = Repo.listLabourers().filter { it.active }
            marks = Repo.listAttendance(today).associate { it.labourerId to it.status }
        }) { error = it }
    }

    FormColumn {
        SectionTitle("Attendance — $today")
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        labourers.forEach { l ->
            ItemCard(l.name, marks[l.id] ?: "not marked",
                actions = {
                    listOf("present","half_day","absent").forEach { s ->
                        TextButton(onClick = {
                            scope.launch {
                                safe({
                                    Repo.upsertAttendance(l.id, null, today, s); version++
                                }) { error = it }
                            }
                        }) { Text(s.replace("_"," ")) }
                    }
                },
            )
        }
    }
}

// ---------- Updates ----------
@Composable
fun AdminUpdates() {
    val context = LocalContext.current
    var rows by remember { mutableStateOf<List<ProjectUpdateRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var posting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version) {
        safe({ rows = Repo.listUpdates(); projects = Repo.listProjects() }) { error = it }
    }
    var project by remember { mutableStateOf<ProjectRow?>(null) }
    var stage by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var completion by remember { mutableStateOf("") }
    var pickedUri by remember { mutableStateOf<Uri?>(null) }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> pickedUri = uri }

    FormColumn {
        SectionTitle("Post project update")
        Dropdown("Project", projects, project, { it.name }, { project = it })
        TextField(stage, { stage = it }, "Stage")
        NumberField(completion, { completion = it }, "Completion %")
        TextField(note, { note = it }, "Note")

        Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                picker.launch(PickVisualMediaRequest(
                    ActivityResultContracts.PickVisualMedia.ImageOnly
                ))
            }) { Text(if (pickedUri == null) "Pick photo" else "Change photo") }
            if (pickedUri != null) {
                AsyncImage(pickedUri, contentDescription = null,
                    modifier = Modifier.size(56.dp))
                TextButton(onClick = { pickedUri = null }) { Text("Clear") }
            }
        }

        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }

        Button(
            onClick = {
                val p = project ?: return@Button
                posting = true
                scope.launch {
                    safe({
                        var url: String? = null
                        val uri = pickedUri
                        if (uri != null) {
                            val bytes = context.contentResolver.openInputStream(uri)
                                ?.use { it.readBytes() } ?: byteArrayOf()
                            val ext = context.contentResolver.getType(uri)
                                ?.substringAfter("/", "jpg") ?: "jpg"
                            url = Repo.uploadProjectImage(p.id, bytes, ext)
                        }
                        Repo.postProjectUpdate(p.id, stage.ifBlank { null },
                            note.ifBlank { null }, url, completion.toDoubleOrNull())
                        stage = ""; note = ""; completion = ""; pickedUri = null
                        version++
                    }) { error = it }
                    posting = false
                }
            },
            enabled = !posting,
            modifier = Modifier.padding(16.dp),
        ) { Text(if (posting) "Posting…" else "Post") }

        Divider()
        SectionTitle("Recent updates (${rows.size})")
        rows.forEach { u ->
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
                            modifier = Modifier.fillMaxWidth().heightIn(max = 200.dp)
                                .padding(top = 8.dp))
                    }
                }
            }
        }
    }
}

// ---------- Reports ----------
@Composable
fun AdminReports() {
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var payments by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        safe({
            projects = Repo.listProjects()
            payments = Repo.listPayments()
            materials = Repo.listMaterials()
        }) { error = it }
    }

    val spent = projects.associate { p ->
        val mat = materials.filter { it.projectId == p.id && it.status != "returned" }
            .sumOf { it.quantity * it.unitCost }
        val pay = payments.filter { it.projectId == p.id && it.status in listOf("paid","approved") }
            .sumOf { it.amount }
        p.id to mat + pay
    }
    val byStatus = listOf("pending","approved","paid","rejected").map { s ->
        s to payments.filter { it.status == s }
    }

    FormColumn {
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        SectionTitle("Projects: budget vs spend")
        projects.forEach { p ->
            val s = spent[p.id] ?: 0.0
            ItemCard(p.name, "Budget ${money(p.totalCost)} · Spent ${money(s)}",
                money(p.totalCost - s))
        }
        SectionTitle("Payments by status")
        byStatus.forEach { (s, rows) ->
            ItemCard(s, "${rows.size} items", money(rows.sumOf { it.amount }))
        }
    }
}

