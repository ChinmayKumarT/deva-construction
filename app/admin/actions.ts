"use server";

import { revalidatePath } from "next/cache";
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
    total_cost: num(fd, "total_cost") ?? 0,
    completion_pct: num(fd, "completion_pct") ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath("/admin");
}

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
    quantity: num(fd, "quantity") ?? 0,
    unit_cost: num(fd, "unit_cost") ?? 0,
    status,
    delivered_at: status === "delivered" ? new Date().toISOString() : null,
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
  revalidatePath("/labour");
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
    amount: num(fd, "amount") ?? 0,
    description: str(fd, "description"),
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
  const completion = num(fd, "completion_pct");
  if (stage || completion != null) {
    const patch: Record<string, unknown> = {};
    if (stage) patch.current_stage = stage;
    if (completion != null) patch.completion_pct = completion;
    await supabase.from("projects").update(patch).eq("id", project_id);
  }

  revalidatePath("/admin/updates");
  revalidatePath("/client");
}

export async function createLabourer(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("labourers").insert({
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    daily_wage: num(fd, "daily_wage") ?? 0,
    active: fd.get("active") === "on",
    profile_id: uuidOrNull(fd, "profile_id"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/labourers");
  revalidatePath("/admin");
}
