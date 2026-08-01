package com.construction.manager.data

import io.github.jan.supabase.auth.OtpType
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class Role { admin, manager, client, supplier, labour;
    companion object { fun fromString(s: String?): Role? = entries.firstOrNull { it.name == s } }
}

// The web confirm page (app/reset-password/confirm) hands off a raw
// token_hash to this app's deep link with a `type` query param -- "magiclink"
// or anything else (including absent, for older links) means recovery. Pulled
// out of MainActivity so the decision itself is unit-testable without an
// Android Intent.
fun otpTypeFromDeepLinkParam(type: String?): OtpType.Email =
    if (type == "magiclink") OtpType.Email.MAGIC_LINK else OtpType.Email.RECOVERY

@Serializable
data class Profile(
    val id: String,
    @SerialName("full_name") val fullName: String? = null,
    val role: String = "client",
    @SerialName("is_owner") val isOwner: Boolean = false,
    @SerialName("role_pending") val rolePending: Boolean = false,
)

@Serializable
data class ClientRow(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    @SerialName("profile_id") val profileId: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
)

@Serializable
data class SupplierRow(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    @SerialName("profile_id") val profileId: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
)

@Serializable
data class LabourerRow(
    val id: String,
    val name: String,
    val phone: String? = null,
    @SerialName("daily_wage") val dailyWage: Double = 0.0,
    val active: Boolean = true,
    val category: String? = null,
    @SerialName("profile_id") val profileId: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
)

@Serializable
data class ProjectRow(
    val id: String,
    val name: String,
    @SerialName("client_id") val clientId: String? = null,
    val address: String? = null,
    val status: String = "planned",
    @SerialName("current_stage") val currentStage: String? = null,
    @SerialName("completion_pct") val completionPct: Double = 0.0,
    @SerialName("total_cost") val totalCost: Double = 0.0,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("end_date") val endDate: String? = null,
    @SerialName("original_end_date") val originalEndDate: String? = null,
    @SerialName("extension_reason") val extensionReason: String? = null,
    @SerialName("next_payment_date") val nextPaymentDate: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
) {
    /** True once end_date has been pushed later than the originally planned date. */
    val finishDateExtended: Boolean
        get() = originalEndDate != null && endDate != null && endDate > originalEndDate
}

@Serializable
data class MaterialRow(
    val id: String,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("supplier_id") val supplierId: String? = null,
    val name: String,
    val unit: String = "unit",
    val quantity: Double = 0.0,
    @SerialName("unit_cost") val unitCost: Double = 0.0,
    val status: String = "ordered",
    @SerialName("ordered_at") val orderedAt: String? = null,
    @SerialName("delivered_at") val deliveredAt: String? = null,
    @SerialName("work_category") val workCategory: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
)

@Serializable
data class PaymentRow(
    val id: String,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("payee_type") val payeeType: String = "supplier",
    @SerialName("supplier_id") val supplierId: String? = null,
    @SerialName("labourer_id") val labourerId: String? = null,
    val amount: Double = 0.0,
    val status: String = "pending",
    val description: String? = null,
    @SerialName("work_category") val workCategory: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
)

@Serializable
data class AttendanceRow(
    val id: String? = null,
    @SerialName("labourer_id") val labourerId: String,
    @SerialName("project_id") val projectId: String? = null,
    val date: String,
    val status: String = "present",
)

@Serializable
data class ProjectUpdateRow(
    val id: String? = null,
    @SerialName("project_id") val projectId: String,
    val stage: String? = null,
    val note: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
)

@Serializable
data class ProjectLabourerRow(
    @SerialName("labourer_id") val labourerId: String,
    @SerialName("project_id") val projectId: String,
)

// Row shape returned by the my_project_wage_totals() RPC: a per-project total
// of attendance-accrued wages, scoped to the calling client's own projects.
@Serializable
data class ProjectWageTotalRow(
    @SerialName("project_id") val projectId: String,
    @SerialName("wage_total") val wageTotal: Double = 0.0,
)

// Row shape returned by the my_project_labourers() RPC: which labourers have
// attendance on a project owned by the calling client. Names/trade only, no
// wage figures -- see 19_client_project_labourers.sql. Named distinctly from
// ProjectLabourerRow above, which is the admin-side project_labourers
// *assignment* table (current site), a different concept from attendance.
@Serializable
data class LabourOnProjectRow(
    @SerialName("project_id") val projectId: String,
    @SerialName("labourer_id") val labourerId: String,
    @SerialName("labourer_name") val labourerName: String,
    val category: String? = null,
)
