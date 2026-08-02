"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return v == null ? null : String(v).trim() || null;
}
function num(fd: FormData, k: string) {
  const v = fd.get(k);
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
// Money, quantity, and wage fields are never legitimately negative -- a typo'd
// "-500" would otherwise silently flip a total negative and skew cash flow.
// The <input min="0"> on the form is a UX hint only; this is the real gate.
function nonNegNum(fd: FormData, k: string, label: string) {
  const n = num(fd, k);
  if (n != null && n < 0) throw new Error(`${label} cannot be negative`);
  return n;
}
function pct(fd: FormData, k: string, label: string) {
  const n = num(fd, k);
  if (n != null && (n < 0 || n > 100)) throw new Error(`${label} must be between 0 and 100`);
  return n;
}
function uuidOrNull(fd: FormData, k: string) {
  const v = str(fd, k);
  return v && v !== "none" ? v : null;
}

export async function createProject(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("projects").insert({
    name: str(fd, "name"),
    client_id: uuidOrNull(fd, "client_id"),
    address: str(fd, "address"),
    status: str(fd, "status") ?? "planned",
    current_stage: str(fd, "current_stage"),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    total_cost: nonNegNum(fd, "total_cost", "Total cost") ?? 0,
    completion_pct: pct(fd, "completion_pct", "Completion %") ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath("/admin");
}

export async function updateProject(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) throw new Error("project id required");
  const { error } = await supabase
    .from("projects")
    .update({
      name: str(fd, "name"),
      client_id: uuidOrNull(fd, "client_id"),
      address: str(fd, "address"),
      status: str(fd, "status") ?? "planned",
      current_stage: str(fd, "current_stage"),
      start_date: str(fd, "start_date"),
      end_date: str(fd, "end_date"),
      total_cost: nonNegNum(fd, "total_cost", "Total cost") ?? 0,
      completion_pct: pct(fd, "completion_pct", "Completion %") ?? 0,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProjectViews();
  redirect("/admin/projects");
}

// "Delete" is a reversible archive -- a real DELETE would cascade and destroy
// this project's materials and progress updates/photos. See supabase/10_archive.sql.
export async function archiveProject(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) throw new Error("project id required");
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProjectViews();
}

export async function unarchiveProject(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) throw new Error("project id required");
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProjectViews();
}

// Archiving changes what every project-derived view shows, so refresh them together.
function revalidateProjectViews() {
  revalidatePath("/admin/projects");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/costs");
  revalidatePath("/admin/materials");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/updates");
  revalidatePath("/admin");
  revalidatePath("/client");
}

// Archiving any entity can change several dashboards at once (a supplier's name
// appears on materials and payments, a labourer's on attendance), so rather than
// track per-entity dependencies, refresh the admin tree and the role dashboards.
function revalidateAll() {
  for (const p of [
    "/admin", "/admin/projects", "/admin/clients", "/admin/suppliers",
    "/admin/labourers", "/admin/materials", "/admin/payments", "/admin/updates",
    "/admin/attendance", "/admin/costs", "/admin/reports",
    "/client", "/supplier",
  ]) revalidatePath(p);
}

/**
 * Permanent, owner-only delete -- the one genuinely irreversible action in the
 * app. Enforcement is in Postgres (owner_delete_row in 12_owner_delete.sql),
 * not here: this action is a thin wrapper, since a server action is directly
 * reachable regardless of what button is or isn't shown in the UI. Deleting a
 * project cascades to its materials/updates; deleting a labourer cascades to
 * their attendance -- expected once the owner chose delete over archive.
 */
async function ownerDeleteRow(table: string, id: string | null) {
  if (!id) throw new Error("id required");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("owner_delete_row", { target_table: table, target_id: id });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function deleteProject(fd: FormData) { await ownerDeleteRow("projects", str(fd, "id")); }
export async function deleteClient(fd: FormData) { await ownerDeleteRow("clients", str(fd, "id")); }
export async function deleteSupplier(fd: FormData) { await ownerDeleteRow("suppliers", str(fd, "id")); }
export async function deleteLabourer(fd: FormData) { await ownerDeleteRow("labourers", str(fd, "id")); }
export async function deleteMaterial(fd: FormData) { await ownerDeleteRow("materials", str(fd, "id")); }
export async function deletePayment(fd: FormData) { await ownerDeleteRow("payments", str(fd, "id")); }
export async function deleteProjectUpdate(fd: FormData) { await ownerDeleteRow("project_updates", str(fd, "id")); }

/**
 * "Delete" is a reversible archive across every entity -- the foreign keys in
 * 02_domain.sql cascade, so a real DELETE on a project would destroy its
 * materials and progress photos, and on a labourer would wipe their attendance
 * (wage) history. See supabase/10_archive.sql and 11_archive_updates.sql.
 */
async function setArchived(table: string, id: string | null, archived: boolean) {
  if (!id) throw new Error("id required");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from(table)
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

async function updateRow(table: string, id: string | null, patch: Record<string, unknown>) {
  if (!id) throw new Error("id required");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

// ---------- Clients ----------
export async function updateClient(fd: FormData) {
  await updateRow("clients", str(fd, "id"), {
    name: str(fd, "name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    profile_id: uuidOrNull(fd, "profile_id"),
  });
  redirect("/admin/clients");
}
export async function archiveClient(fd: FormData) { await setArchived("clients", str(fd, "id"), true); }
export async function unarchiveClient(fd: FormData) { await setArchived("clients", str(fd, "id"), false); }

// ---------- Suppliers ----------
export async function updateSupplier(fd: FormData) {
  await updateRow("suppliers", str(fd, "id"), {
    name: str(fd, "name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    profile_id: uuidOrNull(fd, "profile_id"),
  });
  redirect("/admin/suppliers");
}
export async function archiveSupplier(fd: FormData) { await setArchived("suppliers", str(fd, "id"), true); }
export async function unarchiveSupplier(fd: FormData) { await setArchived("suppliers", str(fd, "id"), false); }

// ---------- Labourers ----------
export async function updateLabourer(fd: FormData) {
  // profile_id is deliberately not written: labourers don't sign in (the site
  // manager records their attendance), so there's no "link to login" field on
  // the form. Leaving it out of the payload preserves any existing value
  // instead of nulling it on every save.
  await updateRow("labourers", str(fd, "id"), {
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    daily_wage: nonNegNum(fd, "daily_wage", "Daily wage") ?? 0,
    active: fd.get("active") === "on",
    category: str(fd, "category"),
  });
  redirect("/admin/labourers");
}
export async function archiveLabourer(fd: FormData) { await setArchived("labourers", str(fd, "id"), true); }
export async function unarchiveLabourer(fd: FormData) { await setArchived("labourers", str(fd, "id"), false); }

// ---------- Materials ----------
export async function updateMaterial(fd: FormData) {
  const status = (str(fd, "status") ?? "ordered") as "ordered" | "delivered" | "returned";
  await updateRow("materials", str(fd, "id"), {
    project_id: uuidOrNull(fd, "project_id"),
    supplier_id: uuidOrNull(fd, "supplier_id"),
    name: str(fd, "name"),
    unit: str(fd, "unit") ?? "unit",
    quantity: nonNegNum(fd, "quantity", "Quantity") ?? 0,
    unit_cost: nonNegNum(fd, "unit_cost", "Unit cost") ?? 0,
    status,
    work_category: str(fd, "work_category"),
  });
  redirect("/admin/materials");
}
export async function archiveMaterial(fd: FormData) { await setArchived("materials", str(fd, "id"), true); }
export async function unarchiveMaterial(fd: FormData) { await setArchived("materials", str(fd, "id"), false); }

// ---------- Payments ----------
export async function updatePayment(fd: FormData) {
  const payee_type = (str(fd, "payee_type") ?? "supplier") as "supplier" | "labour";
  await updateRow("payments", str(fd, "id"), {
    project_id: uuidOrNull(fd, "project_id"),
    payee_type,
    // The DB CHECK constraint requires exactly one of supplier_id/labourer_id
    // to be set, matching payee_type -- so always clear the other one.
    supplier_id: payee_type === "supplier" ? uuidOrNull(fd, "supplier_id") : null,
    labourer_id: payee_type === "labour" ? uuidOrNull(fd, "labourer_id") : null,
    amount: nonNegNum(fd, "amount", "Amount") ?? 0,
    description: str(fd, "description"),
    work_category: str(fd, "work_category"),
  });
  redirect("/admin/payments");
}
export async function archivePayment(fd: FormData) { await setArchived("payments", str(fd, "id"), true); }
export async function unarchivePayment(fd: FormData) { await setArchived("payments", str(fd, "id"), false); }

// ---------- Project updates ----------
export async function updateProjectUpdate(fd: FormData) {
  await updateRow("project_updates", str(fd, "id"), {
    stage: str(fd, "stage"),
    note: str(fd, "note"),
  });
  redirect("/admin/updates");
}
export async function archiveProjectUpdate(fd: FormData) { await setArchived("project_updates", str(fd, "id"), true); }
export async function unarchiveProjectUpdate(fd: FormData) { await setArchived("project_updates", str(fd, "id"), false); }

export async function createClient(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("clients").insert({
    name: str(fd, "name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    profile_id: uuidOrNull(fd, "profile_id"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clients");
}

export async function createSupplier(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("suppliers").insert({
    name: str(fd, "name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    profile_id: uuidOrNull(fd, "profile_id"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/suppliers");
}

export async function createMaterial(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const status = (str(fd, "status") ?? "ordered") as "ordered" | "delivered" | "returned";
  const { error } = await supabase.from("materials").insert({
    project_id: uuidOrNull(fd, "project_id"),
    supplier_id: uuidOrNull(fd, "supplier_id"),
    name: str(fd, "name"),
    unit: str(fd, "unit") ?? "unit",
    quantity: nonNegNum(fd, "quantity", "Quantity") ?? 0,
    unit_cost: nonNegNum(fd, "unit_cost", "Unit cost") ?? 0,
    status,
    delivered_at: status === "delivered" ? new Date().toISOString() : null,
    work_category: str(fd, "work_category"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/materials");
  revalidatePath("/admin/costs");
  revalidatePath("/admin");
}

export async function markMaterialDelivered(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) return;
  const { error } = await supabase
    .from("materials")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/materials");
  revalidatePath("/admin/costs");
  revalidatePath("/admin");
}

export async function markAttendance(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const date = str(fd, "date") ?? new Date().toISOString().slice(0, 10);
  const labourer_id = str(fd, "labourer_id");
  const project_id = uuidOrNull(fd, "project_id");
  const status = (str(fd, "status") ?? "present") as "present" | "absent" | "half_day";
  if (!labourer_id) throw new Error("labourer_id required");

  const { error } = await supabase
    .from("attendance")
    .upsert({ labourer_id, project_id, date, status }, { onConflict: "labourer_id,date" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/attendance");
}

export async function assignLabourer(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const labourer_id = str(fd, "labourer_id");
  const project_id = uuidOrNull(fd, "project_id");
  if (!labourer_id || !project_id) throw new Error("labourer + project required");

  // End any other open assignment for this labourer.
  await supabase
    .from("project_labourers")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("labourer_id", labourer_id)
    .is("unassigned_at", null)
    .neq("project_id", project_id);

  // Upsert this assignment. If the (project, labourer) pair already exists
  // (e.g. previously unassigned), reopen it by clearing unassigned_at.
  const { error } = await supabase
    .from("project_labourers")
    .upsert(
      { labourer_id, project_id, unassigned_at: null, assigned_at: new Date().toISOString() },
      { onConflict: "project_id,labourer_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/labourers");
  revalidatePath("/admin/attendance");
}

export async function createPayment(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const payee_type = (str(fd, "payee_type") ?? "supplier") as "supplier" | "labour";
  const row: Record<string, unknown> = {
    project_id: uuidOrNull(fd, "project_id"),
    payee_type,
    amount: nonNegNum(fd, "amount", "Amount") ?? 0,
    description: str(fd, "description"),
    work_category: str(fd, "work_category"),
    status: "pending",
  };
  if (payee_type === "supplier") {
    row.supplier_id = uuidOrNull(fd, "supplier_id");
    row.labourer_id = null;
  } else {
    row.labourer_id = uuidOrNull(fd, "labourer_id");
    row.supplier_id = null;
  }
  const { error } = await supabase.from("payments").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

export async function approvePayment(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("payments")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id ?? null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

export async function markPaymentPaid(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) return;
  const { error } = await supabase
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/payments");
  revalidatePath("/admin/costs");
  revalidatePath("/admin");
}

export async function rejectPayment(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("payments").update({ status: "rejected" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/payments");
}

export async function postProjectUpdate(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const project_id = uuidOrNull(fd, "project_id");
  if (!project_id) throw new Error("project required");

  let image_url: string | null = str(fd, "image_url");
  const file = fd.get("image_file");
  if (file instanceof File && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${project_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("project-images")
      .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);
    const { data: pub } = supabase.storage.from("project-images").getPublicUrl(path);
    image_url = pub.publicUrl;
  }

  const { error } = await supabase.from("project_updates").insert({
    project_id,
    author_id: user?.id ?? null,
    stage: str(fd, "stage"),
    note: str(fd, "note"),
    image_url,
  });
  if (error) throw new Error(error.message);

  const stage = str(fd, "stage");
  const completion = pct(fd, "completion_pct", "Completion %");
  if (stage || completion != null) {
    const patch: Record<string, unknown> = {};
    if (stage) patch.current_stage = stage;
    if (completion != null) patch.completion_pct = completion;
    await supabase.from("projects").update(patch).eq("id", project_id);
  }

  revalidatePath("/admin/updates");
  revalidatePath("/client");
}

// original_end_date/extension_updated_at are trigger-managed
// (09_project_date_extension.sql) -- this only ever sends end_date/extension_reason,
// same discipline as the Android Repo.extendProjectEndDate.
export async function extendProjectEndDate(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  const end_date = str(fd, "end_date");
  if (!id || !end_date) throw new Error("project and new date required");
  const { error } = await supabase
    .from("projects")
    .update({ end_date, extension_reason: str(fd, "reason") })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath("/client");
}

export async function setNextPaymentDate(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) throw new Error("project required");
  const { error } = await supabase
    .from("projects")
    .update({ next_payment_date: str(fd, "next_payment_date") || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath("/client");
}

// The set_user_role RPC re-checks is_owner() server-side (08_owner_admin_approval.sql),
// so this is a thin wrapper, not the actual security boundary -- a non-owner
// calling it still gets rejected by the database.
export async function setUserRole(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const target_id = str(fd, "target_id");
  const new_role = str(fd, "new_role");
  if (!target_id || !new_role) throw new Error("target and role required");
  const { error } = await supabase.rpc("set_user_role", { target_id, new_role });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team");
}

// Permanent -- admin_delete_user() (20_admin_delete_user.sql) re-checks
// is_owner() and rejects self-deletion server-side, so this is a thin
// wrapper, not the actual security boundary. Deletes the login only;
// business records (projects, materials, payments) are preserved.
export async function deleteUser(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const target_id = str(fd, "id");
  if (!target_id) throw new Error("target required");
  const { error } = await supabase.rpc("admin_delete_user", { target_id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team");
}

export async function createLabourer(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("labourers").insert({
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    daily_wage: nonNegNum(fd, "daily_wage", "Daily wage") ?? 0,
    active: fd.get("active") === "on",
    category: str(fd, "category"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/labourers");
  revalidatePath("/admin");
}
