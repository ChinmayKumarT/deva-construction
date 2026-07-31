package com.construction.manager.ui.dashboards

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
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
import com.construction.manager.util.PdfCashFlowCategory
import com.construction.manager.util.PdfCashFlowProject
import com.construction.manager.util.CsvExporter
import com.construction.manager.util.PdfExporter
import com.construction.manager.util.PdfLabourRow
import com.construction.manager.util.PdfSiteDetail
import com.construction.manager.util.PdfSiteSummary
import com.construction.manager.util.PdfTransaction
import com.construction.manager.util.PdfUpdate
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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

/** Active / archived switch shown at the top of each admin list screen. */
@Composable
private fun ArchivedSwitch(showArchived: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (showArchived) "Showing archived" else "Showing active",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f),
        )
        TextButton(onClick = onToggle) {
            Text(if (showArchived) "Show active" else "Show archived")
        }
    }
}

/**
 * Confirm before archiving. Archiving is reversible and never deletes -- see
 * supabase/10_archive.sql for why a real DELETE would be destructive here.
 */
@Composable
private fun ArchiveConfirmDialog(
    name: String,
    detail: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Archive $name?") },
        text = { Text("$detail Nothing is deleted — you can restore it from “Show archived”.") },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Archive") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/**
 * Permanent delete -- only ever offered when the caller has already checked
 * isOwner, but the real enforcement is server-side (owner_delete_row in
 * 12_owner_delete.sql rejects non-owners regardless of what this dialog does).
 */
@Composable
private fun DeleteForeverConfirmDialog(
    name: String,
    warning: String? = null,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Permanently delete $name?") },
        text = {
            Text(
                "This cannot be undone." + (warning?.let { " $it" } ?: ""),
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Delete forever", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/** Edit / Archive (or Restore [/ Delete forever]) buttons for one row. */
@Composable
private fun RowScope.EntityActions(
    archived: Boolean,
    onEdit: () -> Unit,
    onArchive: () -> Unit,
    onRestore: () -> Unit,
    onDeleteForever: (() -> Unit)? = null,
) {
    if (archived) {
        TextButton(onClick = onRestore) { Text("Restore") }
        if (onDeleteForever != null) {
            TextButton(onClick = onDeleteForever) {
                Text("Delete forever", color = MaterialTheme.colorScheme.error)
            }
        }
    } else {
        TextButton(onClick = onEdit) { Text("Edit") }
        TextButton(onClick = onArchive) { Text("Archive") }
    }
}

/** Small dialog scaffold shared by the per-entity edit dialogs. */
@Composable
private fun EditDialog(
    title: String,
    busy: Boolean,
    error: String?,
    canSave: Boolean,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                content()
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = canSave && !busy, onClick = onSave) {
                Text(if (busy) "Saving…" else "Save")
            }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Cancel") } },
    )
}

/** Plain text field for use inside dialogs (the shared TextField adds list padding). */
@Composable
private fun DialogField(value: String, onChange: (String) -> Unit, label: String) {
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) },
        singleLine = true, modifier = Modifier.fillMaxWidth(),
    )
}

// ---------- Projects ----------
@Composable
fun AdminProjects(isOwner: Boolean = false) {
    var rows by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var clients by remember { mutableStateOf<List<ClientRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var version by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    var showArchived by remember { mutableStateOf(false) }
    var selectedProject by remember { mutableStateOf<ProjectRow?>(null) }

    LaunchedEffect(version, showArchived) {
        safe({
            rows = if (showArchived) Repo.listArchivedProjects() else Repo.listProjects()
            clients = Repo.listClients()
        }) { error = it }
    }
    // The selected project is a snapshot from `rows`; once a create/edit
    // reloads the list, re-point it at the fresh row (or drop the selection
    // if the project no longer exists, e.g. after a delete).
    LaunchedEffect(rows) {
        selectedProject = selectedProject?.let { sel -> rows.find { it.id == sel.id } }
    }

    var name by remember { mutableStateOf("") }
    var stage by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    var completion by remember { mutableStateOf("0") }
    var status by remember { mutableStateOf("planned") }
    var client by remember { mutableStateOf<ClientRow?>(null) }
    var endDate by remember { mutableStateOf("") }

    FormColumn {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (showArchived) "Showing archived" else "Showing active",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { showArchived = !showArchived }) {
                Text(if (showArchived) "Show active" else "Show archived")
            }
        }

        if (!showArchived && selectedProject != null) {
            val p = selectedProject!!
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(p.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                TextButton(onClick = { selectedProject = null }) { Text("← All projects") }
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp)) }
            ProjectRowCard(
                project = p,
                clients = clients,
                archived = false,
                isOwner = isOwner,
                onChanged = { version++ },
            )
            return@FormColumn
        }

        if (!showArchived) {
            if (rows.isNotEmpty()) {
                StatCard("Total cost", money(rows.sumOf { it.totalCost }), modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(8.dp))
                rows.forEach { p ->
                    StatCard(
                        p.name, money(p.totalCost),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                            .clickable { selectedProject = p },
                    )
                }
                Spacer(Modifier.height(8.dp))
            }

            SectionTitle("Create project")
            TextField(name, { name = it }, "Name")
            TextField(stage, { stage = it }, "Current stage")
            NumberField(cost, { cost = it }, "Total cost")
            NumberField(completion, { completion = it }, "Completion %", max = 100.0)
            Dropdown("Status", listOf("planned","active","on_hold","completed","cancelled"), status,
                { it }, { status = it })
            Dropdown("Client", clients, client, { it.name }, { client = it })
            DateField(endDate, { endDate = it }, "Planned finish date")
            error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp)) }
            Button(
                onClick = {
                    scope.launch {
                        safe({
                            Repo.createProject(name, client?.id, status,
                                stage.ifBlank { null },
                                cost.toDoubleOrNull() ?: 0.0,
                                completion.toDoubleOrNull() ?: 0.0,
                                endDate.ifBlank { null })
                            name = ""; stage = ""; cost = ""; completion = "0"; endDate = ""
                            version++
                        }) { error = it }
                    }
                },
                modifier = Modifier.padding(16.dp),
            ) { Text("Create") }
            if (rows.isEmpty()) {
                Divider()
                Text("No projects yet.", Modifier.padding(16.dp))
            }
            return@FormColumn
        }

        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        SectionTitle("Archived projects (${rows.size})")
        if (rows.isEmpty()) {
            Text("No archived projects.", Modifier.padding(16.dp))
        }
        rows.forEach { p ->
            key(p.id) {
                ProjectRowCard(
                    project = p,
                    clients = clients,
                    archived = true,
                    isOwner = isOwner,
                    onChanged = { version++ },
                )
            }
        }
    }
}

@Composable
private fun ProjectRowCard(
    project: ProjectRow,
    clients: List<ClientRow>,
    archived: Boolean,
    isOwner: Boolean,
    onChanged: () -> Unit,
) {
    var extending by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var settingPayment by remember { mutableStateOf(false) }
    var confirmArchive by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val p = project

    ItemCard(
        p.name,
        "${p.status} · ${p.currentStage ?: "—"} · ${"%.1f".format(p.completionPct)}%" +
            (p.endDate?.let { " · Finish $it" } ?: "") +
            (p.nextPaymentDate?.let { " · Next payment $it" } ?: ""),
        money(p.totalCost),
        actions = {
            if (archived) {
                TextButton(onClick = {
                    scope.launch {
                        safe({ Repo.unarchiveProject(p.id); onChanged() }) { error = it }
                    }
                }) { Text("Restore") }
                if (isOwner) {
                    TextButton(onClick = { confirmDelete = true }) {
                        Text("Delete forever", color = MaterialTheme.colorScheme.error)
                    }
                }
            } else {
                if (p.finishDateExtended) {
                    Text(
                        "Extended from ${p.originalEndDate}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                TextButton(onClick = { editing = true }) { Text("Edit") }
                TextButton(onClick = { extending = true }) { Text("Extend date") }
                TextButton(onClick = { settingPayment = true }) { Text("Next payment") }
                TextButton(onClick = { confirmArchive = true }) { Text("Archive") }
            }
        },
    )
    error?.let {
        Text(it, color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 28.dp))
    }

    if (extending) {
        ExtendFinishDateDialog(
            project = p,
            onDismiss = { extending = false },
            onSaved = { extending = false; onChanged() },
        )
    }
    if (editing) {
        EditProjectDialog(
            project = p,
            clients = clients,
            onDismiss = { editing = false },
            onSaved = { editing = false; onChanged() },
        )
    }
    if (settingPayment) {
        NextPaymentDateDialog(
            project = p,
            onDismiss = { settingPayment = false },
            onSaved = { settingPayment = false; onChanged() },
        )
    }
    if (confirmArchive) {
        AlertDialog(
            onDismissRequest = { confirmArchive = false },
            title = { Text("Archive ${p.name}?") },
            text = {
                Text(
                    "It will be hidden from projects, reports and the client's dashboard. " +
                        "Its materials, payments and updates are kept, and you can restore it " +
                        "from \"Show archived\".",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmArchive = false
                    scope.launch {
                        safe({ Repo.archiveProject(p.id); onChanged() }) { error = it }
                    }
                }) { Text("Archive") }
            },
            dismissButton = {
                TextButton(onClick = { confirmArchive = false }) { Text("Cancel") }
            },
        )
    }
    if (confirmDelete) {
        DeleteForeverConfirmDialog(
            p.name,
            warning = "All its materials, payments and progress updates will be deleted too.",
            onDismiss = { confirmDelete = false },
            onConfirm = {
                confirmDelete = false
                scope.launch {
                    safe({ Repo.deleteProjectForever(p.id); onChanged() }) { error = it }
                }
            },
        )
    }
}

@Composable
private fun EditProjectDialog(
    project: ProjectRow,
    clients: List<ClientRow>,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
) {
    var name by remember { mutableStateOf(project.name) }
    var stage by remember { mutableStateOf(project.currentStage ?: "") }
    var cost by remember { mutableStateOf(project.totalCost.toString()) }
    var completion by remember { mutableStateOf(project.completionPct.toString()) }
    var status by remember { mutableStateOf(project.status) }
    var client by remember { mutableStateOf(clients.firstOrNull { it.id == project.clientId }) }
    var endDate by remember { mutableStateOf(project.endDate ?: "") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Edit project") },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                TextField(name, { name = it }, "Name")
                TextField(stage, { stage = it }, "Current stage")
                NumberField(cost, { cost = it }, "Total cost")
                NumberField(completion, { completion = it }, "Completion %", max = 100.0)
                Dropdown("Status", listOf("planned","active","on_hold","completed","cancelled"),
                    status, { it }, { status = it })
                Dropdown("Client", clients, client, { it.name }, { client = it })
                DateField(endDate, { endDate = it }, "Finish date")
                Text(
                    "Changing the finish date here is not recorded as an extension. " +
                        "Use \"Extend date\" so the client sees what changed.",
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank() && !busy,
                onClick = {
                    busy = true
                    scope.launch {
                        safe({
                            Repo.updateProject(
                                project.id, name, client?.id, status,
                                stage.ifBlank { null },
                                cost.toDoubleOrNull() ?: 0.0,
                                completion.toDoubleOrNull() ?: 0.0,
                                endDate.ifBlank { null },
                            )
                            onSaved()
                        }) { error = it }
                        busy = false
                    }
                },
            ) { Text(if (busy) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ExtendFinishDateDialog(project: ProjectRow, onDismiss: () -> Unit, onSaved: () -> Unit) {
    var newDate by remember { mutableStateOf(project.endDate ?: "") }
    var reason by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Extend finish date") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Current: ${project.endDate ?: "not set"}" +
                        (project.originalEndDate?.let { " (originally $it)" } ?: ""),
                    style = MaterialTheme.typography.bodySmall,
                )
                DateField(newDate, { newDate = it }, "New finish date")
                TextField(reason, { reason = it }, "Reason (optional)")
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = newDate.isNotBlank() && !busy,
                onClick = {
                    busy = true
                    scope.launch {
                        safe({
                            Repo.extendProjectEndDate(project.id, newDate, reason.ifBlank { null })
                            onSaved()
                        }) { error = it }
                        busy = false
                    }
                },
            ) { Text(if (busy) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun NextPaymentDateDialog(project: ProjectRow, onDismiss: () -> Unit, onSaved: () -> Unit) {
    var date by remember { mutableStateOf(project.nextPaymentDate ?: "") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Next payment date") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Shown to the client on their dashboard so they know when a payment is due.",
                    style = MaterialTheme.typography.bodySmall,
                )
                DateField(date, { date = it }, "Next payment date")
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !busy,
                onClick = {
                    busy = true
                    scope.launch {
                        safe({
                            Repo.setNextPaymentDate(project.id, date.ifBlank { null })
                            onSaved()
                        }) { error = it }
                        busy = false
                    }
                },
            ) { Text(if (busy) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Cancel") } },
    )
}

// ---------- Clients ----------
@Composable
fun AdminClients(isOwner: Boolean = false) {
    var rows by remember { mutableStateOf<List<ClientRow>>(emptyList()) }
    var profiles by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var showArchived by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ClientRow?>(null) }
    var archiving by remember { mutableStateOf<ClientRow?>(null) }
    var deleting by remember { mutableStateOf<ClientRow?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version, showArchived) {
        safe({
            rows = if (showArchived) Repo.listArchivedClients() else Repo.listClients()
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
        ArchivedSwitch(showArchived) { showArchived = !showArchived }
        if (!showArchived) {
            SectionTitle("Add client")
            TextField(name, { name = it }, "Name")
            TextField(email, { email = it }, "Email")
            TextField(phone, { phone = it }, "Phone")
            Dropdown("Link to login (optional)", unlinked, profile,
                { it.fullName ?: it.id.take(8) }, { profile = it })
            Button(onClick = {
                scope.launch {
                    safe({
                        Repo.createClient(name, email.ifBlank { null }, phone.ifBlank { null },
                            profile?.id)
                        name = ""; email = ""; phone = ""; profile = null; version++
                    }) { error = it }
                }
            }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Divider()
        SectionTitle(
            if (showArchived) "Archived clients (${rows.size})" else "Clients (${rows.size})",
        )
        if (rows.isEmpty()) {
            Text(if (showArchived) "No archived clients." else "No clients yet.",
                Modifier.padding(16.dp))
        }
        rows.forEach { c ->
            ItemCard(
                c.name, "${c.email ?: "—"} · ${c.phone ?: "—"}",
                if (c.profileId != null) "linked" else "no login",
                actions = {
                    EntityActions(
                        archived = showArchived,
                        onEdit = { editing = c },
                        onArchive = { archiving = c },
                        onRestore = {
                            scope.launch {
                                safe({ Repo.unarchiveClient(c.id); version++ }) { error = it }
                            }
                        },
                        onDeleteForever = if (isOwner) { { deleting = c } } else null,
                    )
                },
            )
        }
    }

    editing?.let { c ->
        EditClientDialog(c, onDismiss = { editing = null }, onSaved = { editing = null; version++ })
    }
    archiving?.let { c ->
        ArchiveConfirmDialog(
            c.name,
            "They will be hidden from lists and dropdowns. Their projects stay, and simply lose the client link.",
            onDismiss = { archiving = null },
            onConfirm = {
                archiving = null
                scope.launch { safe({ Repo.archiveClient(c.id); version++ }) { error = it } }
            },
        )
    }
    deleting?.let { c ->
        DeleteForeverConfirmDialog(
            c.name,
            onDismiss = { deleting = null },
            onConfirm = {
                deleting = null
                scope.launch { safe({ Repo.deleteClientForever(c.id); version++ }) { error = it } }
            },
        )
    }
}

@Composable
private fun EditClientDialog(client: ClientRow, onDismiss: () -> Unit, onSaved: () -> Unit) {
    var name by remember { mutableStateOf(client.name) }
    var email by remember { mutableStateOf(client.email ?: "") }
    var phone by remember { mutableStateOf(client.phone ?: "") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    EditDialog(
        title = "Edit client", busy = busy, error = error, canSave = name.isNotBlank(),
        onDismiss = onDismiss,
        onSave = {
            busy = true
            scope.launch {
                safe({
                    Repo.updateClient(client.id, name, email.ifBlank { null }, phone.ifBlank { null })
                    onSaved()
                }) { error = it }
                busy = false
            }
        },
    ) {
        DialogField(name, { name = it }, "Name")
        DialogField(email, { email = it }, "Email")
        DialogField(phone, { phone = it }, "Phone")
    }
}

// ---------- Suppliers ----------
@Composable
fun AdminSuppliers(isOwner: Boolean = false) {
    var rows by remember { mutableStateOf<List<SupplierRow>>(emptyList()) }
    var profiles by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var showArchived by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<SupplierRow?>(null) }
    var archiving by remember { mutableStateOf<SupplierRow?>(null) }
    var deleting by remember { mutableStateOf<SupplierRow?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version, showArchived) {
        safe({
            rows = if (showArchived) Repo.listArchivedSuppliers() else Repo.listSuppliers()
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
        ArchivedSwitch(showArchived) { showArchived = !showArchived }
        if (!showArchived) {
            SectionTitle("Add supplier")
            TextField(name, { name = it }, "Name")
            TextField(email, { email = it }, "Email")
            TextField(phone, { phone = it }, "Phone")
            Dropdown("Link to login (optional)", unlinked, profile,
                { it.fullName ?: it.id.take(8) }, { profile = it })
            Button(onClick = {
                scope.launch {
                    safe({
                        Repo.createSupplier(name, email.ifBlank { null }, phone.ifBlank { null },
                            profile?.id)
                        name = ""; email = ""; phone = ""; profile = null; version++
                    }) { error = it }
                }
            }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Divider()
        SectionTitle(
            if (showArchived) "Archived suppliers (${rows.size})" else "Suppliers (${rows.size})",
        )
        if (rows.isEmpty()) {
            Text(if (showArchived) "No archived suppliers." else "No suppliers yet.",
                Modifier.padding(16.dp))
        }
        rows.forEach { s ->
            ItemCard(
                s.name, "${s.email ?: "—"} · ${s.phone ?: "—"}",
                if (s.profileId != null) "linked" else "no login",
                actions = {
                    EntityActions(
                        archived = showArchived,
                        onEdit = { editing = s },
                        onArchive = { archiving = s },
                        onRestore = {
                            scope.launch {
                                safe({ Repo.unarchiveSupplier(s.id); version++ }) { error = it }
                            }
                        },
                        onDeleteForever = if (isOwner) { { deleting = s } } else null,
                    )
                },
            )
        }
    }

    editing?.let { s ->
        EditSupplierDialog(s, onDismiss = { editing = null }, onSaved = { editing = null; version++ })
    }
    archiving?.let { s ->
        ArchiveConfirmDialog(
            s.name,
            "They will be hidden from lists and dropdowns. Past materials and payments are kept.",
            onDismiss = { archiving = null },
            onConfirm = {
                archiving = null
                scope.launch { safe({ Repo.archiveSupplier(s.id); version++ }) { error = it } }
            },
        )
    }
    deleting?.let { s ->
        DeleteForeverConfirmDialog(
            s.name,
            onDismiss = { deleting = null },
            onConfirm = {
                deleting = null
                scope.launch { safe({ Repo.deleteSupplierForever(s.id); version++ }) { error = it } }
            },
        )
    }
}

@Composable
private fun EditSupplierDialog(supplier: SupplierRow, onDismiss: () -> Unit, onSaved: () -> Unit) {
    var name by remember { mutableStateOf(supplier.name) }
    var email by remember { mutableStateOf(supplier.email ?: "") }
    var phone by remember { mutableStateOf(supplier.phone ?: "") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    EditDialog(
        title = "Edit supplier", busy = busy, error = error, canSave = name.isNotBlank(),
        onDismiss = onDismiss,
        onSave = {
            busy = true
            scope.launch {
                safe({
                    Repo.updateSupplier(supplier.id, name, email.ifBlank { null }, phone.ifBlank { null })
                    onSaved()
                }) { error = it }
                busy = false
            }
        },
    ) {
        DialogField(name, { name = it }, "Name")
        DialogField(email, { email = it }, "Email")
        DialogField(phone, { phone = it }, "Phone")
    }
}

// ---------- Labourers ----------
@Composable
fun AdminLabourers(isOwner: Boolean = false) {
    var rows by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var showArchived by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<LabourerRow?>(null) }
    var archiving by remember { mutableStateOf<LabourerRow?>(null) }
    var deleting by remember { mutableStateOf<LabourerRow?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version, showArchived) {
        safe({
            rows = if (showArchived) Repo.listArchivedLabourers() else Repo.listLabourers()
        }) { error = it }
    }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var wage by remember { mutableStateOf("") }
    var active by remember { mutableStateOf(true) }
    var category by remember { mutableStateOf("None") }

    FormColumn {
        ArchivedSwitch(showArchived) { showArchived = !showArchived }
        if (!showArchived) {
            SectionTitle("Add labourer")
            TextField(name, { name = it }, "Name")
            Dropdown("Category", WorkCategories, category, { it }, { category = it })
            TextField(phone, { phone = it }, "Phone")
            NumberField(wage, { wage = it }, "Daily wage")
            Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Checkbox(active, { active = it }); Text("Active")
            }
            Button(onClick = {
                scope.launch {
                    safe({
                        Repo.createLabourer(name, phone.ifBlank { null },
                            wage.toDoubleOrNull() ?: 0.0, active, category.takeIf { it != "None" })
                        name = ""; phone = ""; wage = ""; category = "None"; version++
                    }) { error = it }
                }
            }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Divider()
        SectionTitle(
            if (showArchived) "Archived labourers (${rows.size})" else "Labourers (${rows.size})",
        )
        if (rows.isEmpty()) {
            Text(if (showArchived) "No archived labourers." else "No labourers yet.",
                Modifier.padding(16.dp))
        }
        rows.forEach { l ->
            ItemCard(
                l.name,
                listOfNotNull(l.category, l.phone ?: "—", if (l.active) "active" else "inactive")
                    .joinToString(" · "),
                money(l.dailyWage),
                actions = {
                    EntityActions(
                        archived = showArchived,
                        onEdit = { editing = l },
                        onArchive = { archiving = l },
                        onRestore = {
                            scope.launch {
                                safe({ Repo.unarchiveLabourer(l.id); version++ }) { error = it }
                            }
                        },
                        onDeleteForever = if (isOwner) { { deleting = l } } else null,
                    )
                },
            )
        }
    }

    editing?.let { l ->
        EditLabourerDialog(l, onDismiss = { editing = null }, onSaved = { editing = null; version++ })
    }
    archiving?.let { l ->
        ArchiveConfirmDialog(
            l.name,
            "They will be hidden from lists, attendance and assignment. " +
                "Their attendance and wage history is kept.",
            onDismiss = { archiving = null },
            onConfirm = {
                archiving = null
                scope.launch { safe({ Repo.archiveLabourer(l.id); version++ }) { error = it } }
            },
        )
    }
    deleting?.let { l ->
        DeleteForeverConfirmDialog(
            l.name,
            warning = "Their entire attendance and wage history will be deleted too.",
            onDismiss = { deleting = null },
            onConfirm = {
                deleting = null
                scope.launch { safe({ Repo.deleteLabourerForever(l.id); version++ }) { error = it } }
            },
        )
    }
}

@Composable
private fun EditLabourerDialog(labourer: LabourerRow, onDismiss: () -> Unit, onSaved: () -> Unit) {
    var name by remember { mutableStateOf(labourer.name) }
    var phone by remember { mutableStateOf(labourer.phone ?: "") }
    var wage by remember { mutableStateOf(labourer.dailyWage.toString()) }
    var active by remember { mutableStateOf(labourer.active) }
    var category by remember { mutableStateOf(labourer.category ?: "None") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    EditDialog(
        title = "Edit labourer", busy = busy, error = error, canSave = name.isNotBlank(),
        onDismiss = onDismiss,
        onSave = {
            busy = true
            scope.launch {
                safe({
                    Repo.updateLabourer(
                        labourer.id, name, phone.ifBlank { null },
                        wage.toDoubleOrNull() ?: 0.0, active, category.takeIf { it != "None" },
                    )
                    onSaved()
                }) { error = it }
                busy = false
            }
        },
    ) {
        DialogField(name, { name = it }, "Name")
        Dropdown("Category", WorkCategories, category, { it }, { category = it })
        DialogField(phone, { phone = it }, "Phone")
        OutlinedTextField(
            value = wage,
            onValueChange = { s -> if (s.isEmpty() || s.toDoubleOrNull() != null) wage = s },
            label = { Text("Daily wage") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(active, { active = it }); Text("Active")
        }
    }
}

// Fixed list (not freeform text) so the "Spend by work category" breakdown
// on the report page doesn't fragment into near-duplicate categories from
// typos. Mirrored on web as WORK_CATEGORIES in lib/workCategories.ts.
private val WorkCategories = listOf(
    "None", "Carpenter", "Plumber", "Electrician", "Bar bender", "Civil worker", "Painter", "Tiles",
)

// ---------- Materials ----------
@Composable
fun AdminMaterials(isOwner: Boolean = false, initialProjectFilter: ProjectRow? = null) {
    var rows by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var suppliers by remember { mutableStateOf<List<SupplierRow>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var showArchived by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<MaterialRow?>(null) }
    var archiving by remember { mutableStateOf<MaterialRow?>(null) }
    var deleting by remember { mutableStateOf<MaterialRow?>(null) }
    var projectFilter by remember { mutableStateOf(initialProjectFilter) }
    var showUnassigned by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version, showArchived) {
        safe({
            rows = if (showArchived) Repo.listArchivedMaterials() else Repo.listMaterials()
            projects = Repo.listProjects()
            suppliers = Repo.listSuppliers()
        }) { error = it }
    }

    if (projectFilter == null && !showUnassigned) {
        MaterialsProjectPicker(
            projects = projects,
            suppliers = suppliers,
            rows = rows,
            onCreated = { version++ },
            onPickProject = { projectFilter = it },
            onPickUnassigned = { showUnassigned = true },
        )
        return
    }

    val visibleRows = if (showUnassigned) rows.filter { it.projectId == null }
        else rows.filter { it.projectId == projectFilter?.id }
    var name by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("unit") }
    var qty by remember { mutableStateOf("") }
    var unitCost by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("ordered") }
    var supplier by remember { mutableStateOf<SupplierRow?>(null) }
    var workCategory by remember { mutableStateOf("None") }

    FormColumn {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (showUnassigned) "Materials with no project" else projectFilter?.name ?: "",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { projectFilter = null; showUnassigned = false; showArchived = false }) {
                Text("← All materials")
            }
        }
        ArchivedSwitch(showArchived) { showArchived = !showArchived }
        // Materials with no project were never created through this screen
        // (the create form always assigns a project below), so there's
        // nothing to add from here -- only existing ones to manage.
        if (!showArchived && !showUnassigned) {
            SectionTitle("Add material")
            TextField(name, { name = it }, "Name")
            TextField(unit, { unit = it }, "Unit (kg, bag…)")
            NumberField(qty, { qty = it }, "Quantity")
            NumberField(unitCost, { unitCost = it }, "Unit cost")
            Dropdown("Status", listOf("ordered","delivered","returned"), status, { it }, { status = it })
            Dropdown("Supplier", suppliers, supplier, { it.name }, { supplier = it })
            Dropdown("Work category", WorkCategories, workCategory, { it }, { workCategory = it })
            Button(onClick = {
                val p = projectFilter ?: return@Button
                scope.launch {
                    safe({
                        Repo.createMaterial(p.id, supplier?.id, name, unit,
                            qty.toDoubleOrNull() ?: 0.0, unitCost.toDoubleOrNull() ?: 0.0, status,
                            workCategory.takeIf { it != "None" })
                        name = ""; qty = ""; unitCost = ""; version++
                    }) { error = it }
                }
            }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Divider()
        SectionTitle(
            if (showArchived) "Archived materials (${visibleRows.size})" else "Materials (${visibleRows.size})",
        )
        if (visibleRows.isEmpty()) {
            Text(if (showArchived) "No archived materials." else "No materials yet.",
                Modifier.padding(16.dp))
        }
        visibleRows.forEach { m ->
            ItemCard(
                m.name,
                "${m.quantity} ${m.unit} · ${m.status}",
                money(lineTotal(m.quantity, m.unitCost)),
                actions = {
                    if (!showArchived && m.status == "ordered") {
                        TextButton(onClick = {
                            scope.launch {
                                safe({ Repo.markMaterialDelivered(m.id); version++ }) { error = it }
                            }
                        }) { Text("Delivered") }
                    }
                    EntityActions(
                        archived = showArchived,
                        onEdit = { editing = m },
                        onArchive = { archiving = m },
                        onRestore = {
                            scope.launch {
                                safe({ Repo.unarchiveMaterial(m.id); version++ }) { error = it }
                            }
                        },
                        onDeleteForever = if (isOwner) { { deleting = m } } else null,
                    )
                },
            )
        }
    }

    editing?.let { m ->
        EditMaterialDialog(m, onDismiss = { editing = null }, onSaved = { editing = null; version++ })
    }
    archiving?.let { m ->
        ArchiveConfirmDialog(
            m.name,
            "It will be hidden from lists and excluded from cost totals.",
            onDismiss = { archiving = null },
            onConfirm = {
                archiving = null
                scope.launch { safe({ Repo.archiveMaterial(m.id); version++ }) { error = it } }
            },
        )
    }
    deleting?.let { m ->
        DeleteForeverConfirmDialog(
            m.name,
            onDismiss = { deleting = null },
            onConfirm = {
                deleting = null
                scope.launch { safe({ Repo.deleteMaterialForever(m.id); version++ }) { error = it } }
            },
        )
    }
}

@Composable
private fun MaterialsProjectPicker(
    projects: List<ProjectRow>,
    suppliers: List<SupplierRow>,
    rows: List<MaterialRow>,
    onCreated: () -> Unit,
    onPickProject: (ProjectRow) -> Unit,
    onPickUnassigned: () -> Unit,
) {
    val statsByProject = remember(rows) {
        val map = mutableMapOf<String, Pair<Int, Double>>()
        for (m in rows) {
            val pid = m.projectId ?: continue
            val spend = if (m.status == "returned") 0.0 else lineTotal(m.quantity, m.unitCost)
            val cur = map[pid] ?: (0 to 0.0)
            map[pid] = (cur.first + 1) to (cur.second + spend)
        }
        map
    }
    val unassignedRows = remember(rows) { rows.filter { it.projectId == null } }
    val unassignedSpend = remember(unassignedRows) {
        unassignedRows.sumOf { if (it.status == "returned") 0.0 else lineTotal(it.quantity, it.unitCost) }
    }
    val totalCost = remember(statsByProject, unassignedSpend) {
        statsByProject.values.sumOf { it.second } + unassignedSpend
    }

    var name by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("unit") }
    var qty by remember { mutableStateOf("") }
    var unitCost by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("ordered") }
    var project by remember { mutableStateOf<ProjectRow?>(null) }
    var supplier by remember { mutableStateOf<SupplierRow?>(null) }
    var workCategory by remember { mutableStateOf("None") }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    FormColumn {
        SectionTitle("Materials")
        Text(
            "Pick a site to see what's ordered, delivered, and how much it costs.",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        Spacer(Modifier.height(8.dp))
        SectionTitle("Add material")
        TextField(name, { name = it }, "Name")
        Dropdown("Project", projects, project, { it.name }, { project = it })
        Dropdown("Supplier", suppliers, supplier, { it.name }, { supplier = it })
        TextField(unit, { unit = it }, "Unit (kg, bag…)")
        NumberField(qty, { qty = it }, "Quantity")
        NumberField(unitCost, { unitCost = it }, "Unit cost")
        Dropdown("Status", listOf("ordered","delivered","returned"), status, { it }, { status = it })
        Dropdown("Work category", WorkCategories, workCategory, { it }, { workCategory = it })
        Button(onClick = {
            val p = project ?: return@Button
            scope.launch {
                safe({
                    Repo.createMaterial(p.id, supplier?.id, name, unit,
                        qty.toDoubleOrNull() ?: 0.0, unitCost.toDoubleOrNull() ?: 0.0, status,
                        workCategory.takeIf { it != "None" })
                    name = ""; qty = ""; unitCost = ""; onCreated()
                }) { error = it }
            }
        }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Divider()
        StatCard("Total cost", money(totalCost), modifier = Modifier.padding(horizontal = 16.dp))
        Spacer(Modifier.height(8.dp))
        if (projects.isEmpty()) {
            Text("No projects yet.", Modifier.padding(16.dp))
        }
        projects.forEach { p ->
            StatCard(
                p.name, money(statsByProject[p.id]?.second ?: 0.0),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                    .clickable { onPickProject(p) },
            )
        }
        if (unassignedRows.isNotEmpty()) {
            StatCard(
                "No project", money(unassignedSpend),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                    .clickable(onClick = onPickUnassigned),
            )
        }
    }
}

@Composable
private fun EditMaterialDialog(material: MaterialRow, onDismiss: () -> Unit, onSaved: () -> Unit) {
    var name by remember { mutableStateOf(material.name) }
    var unit by remember { mutableStateOf(material.unit) }
    var qty by remember { mutableStateOf(material.quantity.toString()) }
    var unitCost by remember { mutableStateOf(material.unitCost.toString()) }
    var status by remember { mutableStateOf(material.status) }
    var workCategory by remember { mutableStateOf(material.workCategory ?: "None") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    EditDialog(
        title = "Edit material", busy = busy, error = error, canSave = name.isNotBlank(),
        onDismiss = onDismiss,
        onSave = {
            busy = true
            scope.launch {
                safe({
                    Repo.updateMaterial(
                        material.id, name, unit.ifBlank { "unit" },
                        qty.toDoubleOrNull() ?: 0.0, unitCost.toDoubleOrNull() ?: 0.0, status,
                        workCategory.takeIf { it != "None" },
                    )
                    onSaved()
                }) { error = it }
                busy = false
            }
        },
    ) {
        DialogField(name, { name = it }, "Name")
        DialogField(unit, { unit = it }, "Unit")
        OutlinedTextField(
            value = qty,
            onValueChange = { s -> if (s.isEmpty() || s.toDoubleOrNull() != null) qty = s },
            label = { Text("Quantity") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = unitCost,
            onValueChange = { s -> if (s.isEmpty() || s.toDoubleOrNull() != null) unitCost = s },
            label = { Text("Unit cost") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        Dropdown("Status", listOf("ordered","delivered","returned"), status, { it }, { status = it })
        Dropdown("Work category", WorkCategories, workCategory, { it }, { workCategory = it })
    }
}

// ---------- Payments ----------
@Composable
fun AdminPayments(isOwner: Boolean = false, initialProjectFilter: ProjectRow? = null) {
    var rows by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var suppliers by remember { mutableStateOf<List<SupplierRow>>(emptyList()) }
    var labourers by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var assignments by remember { mutableStateOf<List<ProjectLabourerRow>>(emptyList()) }
    var attendance by remember { mutableStateOf<List<AttendanceRow>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var showArchived by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<PaymentRow?>(null) }
    var archiving by remember { mutableStateOf<PaymentRow?>(null) }
    var deleting by remember { mutableStateOf<PaymentRow?>(null) }
    var projectFilter by remember { mutableStateOf(initialProjectFilter) }
    var showUnassigned by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version, showArchived) {
        safe({
            rows = if (showArchived) Repo.listArchivedPayments() else Repo.listPayments()
            projects = Repo.listProjects()
            suppliers = Repo.listSuppliers()
            labourers = Repo.listLabourers()
            materials = Repo.listMaterials().filter { it.status != "returned" }
            assignments = Repo.listActiveAssignments()
            attendance = Repo.listAllAttendance()
        }) { error = it }
    }

    if (projectFilter == null && !showUnassigned) {
        PaymentsProjectPicker(
            projects = projects,
            rows = rows,
            onPickProject = { projectFilter = it },
            onPickUnassigned = { showUnassigned = true },
        )
        return
    }

    val visibleRows = if (showUnassigned) rows.filter { it.projectId == null }
        else rows.filter { it.projectId == projectFilter?.id }
    var payeeType by remember { mutableStateOf("supplier") }
    var amount by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var supplier by remember { mutableStateOf<SupplierRow?>(null) }
    var labourer by remember { mutableStateOf<LabourerRow?>(null) }
    var workCategory by remember { mutableStateOf("None") }
    var purchase by remember { mutableStateOf<MaterialRow?>(null) }
    val projectMaterials = projectFilter?.let { pr -> materials.filter { it.projectId == pr.id } } ?: emptyList()
    val assignedLabourers = projectFilter?.let { pr ->
        val ids = assignments.filter { it.projectId == pr.id }.map { it.labourerId }.toSet()
        labourers.filter { it.id in ids }
    } ?: emptyList()
    val wageById = labourers.associate { it.id to it.dailyWage }
    val wageDue = remember(attendance, rows, wageById) { computeWagesDue(attendance, rows, wageById) }

    FormColumn {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (showUnassigned) "Payments with no project" else projectFilter?.name ?: "",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { projectFilter = null; showUnassigned = false; showArchived = false }) {
                Text("← All payments")
            }
        }
        ArchivedSwitch(showArchived) { showArchived = !showArchived }
        // Payments with no project were never created through this screen
        // (the create form always assigns the selected project below), so
        // there's nothing to add from here -- only existing ones to manage.
        if (!showArchived && !showUnassigned) {
            SectionTitle("Create payment")
            Dropdown(
                "Payee type", listOf("supplier","labour"), payeeType, { it },
                { payeeType = it; supplier = null; labourer = null; desc = ""; purchase = null },
            )
            if (payeeType == "labour") {
                Dropdown(
                    "Labourer", assignedLabourers, labourer, { it.name },
                    { l ->
                        labourer = l
                        val pid = projectFilter?.id
                        if (pid != null) amount = (wageDue[wageDueKey(pid, l.id)] ?: 0.0).toString()
                    },
                )
                Text(
                    "Only labourers currently assigned to this project. Selecting one fills in " +
                        "the wages owed based on their attendance.",
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            } else {
                Dropdown(
                    "Purchase (optional)", projectMaterials, purchase,
                    { m -> "${m.name} (${m.quantity} ${m.unit}) — ${money(lineTotal(m.quantity, m.unitCost))}" },
                    { m ->
                        purchase = m
                        payeeType = "supplier"
                        supplier = suppliers.find { it.id == m.supplierId }
                        amount = (lineTotal(m.quantity, m.unitCost)).toString()
                        desc = "${m.name} (${m.quantity} ${m.unit})"
                        workCategory = m.workCategory ?: "None"
                    },
                )
                Dropdown("Supplier", suppliers, supplier, { it.name }, { supplier = it })
                TextField(desc, { desc = it }, "Description")
            }
            Dropdown("Work category", WorkCategories, workCategory, { it }, { workCategory = it })
            NumberField(amount, { amount = it }, "Amount")
            Button(onClick = {
                val pid = projectFilter?.id ?: return@Button
                scope.launch {
                    safe({
                        Repo.createPayment(pid, payeeType,
                            supplier?.id, labourer?.id,
                            amount.toDoubleOrNull() ?: 0.0, desc.ifBlank { null },
                            workCategory.takeIf { it != "None" })
                        amount = ""; desc = ""; version++
                    }) { error = it }
                }
            }, modifier = Modifier.padding(16.dp)) { Text("Create") }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        Divider()
        SectionTitle(
            if (showArchived) "Archived payments (${visibleRows.size})" else "Payments (${visibleRows.size})",
        )
        if (visibleRows.isEmpty()) {
            Text(if (showArchived) "No archived payments." else "No payments yet.",
                Modifier.padding(16.dp))
        }
        visibleRows.forEach { p ->
            ItemCard("${p.payeeType} · ${p.description ?: "—"}",
                p.status, money(p.amount),
                actions = {
                    if (!showArchived) {
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
                            }) { Text("Paid") }
                        }
                    }
                    EntityActions(
                        archived = showArchived,
                        onEdit = { editing = p },
                        onArchive = { archiving = p },
                        onRestore = {
                            scope.launch {
                                safe({ Repo.unarchivePayment(p.id); version++ }) { error = it }
                            }
                        },
                        onDeleteForever = if (isOwner) { { deleting = p } } else null,
                    )
                },
            )
        }
    }

    editing?.let { p ->
        EditPaymentDialog(
            p, projects, suppliers, labourers, materials, assignments, attendance, rows,
            onDismiss = { editing = null }, onSaved = { editing = null; version++ },
        )
    }
    archiving?.let { p ->
        ArchiveConfirmDialog(
            "this ${p.payeeType} payment",
            "It will be hidden from lists and excluded from cost totals.",
            onDismiss = { archiving = null },
            onConfirm = {
                archiving = null
                scope.launch { safe({ Repo.archivePayment(p.id); version++ }) { error = it } }
            },
        )
    }
    deleting?.let { p ->
        DeleteForeverConfirmDialog(
            "this ${p.payeeType} payment",
            onDismiss = { deleting = null },
            onConfirm = {
                deleting = null
                scope.launch { safe({ Repo.deletePaymentForever(p.id); version++ }) { error = it } }
            },
        )
    }
}

@Composable
private fun PaymentsProjectPicker(
    projects: List<ProjectRow>,
    rows: List<PaymentRow>,
    onPickProject: (ProjectRow) -> Unit,
    onPickUnassigned: () -> Unit,
) {
    val statsByProject = remember(rows) {
        val map = mutableMapOf<String, Pair<Int, Double>>()
        for (p in rows) {
            val pid = p.projectId ?: continue
            val spend = if (p.status == "rejected") 0.0 else p.amount
            val cur = map[pid] ?: (0 to 0.0)
            map[pid] = (cur.first + 1) to (cur.second + spend)
        }
        map
    }
    val unassignedRows = remember(rows) { rows.filter { it.projectId == null } }
    val unassignedSpend = remember(unassignedRows) {
        unassignedRows.sumOf { if (it.status == "rejected") 0.0 else it.amount }
    }
    val totalCost = remember(statsByProject, unassignedSpend) {
        statsByProject.values.sumOf { it.second } + unassignedSpend
    }

    FormColumn {
        SectionTitle("Payments")
        Text(
            "Pick a site to see its bills and wages. Pending → approved → paid.",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        Spacer(Modifier.height(8.dp))
        StatCard("Total cost", money(totalCost), modifier = Modifier.padding(horizontal = 16.dp))
        Spacer(Modifier.height(8.dp))
        if (projects.isEmpty()) {
            Text("No projects yet.", Modifier.padding(16.dp))
        }
        projects.forEach { p ->
            StatCard(
                p.name, money(statsByProject[p.id]?.second ?: 0.0),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                    .clickable { onPickProject(p) },
            )
        }
        if (unassignedRows.isNotEmpty()) {
            StatCard(
                "No project", money(unassignedSpend),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                    .clickable(onClick = onPickUnassigned),
            )
        }
    }
}

@Composable
private fun EditPaymentDialog(
    payment: PaymentRow,
    projects: List<ProjectRow>,
    suppliers: List<SupplierRow>,
    labourers: List<LabourerRow>,
    materials: List<MaterialRow>,
    assignments: List<ProjectLabourerRow>,
    attendance: List<AttendanceRow>,
    payments: List<PaymentRow>,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
) {
    var payeeType by remember { mutableStateOf(payment.payeeType) }
    var project by remember { mutableStateOf(projects.find { it.id == payment.projectId }) }
    var supplier by remember { mutableStateOf(suppliers.find { it.id == payment.supplierId }) }
    var labourer by remember { mutableStateOf(labourers.find { it.id == payment.labourerId }) }
    var purchase by remember { mutableStateOf<MaterialRow?>(null) }
    var amount by remember { mutableStateOf(payment.amount.toString()) }
    var desc by remember { mutableStateOf(payment.description ?: "") }
    var workCategory by remember { mutableStateOf(payment.workCategory ?: "None") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val projectMaterials = project?.let { pr -> materials.filter { it.projectId == pr.id } } ?: emptyList()
    val assignedLabourers = project?.let { pr ->
        val ids = assignments.filter { it.projectId == pr.id }.map { it.labourerId }.toSet()
        labourers.filter { it.id in ids || it.id == payment.labourerId }
    } ?: emptyList()
    val wageById = labourers.associate { it.id to it.dailyWage }
    // Exclude this payment itself from "already claimed" -- otherwise
    // re-selecting the same labourer would subtract its own amount and
    // always show 0 due.
    val wageDue = remember(attendance, payments, wageById) {
        computeWagesDue(attendance, payments, wageById, excludePaymentId = payment.id)
    }

    EditDialog(
        title = "Edit payment", busy = busy, error = error,
        canSave = amount.toDoubleOrNull() != null,
        onDismiss = onDismiss,
        onSave = {
            busy = true
            scope.launch {
                safe({
                    Repo.updatePayment(
                        payment.id, project?.id, payeeType, supplier?.id, labourer?.id,
                        amount.toDoubleOrNull() ?: 0.0, desc.ifBlank { null },
                        workCategory.takeIf { it != "None" },
                    )
                    onSaved()
                }) { error = it }
                busy = false
            }
        },
    ) {
        Dropdown("Payee type", listOf("supplier","labour"), payeeType, { it }, { payeeType = it })
        Dropdown("Project", projects, project, { it.name }, { project = it; purchase = null; labourer = null })
        if (payeeType == "labour") {
            Dropdown(
                "Labourer", assignedLabourers, labourer, { it.name },
                { l ->
                    labourer = l
                    val pid = project?.id
                    if (pid != null) amount = (wageDue[wageDueKey(pid, l.id)] ?: 0.0).toString()
                },
            )
            Text(
                "Only labourers currently assigned to this project. Selecting one fills in the " +
                    "wages owed based on their attendance.",
                style = MaterialTheme.typography.labelSmall,
            )
        } else {
            Dropdown(
                "Purchase (optional)", projectMaterials, purchase,
                { m -> "${m.name} (${m.quantity} ${m.unit}) — ${money(lineTotal(m.quantity, m.unitCost))}" },
                { m ->
                    purchase = m
                    payeeType = "supplier"
                    supplier = suppliers.find { it.id == m.supplierId }
                    amount = (lineTotal(m.quantity, m.unitCost)).toString()
                    desc = "${m.name} (${m.quantity} ${m.unit})"
                    workCategory = m.workCategory ?: "None"
                },
            )
            Dropdown("Supplier", suppliers, supplier, { it.name }, { supplier = it })
            DialogField(desc, { desc = it }, "Description")
        }
        Dropdown("Work category", WorkCategories, workCategory, { it }, { workCategory = it })
        OutlinedTextField(
            value = amount,
            onValueChange = { s -> if (s.isEmpty() || s.toDoubleOrNull() != null) amount = s },
            label = { Text("Amount") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "Status (${payment.status}) is changed with the Approve / Paid buttons, not here.",
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

// ---------- Attendance ----------
@Composable
fun AdminAttendance() {
    val todayStr = remember { LocalDate.now().toString() }
    var date by remember { mutableStateOf(todayStr) }
    var labourers by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var assignments by remember { mutableStateOf<List<ProjectLabourerRow>>(emptyList()) }
    var marks by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var error by remember { mutableStateOf<String?>(null) }
    var version by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version, date) {
        safe({
            labourers = Repo.listLabourers().filter { it.active }
            projects = Repo.listProjects()
            assignments = Repo.listActiveAssignments()
            marks = Repo.listAttendance(date).associate { it.labourerId to it.status }
        }) { error = it }
    }
    val projectName = projects.associate { it.id to it.name }
    val currentSite = assignments.associate { it.labourerId to it.projectId }

    FormColumn {
        SectionTitle("Attendance")
        Row(
            Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DateField(date, { date = it }, "Date", modifier = Modifier.weight(1f))
            if (date != todayStr) {
                TextButton(onClick = { date = todayStr }) { Text("Today") }
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        if (labourers.isEmpty()) {
            Text("No active labourers. Add one in Labourers.", Modifier.padding(16.dp))
        }
        labourers.forEach { l ->
            val siteId = currentSite[l.id]
            ItemCard(
                l.name,
                "${siteId?.let { projectName[it] } ?: "unassigned"} · ${money(l.dailyWage)} · " +
                    (marks[l.id]?.replace("_", " ") ?: "not marked"),
                actions = {
                    listOf("present","half_day","absent").forEach { s ->
                        TextButton(onClick = {
                            scope.launch {
                                safe({
                                    Repo.upsertAttendance(l.id, siteId, date, s); version++
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
fun AdminUpdates(isOwner: Boolean = false) {
    val context = LocalContext.current
    var rows by remember { mutableStateOf<List<ProjectUpdateRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var posting by remember { mutableStateOf(false) }
    var showArchived by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ProjectUpdateRow?>(null) }
    var archiving by remember { mutableStateOf<ProjectUpdateRow?>(null) }
    var deleting by remember { mutableStateOf<ProjectUpdateRow?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(version, showArchived) {
        safe({
            rows = if (showArchived) Repo.listArchivedUpdates() else Repo.listUpdates()
            projects = Repo.listProjects()
        }) { error = it }
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
        ArchivedSwitch(showArchived) { showArchived = !showArchived }
        if (!showArchived) {
            SectionTitle("Post project update")
            Dropdown("Project", projects, project, { it.name }, { project = it })
            TextField(stage, { stage = it }, "Stage")
            NumberField(completion, { completion = it }, "Completion %", max = 100.0)
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
        }

        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }

        Divider()
        SectionTitle(
            if (showArchived) "Archived updates (${rows.size})" else "Recent updates (${rows.size})",
        )
        if (rows.isEmpty()) {
            Text(if (showArchived) "No archived updates." else "No updates yet.",
                Modifier.padding(16.dp))
        }
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
                    Row(Modifier.padding(top = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        EntityActions(
                            archived = showArchived,
                            onEdit = { editing = u },
                            onArchive = { archiving = u },
                            onRestore = {
                                val id = u.id ?: return@EntityActions
                                scope.launch {
                                    safe({ Repo.unarchiveUpdate(id); version++ }) { error = it }
                                }
                            },
                            onDeleteForever = if (isOwner) { { deleting = u } } else null,
                        )
                    }
                }
            }
        }
    }

    editing?.let { u ->
        EditUpdateDialog(u, onDismiss = { editing = null }, onSaved = { editing = null; version++ })
    }
    archiving?.let { u ->
        ArchiveConfirmDialog(
            "this update",
            "It will be hidden from admin and from the client's dashboard.",
            onDismiss = { archiving = null },
            onConfirm = {
                val id = u.id
                archiving = null
                if (id != null) {
                    scope.launch { safe({ Repo.archiveUpdate(id); version++ }) { error = it } }
                }
            },
        )
    }
    deleting?.let { u ->
        DeleteForeverConfirmDialog(
            "this update",
            onDismiss = { deleting = null },
            onConfirm = {
                val id = u.id
                deleting = null
                if (id != null) {
                    scope.launch { safe({ Repo.deleteUpdateForever(id); version++ }) { error = it } }
                }
            },
        )
    }
}

@Composable
private fun EditUpdateDialog(update: ProjectUpdateRow, onDismiss: () -> Unit, onSaved: () -> Unit) {
    var stage by remember { mutableStateOf(update.stage ?: "") }
    var note by remember { mutableStateOf(update.note ?: "") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    EditDialog(
        title = "Edit update", busy = busy, error = error, canSave = update.id != null,
        onDismiss = onDismiss,
        onSave = {
            val id = update.id ?: return@EditDialog
            busy = true
            scope.launch {
                safe({
                    Repo.updateProjectUpdate(id, stage.ifBlank { null }, note.ifBlank { null })
                    onSaved()
                }) { error = it }
                busy = false
            }
        },
    ) {
        DialogField(stage, { stage = it }, "Stage")
        DialogField(note, { note = it }, "Note")
        Text(
            "The photo can't be changed here, and editing the stage does not change the " +
                "project's current stage — post a new update for that.",
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

// ---------- Costs ----------
// Mirrors app/admin/costs/page.tsx: budget vs spend per project, where spend is
// materials (excluding returned) plus approved/paid payments split by payee type.
@Composable
fun AdminCosts(
    onJumpToMaterials: (ProjectRow) -> Unit = {},
    onJumpToPayments: (ProjectRow) -> Unit = {},
) {
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var clients by remember { mutableStateOf<List<ClientRow>>(emptyList()) }
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var payments by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var labourers by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var attendance by remember { mutableStateOf<List<AttendanceRow>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var version by remember { mutableStateOf(0) }
    var editingBudget by remember { mutableStateOf<ProjectRow?>(null) }

    LaunchedEffect(version) {
        safe({
            projects = Repo.listProjects()
            clients = Repo.listClients()
            materials = Repo.listMaterials()
            payments = Repo.listPayments()
            labourers = Repo.listLabourers()
            attendance = Repo.listAllAttendance()
        }) { error = it }
        loading = false
    }

    val countedPayments = payments.filter { it.status == "paid" || it.status == "approved" }
    val wageById = labourers.associate { it.id to it.dailyWage }
    val breakdown = projects.associate { p ->
        val mat = materials
            .filter { it.projectId == p.id && it.status != "returned" }
            .sumOf { lineTotal(it.quantity, it.unitCost) }
        val labour = countedPayments
            .filter { it.projectId == p.id && it.payeeType == "labour" }
            .sumOf { it.amount }
        val supplierPaid = countedPayments
            .filter { it.projectId == p.id && it.payeeType != "labour" }
            .sumOf { it.amount }
        val wages = attendance
            .filter { it.projectId == p.id }
            .sumOf { roundMoney((ReportWageFactor[it.status] ?: 0.0) * (wageById[it.labourerId] ?: 0.0)) }
        p.id to listOf(mat, labour, supplierPaid, wages)
    }
    // Spend counts materials + labour payments + wages accrued from attendance.
    // Supplier payments are shown separately so a material and the bill that
    // pays for it are not double-counted.
    val spentFor: (String) -> Double = { id ->
        val b = breakdown[id]
        if (b == null) 0.0 else b[0] + b[1] + b[3]
    }
    val totalBudget: Double = projects.sumOf { it.totalCost }
    val totalSpent: Double = projects.sumOf { spentFor(it.id) }

    FormColumn {
        when {
            error != null -> Text("Error: $error", color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp))
            loading -> Box(Modifier.fillMaxWidth().padding(32.dp),
                contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            projects.isEmpty() -> Text("Create a project first.", Modifier.padding(16.dp))
            else -> {
                SectionTitle("Cost tracking")
                Row(Modifier.padding(horizontal = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatCard("Total budget", money(totalBudget), Modifier.weight(1f))
                    StatCard("Total spent", money(totalSpent), Modifier.weight(1f))
                }
                Box(Modifier.padding(horizontal = 8.dp, vertical = 8.dp)) {
                    StatCard("Remaining", money(totalBudget - totalSpent))
                }
                Divider()
                SectionTitle("By project")
                projects.forEach { p ->
                    val (mat, labour, supplierPaid, wages) = breakdown[p.id]
                        ?: listOf(0.0, 0.0, 0.0, 0.0)
                    val spent = mat + labour + wages
                    val materialCount = materials.count { it.projectId == p.id }
                    val paymentCount = payments.count { it.projectId == p.id }
                    ItemCard(
                        p.name,
                        "${p.status} · Materials ${money(mat)} · Labour ${money(labour)} · " +
                            "Supplier bills ${money(supplierPaid)} · Wages ${money(wages)}",
                        "${money(spent)} / ${money(p.totalCost)}",
                        actions = {
                            TextButton(onClick = { editingBudget = p }) { Text("Edit budget") }
                            TextButton(onClick = { onJumpToMaterials(p) }) {
                                Text("Materials ($materialCount)")
                            }
                            TextButton(onClick = { onJumpToPayments(p) }) {
                                Text("Payments ($paymentCount)")
                            }
                        },
                    )
                }
                Text(
                    "Spend includes approved and paid payments, plus wages accrued from marked " +
                        "attendance (present = full daily wage, half day = 50%). Pending payments " +
                        "are not counted. Materials marked returned are excluded.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }
    }

    editingBudget?.let { p ->
        EditProjectDialog(
            project = p, clients = clients,
            onDismiss = { editingBudget = null },
            onSaved = { editingBudget = null; version++ },
        )
    }
}

// ---------- Team access (owner only) ----------
// The set_user_role() RPC re-checks is_owner() server-side, so this screen is a
// convenience UI, not the security boundary -- a non-owner reaching it (e.g. a
// stale isOwner flag) still gets rejected by the database on submit.
@Composable
fun AdminTeamAccess() {
    var rows by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var version by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var busyId by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(version) {
        safe({ rows = Repo.listAllProfiles() }) { error = it }
    }

    val assignableRoles = listOf(Role.client, Role.supplier, Role.labour, Role.manager, Role.admin)
    val filtered = remember(rows, query) {
        val q = query.trim()
        if (q.isBlank()) rows
        else rows.filter { p ->
            (p.fullName?.contains(q, ignoreCase = true) ?: false) ||
                p.role.contains(q, ignoreCase = true) ||
                p.id.startsWith(q, ignoreCase = true)
        }
    }

    FormColumn {
        SectionTitle("Team access (${rows.size})")
        Text(
            "Only you can grant admin or manager access. Everyone else signs up as " +
                "client, supplier or labour.",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search by name or role") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
            trailingIcon = if (query.isNotEmpty()) {
                { IconButton(onClick = { query = "" }) {
                    Icon(Icons.Default.Close, contentDescription = "Clear search")
                } }
            } else null,
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        )
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }
        if (filtered.isEmpty()) {
            Text("No matches.", Modifier.padding(16.dp))
        }
        filtered.forEach { p ->
            key(p.id) {
                TeamAccessRow(
                    profile = p,
                    assignableRoles = assignableRoles,
                    busy = busyId == p.id,
                    onSave = { newRole ->
                        busyId = p.id
                        scope.launch {
                            safe({
                                Repo.setUserRole(p.id, newRole)
                                version++
                            }) { error = it }
                            busyId = null
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun TeamAccessRow(
    profile: Profile,
    assignableRoles: List<Role>,
    busy: Boolean,
    onSave: (Role) -> Unit,
) {
    var pendingRole by remember { mutableStateOf(Role.fromString(profile.role) ?: Role.client) }
    ItemCard(
        profile.fullName?.ifBlank { null } ?: profile.id.take(8),
        "Current role: ${profile.role}" + if (profile.isOwner) " · owner" else "",
        actions = {
            Dropdown(
                "New role", assignableRoles, pendingRole, { it.name },
                { pendingRole = it },
                modifier = Modifier.weight(1f),
            )
            TextButton(
                enabled = !busy && pendingRole.name != profile.role,
                onClick = { onSave(pendingRole) },
            ) { Text(if (busy) "Saving…" else "Save") }
        },
    )
}

// ---------- Reports ----------
@Composable
fun AdminReports() {
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var payments by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var labourers by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var weekAttendance by remember { mutableStateOf<List<AttendanceRow>>(emptyList()) }
    var attendance by remember { mutableStateOf<List<AttendanceRow>>(emptyList()) }
    var clients by remember { mutableStateOf<List<ClientRow>>(emptyList()) }
    var updates by remember { mutableStateOf<List<ProjectUpdateRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedProject by remember { mutableStateOf<ProjectRow?>(null) }
    LaunchedEffect(Unit) {
        safe({
            projects = Repo.listProjects()
            payments = Repo.listPayments()
            materials = Repo.listMaterials()
            labourers = Repo.listLabourers()
            weekAttendance = Repo.listAttendanceSince(LocalDate.now().minusDays(6).toString())
            attendance = Repo.listAllAttendance()
            clients = Repo.listClients()
            updates = Repo.listUpdates()
        }) { error = it }
    }

    val wageById = labourers.associate { it.id to it.dailyWage }
    val spent = projects.associate { p ->
        val mat = materials.filter { it.projectId == p.id && it.status != "returned" }
            .sumOf { lineTotal(it.quantity, it.unitCost) }
        // Labour only: supplier payments settle already-counted material costs,
        // so counting them too would double-count (matches AdminCosts).
        val pay = payments.filter {
            it.projectId == p.id && it.status in listOf("paid", "approved") &&
                it.payeeType == "labour"
        }.sumOf { it.amount }
        val wages = attendance.filter { it.projectId == p.id }
            .sumOf { roundMoney((ReportWageFactor[it.status] ?: 0.0) * (wageById[it.labourerId] ?: 0.0)) }
        p.id to mat + pay + wages
    }

    val context = LocalContext.current

    FormColumn {
        error?.let { Text(it, color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)) }

        val sel = selectedProject
        if (sel == null) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                val summarySites = projects.map {
                    PdfSiteSummary(it.name, it.status, it.completionPct, it.totalCost, spent[it.id] ?: 0.0)
                }
                val summaryLabour = weeklyLabourRows(labourers, weekAttendance)
                TextButton(onClick = {
                    CsvExporter.share(context, CsvExporter.exportSummary(context, summarySites, summaryLabour))
                }) { Text("Download CSV") }
                TextButton(onClick = {
                    PdfExporter.share(context, PdfExporter.exportSummaryReport(context, summarySites, summaryLabour))
                }) { Text("Download PDF") }
            }
            SiteReportList(projects, spent, onSelect = { selectedProject = it })
            Divider()
            WeeklyLabourSection(labourers, weekAttendance)
        } else {
            SiteReportDetail(
                project = sel,
                spent = spent[sel.id] ?: 0.0,
                clientName = clients.firstOrNull { it.id == sel.clientId }?.name,
                materials = materials.filter { it.projectId == sel.id },
                payments = payments.filter { it.projectId == sel.id },
                attendance = attendance.filter { it.projectId == sel.id },
                labourerWage = wageById,
                labourerName = labourers.associate { it.id to it.name },
                updates = updates.filter { it.projectId == sel.id }.take(5),
                onBack = { selectedProject = null },
            )
        }
    }
}

private fun weeklyLabourRows(labourers: List<LabourerRow>, weekAttendance: List<AttendanceRow>): List<PdfLabourRow> {
    val wageById = labourers.associate { it.id to it.dailyWage }
    val nameById = labourers.associate { it.id to it.name }
    val daysById = mutableMapOf<String, Double>()
    val earnById = mutableMapOf<String, Double>()
    for (a in weekAttendance) {
        val factor = ReportWageFactor[a.status] ?: 0.0
        daysById[a.labourerId] = (daysById[a.labourerId] ?: 0.0) + factor
        earnById[a.labourerId] = (earnById[a.labourerId] ?: 0.0) + roundMoney(factor * (wageById[a.labourerId] ?: 0.0))
    }
    return daysById.map { (id, days) ->
        PdfLabourRow(nameById[id] ?: "—", "%.1f".format(days), money(earnById[id] ?: 0.0))
    }
}

// ---------- Cash flow ----------
// Deliberately different from "Spent" elsewhere (which only counts labour
// payments, to avoid double-counting against materials cost): cash flow asks
// "what actually left the bank," so materials cost, supplier payments and
// labour payments are each their own outflow category, not summed into one
// blended spend figure.
private data class CashFlowTotals(
    val materials: Double, val supplier: Double, val labour: Double, val wages: Double,
    val byProjectMaterials: Map<String, Double>,
    val byProjectSupplier: Map<String, Double>,
    val byProjectLabour: Map<String, Double>,
    val byProjectWages: Map<String, Double>,
)

private fun computeCashFlow(
    materials: List<MaterialRow>,
    payments: List<PaymentRow>,
    attendance: List<AttendanceRow>,
    labourerWage: Map<String, Double>,
    from: String,
    to: String,
    projectId: String? = null,
): CashFlowTotals {
    val byProjectMaterials = mutableMapOf<String, Double>()
    val byProjectSupplier = mutableMapOf<String, Double>()
    val byProjectLabour = mutableMapOf<String, Double>()
    val byProjectWages = mutableMapOf<String, Double>()
    var materialsTotal = 0.0
    var supplierTotal = 0.0
    var labourTotal = 0.0
    var wagesTotal = 0.0

    materials.forEach { m ->
        val pid = m.projectId ?: return@forEach
        if (projectId != null && pid != projectId) return@forEach
        if (m.status == "returned") return@forEach
        val date = m.deliveredAt ?: m.orderedAt ?: return@forEach
        if (date < from || date > to) return@forEach
        val amount = lineTotal(m.quantity, m.unitCost)
        materialsTotal += amount
        byProjectMaterials[pid] = (byProjectMaterials[pid] ?: 0.0) + amount
    }
    payments.forEach { p ->
        val pid = p.projectId ?: return@forEach
        if (projectId != null && pid != projectId) return@forEach
        if (p.status !in listOf("paid", "approved")) return@forEach
        val date = (p.createdAt ?: return@forEach).take(10)
        if (date < from || date > to) return@forEach
        when (p.payeeType) {
            "supplier" -> {
                supplierTotal += p.amount
                byProjectSupplier[pid] = (byProjectSupplier[pid] ?: 0.0) + p.amount
            }
            "labour" -> {
                labourTotal += p.amount
                byProjectLabour[pid] = (byProjectLabour[pid] ?: 0.0) + p.amount
            }
        }
    }
    attendance.forEach { a ->
        val pid = a.projectId ?: return@forEach
        if (projectId != null && pid != projectId) return@forEach
        if (a.date < from || a.date > to) return@forEach
        val amount = roundMoney((ReportWageFactor[a.status] ?: 0.0) * (labourerWage[a.labourerId] ?: 0.0))
        if (amount <= 0.0) return@forEach
        wagesTotal += amount
        byProjectWages[pid] = (byProjectWages[pid] ?: 0.0) + amount
    }
    return CashFlowTotals(
        materialsTotal, supplierTotal, labourTotal, wagesTotal,
        byProjectMaterials, byProjectSupplier, byProjectLabour, byProjectWages,
    )
}

private fun wageDueKey(projectId: String, labourerId: String) = "$projectId|$labourerId"

// How much is still owed to a labourer for a project: wage accrued from
// attendance minus whatever labour payments already exist for that pair
// (any non-rejected status counts as claimed, so a pending payment isn't
// double-suggested). Mirrors lib/wages.ts's computeWagesDue.
private fun computeWagesDue(
    attendance: List<AttendanceRow>,
    payments: List<PaymentRow>,
    labourerWage: Map<String, Double>,
    excludePaymentId: String? = null,
): Map<String, Double> {
    val due = mutableMapOf<String, Double>()
    attendance.forEach { a ->
        val pid = a.projectId ?: return@forEach
        val wage = roundMoney((ReportWageFactor[a.status] ?: 0.0) * (labourerWage[a.labourerId] ?: 0.0))
        if (wage <= 0.0) return@forEach
        val key = wageDueKey(pid, a.labourerId)
        due[key] = (due[key] ?: 0.0) + wage
    }
    payments.forEach { p ->
        val pid = p.projectId ?: return@forEach
        val labourerId = p.labourerId ?: return@forEach
        if (p.id == excludePaymentId || p.payeeType != "labour" || p.status == "rejected") return@forEach
        val key = wageDueKey(pid, labourerId)
        due[key] = (due[key] ?: 0.0) - p.amount
    }
    return due.mapValues { (_, v) -> v.coerceAtLeast(0.0) }
}

private val CashFlowMaterialsColor = androidx.compose.ui.graphics.Color(0xFF16A34A)
private val CashFlowSupplierColor = androidx.compose.ui.graphics.Color(0xFFF59E0B)
private val CashFlowLabourColor = androidx.compose.ui.graphics.Color(0xFF0EA5E9)
private val CashFlowWagesColor = androidx.compose.ui.graphics.Color(0xFFA855F7)

@Composable
fun AdminCashFlow() {
    var materials by remember { mutableStateOf<List<MaterialRow>>(emptyList()) }
    var payments by remember { mutableStateOf<List<PaymentRow>>(emptyList()) }
    var attendance by remember { mutableStateOf<List<AttendanceRow>>(emptyList()) }
    var labourers by remember { mutableStateOf<List<LabourerRow>>(emptyList()) }
    var projects by remember { mutableStateOf<List<ProjectRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    val today = remember { LocalDate.now() }
    var from by remember { mutableStateOf(today.withDayOfMonth(1).toString()) }
    var to by remember { mutableStateOf(today.toString()) }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        safe({
            materials = Repo.listMaterials()
            payments = Repo.listPayments()
            attendance = Repo.listAllAttendance()
            labourers = Repo.listLabourers()
            projects = Repo.listProjects()
        }) { error = it }
    }

    val wageById = labourers.associate { it.id to it.dailyWage }
    val cashFlow = remember(materials, payments, attendance, labourers, from, to) {
        computeCashFlow(materials, payments, attendance, wageById, from, to)
    }
    val projectName = projects.associate { it.id to it.name }
    val projectIds = (
        cashFlow.byProjectMaterials.keys + cashFlow.byProjectSupplier.keys +
            cashFlow.byProjectLabour.keys + cashFlow.byProjectWages.keys
        ).distinct()

    FormColumn {
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp)) }
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DateField(from, { from = it }, "From", Modifier.weight(1f))
            DateField(to, { to = it }, "To", Modifier.weight(1f))
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.End,
        ) {
            val cfProjects = projectIds.map { id ->
                PdfCashFlowProject(
                    projectName[id] ?: "—",
                    cashFlow.byProjectMaterials[id] ?: 0.0,
                    cashFlow.byProjectSupplier[id] ?: 0.0,
                    cashFlow.byProjectLabour[id] ?: 0.0,
                    cashFlow.byProjectWages[id] ?: 0.0,
                )
            }
            TextButton(onClick = {
                CsvExporter.share(context, CsvExporter.exportCashFlow(context, from, to, cfProjects))
            }) { Text("Download CSV") }
            TextButton(onClick = {
                val uri = PdfExporter.exportCashFlowReport(
                    context, from, to,
                    categories = listOf(
                        PdfCashFlowCategory("Materials", cashFlow.materials, android.graphics.Color.parseColor("#16A34A")),
                        PdfCashFlowCategory("Supplier payments", cashFlow.supplier, android.graphics.Color.parseColor("#F59E0B")),
                        PdfCashFlowCategory("Labour payments", cashFlow.labour, android.graphics.Color.parseColor("#0EA5E9")),
                        PdfCashFlowCategory("Wages (attendance)", cashFlow.wages, android.graphics.Color.parseColor("#A855F7")),
                    ),
                    total = cashFlow.materials + cashFlow.supplier + cashFlow.labour + cashFlow.wages,
                    projects = cfProjects,
                )
                PdfExporter.share(context, uri)
            }) { Text("Download PDF") }
        }

        SectionTitle("Outflow by category")
        CashFlowBarChart(
            listOf(
                CashFlowCategory("Materials", cashFlow.materials, CashFlowMaterialsColor),
                CashFlowCategory("Supplier", cashFlow.supplier, CashFlowSupplierColor),
                CashFlowCategory("Labour", cashFlow.labour, CashFlowLabourColor),
                CashFlowCategory("Wages", cashFlow.wages, CashFlowWagesColor),
            ),
        )
        Text(
            "Total outflow: ${money(cashFlow.materials + cashFlow.supplier + cashFlow.labour + cashFlow.wages)}",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )

        Divider()
        SectionTitle("By project")
        if (projectIds.isEmpty()) {
            Text("No outflow recorded in this date range.", Modifier.padding(16.dp))
        } else {
            projectIds.forEach { id ->
                val mat = cashFlow.byProjectMaterials[id] ?: 0.0
                val sup = cashFlow.byProjectSupplier[id] ?: 0.0
                val lab = cashFlow.byProjectLabour[id] ?: 0.0
                val wag = cashFlow.byProjectWages[id] ?: 0.0
                ItemCard(
                    projectName[id] ?: "—",
                    "Materials ${money(mat)} · Supplier ${money(sup)} · Labour ${money(lab)} · Wages ${money(wag)}",
                    money(mat + sup + lab + wag),
                )
            }
        }
    }
}

@Composable
private fun SiteReportList(
    projects: List<ProjectRow>,
    spent: Map<String, Double>,
    onSelect: (ProjectRow) -> Unit,
) {
    SectionTitle("Reports by site")
    if (projects.isEmpty()) {
        Text("Create a project first.", Modifier.padding(16.dp))
        return
    }
    projects.forEach { p ->
        val s = spent[p.id] ?: 0.0
        ItemCard(
            p.name,
            "${p.status} · ${"%.1f".format(p.completionPct)}% · Budget ${money(p.totalCost)}",
            money(s),
            actions = { TextButton(onClick = { onSelect(p) }) { Text("View report") } },
        )
    }
}

// Mirrors app/admin/reports/page.tsx's "Labour: last 7 days" table -- days
// worked and wages earned per labourer over the last week, weighted by
// present/half_day/absent the same way the labour dashboard does.
private val ReportWageFactor = mapOf("present" to 1.0, "half_day" to 0.5, "absent" to 0.0)

@Composable
private fun WeeklyLabourSection(labourers: List<LabourerRow>, weekAttendance: List<AttendanceRow>) {
    val wageById = labourers.associate { it.id to it.dailyWage }
    val nameById = labourers.associate { it.id to it.name }
    val daysById = mutableMapOf<String, Double>()
    val earnById = mutableMapOf<String, Double>()
    for (a in weekAttendance) {
        val factor = ReportWageFactor[a.status] ?: 0.0
        daysById[a.labourerId] = (daysById[a.labourerId] ?: 0.0) + factor
        earnById[a.labourerId] = (earnById[a.labourerId] ?: 0.0) + roundMoney(factor * (wageById[a.labourerId] ?: 0.0))
    }

    SectionTitle("Labour: last 7 days")
    if (daysById.isEmpty()) {
        Text("No attendance recorded in the last 7 days.", Modifier.padding(16.dp))
        return
    }
    daysById.forEach { (labourerId, days) ->
        ItemCard(
            nameById[labourerId] ?: "—",
            "%.1f days worked".format(days),
            money(earnById[labourerId] ?: 0.0),
        )
    }
}

private data class Transaction(
    val date: String?,
    val type: String,
    val description: String,
    val amount: Double,
    val status: String,
)

@Composable
private fun SiteReportDetail(
    project: ProjectRow,
    spent: Double,
    clientName: String?,
    materials: List<MaterialRow>,
    payments: List<PaymentRow>,
    attendance: List<AttendanceRow>,
    labourerWage: Map<String, Double>,
    labourerName: Map<String, String>,
    updates: List<ProjectUpdateRow>,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var exporting by remember { mutableStateOf(false) }

    val transactions = remember(materials, payments, attendance) {
        val materialTx = materials.map {
            Transaction(
                date = it.deliveredAt ?: it.orderedAt,
                type = "Material",
                description = "${it.name} (${it.quantity} ${it.unit})",
                amount = lineTotal(it.quantity, it.unitCost),
                status = it.status,
            )
        }
        val paymentTx = payments.map {
            Transaction(
                date = it.createdAt,
                type = if (it.payeeType == "labour") "Payment · labour" else "Payment · supplier",
                description = it.description?.ifBlank { null } ?: "—",
                amount = it.amount,
                status = it.status,
            )
        }
        val wageTx = attendance.mapNotNull { a ->
            val amount = roundMoney((ReportWageFactor[a.status] ?: 0.0) * (labourerWage[a.labourerId] ?: 0.0))
            if (amount <= 0.0) return@mapNotNull null
            Transaction(
                date = a.date,
                type = "Wage · attendance",
                description = "${labourerName[a.labourerId] ?: "—"} (${a.status.replace("_", " ")})",
                amount = amount,
                status = a.status,
            )
        }
        (materialTx + paymentTx + wageTx).sortedByDescending { it.date ?: "" }
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = onBack) { Text("← Reports") }
        Row(verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = {
            val csvTx = transactions.map {
                PdfTransaction(it.type, it.description, it.date ?: "no date", it.status, it.amount)
            }
            CsvExporter.share(context, CsvExporter.exportSiteReport(context, project.name, csvTx))
        }) { Text("Download CSV") }
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
                    val pdfTransactions = transactions.map {
                        PdfTransaction(
                            type = it.type, description = it.description,
                            date = it.date ?: "no date", status = it.status, amount = it.amount,
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
                                client = clientName,
                                address = project.address,
                                stage = project.currentStage,
                                endDate = project.endDate,
                                extended = project.finishDateExtended,
                                originalEndDate = project.originalEndDate,
                                extensionReason = project.extensionReason,
                            ),
                            transactions = pdfTransactions,
                            updates = pdfUpdates,
                        )
                    }
                    PdfExporter.share(context, uri)
                    exporting = false
                }
            },
        ) { Text(if (exporting) "Preparing…" else "Download PDF") }
        }
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
        Text("No materials or payments recorded for this site yet.", Modifier.padding(16.dp))
    } else {
        transactions.forEach { t ->
            ItemCard(
                "${t.type} · ${t.description}",
                "${t.date ?: "no date"} · ${t.status}",
                money(t.amount),
            )
        }
    }

    Divider()
    SectionTitle("Spend by work category")
    val categoryTotals = remember(materials, payments, attendance) {
        val totals = mutableMapOf<String, Double>()
        materials.forEach { m ->
            if (m.status == "returned") return@forEach
            val cat = m.workCategory ?: "Uncategorized"
            totals[cat] = (totals[cat] ?: 0.0) + lineTotal(m.quantity, m.unitCost)
        }
        payments.forEach { p ->
            if (p.status !in listOf("paid", "approved")) return@forEach
            val cat = p.workCategory ?: "Uncategorized"
            totals[cat] = (totals[cat] ?: 0.0) + p.amount
        }
        val wages = attendance.sumOf { a ->
            roundMoney((ReportWageFactor[a.status] ?: 0.0) * (labourerWage[a.labourerId] ?: 0.0))
        }
        if (wages > 0.0) totals["Wages (attendance)"] = (totals["Wages (attendance)"] ?: 0.0) + wages
        totals.toList().sortedByDescending { it.second }
    }
    if (categoryTotals.isEmpty()) {
        Text("No categorized materials or payments for this site yet.", Modifier.padding(16.dp))
    } else {
        categoryTotals.forEach { (category, total) ->
            ItemCard(category, "", money(total))
        }
    }

    Divider()
    SectionTitle("Cash flow")
    val today = remember { LocalDate.now() }
    var cfFrom by remember { mutableStateOf(today.withDayOfMonth(1).toString()) }
    var cfTo by remember { mutableStateOf(today.toString()) }
    Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DateField(cfFrom, { cfFrom = it }, "From", Modifier.weight(1f))
        DateField(cfTo, { cfTo = it }, "To", Modifier.weight(1f))
    }
    val projectCashFlow = remember(materials, payments, attendance, cfFrom, cfTo) {
        computeCashFlow(materials, payments, attendance, labourerWage, cfFrom, cfTo, project.id)
    }
    CashFlowBarChart(
        listOf(
            CashFlowCategory("Materials", projectCashFlow.materials, CashFlowMaterialsColor),
            CashFlowCategory("Supplier", projectCashFlow.supplier, CashFlowSupplierColor),
            CashFlowCategory("Labour", projectCashFlow.labour, CashFlowLabourColor),
            CashFlowCategory("Wages", projectCashFlow.wages, CashFlowWagesColor),
        ),
    )
    Text(
        "Total outflow: ${money(projectCashFlow.materials + projectCashFlow.supplier + projectCashFlow.labour + projectCashFlow.wages)}",
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
    )
}

