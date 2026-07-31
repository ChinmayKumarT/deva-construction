package com.construction.manager.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Count
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.PostgrestRequestBuilder
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.storage.storage
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate

object Repo {

    // ---------- Archive helpers ----------
    // "Delete" is a reversible archive everywhere: the foreign keys in
    // 02_domain.sql cascade, so deleting a project would destroy its materials
    // and progress photos, and deleting a labourer would wipe their attendance
    // (wage) history. See supabase/10_archive.sql and 11_archive_updates.sql.
    private fun PostgrestRequestBuilder.activeOnly() {
        filter { filter("archived_at", FilterOperator.IS, "null") }
    }
    private fun PostgrestRequestBuilder.archivedOnly() {
        filter { filterNot("archived_at", FilterOperator.IS, "null") }
    }

    private suspend fun setArchived(table: String, id: String, archived: Boolean) {
        supabase.from(table).update(buildJsonObject {
            if (archived) put("archived_at", java.time.Instant.now().toString())
            else put("archived_at", JsonNull)
        }) { filter { eq("id", id) } }
    }

    suspend fun archiveClient(id: String) = setArchived("clients", id, true)
    suspend fun unarchiveClient(id: String) = setArchived("clients", id, false)
    suspend fun archiveSupplier(id: String) = setArchived("suppliers", id, true)
    suspend fun unarchiveSupplier(id: String) = setArchived("suppliers", id, false)
    suspend fun archiveLabourer(id: String) = setArchived("labourers", id, true)
    suspend fun unarchiveLabourer(id: String) = setArchived("labourers", id, false)
    suspend fun archiveMaterial(id: String) = setArchived("materials", id, true)
    suspend fun unarchiveMaterial(id: String) = setArchived("materials", id, false)
    suspend fun archivePayment(id: String) = setArchived("payments", id, true)
    suspend fun unarchivePayment(id: String) = setArchived("payments", id, false)
    suspend fun archiveUpdate(id: String) = setArchived("project_updates", id, true)
    suspend fun unarchiveUpdate(id: String) = setArchived("project_updates", id, false)

    // ---------- Updates (edit) ----------
    suspend fun updateClient(id: String, name: String, email: String?, phone: String?) {
        supabase.from("clients").update(buildJsonObject {
            put("name", name); put("email", email); put("phone", phone)
        }) { filter { eq("id", id) } }
    }
    suspend fun updateSupplier(id: String, name: String, email: String?, phone: String?) {
        supabase.from("suppliers").update(buildJsonObject {
            put("name", name); put("email", email); put("phone", phone)
        }) { filter { eq("id", id) } }
    }
    suspend fun updateLabourer(
        id: String, name: String, phone: String?, dailyWage: Double, active: Boolean, category: String?,
    ) {
        supabase.from("labourers").update(buildJsonObject {
            put("name", name); put("phone", phone)
            put("daily_wage", dailyWage); put("active", active)
            put("category", category)
        }) { filter { eq("id", id) } }
    }
    suspend fun updateMaterial(
        id: String, name: String, unit: String, quantity: Double,
        unitCost: Double, status: String, workCategory: String?,
    ) {
        supabase.from("materials").update(buildJsonObject {
            put("name", name); put("unit", unit)
            put("quantity", quantity); put("unit_cost", unitCost)
            put("status", status); put("work_category", workCategory)
        }) { filter { eq("id", id) } }
    }
    suspend fun updatePayment(
        id: String, projectId: String?, payeeType: String, supplierId: String?, labourerId: String?,
        amount: Double, description: String?, workCategory: String?,
    ) {
        supabase.from("payments").update(buildJsonObject {
            put("project_id", projectId)
            put("payee_type", payeeType)
            put("supplier_id", if (payeeType == "supplier") supplierId else null)
            put("labourer_id", if (payeeType == "labour") labourerId else null)
            put("amount", amount); put("description", description)
            put("work_category", workCategory)
        }) { filter { eq("id", id) } }
    }
    suspend fun updateProjectUpdate(id: String, stage: String?, note: String?) {
        supabase.from("project_updates").update(buildJsonObject {
            put("stage", stage); put("note", note)
        }) { filter { eq("id", id) } }
    }


    // ---------- Auth ----------
    suspend fun signIn(email: String, password: String) {
        supabase.auth.signInWith(Email) { this.email = email; this.password = password }
    }
    // New Google accounts land as role='client' via the same handle_new_user()
    // trigger the web sign-up path uses (it defaults any unrecognized/absent
    // role to client) -- no separate handling needed here.
    suspend fun signInWithGoogleIdToken(idToken: String) {
        supabase.auth.signInWith(IDToken) {
            this.idToken = idToken
            this.provider = Google
        }
    }
    // Uses the Auth plugin's configured scheme/host (Supabase.kt) as the
    // redirect target by default -- the app's registered deep link.
    suspend fun requestPasswordReset(email: String) {
        supabase.auth.resetPasswordForEmail(email)
    }
    suspend fun updatePassword(newPassword: String) {
        supabase.auth.updateUser { password = newPassword }
    }
    suspend fun signUp(email: String, password: String, fullName: String, role: Role) {
        supabase.auth.signUpWith(Email) {
            this.email = email; this.password = password
            this.data = buildJsonObject { put("full_name", fullName); put("role", role.name) }
        }
    }
    suspend fun signOut() = supabase.auth.signOut()
    suspend fun deleteMyAccount() {
        supabase.postgrest.rpc("delete_my_account")
        supabase.auth.signOut()
    }
    fun currentUserId(): String? = supabase.auth.currentUserOrNull()?.id
    suspend fun fetchMyProfile(): Profile? {
        val uid = currentUserId() ?: return null
        return supabase.from("profiles").select { filter { eq("id", uid) } }
            .decodeSingleOrNull<Profile>()
    }

    // Owner-only; the set_user_role() RPC re-checks is_owner() server-side and
    // rejects the call outright for anyone else.
    suspend fun setUserRole(targetId: String, role: Role) {
        supabase.postgrest.rpc("set_user_role", buildJsonObject {
            put("target_id", targetId)
            put("new_role", role.name)
        })
    }

    // Permanent, owner-only delete -- enforcement is in Postgres
    // (owner_delete_row in 12_owner_delete.sql rejects non-owners regardless
    // of what the app does), so this is a thin wrapper, same trust model as
    // setUserRole above.
    private suspend fun ownerDeleteRow(table: String, id: String) {
        supabase.postgrest.rpc("owner_delete_row", buildJsonObject {
            put("target_table", table)
            put("target_id", id)
        })
    }
    suspend fun deleteProjectForever(id: String) = ownerDeleteRow("projects", id)
    suspend fun deleteClientForever(id: String) = ownerDeleteRow("clients", id)
    suspend fun deleteSupplierForever(id: String) = ownerDeleteRow("suppliers", id)
    suspend fun deleteLabourerForever(id: String) = ownerDeleteRow("labourers", id)
    suspend fun deleteMaterialForever(id: String) = ownerDeleteRow("materials", id)
    suspend fun deletePaymentForever(id: String) = ownerDeleteRow("payments", id)
    suspend fun deleteUpdateForever(id: String) = ownerDeleteRow("project_updates", id)

    // ---------- Admin metrics ----------
    data class AdminMetrics(
        val totalProjects: Int, val activeProjects: Int, val totalCost: Double,
        val pendingPayments: Double, val materialStock: Double,
        val labourCount: Int, val completion: Double,
    )
    suspend fun adminMetrics(): AdminMetrics {
        // Archived rows are excluded everywhere so the dashboard totals match
        // what the user actually sees in each list.
        val total = supabase.from("projects").select {
            filter { filter("archived_at", FilterOperator.IS, "null") }; count(Count.EXACT)
        }.countOrNull() ?: 0
        val active = supabase.from("projects").select {
            filter {
                eq("status", "active")
                filter("archived_at", FilterOperator.IS, "null")
            }
            count(Count.EXACT)
        }.countOrNull() ?: 0
        val projects = listProjects()
        val payments = supabase.from("payments").select {
            filter {
                isIn("status", listOf("pending", "approved"))
                filter("archived_at", FilterOperator.IS, "null")
            }
        }.decodeList<PaymentRow>()
        val materialStock = supabase.from("materials").select {
            filter {
                eq("status", "delivered")
                filter("archived_at", FilterOperator.IS, "null")
            }
        }.decodeList<MaterialRow>().sumOf { it.quantity }
        val labour = supabase.from("labourers").select {
            filter {
                eq("active", true)
                filter("archived_at", FilterOperator.IS, "null")
            }
            count(Count.EXACT)
        }.countOrNull() ?: 0L
        return AdminMetrics(
            total.toInt(), active.toInt(),
            projects.sumOf { it.totalCost },
            payments.sumOf { it.amount },
            materialStock,
            labour.toInt(),
            if (projects.isEmpty()) 0.0 else projects.sumOf { it.completionPct } / projects.size,
        )
    }

    // ---------- Lists ----------
    suspend fun listProjects() = supabase.from("projects")
        .select {
            filter { filter("archived_at", FilterOperator.IS, "null") }
            order("created_at", Order.DESCENDING)
        }.decodeList<ProjectRow>()
    suspend fun listClients() = supabase.from("clients")
        .select { activeOnly(); order("created_at", Order.DESCENDING) }.decodeList<ClientRow>()
    suspend fun listSuppliers() = supabase.from("suppliers")
        .select { activeOnly(); order("created_at", Order.DESCENDING) }.decodeList<SupplierRow>()
    suspend fun listLabourers() = supabase.from("labourers")
        .select { activeOnly(); order("created_at", Order.DESCENDING) }.decodeList<LabourerRow>()
    suspend fun listMaterials() = supabase.from("materials")
        .select { activeOnly(); order("ordered_at", Order.DESCENDING) }.decodeList<MaterialRow>()
    suspend fun listPayments() = supabase.from("payments")
        .select { activeOnly(); order("created_at", Order.DESCENDING) }.decodeList<PaymentRow>()
    suspend fun listUpdates() = supabase.from("project_updates")
        .select { activeOnly(); order("created_at", Order.DESCENDING); limit(50) }
        .decodeList<ProjectUpdateRow>()

    // ---------- Archived lists ----------
    suspend fun listArchivedClients() = supabase.from("clients")
        .select { archivedOnly(); order("created_at", Order.DESCENDING) }.decodeList<ClientRow>()
    suspend fun listArchivedSuppliers() = supabase.from("suppliers")
        .select { archivedOnly(); order("created_at", Order.DESCENDING) }.decodeList<SupplierRow>()
    suspend fun listArchivedLabourers() = supabase.from("labourers")
        .select { archivedOnly(); order("created_at", Order.DESCENDING) }.decodeList<LabourerRow>()
    suspend fun listArchivedMaterials() = supabase.from("materials")
        .select { archivedOnly(); order("ordered_at", Order.DESCENDING) }.decodeList<MaterialRow>()
    suspend fun listArchivedPayments() = supabase.from("payments")
        .select { archivedOnly(); order("created_at", Order.DESCENDING) }.decodeList<PaymentRow>()
    suspend fun listArchivedUpdates() = supabase.from("project_updates")
        .select { archivedOnly(); order("created_at", Order.DESCENDING); limit(50) }
        .decodeList<ProjectUpdateRow>()
    suspend fun listAttendance(date: String) =
        supabase.from("attendance").select { filter { eq("date", date) } }.decodeList<AttendanceRow>()
    suspend fun listAttendanceSince(sinceDate: String) =
        supabase.from("attendance").select { filter { gte("date", sinceDate) } }.decodeList<AttendanceRow>()
    suspend fun listAllAttendance() =
        supabase.from("attendance").select().decodeList<AttendanceRow>()
    suspend fun listProfilesByRole(role: Role) = supabase.from("profiles")
        .select { filter { eq("role", role.name) } }.decodeList<Profile>()
    suspend fun listAllProfiles() = supabase.from("profiles")
        .select { order("full_name", Order.ASCENDING) }.decodeList<Profile>()

    // ---------- Creates ----------
    suspend fun createProject(name: String, clientId: String?, status: String, stage: String?,
                              totalCost: Double, completion: Double, endDate: String?) {
        supabase.from("projects").insert(buildJsonObject {
            put("name", name)
            if (clientId != null) put("client_id", clientId)
            put("status", status)
            if (stage != null) put("current_stage", stage)
            put("total_cost", totalCost)
            put("completion_pct", completion)
            // original_end_date is copied from this by a DB trigger on insert.
            if (endDate != null) put("end_date", endDate)
        })
    }

    suspend fun updateProject(
        id: String, name: String, clientId: String?, status: String,
        stage: String?, totalCost: Double, completion: Double, endDate: String?,
    ) {
        supabase.from("projects").update(buildJsonObject {
            put("name", name)
            put("client_id", clientId)
            put("status", status)
            put("current_stage", stage)
            put("total_cost", totalCost)
            put("completion_pct", completion)
            put("end_date", endDate)
        }) { filter { eq("id", id) } }
    }

    // "Delete" is a reversible archive -- a real DELETE cascades and would
    // destroy the project's materials and progress updates (see 10_archive.sql).
    suspend fun archiveProject(id: String) {
        supabase.from("projects").update(buildJsonObject {
            put("archived_at", java.time.Instant.now().toString())
        }) { filter { eq("id", id) } }
    }
    suspend fun unarchiveProject(id: String) {
        supabase.from("projects").update(buildJsonObject {
            put("archived_at", JsonNull)
        }) { filter { eq("id", id) } }
    }
    suspend fun listArchivedProjects() = supabase.from("projects")
        .select {
            filter { filterNot("archived_at", FilterOperator.IS, "null") }
            order("created_at", Order.DESCENDING)
        }.decodeList<ProjectRow>()

    // Only ever sends end_date/extension_reason -- original_end_date and
    // extension_updated_at are DB-trigger-managed (see
    // 09_project_date_extension.sql), so the client can't get them wrong.
    suspend fun extendProjectEndDate(projectId: String, newEndDate: String, reason: String?) {
        supabase.from("projects").update(buildJsonObject {
            put("end_date", newEndDate)
            if (reason != null) put("extension_reason", reason)
        }) { filter { eq("id", projectId) } }
    }
    suspend fun setNextPaymentDate(projectId: String, date: String?) {
        supabase.from("projects").update(buildJsonObject {
            if (date != null) put("next_payment_date", date) else put("next_payment_date", JsonNull)
        }) { filter { eq("id", projectId) } }
    }
    suspend fun createClient(name: String, email: String?, phone: String?, profileId: String?) {
        supabase.from("clients").insert(buildJsonObject {
            put("name", name)
            if (email != null) put("email", email)
            if (phone != null) put("phone", phone)
            if (profileId != null) put("profile_id", profileId)
        })
    }
    suspend fun createSupplier(name: String, email: String?, phone: String?, profileId: String?) {
        supabase.from("suppliers").insert(buildJsonObject {
            put("name", name)
            if (email != null) put("email", email)
            if (phone != null) put("phone", phone)
            if (profileId != null) put("profile_id", profileId)
        })
    }
    // No profileId: labourers don't sign in -- the site manager records their
    // attendance and wages -- so there's no login to link. The profile_id
    // column stays in the table for future biometric identity linking.
    suspend fun createLabourer(
        name: String, phone: String?, dailyWage: Double, active: Boolean, category: String?,
    ) {
        supabase.from("labourers").insert(buildJsonObject {
            put("name", name)
            if (phone != null) put("phone", phone)
            put("daily_wage", dailyWage)
            put("active", active)
            if (category != null) put("category", category)
        })
    }
    suspend fun createMaterial(projectId: String, supplierId: String?, name: String,
                               unit: String, quantity: Double, unitCost: Double, status: String,
                               workCategory: String?) {
        supabase.from("materials").insert(buildJsonObject {
            put("project_id", projectId)
            if (supplierId != null) put("supplier_id", supplierId)
            put("name", name); put("unit", unit)
            put("quantity", quantity); put("unit_cost", unitCost)
            put("status", status)
            if (workCategory != null) put("work_category", workCategory)
        })
    }
    suspend fun createPayment(projectId: String?, payeeType: String, supplierId: String?,
                              labourerId: String?, amount: Double, description: String?,
                              workCategory: String?) {
        supabase.from("payments").insert(buildJsonObject {
            if (projectId != null) put("project_id", projectId)
            put("payee_type", payeeType)
            if (payeeType == "supplier" && supplierId != null) put("supplier_id", supplierId)
            if (payeeType == "labour" && labourerId != null) put("labourer_id", labourerId)
            put("amount", amount); put("status", "pending")
            if (description != null) put("description", description)
            if (workCategory != null) put("work_category", workCategory)
        })
    }
    suspend fun postProjectUpdate(projectId: String, stage: String?, note: String?,
                                  imageUrl: String?, completion: Double?) {
        val uid = currentUserId()
        supabase.from("project_updates").insert(buildJsonObject {
            put("project_id", projectId)
            if (uid != null) put("author_id", uid)
            if (stage != null) put("stage", stage)
            if (note != null) put("note", note)
            if (imageUrl != null) put("image_url", imageUrl)
        })
        if (stage != null || completion != null) {
            supabase.from("projects").update(buildJsonObject {
                if (stage != null) put("current_stage", stage)
                if (completion != null) put("completion_pct", completion)
            }) { filter { eq("id", projectId) } }
        }
    }

    // ---------- Storage ----------
    suspend fun uploadProjectImage(projectId: String, bytes: ByteArray, ext: String): String {
        val safeExt = ext.lowercase().ifBlank { "jpg" }
        val path = "$projectId/${System.currentTimeMillis()}-${(0..999999).random()}.$safeExt"
        supabase.storage.from("project-images").upload(path, bytes) { upsert = false }
        return supabase.storage.from("project-images").publicUrl(path)
    }

    // ---------- Updates ----------
    suspend fun approvePayment(id: String) {
        supabase.from("payments").update(buildJsonObject {
            put("status", "approved"); put("approved_at", java.time.Instant.now().toString())
        }) { filter { eq("id", id) } }
    }
    suspend fun markPaymentPaid(id: String) {
        supabase.from("payments").update(buildJsonObject {
            put("status", "paid"); put("paid_at", java.time.Instant.now().toString())
        }) { filter { eq("id", id) } }
    }
    suspend fun rejectPayment(id: String) {
        supabase.from("payments").update(buildJsonObject { put("status", "rejected") }) {
            filter { eq("id", id) }
        }
    }
    suspend fun markMaterialDelivered(id: String) {
        supabase.from("materials").update(buildJsonObject {
            put("status", "delivered"); put("delivered_at", java.time.Instant.now().toString())
        }) { filter { eq("id", id) } }
    }

    // ---------- Attendance ----------
    suspend fun upsertAttendance(labourerId: String, projectId: String?, date: String, status: String) {
        supabase.from("attendance").upsert(
            buildJsonObject {
                put("labourer_id", labourerId)
                if (projectId != null) put("project_id", projectId)
                put("date", date); put("status", status)
            }
        ) {
            onConflict = "labourer_id,date"
        }
    }

    // ---------- Role-scoped queries ----------
    suspend fun mySupplier(): SupplierRow? {
        val uid = currentUserId() ?: return null
        return supabase.from("suppliers").select { filter { eq("profile_id", uid) } }
            .decodeSingleOrNull()
    }
    suspend fun myClient(): ClientRow? {
        val uid = currentUserId() ?: return null
        return supabase.from("clients").select { filter { eq("profile_id", uid) } }
            .decodeSingleOrNull()
    }
    // Per-project attendance-wage totals for the calling client's own projects
    // (security-definer RPC -- clients can't read the attendance table directly).
    suspend fun myProjectWageTotals(): List<ProjectWageTotalRow> =
        supabase.postgrest.rpc("my_project_wage_totals").decodeList()
    suspend fun myProjects(clientId: String) = supabase.from("projects")
        .select {
            filter {
                eq("client_id", clientId)
                filter("archived_at", FilterOperator.IS, "null")
            }
            order("created_at", Order.DESCENDING)
        }.decodeList<ProjectRow>()
    suspend fun myUpdates(projectIds: List<String>): List<ProjectUpdateRow> {
        if (projectIds.isEmpty()) return emptyList()
        return supabase.from("project_updates")
            .select {
                filter {
                    isIn("project_id", projectIds)
                    filter("archived_at", FilterOperator.IS, "null")
                }
                order("created_at", Order.DESCENDING); limit(20)
            }.decodeList()
    }
    suspend fun myMaterials(projectIds: List<String>): List<MaterialRow> {
        if (projectIds.isEmpty()) return emptyList()
        return supabase.from("materials")
            .select {
                filter {
                    isIn("project_id", projectIds)
                    filter("archived_at", FilterOperator.IS, "null")
                }
            }.decodeList()
    }
    suspend fun myPayments(projectIds: List<String>): List<PaymentRow> {
        if (projectIds.isEmpty()) return emptyList()
        return supabase.from("payments")
            .select {
                filter {
                    isIn("project_id", projectIds)
                    filter("archived_at", FilterOperator.IS, "null")
                }
                order("created_at", Order.DESCENDING)
            }.decodeList()
    }
    suspend fun supplierMaterials(supplierId: String) = supabase.from("materials")
        .select {
            filter {
                eq("supplier_id", supplierId)
                filter("archived_at", FilterOperator.IS, "null")
            }
        }.decodeList<MaterialRow>()
    suspend fun recordSupplierDelivery(
        projectId: String, supplierId: String, name: String,
        unit: String, quantity: Double, unitCost: Double, status: String,
    ) {
        supabase.from("materials").insert(buildJsonObject {
            put("project_id", projectId)
            put("supplier_id", supplierId)
            put("name", name); put("unit", unit)
            put("quantity", quantity); put("unit_cost", unitCost)
            put("status", status)
        })
    }
    suspend fun supplierPayments(supplierId: String) = supabase.from("payments")
        .select {
            filter {
                eq("supplier_id", supplierId)
                filter("archived_at", FilterOperator.IS, "null")
            }
            order("created_at", Order.DESCENDING)
        }.decodeList<PaymentRow>()
    // Every active labourer's current site in one query, for the Attendance screen.
    suspend fun listActiveAssignments() = supabase.from("project_labourers")
        .select { filter { filter("unassigned_at", FilterOperator.IS, "null") } }
        .decodeList<ProjectLabourerRow>()
}
