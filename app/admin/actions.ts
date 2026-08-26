"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { WAGE_FACTOR } from "@/lib/wages";

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
function requiredStr(fd: FormData, k: string, label: string) {
  const v = str(fd, k);
  if (!v) throw new Error(`${label} is required`);
  return v;
}
// The Supplier field's "Other…" option omits `name="supplier_id"` from the
// select (see PaymentForm.tsx) and submits a plain-text `new_supplier_name`
// instead -- resolve that into a real supplier row so supplier_id can stay a
// required FK everywhere else in the app (reports, the Suppliers list, etc).
async function resolveSupplierId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  fd: FormData,
): Promise<string | null> {
  const supplierId = uuidOrNull(fd, "supplier_id");
  if (supplierId) return supplierId;
  const newSupplierName = str(fd, "new_supplier_name");
  if (!newSupplierName) return null;
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name: newSupplierName })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/suppliers");
  return data.id;
}

// Guards against duplicate rows from clicking a Create/Record/Submit button
// more than once -- a disabled-while-pending button only blocks a second
// click DURING the request; it does nothing once that request finishes and
// the (still filled-in) form is re-submitted a few seconds later. Treat a
// near-identical row inserted moments ago as the same submission and skip
// re-inserting it, rather than trying to catch every possible client-side
// double-click/resubmit path. Exported so app/supplier/actions.ts (the other
// place rows get inserted into these same tables) can share it.
export async function wasJustCreated(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: "materials" | "payments",
  match: Record<string, string | number | null>,
  windowSeconds = 10,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();
  let query = supabase.from(table).select("id").gte("created_at", cutoff).limit(1);
  for (const [key, value] of Object.entries(match)) {
    query = value === null ? query.is(key, null) : query.eq(key, value);
  }
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

export async function createProject(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) throw new Error("project id required");
  const patch: Record<string, unknown> = {
    name: str(fd, "name"),
    client_id: uuidOrNull(fd, "client_id"),
    address: str(fd, "address"),
    status: str(fd, "status") ?? "planned",
    current_stage: str(fd, "current_stage"),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    completion_pct: pct(fd, "completion_pct", "Completion %") ?? 0,
  };
  // The manager edit form has no budget input, and num() cannot tell a
  // missing field from a cleared one -- both come back null. Writing
  // `?? 0` unconditionally would therefore wipe the project's budget every
  // time a manager saved an unrelated edit, and silently: no error, just a
  // zero. Only touch total_cost when the form actually submitted it.
  if (fd.has("total_cost")) {
    patch.total_cost = nonNegNum(fd, "total_cost", "Total cost") ?? 0;
  }
  const { error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProjectViews();
  redirect("/admin/projects");
}

// "Delete" is a reversible archive -- a real DELETE would cascade and destroy
// this project's materials and progress updates/photos. See supabase/10_archive.sql.
export async function archiveProject(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(table)
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

async function updateRow(table: string, id: string | null, patch: Record<string, unknown>) {
  if (!id) throw new Error("id required");
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const payee_type = (str(fd, "payee_type") ?? "supplier") as "supplier" | "labour";
  await updateRow("payments", str(fd, "id"), {
    project_id: uuidOrNull(fd, "project_id"),
    payee_type,
    // The DB CHECK constraint requires exactly one of supplier_id/labourer_id
    // to be set, matching payee_type -- so always clear the other one.
    supplier_id: payee_type === "supplier" ? await resolveSupplierId(supabase, fd) : null,
    labourer_id: payee_type === "labour" ? uuidOrNull(fd, "labourer_id") : null,
    amount: nonNegNum(fd, "amount", "Amount") ?? 0,
    description: str(fd, "description"),
    work_category: requiredStr(fd, "work_category", "Work category"),
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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

export type CreateMaterialState = { error: string | null; success: boolean };

// Returns its result instead of throwing (see markAttendance's comment above
// for why), and checks wasJustCreated() first so clicking "Add material"
// more than once on an unreset form can't insert the same delivery twice.
export async function createMaterial(
  _prevState: CreateMaterialState,
  fd: FormData,
): Promise<CreateMaterialState> {
  const supabase = await createSupabaseServerClient();
  try {
    const status = (str(fd, "status") ?? "ordered") as "ordered" | "delivered" | "returned";
    const row = {
      project_id: uuidOrNull(fd, "project_id"),
      supplier_id: uuidOrNull(fd, "supplier_id"),
      name: str(fd, "name"),
      unit: str(fd, "unit") ?? "unit",
      quantity: nonNegNum(fd, "quantity", "Quantity") ?? 0,
      unit_cost: nonNegNum(fd, "unit_cost", "Unit cost") ?? 0,
      status,
      delivered_at: status === "delivered" ? new Date().toISOString() : null,
      work_category: str(fd, "work_category"),
    };
    const duplicate = await wasJustCreated(supabase, "materials", {
      project_id: row.project_id,
      supplier_id: row.supplier_id,
      name: row.name,
      quantity: row.quantity,
      unit_cost: row.unit_cost,
    });
    if (!duplicate) {
      const { error } = await supabase.from("materials").insert(row);
      if (error) throw new Error(error.message);
    }
    revalidatePath("/admin/materials");
    revalidatePath("/admin/costs");
    revalidatePath("/admin");
    return { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add material", success: false };
  }
}

export async function markMaterialDelivered(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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

export type MarkAttendanceState = { error: string | null };

// Returns its error instead of throwing, and is called via useFormState
// (components/admin/AttendanceMarkForm.tsx) rather than a bare
// <form action={...}>. Next.js redacts thrown Server Action error messages
// in production builds (shows only a generic "Server Components render"
// message + digest) -- returning the message as state is the supported way
// to actually surface a validation message like the overlap guard below to
// the client in production, not just in dev.
export async function markAttendance(
  _prevState: MarkAttendanceState,
  fd: FormData,
): Promise<MarkAttendanceState> {
  const supabase = await createSupabaseServerClient();
  const date = str(fd, "date") ?? new Date().toISOString().slice(0, 10);
  const labourer_id = str(fd, "labourer_id");
  const project_id = uuidOrNull(fd, "project_id");
  const status = (str(fd, "status") ?? "present") as "present" | "absent" | "half_day";
  if (!labourer_id) return { error: "labourer_id required" };
  if (!project_id) return { error: "project_id required" };

  // A labourer can have one attendance row per project per day (see
  // 25_multi_site_attendance.sql), to record a day split across sites.
  // Guard against accidentally paying for more than one full day: sum this
  // status against whatever's already recorded for this labourer on this
  // date at OTHER projects.
  const { data: otherRows } = await supabase
    .from("attendance")
    .select("status, projects(name)")
    .eq("labourer_id", labourer_id)
    .eq("date", date)
    .neq("project_id", project_id);
  const otherTotal = (otherRows ?? []).reduce((sum, r) => sum + (WAGE_FACTOR[r.status] ?? 0), 0);
  const newTotal = otherTotal + (WAGE_FACTOR[status] ?? 0);
  if (newTotal > 1) {
    const otherNames = (otherRows ?? [])
      // @ts-expect-error relation
      .map((r) => r.projects?.name)
      .filter(Boolean)
      .join(", ");
    return {
      error: `This would total ${newTotal} days of pay for ${date}${otherNames ? ` -- already marked at ${otherNames}` : ""}. Reduce the other entry first.`,
    };
  }

  const { error } = await supabase
    .from("attendance")
    .upsert({ labourer_id, project_id, date, status }, { onConflict: "labourer_id,date,project_id" });
  if (error) return { error: error.message };
  revalidatePath("/admin/attendance");
  revalidatePath(`/admin/attendance/${project_id}`);
  return { error: null };
}

export async function assignLabourer(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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

export type CreatePaymentState = { error: string | null; success: boolean };

// Returns its result instead of throwing, and is called via useFormState
// (components/admin/PaymentForm.tsx) rather than a bare <form action={...}>
// -- same reasoning as markAttendance above (production redacts thrown
// Server Action messages), plus the `success` flag is what triggers the
// in-page "Payment created" popup after a successful submit.
export async function createPayment(
  _prevState: CreatePaymentState,
  fd: FormData,
): Promise<CreatePaymentState> {
  const supabase = await createSupabaseServerClient();
  const payee_type = (str(fd, "payee_type") ?? "supplier") as "supplier" | "labour";
  try {
    // Payments created here are always admin-entered (this form isn't
    // exposed to any other role), so there's no one else left to approve it.
    // Supplier bills specifically: the admin typing one in here means the
    // money already changed hands, so it goes straight to "paid" -- no
    // separate "Mark paid" click needed. "Mark paid" as a distinct step is
    // for the OTHER path into this table: the bill a supplier's own delivery
    // raises via recordDelivery() (app/supplier/actions.ts), which the admin
    // hasn't paid yet at record time. Labour wages keep the "approved" pause since
    // payday timing there is intentionally separate from entry time.
    // getUser() and resolveSupplierId() don't depend on each other -- run
    // them together instead of paying for both round-trips back to back.
    const [{ data: { user } }, resolvedSupplierId] = await Promise.all([
      supabase.auth.getUser(),
      payee_type === "supplier" ? resolveSupplierId(supabase, fd) : Promise.resolve(null),
    ]);
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      project_id: uuidOrNull(fd, "project_id"),
      payee_type,
      amount: nonNegNum(fd, "amount", "Amount") ?? 0,
      description: str(fd, "description"),
      work_category: requiredStr(fd, "work_category", "Work category"),
      status: payee_type === "supplier" ? "paid" : "approved",
      approved_at: now,
      approved_by: user?.id ?? null,
      paid_at: payee_type === "supplier" ? now : null,
    };
    if (payee_type === "supplier") {
      if (!resolvedSupplierId) {
        return { error: "Pick a supplier for this bill (or use \"Other…\" to type a new supplier name).", success: false };
      }
      row.supplier_id = resolvedSupplierId;
      row.labourer_id = null;
    } else {
      const labourerId = uuidOrNull(fd, "labourer_id");
      if (!labourerId) {
        return { error: "Pick a labourer for these wages.", success: false };
      }
      row.labourer_id = labourerId;
      row.supplier_id = null;
      const collectedBy = uuidOrNull(fd, "collected_by");
      if (collectedBy) row.collected_by = collectedBy;
    }

    // Record WHICH material this bill covers, not just that one does. The
    // billed flag below is a one-way boolean; material_id is the actual link,
    // and the unique partial index on it (40_supplier_delivery_autobill.sql)
    // is what stops a delivery being billed twice across the two paths into
    // this table -- here, and the supplier's own recordDelivery().
    const materialId = uuidOrNull(fd, "material_id");
    if (materialId) row.material_id = materialId;

    const duplicate = await wasJustCreated(supabase, "payments", {
      project_id: row.project_id as string | null,
      payee_type: row.payee_type as string,
      supplier_id: (row.supplier_id as string | null) ?? null,
      labourer_id: (row.labourer_id as string | null) ?? null,
      amount: row.amount as number,
      description: row.description as string | null,
    });
    if (!duplicate) {
      const { error } = await supabase.from("payments").insert(row);
      if (error) throw new Error(error.message);
    }

    // Mark the picked purchase as billed so it drops out of the "Purchase
    // (optional)" dropdown -- otherwise the same material could be paid for
    // more than once from repeat visits to this form.
    if (materialId) {
      const { error: materialError } = await supabase
        .from("materials")
        .update({ billed: true })
        .eq("id", materialId);
      if (materialError) throw new Error(materialError.message);
      revalidatePath("/admin/materials");
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create payment", success: false };
  }
}

export async function approvePayment(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  // The supplier page can trigger this too (MarkPaidButton on
  // /admin/suppliers/[id]), and its Remaining/Received figures come straight
  // off payment status -- without these it would redirect back showing the
  // pre-payment totals. Optional because the payments screen doesn't send it.
  revalidatePath("/admin/suppliers");
  const supplierId = str(fd, "supplier_id");
  if (supplierId) revalidatePath(`/admin/suppliers/${supplierId}`);
}

export async function rejectPayment(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("payments").update({ status: "rejected" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/payments");
}

export async function postProjectUpdate(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const id = str(fd, "id");
  if (!id) throw new Error("project required");
  const date = str(fd, "next_payment_date") || null;
  // No due date means no due amount either -- clear both together.
  const amount = date ? nonNegNum(fd, "next_payment_amount", "Amount") : null;
  const { error } = await supabase
    .from("projects")
    .update({ next_payment_date: date, next_payment_amount: amount })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath("/client");
}

// ---------- Change orders ----------
// Extra scope a client asks for mid-project (add a balcony, extend a floor,
// etc.), logged with the cost it adds to the project's budget. Creating one
// bumps projects.total_cost right away, same as extendProjectEndDate bumps
// end_date directly above -- Budget/Spent/Remaining on the project page
// stays correct with no separate manual edit step.
export async function createChangeOrder(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const project_id = str(fd, "project_id");
  if (!project_id) throw new Error("project_id required");
  const description = requiredStr(fd, "description", "Description");
  const extra_cost = nonNegNum(fd, "extra_cost", "Extra cost") ?? 0;
  const work_category = str(fd, "work_category");

  const { error } = await supabase.from("project_change_orders").insert({
    project_id,
    description,
    work_category,
    extra_cost,
  });
  if (error) throw new Error(error.message);

  if (extra_cost > 0) {
    const { data: project } = await supabase
      .from("projects")
      .select("total_cost")
      .eq("id", project_id)
      .single();
    if (project) {
      await supabase
        .from("projects")
        .update({ total_cost: Number(project.total_cost) + extra_cost })
        .eq("id", project_id);
    }
  }
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/costs");
  revalidatePath("/client");
}

// Change orders bump the project's budget when created (above), so
// archiving/restoring one must reverse/reapply that adjustment -- otherwise
// undoing a mistaken entry would leave the budget permanently inflated.
async function adjustChangeOrderArchive(id: string | null, archived: boolean) {
  if (!id) throw new Error("id required");
  const supabase = await createSupabaseServerClient();
  const { data: changeOrder } = await supabase
    .from("project_change_orders")
    .select("project_id, extra_cost")
    .eq("id", id)
    .single();
  if (!changeOrder) throw new Error("change order not found");

  const { error } = await supabase
    .from("project_change_orders")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const extraCost = Number(changeOrder.extra_cost);
  if (extraCost > 0) {
    const { data: project } = await supabase
      .from("projects")
      .select("total_cost")
      .eq("id", changeOrder.project_id)
      .single();
    if (project) {
      const delta = archived ? -extraCost : extraCost;
      await supabase
        .from("projects")
        .update({ total_cost: Number(project.total_cost) + delta })
        .eq("id", changeOrder.project_id);
    }
  }
  revalidatePath(`/admin/projects/${changeOrder.project_id}`);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/costs");
  revalidatePath("/client");
}
export async function archiveChangeOrder(fd: FormData) {
  await adjustChangeOrderArchive(str(fd, "id"), true);
}
export async function unarchiveChangeOrder(fd: FormData) {
  await adjustChangeOrderArchive(str(fd, "id"), false);
}
export async function deleteChangeOrder(fd: FormData) {
  await ownerDeleteRow("project_change_orders", str(fd, "id"));
}

// Same upload pattern as postProjectUpdate above -- image goes to the
// existing project-images bucket, only the public URL is stored on the row.
export async function uploadProjectAgreement(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const project_id = str(fd, "project_id");
  if (!project_id) throw new Error("project required");

  const file = fd.get("image_file");
  if (!(file instanceof File) || file.size === 0) throw new Error("agreement image required");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${project_id}/agreement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("project-images")
    .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);
  const { data: pub } = supabase.storage.from("project-images").getPublicUrl(path);

  const { error } = await supabase
    .from("projects")
    .update({ agreement_image_url: pub.publicUrl })
    .eq("id", project_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/client");
}

export async function removeProjectAgreement(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const project_id = str(fd, "project_id");
  if (!project_id) throw new Error("project required");
  const { error } = await supabase
    .from("projects")
    .update({ agreement_image_url: null })
    .eq("id", project_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/client");
}

export async function assignRoleByEmail(fd: FormData) {
  const { role: callerRole, isOwner } = await getSessionAndRole();
  if (callerRole !== "superadmin" && !isOwner) throw new Error("only superadmin can assign roles");
  const email = str(fd, "email");
  const role = str(fd, "role");
  if (!email || !role) throw new Error("email and role required");

  const { createSupabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdmin();

  const { data: existingUser } = await admin.auth.admin.listUsers();
  const match = existingUser?.users?.find((u) => u.email === email);

  if (match) {
    await admin.from("profiles").update({ role, role_pending: false }).eq("id", match.id);
  } else {
    await admin.from("role_reservations").upsert(
      { email: email.toLowerCase(), role },
      { onConflict: "email" },
    );
  }

  revalidatePath("/admin/team");
}

export async function deleteRoleReservation(fd: FormData) {
  const { role: callerRole, isOwner } = await getSessionAndRole();
  if (callerRole !== "superadmin" && !isOwner) throw new Error("only superadmin can manage reservations");
  const email = str(fd, "email");
  if (!email) throw new Error("email required");
  const supabase = await createSupabaseServerClient();
  await supabase.from("role_reservations").delete().eq("email", email);
  revalidatePath("/admin/team");
}

// The set_user_role RPC re-checks is_owner() server-side (08_owner_admin_approval.sql),
// so this is a thin wrapper, not the actual security boundary -- a non-owner
// calling it still gets rejected by the database.
export async function setUserRole(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const target_id = str(fd, "id");
  if (!target_id) throw new Error("target required");
  const { error } = await supabase.rpc("admin_delete_user", { target_id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team");
}

export async function createLabourer(fd: FormData) {
  const supabase = await createSupabaseServerClient();
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

// ---------- Labourer families ----------

export async function linkFamily(fd: FormData) {
  const ids = fd.getAll("labourer_id").map(String).filter(Boolean);
  if (ids.length < 2) throw new Error("Select at least two labourers to link as family.");
  const supabase = await createSupabaseServerClient();
  // Check if any of them already have a family_id — reuse it
  const { data: existing } = await supabase
    .from("labourers")
    .select("family_id")
    .in("id", ids)
    .not("family_id", "is", null)
    .limit(1);
  const familyId = existing?.[0]?.family_id ?? crypto.randomUUID();
  const { error } = await supabase
    .from("labourers")
    .update({ family_id: familyId })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/labourers");
}

export async function unlinkFamily(fd: FormData) {
  const id = str(fd, "labourer_id");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("labourers")
    .update({ family_id: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/labourers");
}

// ---------- Personal transactions ----------
// The admin's own income/expenses, unrelated to any project -- kept out of
// every cost/cash-flow calculation elsewhere by design (see
// supabase/21_personal_transactions.sql for the RLS boundary: no
// client/supplier/labour policy exists on this table at all).
export async function createPersonalTransaction(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const type = str(fd, "type") === "expense" ? "expense" : "income";
  const { error } = await supabase.from("personal_transactions").insert({
    type,
    amount: nonNegNum(fd, "amount", "Amount") ?? 0,
    description: str(fd, "description"),
    occurred_at: str(fd, "occurred_at") || undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/personal");
}
export async function archivePersonalTransaction(fd: FormData) {
  await setArchived("personal_transactions", str(fd, "id"), true);
  revalidatePath("/admin/personal");
}
export async function unarchivePersonalTransaction(fd: FormData) {
  await setArchived("personal_transactions", str(fd, "id"), false);
  revalidatePath("/admin/personal");
}
export async function deletePersonalTransaction(fd: FormData) {
  await ownerDeleteRow("personal_transactions", str(fd, "id"));
  revalidatePath("/admin/personal");
}

export async function createClientPayment(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const projectId = str(fd, "project_id");
  if (!projectId) throw new Error("Project is required");
  const amount = nonNegNum(fd, "amount", "Amount") ?? 0;
  const { error } = await supabase.from("client_payments").insert({
    project_id: projectId,
    amount,
    description: str(fd, "description"),
    paid_on: str(fd, "paid_on") || undefined,
  });
  if (error) throw new Error(error.message);

  // If a "next payment due" reminder is showing, this payment reduces its
  // outstanding balance instead of blindly clearing it -- a partial payment
  // just lowers the remaining balance and the reminder stays up. Only
  // clears once the balance reaches zero. A due date with no amount set
  // (e.g. from before this balance tracking existed) has nothing to check
  // against, so any payment clears it, same as before.
  const { data: project } = await supabase
    .from("projects")
    .select("next_payment_date, next_payment_amount")
    .eq("id", projectId)
    .single();
  if (project?.next_payment_date) {
    const remaining = Number(project.next_payment_amount ?? 0) - amount;
    await supabase
      .from("projects")
      .update(
        remaining > 0
          ? { next_payment_amount: remaining }
          : { next_payment_date: null, next_payment_amount: null },
      )
      .eq("id", projectId);
  }
  revalidatePath(`/admin/payments/${projectId}`);
  revalidatePath("/admin/projects");
  revalidatePath("/client");
}
export async function archiveClientPayment(fd: FormData) {
  await setArchived("client_payments", str(fd, "id"), true);
}
export async function unarchiveClientPayment(fd: FormData) {
  await setArchived("client_payments", str(fd, "id"), false);
}
export async function deleteClientPayment(fd: FormData) {
  await ownerDeleteRow("client_payments", str(fd, "id"));
}

// --------------- Budget extensions ---------------

export async function createBudgetExtension(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const project_id = str(fd, "project_id");
  if (!project_id) throw new Error("project_id required");
  const amount = nonNegNum(fd, "amount", "Amount");
  if (!amount || amount <= 0) throw new Error("Amount must be greater than zero");
  const reason = str(fd, "reason");

  const { error } = await supabase.from("budget_extensions").insert({
    project_id,
    amount,
    reason,
  });
  if (error) throw new Error(error.message);

  const { data: project } = await supabase
    .from("projects")
    .select("total_cost")
    .eq("id", project_id)
    .single();
  if (project) {
    await supabase
      .from("projects")
      .update({ total_cost: Number(project.total_cost) + amount })
      .eq("id", project_id);
  }
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/costs");
  revalidatePath("/client");
}

async function adjustBudgetExtensionArchive(id: string | null, archived: boolean) {
  if (!id) throw new Error("id required");
  const supabase = await createSupabaseServerClient();
  const { data: ext } = await supabase
    .from("budget_extensions")
    .select("project_id, amount")
    .eq("id", id)
    .single();
  if (!ext) throw new Error("budget extension not found");

  const { error } = await supabase
    .from("budget_extensions")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const extAmount = Number(ext.amount);
  const { data: project } = await supabase
    .from("projects")
    .select("total_cost")
    .eq("id", ext.project_id)
    .single();
  if (project) {
    const delta = archived ? -extAmount : extAmount;
    await supabase
      .from("projects")
      .update({ total_cost: Number(project.total_cost) + delta })
      .eq("id", ext.project_id);
  }
  revalidatePath(`/admin/projects/${ext.project_id}`);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/costs");
  revalidatePath("/client");
}
export async function archiveBudgetExtension(fd: FormData) {
  await adjustBudgetExtensionArchive(str(fd, "id"), true);
}
export async function unarchiveBudgetExtension(fd: FormData) {
  await adjustBudgetExtensionArchive(str(fd, "id"), false);
}
export async function deleteBudgetExtension(fd: FormData) {
  await ownerDeleteRow("budget_extensions", str(fd, "id"));
}
