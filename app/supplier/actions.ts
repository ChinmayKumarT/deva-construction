"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { wasJustCreated } from "@/app/admin/actions";

export type RecordDeliveryState = { error: string | null; success: boolean };

// Returns its result instead of throwing -- production redacts thrown Server
// Action error messages, so this is the only way a real validation error
// (rather than a generic message) reaches the client. Also checks
// wasJustCreated() before inserting: a disabled-while-pending submit button
// only blocks a second click DURING the request, not a resubmit of the same
// still-filled-in form a few seconds after the first one already succeeded.
export async function recordDelivery(
  _prevState: RecordDeliveryState,
  fd: FormData,
): Promise<RecordDeliveryState> {
  const supabase = await createSupabaseServerClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("not signed in");

    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("profile_id", user.id)
      .single();
    if (!supplier) throw new Error("no supplier profile linked");

    const project_id = String(fd.get("project_id") ?? "");
    const name = String(fd.get("name") ?? "").trim();
    const unit = (String(fd.get("unit") ?? "").trim()) || "unit";
    const quantity = Number(fd.get("quantity") ?? 0);
    const unit_cost = Number(fd.get("unit_cost") ?? 0);
    const status = String(fd.get("status") ?? "delivered");

    if (!project_id || !name || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("project, material, and positive quantity required");
    }
    if (!Number.isFinite(unit_cost) || unit_cost < 0) {
      throw new Error("unit cost cannot be negative");
    }

    const duplicate = await wasJustCreated(supabase, "materials", {
      project_id,
      supplier_id: supplier.id,
      name,
      quantity,
      unit_cost,
    });
    if (!duplicate) {
      // Optional photo of what was actually delivered, so admin can check it
      // against the recorded quantity/status. Same upload pattern as
      // postProjectUpdate in app/admin/actions.ts.
      let image_url: string | null = null;
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

      const { error } = await supabase.from("materials").insert({
        project_id,
        supplier_id: supplier.id,
        name,
        unit,
        quantity,
        unit_cost,
        status,
        delivered_at: status === "delivered" ? new Date().toISOString() : null,
        image_url,
        created_by_supplier: true,
      });
      if (error) throw new Error(error.message);
    }

    revalidatePath("/supplier");
    revalidatePath("/admin/materials");
    revalidatePath(`/admin/materials/${project_id}`);
    revalidatePath(`/admin/payments/${project_id}`);
    revalidatePath(`/admin/suppliers/${supplier.id}`);
    revalidatePath("/admin");
    return { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record delivery", success: false };
  }
}

export type GenerateBillState = { error: string | null; success: boolean };

export async function generateBill(
  _prevState: GenerateBillState,
  fd: FormData,
): Promise<GenerateBillState> {
  const supabase = await createSupabaseServerClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("not signed in");

    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("profile_id", user.id)
      .single();
    if (!supplier) throw new Error("no supplier profile linked");

    const project_id = String(fd.get("project_id") ?? "");
    const amount = Number(fd.get("amount") ?? 0);
    const description = String(fd.get("description") ?? "");
    if (!project_id || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("project + positive amount required");
    }

    const duplicate = await wasJustCreated(supabase, "payments", {
      project_id,
      payee_type: "supplier",
      supplier_id: supplier.id,
      amount,
      description: description || null,
    });
    if (!duplicate) {
      const { error } = await supabase.from("payments").insert({
        project_id,
        payee_type: "supplier",
        supplier_id: supplier.id,
        amount,
        description,
        // Suppliers are trusted -- skip the manual approval review step, but
        // "Mark paid" stays a separate admin-only action for the actual
        // payment event (see 26_supplier_bills_auto_approved.sql).
        status: "approved",
        created_by_supplier: true,
      });
      if (error) throw new Error(error.message);
    }

    revalidatePath("/supplier");
    revalidatePath("/admin/payments");
    revalidatePath(`/admin/payments/${project_id}`);
    revalidatePath(`/admin/suppliers/${supplier.id}`);
    revalidatePath("/admin");
    return { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to submit bill", success: false };
  }
}

export async function archiveDelivery(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!supplier) throw new Error("no supplier profile linked");

  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("missing id");

  // Only rows the supplier themselves recorded -- not admin-entered
  // deliveries -- can be deleted from here (RLS enforces this too, see
  // 35_supplier_created_only_delete.sql, but checking here gives a real
  // error instead of a silent 0-row update).
  const { data, error } = await supabase
    .from("materials")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("supplier_id", supplier.id)
    .eq("created_by_supplier", true)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("You can only delete deliveries you recorded yourself.");
  revalidatePath("/supplier");
  revalidatePath("/admin/materials");
}

export async function archiveSupplierPayment(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!supplier) throw new Error("no supplier profile linked");

  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("missing id");

  // Only bills the supplier themselves generated -- not admin-created/approved
  // payments -- can be deleted from here (RLS enforces this too, see
  // 35_supplier_created_only_delete.sql, but checking here gives a real
  // error instead of a silent 0-row update).
  const { data, error } = await supabase
    .from("payments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("supplier_id", supplier.id)
    .eq("created_by_supplier", true)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("You can only delete bills you generated yourself.");
  revalidatePath("/supplier");
  revalidatePath("/admin/payments");
}
