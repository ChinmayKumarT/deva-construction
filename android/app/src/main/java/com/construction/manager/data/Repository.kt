package com.construction.manager.data

// lineTotal/roundMoney live in the ui package, which is the wrong way round
// for the data layer to depend. Importing anyway rather than re-deriving the
// rounding here: the amount written to payments has to match what the web
// server action stores to the paise, and two copies of a rounding rule drift.
import com.construction.manager.ui.lineTotal
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.providers.builtin.OTP
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
    suspend fun archivePersonalTransaction(id: String) = setArchived("personal_transactions", id, true)
    suspend fun unarchivePersonalTransaction(id: String) = setArchived("personal_transactions", id, false)
    suspend fun archiveClientPayment(id: String) = setArchived("client_payments", id, true)
    suspend fun unarchiveClientPayment(id: String) = setArchived("client_payments", id, false)

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
    // Lands on the same deep link as password recovery (this SDK version's
    // OTP config has no per-call redirect override) -- MainActivity tells
    // the two apart via the imported UserSession's `type` field.
    suspend fun requestMagicLink(email: String) {
        supabase.auth.signInWith(OTP) {
            this.email = email
            this.createUser = true
        }
    }
    suspend fun updatePassword(newPassword: String) {
        supabase.auth.updateUser { password = newPassword }
    }
    // Verifies the raw token_hash handed off by the web confirm page (see
    // app/reset-password/confirm) instead of the SDK's own handleDeeplinks
    // parsing -- both the Reset Password and Magic Link email templates now
    // route through that page first so Gmail/Outlook's link-prefetch
    // scanners can't silently consume the one-time token before the user
    // taps it.
    suspend fun verifyEmailOtp(tokenHash: String, type: OtpType.Email) {
        supabase.auth.verifyEmailOtp(type = type, tokenHash = tokenHash)
    }
    suspend fun signUp(email: String, password: String, fullName: String, phone: String, role: Role) {
        supabase.auth.signUpWith(Email) {
            this.email = email; this.password = password
            this.data = buildJsonObject { put("full_name", fullName); put("phone", phone); put("role", role.name) }
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

    // Self-service, but narrow: only fires while role_pending is true (see
    // 18_oauth_role_pending.sql), only accepts client/supplier, and only
    // touches the caller's own row -- can't be used to self-promote.
    suspend fun chooseRole(role: Role) {
        supabase.postgrest.rpc("choose_role", buildJsonObject {
            put("new_role", role.name)
        })
    }

    // Owner-only; the set_user_role() RPC re-checks is_owner() server-side and
    // rejects the call outright for anyone else.
    suspend fun setUserRole(targetId: String, role: Role) {
        supabase.postgrest.rpc("set_user_role", buildJsonObject {
            put("target_id", targetId)
            put("new_role", role.name)
        })
    }
    // Owner-only permanent account deletion; admin_delete_user() (see
    // 20_admin_delete_user.sql) re-checks is_owner() and rejects self-deletion
    // server-side. Removes the login only -- business records are preserved.
    suspend fun deleteUser(targetId: String) {
        supabase.postgrest.rpc("admin_delete_user", buildJsonObject {
            put("target_id", targetId)
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
    suspend fun deletePersonalTransactionForever(id: String) = ownerDeleteRow("personal_transactions", id)
    suspend fun deleteClientPaymentForever(id: String) = ownerDeleteRow("client_payments", id)

    // ---------- Admin metrics ----------
    data class TrendData(val delta: Int, val label: String)
    data class AdminMetrics(
        val totalProjects: Int, val activeProjects: Int, val totalCost: Double,
        val pendingPayments: Double, val materialStock: Double,
        val labourCount: Int, val completion: Double,
        val overBudgetCount: Int = 0,
        val nearBudgetCount: Int = 0,
        val overBudgetNames: List<String> = emptyList(),
        val nearBudgetNames: List<String> = emptyList(),
        val projectsTrend: TrendData? = null,
        val spendingTrend: TrendData? = null,
        val attendanceTrend: TrendData? = null,
        val spendingThisMonth: Double = 0.0,
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
        val allMaterials = supabase.from("materials").select {
            filter { filter("archived_at", FilterOperator.IS, "null") }
        }.decodeList<MaterialRow>()
        val materialStock = allMaterials.filter { it.status == "delivered" }.sumOf { it.quantity }
        val allPayments = supabase.from("payments").select {
            filter { filter("archived_at", FilterOperator.IS, "null") }
        }.decodeList<PaymentRow>()
        val allAttendance = supabase.from("attendance").select().decodeList<AttendanceRow>()
        val allLabourers = supabase.from("labourers").select { filter { filter("archived_at", FilterOperator.IS, "null") } }
            .decodeList<LabourerRow>()
        val labourerWage = allLabourers.associate { it.id to it.dailyWage }
        val labour = allLabourers.count { it.active }.toLong()

        val wageFactor = mapOf("present" to 1.0, "half_day" to 0.5, "absent" to 0.0)
        val spentByProject = mutableMapOf<String, Double>()
        for (m in allMaterials) {
            if (m.projectId == null || m.status == "returned") continue
            spentByProject[m.projectId] = (spentByProject[m.projectId] ?: 0.0) + m.quantity * m.unitCost
        }
        for (p in allPayments) {
            if (p.projectId == null || p.payeeType != "labour" || (p.status != "paid" && p.status != "approved")) continue
            spentByProject[p.projectId] = (spentByProject[p.projectId] ?: 0.0) + p.amount
        }
        for (a in allAttendance) {
            if (a.projectId == null) continue
            val w = (wageFactor[a.status] ?: 0.0) * (labourerWage[a.labourerId] ?: 0.0)
            if (w > 0) spentByProject[a.projectId!!] = (spentByProject[a.projectId!!] ?: 0.0) + w
        }

        val overNames = mutableListOf<String>()
        val nearNames = mutableListOf<String>()
        for (p in projects) {
            if (p.totalCost <= 0) continue
            val spent = spentByProject[p.id] ?: 0.0
            val pct = spent / p.totalCost
            if (pct >= 1.0) overNames.add(p.name)
            else if (pct >= 0.8) nearNames.add(p.name)
        }

        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.DAY_OF_MONTH, 1)
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0); cal.set(java.util.Calendar.MINUTE, 0); cal.set(java.util.Calendar.SECOND, 0)
        val thisMonthStart = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(cal.time)
        cal.add(java.util.Calendar.MONTH, -1)
        val lastMonthStart = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(cal.time)
        cal.add(java.util.Calendar.MONTH, 2)
        val nextMonthStart = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(cal.time)

        val projThis = supabase.from("projects").select {
            filter { filter("archived_at", FilterOperator.IS, "null"); gte("created_at", thisMonthStart); lt("created_at", nextMonthStart) }; count(Count.EXACT)
        }.countOrNull()?.toInt() ?: 0
        val projLast = supabase.from("projects").select {
            filter { filter("archived_at", FilterOperator.IS, "null"); gte("created_at", lastMonthStart); lt("created_at", thisMonthStart) }; count(Count.EXACT)
        }.countOrNull()?.toInt() ?: 0

        val payThis = allPayments.filter { it.createdAt != null && it.createdAt >= thisMonthStart && it.createdAt < nextMonthStart }.sumOf { it.amount }
        val payLast = allPayments.filter { it.createdAt != null && it.createdAt >= lastMonthStart && it.createdAt < thisMonthStart }.sumOf { it.amount }
        val matThis = allMaterials.filter { it.orderedAt != null && it.orderedAt!! >= thisMonthStart && it.orderedAt!! < nextMonthStart }.sumOf { it.quantity * it.unitCost }
        val matLast = allMaterials.filter { it.orderedAt != null && it.orderedAt!! >= lastMonthStart && it.orderedAt!! < thisMonthStart }.sumOf { it.quantity * it.unitCost }
        val spendThis = payThis + matThis
        val spendLast = payLast + matLast

        val attThis = allAttendance.count { it.date >= thisMonthStart && it.date < nextMonthStart }
        val attLast = allAttendance.count { it.date >= lastMonthStart && it.date < thisMonthStart }

        fun trend(cur: Int, prev: Int): TrendData? {
            if (cur == 0 && prev == 0) return null
            if (prev == 0) return TrendData(100, "+$cur new")
            val pct = ((cur - prev).toDouble() / prev * 100).toInt()
            return TrendData(pct, "${if (pct >= 0) "+" else ""}$pct% vs last month")
        }
        fun trendAmount(cur: Double, prev: Double): TrendData? {
            if (cur == 0.0 && prev == 0.0) return null
            if (prev == 0.0) return TrendData(100, "New this month")
            val pct = ((cur - prev) / prev * 100).toInt()
            return TrendData(pct, "${if (pct >= 0) "+" else ""}$pct% vs last month")
        }

        return AdminMetrics(
            total.toInt(), active.toInt(),
            projects.sumOf { it.totalCost },
            payments.sumOf { it.amount },
            materialStock,
            labour.toInt(),
            if (projects.isEmpty()) 0.0 else projects.sumOf { it.completionPct } / projects.size,
            overBudgetCount = overNames.size,
            nearBudgetCount = nearNames.size,
            overBudgetNames = overNames,
            nearBudgetNames = nearNames,
            projectsTrend = trend(projThis, projLast),
            spendingTrend = trendAmount(spendThis, spendLast),
            attendanceTrend = trend(attThis, attLast),
            spendingThisMonth = spendThis,
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
    // Staff-scoped equivalent of myProjectWageTotals() above, but per
    // (project, labourer) instead of just per project -- the Payments
    // screens need per-labourer amounts to auto-fill a wage payment. Same
    // security-definer RPC pattern, summed in Postgres so this doesn't have
    // to pull the whole (ever-growing) attendance table down to the device.
    suspend fun staffLabourerWageAccrued(): List<LabourerWageAccruedRow> =
        supabase.postgrest.rpc("staff_labourer_wage_accrued").decodeList()
    suspend fun listMaterials() = supabase.from("materials")
        .select { activeOnly(); order("ordered_at", Order.DESCENDING) }.decodeList<MaterialRow>()
    suspend fun listPayments() = supabase.from("payments")
        .select { activeOnly(); order("created_at", Order.DESCENDING) }.decodeList<PaymentRow>()
    suspend fun listUpdates() = supabase.from("project_updates")
        .select { activeOnly(); order("created_at", Order.DESCENDING); limit(50) }
        .decodeList<ProjectUpdateRow>()
    suspend fun listPersonalTransactions() = supabase.from("personal_transactions")
        .select { activeOnly(); order("occurred_at", Order.DESCENDING) }.decodeList<PersonalTransactionRow>()
    suspend fun listClientPayments() = supabase.from("client_payments")
        .select { activeOnly(); order("paid_on", Order.DESCENDING) }.decodeList<ClientPaymentRow>()

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
    suspend fun listArchivedPersonalTransactions() = supabase.from("personal_transactions")
        .select { archivedOnly(); order("occurred_at", Order.DESCENDING) }.decodeList<PersonalTransactionRow>()
    suspend fun listArchivedClientPayments() = supabase.from("client_payments")
        .select { archivedOnly(); order("paid_on", Order.DESCENDING) }.decodeList<ClientPaymentRow>()
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
    suspend fun setNextPaymentDate(projectId: String, date: String?, amount: Double? = null) {
        supabase.from("projects").update(buildJsonObject {
            if (date != null) put("next_payment_date", date) else put("next_payment_date", JsonNull)
            // No due date means no due amount either -- clear both together.
            if (date != null && amount != null) put("next_payment_amount", amount)
            else put("next_payment_amount", JsonNull)
        }) { filter { eq("id", projectId) } }
    }
    // ---------- Change orders ----------
    // Extra scope a client asks for mid-project, logged with the cost it
    // adds to the project's budget -- mirrors web's createChangeOrder /
    // adjustChangeOrderArchive in app/admin/actions.ts. Creating one bumps
    // projects.total_cost right away, same as extendProjectEndDate bumps
    // end_date directly above.
    suspend fun listChangeOrders(projectId: String) = supabase.from("project_change_orders")
        .select { filter { eq("project_id", projectId) }; activeOnly(); order("created_at", Order.DESCENDING) }
        .decodeList<ProjectChangeOrderRow>()
    suspend fun listArchivedChangeOrders(projectId: String) = supabase.from("project_change_orders")
        .select { filter { eq("project_id", projectId) }; archivedOnly(); order("created_at", Order.DESCENDING) }
        .decodeList<ProjectChangeOrderRow>()
    suspend fun createChangeOrder(projectId: String, description: String, workCategory: String?, extraCost: Double) {
        supabase.from("project_change_orders").insert(buildJsonObject {
            put("project_id", projectId)
            put("description", description)
            if (workCategory != null) put("work_category", workCategory)
            put("extra_cost", extraCost)
        })
        if (extraCost > 0.0) {
            val project = supabase.from("projects").select { filter { eq("id", projectId) } }
                .decodeSingleOrNull<ProjectRow>()
            if (project != null) {
                supabase.from("projects").update(buildJsonObject {
                    put("total_cost", project.totalCost + extraCost)
                }) { filter { eq("id", projectId) } }
            }
        }
    }
    // Change orders bump the project's budget when created (above), so
    // archiving/restoring one must reverse/reapply that adjustment --
    // otherwise undoing a mistaken entry would leave the budget permanently
    // inflated.
    private suspend fun adjustChangeOrderArchive(id: String, archived: Boolean) {
        val changeOrder = supabase.from("project_change_orders").select { filter { eq("id", id) } }
            .decodeSingleOrNull<ProjectChangeOrderRow>() ?: return
        setArchived("project_change_orders", id, archived)
        if (changeOrder.extraCost > 0.0) {
            val project = supabase.from("projects").select { filter { eq("id", changeOrder.projectId) } }
                .decodeSingleOrNull<ProjectRow>()
            if (project != null) {
                val delta = if (archived) -changeOrder.extraCost else changeOrder.extraCost
                supabase.from("projects").update(buildJsonObject {
                    put("total_cost", project.totalCost + delta)
                }) { filter { eq("id", changeOrder.projectId) } }
            }
        }
    }
    suspend fun archiveChangeOrder(id: String) = adjustChangeOrderArchive(id, true)
    suspend fun unarchiveChangeOrder(id: String) = adjustChangeOrderArchive(id, false)
    suspend fun deleteChangeOrderForever(id: String) = ownerDeleteRow("project_change_orders", id)

    // Uploaded image goes through uploadProjectImage (same project-images
    // bucket); this just points/clears the project row's agreement field.
    suspend fun setProjectAgreementImage(projectId: String, url: String?) {
        supabase.from("projects").update(buildJsonObject {
            if (url != null) put("agreement_image_url", url) else put("agreement_image_url", JsonNull)
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
    // Returns the new row's id -- used both by the Suppliers create form (which
    // ignores it) and by createPayment's "Other..." supplier escape hatch, which
    // needs the id right away to attach the payment to it.
    suspend fun createSupplier(name: String, email: String?, phone: String?, profileId: String?): String {
        val result = supabase.from("suppliers").insert(buildJsonObject {
            put("name", name)
            if (email != null) put("email", email)
            if (phone != null) put("phone", phone)
            if (profileId != null) put("profile_id", profileId)
        }) { select() }
        return result.decodeSingle<SupplierRow>().id
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
    suspend fun createPersonalTransaction(type: String, amount: Double, description: String?, occurredAt: String?) {
        supabase.from("personal_transactions").insert(buildJsonObject {
            put("type", type)
            put("amount", amount)
            if (description != null) put("description", description)
            if (occurredAt != null) put("occurred_at", occurredAt)
        })
    }
    suspend fun createClientPayment(projectId: String, amount: Double, description: String?, paidOn: String?) {
        supabase.from("client_payments").insert(buildJsonObject {
            put("project_id", projectId)
            put("amount", amount)
            if (description != null) put("description", description)
            if (paidOn != null) put("paid_on", paidOn)
        })
        // If a "next payment due" reminder is showing, this payment reduces
        // its outstanding balance instead of blindly clearing it -- a
        // partial payment just lowers the remaining balance and the
        // reminder stays up. Only clears once the balance reaches zero. A
        // due date with no amount set has nothing to check against, so any
        // payment clears it (setNextPaymentDate's default amount = null).
        val project = supabase.from("projects").select { filter { eq("id", projectId) } }
            .decodeSingleOrNull<ProjectRow>()
        if (project?.nextPaymentDate != null) {
            val remaining = (project.nextPaymentAmount ?: 0.0) - amount
            if (remaining > 0) setNextPaymentDate(projectId, project.nextPaymentDate, remaining)
            else setNextPaymentDate(projectId, null)
        }
    }
    // Marks a purchase as paid for so it drops out of the Payments page's
    // "Purchase (optional)" picker -- otherwise the same material could be
    // paid for more than once across repeat visits to that form.
    suspend fun markMaterialBilled(id: String) {
        supabase.from("materials").update(buildJsonObject {
            put("billed", true)
        }) { filter { eq("id", id) } }
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
    // Defaults to "approved" rather than "pending" -- this is only ever
    // called from the admin's own Create Payment form (no other role has
    // access to it), so there's no one left to approve it a moment later.
    suspend fun createPayment(projectId: String?, payeeType: String, supplierId: String?,
                              labourerId: String?, amount: Double, description: String?,
                              workCategory: String?, status: String = "approved") {
        supabase.from("payments").insert(buildJsonObject {
            if (projectId != null) put("project_id", projectId)
            put("payee_type", payeeType)
            if (payeeType == "supplier" && supplierId != null) put("supplier_id", supplierId)
            if (payeeType == "labour" && labourerId != null) put("labourer_id", labourerId)
            put("amount", amount); put("status", status)
            if (status == "approved") put("approved_at", java.time.Instant.now().toString())
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
    // A labourer can have one attendance row per project per day (see
    // 25_multi_site_attendance.sql), to record a day split across sites.
    private val AttendanceWageFactor = mapOf("present" to 1.0, "half_day" to 0.5, "absent" to 0.0)

    suspend fun upsertAttendance(labourerId: String, projectId: String, date: String, status: String) {
        // Guard against accidentally paying for more than one full day: sum
        // this status against whatever's already recorded for this labourer
        // on this date at OTHER projects.
        val otherRows = supabase.from("attendance")
            .select { filter { eq("labourer_id", labourerId); eq("date", date); neq("project_id", projectId) } }
            .decodeList<AttendanceRow>()
        val otherTotal = otherRows.sumOf { AttendanceWageFactor[it.status] ?: 0.0 }
        val newTotal = otherTotal + (AttendanceWageFactor[status] ?: 0.0)
        if (newTotal > 1.0) {
            throw Exception("This would total $newTotal days of pay for $date -- reduce their status at the other site first.")
        }

        supabase.from("attendance").upsert(
            buildJsonObject {
                put("labourer_id", labourerId)
                put("project_id", projectId)
                put("date", date); put("status", status)
            }
        ) {
            onConflict = "labourer_id,date,project_id"
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
    // Which labourers worked the calling client's own projects (names/trade
    // only, no wages -- security-definer RPC, same scoping as the wage totals
    // one above).
    suspend fun myProjectLabourers(): List<LabourOnProjectRow> =
        supabase.postgrest.rpc("my_project_labourers").decodeList()
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
    suspend fun myClientPayments(projectIds: List<String>): List<ClientPaymentRow> {
        if (projectIds.isEmpty()) return emptyList()
        return supabase.from("client_payments")
            .select {
                filter {
                    isIn("project_id", projectIds)
                    filter("archived_at", FilterOperator.IS, "null")
                }
                order("paid_on", Order.DESCENDING)
            }.decodeList()
    }
    // Read-only for the client -- client_own_change_orders RLS policy scopes
    // this to the caller's own projects regardless of what project IDs are
    // passed in here.
    suspend fun myChangeOrders(projectIds: List<String>): List<ProjectChangeOrderRow> {
        if (projectIds.isEmpty()) return emptyList()
        return supabase.from("project_change_orders")
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
    /**
     * Records a delivery and, when it is actually delivered, raises the bill
     * for it in the same call. The two used to be separate: this inserted the
     * material, and the supplier dashboard separately called createPayment()
     * from a second form. Keeping both halves here means Android and the web
     * server action (app/supplier/actions.ts recordDelivery) behave the same.
     *
     * This also fixes two fields that were missing entirely. Without
     * `created_by_supplier` the supplier could not delete their own
     * Android-recorded delivery -- the RLS policy in
     * 35_supplier_created_only_delete.sql requires the flag -- and
     * `delivered_at` was never stamped.
     */
    suspend fun recordSupplierDelivery(
        projectId: String, supplierId: String, name: String,
        unit: String, quantity: Double, unitCost: Double, status: String,
        imageUrl: String? = null,
    ) {
        // A delivered material bills itself below, so it is marked billed in
        // the same insert. That flag is load-bearing: cash flow skips
        // materials where `billed` because their cost is counted through the
        // supplier payment instead. Set one without the other and the
        // delivery is counted twice.
        val bills = status == "delivered"

        val material = supabase.from("materials").insert(buildJsonObject {
            put("project_id", projectId)
            put("supplier_id", supplierId)
            put("name", name); put("unit", unit)
            put("quantity", quantity); put("unit_cost", unitCost)
            put("status", status)
            if (bills) put("delivered_at", java.time.Instant.now().toString())
            if (imageUrl != null) put("image_url", imageUrl)
            put("created_by_supplier", true)
            put("billed", bills)
        }) { select() }.decodeSingle<MaterialRow>()

        if (!bills) return

        // Suppliers are trusted -- skip the manual approval review step, but
        // "Mark paid" stays a separate admin-only action for the actual
        // payment event. 26_supplier_bills_auto_approved.sql *requires*
        // status = 'approved' on a supplier-context insert. The admin's
        // Pending Payments metric counts pending + approved, so this lands
        // there immediately.
        supabase.from("payments").insert(buildJsonObject {
            put("project_id", projectId)
            put("payee_type", "supplier")
            put("supplier_id", supplierId)
            put("amount", lineTotal(quantity, unitCost))
            put("description", "$name ($quantity $unit)")
            put("status", "approved")
            put("created_by_supplier", true)
            put("material_id", material.id)
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

    // ---------- Backup ----------
    // Tables in FK-safe order so an eventual restore can insert rows without
    // hitting foreign-key violations. Mirrors lib/backup.ts on the web.
    private val backupTables = listOf(
        "profiles", "clients", "suppliers", "labourers",
        "projects", "project_labourers",
        "materials", "payments", "attendance",
        "project_updates", "personal_transactions",
        "project_change_orders", "client_payments",
    )

    // Full JSON dump of every table plus a small metadata header. Returned as
    // a string so the Backup screen can hand it to BackupExporter and let the
    // user save/share it -- same shape as the web /api/backup?format=json.
    suspend fun generateBackupJson(): Pair<String, Map<String, Int>> {
        val json = kotlinx.serialization.json.Json { prettyPrint = false }
        val tables = kotlinx.serialization.json.buildJsonObject {
            for (t in backupTables) {
                val raw = supabase.from(t).select().data
                put(t, json.parseToJsonElement(raw))
            }
        }
        val counts = mutableMapOf<String, Int>()
        for (t in backupTables) {
            val arr = tables[t] as? kotlinx.serialization.json.JsonArray
            counts[t] = arr?.size ?: 0
        }
        val payload = kotlinx.serialization.json.buildJsonObject {
            put("metadata", kotlinx.serialization.json.buildJsonObject {
                put("timestamp", kotlinx.serialization.json.JsonPrimitive(java.time.Instant.now().toString()))
                put("tables", kotlinx.serialization.json.buildJsonObject {
                    counts.forEach { (k, v) -> put(k, kotlinx.serialization.json.JsonPrimitive(v)) }
                })
            })
            put("tables", tables)
        }
        return json.encodeToString(kotlinx.serialization.json.JsonObject.serializer(), payload) to counts
    }

    suspend fun logBackupDownload(counts: Map<String, Int>) {
        val userId = supabase.auth.currentUserOrNull()?.id
        supabase.from("backup_logs").insert(buildJsonObject {
            put("type", "manual")
            put("format", "json")
            put("user_id", userId)
            put("table_counts", kotlinx.serialization.json.buildJsonObject {
                counts.forEach { (k, v) -> put(k, kotlinx.serialization.json.JsonPrimitive(v)) }
            })
        })
    }

    suspend fun fetchBackupLogs(): List<BackupLogRow> = supabase.from("backup_logs")
        .select { order("created_at", Order.DESCENDING); limit(20) }
        .decodeList<BackupLogRow>()
}
