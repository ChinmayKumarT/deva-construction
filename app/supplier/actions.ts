"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { wasJustCreated } from "@/app/admin/actions";
import { lineTotal } from "@/lib/money";

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

      // A delivered material bills itself (see the bill insert below), so it
      // is marked billed in the same insert. That flag is load-bearing:
      // lib/cashflow.ts skips materials where `billed` because their cost is
      // counted through the supplier payment instead. Set one without the
      // other and the delivery is counted twice.
      const bills = status === "delivered";

      const { data: material, error } = await supabase
        .from("materials")
        .insert({
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
          billed: bills,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (bills && material) {
        const cost = lineTotal(quantity, unit_cost);

        // The full cost always comes off the advance ledger, even when that
        // drives the balance negative -- a negative balance is exactly the
        // "what we still owe this supplier" figure, and it is what lets the
        // bill below settle itself with nothing left for an admin to confirm.
        await supabase.from("supplier_advances").insert({
          supplier_id: supplier.id,
          amount: -cost,
          description: `Auto-deducted for ${name} delivery`,
          material_id: material.id,
        });

        // Recording the delivery IS the payment event: the cost is settled
        // against the advance above, so the bill goes straight to "paid".
        // 48_supplier_bills_auto_paid.sql's insert policy *requires*
        // status = 'paid' here.
        const { error: billError } = await supabase.from("payments").insert({
          project_id,
          payee_type: "supplier",
          supplier_id: supplier.id,
          amount: cost,
          // Same description shape the admin's own purchase-billing flow
          // produces (components/admin/PaymentForm.tsx), so bills from the
          // two paths read identically in the payments list.
          description: `${name} (${quantity} ${unit})`,
          status: "paid",
          paid_at: new Date().toISOString(),
          created_by_supplier: true,
          material_id: material.id,
        });
        if (billError) throw new Error(billError.message);
      }
    }

    revalidatePath("/supplier");
    revalidatePath("/admin/materials");
    revalidatePath(`/admin/materials/${project_id}`);
    revalidatePath("/admin/payments");
    revalidatePath(`/admin/payments/${project_id}`);
    revalidatePath(`/admin/suppliers/${supplier.id}`);
    revalidatePath("/admin");
    return { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record delivery", success: false };
  }
}

// generateBill() used to live here: a second form where the supplier retyped
// the project, amount and description to raise the bill for a delivery they
// had just recorded. recordDelivery() now creates that bill itself, so the
// form and this action are gone.

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

  // The delivery raised its own bill, so removing the delivery has to remove
  // the debt with it -- otherwise the admin keeps owing money for goods that
  // are no longer recorded, and the supplier has no bill form left to undo it
  // from. Scoped the same way as the material update above so this can only
  // ever reach a bill this supplier's own delivery created.
  const { error: billError } = await supabase
    .from("payments")
    .update({ archived_at: new Date().toISOString() })
    .eq("material_id", id)
    .eq("supplier_id", supplier.id)
    .eq("created_by_supplier", true);
  if (billError) throw new Error(billError.message);

  revalidatePath("/supplier");
  revalidatePath("/admin/materials");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/suppliers/${supplier.id}`);
  revalidatePath("/admin");
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
    .select("id, material_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("You can only delete bills you generated yourself.");

  // If this bill came from a delivery, hand the cost back to the material.
  // materials.billed tells lib/cashflow.ts to skip the material because its
  // payment covers it; leaving the flag set after archiving that payment
  // would drop the cost from cash flow entirely -- counted in neither place.
  const materialId = data[0]?.material_id;
  if (materialId) {
    const { error: materialError } = await supabase
      .from("materials")
      .update({ billed: false })
      .eq("id", materialId)
      .eq("supplier_id", supplier.id)
      .eq("created_by_supplier", true);
    if (materialError) throw new Error(materialError.message);
    revalidatePath("/admin/materials");
  }

  revalidatePath("/supplier");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/suppliers/${supplier.id}`);
  revalidatePath("/admin");
}
