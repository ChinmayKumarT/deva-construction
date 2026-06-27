"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function recordDelivery(fd: FormData) {
  const supabase = createSupabaseServerClient();
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

  const { error } = await supabase.from("materials").insert({
    project_id,
    supplier_id: supplier.id,
    name,
    unit,
    quantity,
    unit_cost,
    status,
    delivered_at: status === "delivered" ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier");
  revalidatePath("/admin/materials");
  revalidatePath("/admin");
}

export async function generateBill(fd: FormData) {
  const supabase = createSupabaseServerClient();
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

  const { error } = await supabase.from("payments").insert({
    project_id,
    payee_type: "supplier",
    supplier_id: supplier.id,
    amount,
    description,
    status: "pending",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier");
  revalidatePath("/admin/payments");
}
