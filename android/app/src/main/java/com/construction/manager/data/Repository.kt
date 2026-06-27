package com.construction.manager.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Count
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.storage.storage
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate

object Repo {

    // ---------- Auth ----------
    suspend fun signIn(email: String, password: String) {
        supabase.auth.signInWith(Email) { this.email = email; this.password = password }
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
    suspend fun fetchRole(): Role? {
        val uid = currentUserId() ?: return null
        return Role.fromString(
            supabase.from("profiles").select { filter { eq("id", uid) } }
                .decodeSingleOrNull<Profile>()?.role
        )
    }

    // ---------- Admin metrics ----------
    data class AdminMetrics(
        val totalProjects: Int, val activeProjects: Int, val totalCost: Double,
        val pendingPayments: Double, val labourCount: Int, val completion: Double,
    )
    suspend fun adminMetrics(): AdminMetrics {
        val total = supabase.from("projects").select { count(Count.EXACT) }.countOrNull() ?: 0
        val active = supabase.from("projects").select {
            filter { eq("status", "active") }; count(Count.EXACT)
        }.countOrNull() ?: 0
        val projects = supabase.from("projects").select().decodeList<ProjectRow>()
        val payments = supabase.from("payments").select {
            filter { isIn("status", listOf("pending", "approved")) }
        }.decodeList<PaymentRow>()
        val labour = supabase.from("labourers").select {
            filter { eq("active", true) }; count(Count.EXACT)
        }.countOrNull() ?: 0L
        return AdminMetrics(
            total.toInt(), active.toInt(),
            projects.sumOf { it.totalCost },
            payments.sumOf { it.amount },
            labour.toInt(),
            if (projects.isEmpty()) 0.0 else projects.sumOf { it.completionPct } / projects.size,
        )
    }

    // ---------- Lists ----------
    suspend fun listProjects() = supabase.from("projects")
        .select { order("created_at", Order.DESCENDING) }.decodeList<ProjectRow>()
    suspend fun listClients() = supabase.from("clients")
        .select { order("created_at", Order.DESCENDING) }.decodeList<ClientRow>()
    suspend fun listSuppliers() = supabase.from("suppliers")
        .select { order("created_at", Order.DESCENDING) }.decodeList<SupplierRow>()
    suspend fun listLabourers() = supabase.from("labourers")
        .select { order("created_at", Order.DESCENDING) }.decodeList<LabourerRow>()
    suspend fun listMaterials() = supabase.from("materials")
        .select { order("ordered_at", Order.DESCENDING) }.decodeList<MaterialRow>()
    suspend fun listPayments() = supabase.from("payments")
        .select { order("created_at", Order.DESCENDING) }.decodeList<PaymentRow>()
    suspend fun listUpdates() = supabase.from("project_updates")
        .select { order("created_at", Order.DESCENDING); limit(50) }.decodeList<ProjectUpdateRow>()
    suspend fun listAttendance(date: String) =
        supabase.from("attendance").select { filter { eq("date", date) } }.decodeList<AttendanceRow>()
    suspend fun listProfilesByRole(role: Role) = supabase.from("profiles")
        .select { filter { eq("role", role.name) } }.decodeList<Profile>()

    // ---------- Creates ----------
    suspend fun createProject(name: String, clientId: String?, status: String, stage: String?,
                              totalCost: Double, completion: Double) {
        supabase.from("projects").insert(buildJsonObject {
            put("name", name)
            if (clientId != null) put("client_id", clientId)
            put("status", status)
            if (stage != null) put("current_stage", stage)
            put("total_cost", totalCost)
            put("completion_pct", completion)
        })
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
    suspend fun createLabourer(name: String, phone: String?, dailyWage: Double,
                               active: Boolean, profileId: String?) {
        supabase.from("labourers").insert(buildJsonObject {
            put("name", name)
            if (phone != null) put("phone", phone)
            put("daily_wage", dailyWage)
            put("active", active)
            if (profileId != null) put("profile_id", profileId)
        })
    }
    suspend fun createMaterial(projectId: String, supplierId: String?, name: String,
                               unit: String, quantity: Double, unitCost: Double, status: String) {
        supabase.from("materials").insert(buildJsonObject {
            put("project_id", projectId)
            if (supplierId != null) put("supplier_id", supplierId)
            put("name", name); put("unit", unit)
            put("quantity", quantity); put("unit_cost", unitCost)
            put("status", status)
        })
    }
    suspend fun createPayment(projectId: String?, payeeType: String, supplierId: String?,
                              labourerId: String?, amount: Double, description: String?) {
        supabase.from("payments").insert(buildJsonObject {
            if (projectId != null) put("project_id", projectId)
            put("payee_type", payeeType)
            if (payeeType == "supplier" && supplierId != null) put("supplier_id", supplierId)
            if (payeeType == "labour" && labourerId != null) put("labourer_id", labourerId)
            put("amount", amount); put("status", "pending")
            if (description != null) put("description", description)
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
    suspend fun myLabourer(): LabourerRow? {
        val uid = currentUserId() ?: return null
        return supabase.from("labourers").select { filter { eq("profile_id", uid) } }
            .decodeSingleOrNull()
    }
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
    suspend fun myProjects(clientId: String) = supabase.from("projects")
        .select { filter { eq("client_id", clientId) }; order("created_at", Order.DESCENDING) }
        .decodeList<ProjectRow>()
    suspend fun myUpdates(projectIds: List<String>): List<ProjectUpdateRow> {
        if (projectIds.isEmpty()) return emptyList()
        return supabase.from("project_updates")
            .select {
                filter { isIn("project_id", projectIds) }
                order("created_at", Order.DESCENDING); limit(20)
            }.decodeList()
    }
    suspend fun supplierMaterials(supplierId: String) = supabase.from("materials")
        .select { filter { eq("supplier_id", supplierId) } }.decodeList<MaterialRow>()
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
            filter { eq("supplier_id", supplierId) }
            order("created_at", Order.DESCENDING)
        }.decodeList<PaymentRow>()
    suspend fun labourerAttendance(labourerId: String, sinceDate: String) =
        supabase.from("attendance").select {
            filter { eq("labourer_id", labourerId); gte("date", sinceDate) }
            order("date", Order.DESCENDING)
        }.decodeList<AttendanceRow>()
    suspend fun labourerCurrentProject(labourerId: String): String? {
        return supabase.from("project_labourers").select {
            filter {
                eq("labourer_id", labourerId)
                filter("unassigned_at", FilterOperator.IS, "null")
            }
            order("assigned_at", Order.DESCENDING); limit(1)
        }.decodeList<ProjectLabourerRow>().firstOrNull()?.projectId
    }
}
