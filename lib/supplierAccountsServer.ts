import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { supplierMoney } from "@/lib/supplierAccount";

export type SupplierAccountFigures = {
  remaining: number;
  lifetimePayment: number;
  advanceBalance: number;
};

/**
 * Every supplier's {remaining, lifetimePayment, advanceBalance}, keyed by
 * supplier id, using the one shared derivation (lib/supplierAccount.ts). Fed to
 * the Payments form so picking a supplier shows their live account. Same rows,
 * same math as the supplier profile, so the figures cannot disagree.
 */
export async function loadSupplierAccounts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Record<string, SupplierAccountFigures>> {
  const [{ data: payments }, { data: advances }, { data: materials }] = await Promise.all([
    supabase.from("payments").select("id, supplier_id, amount, status").is("archived_at", null).eq("payee_type", "supplier"),
    supabase.from("supplier_advances").select("supplier_id, amount, payment_id, material_id"),
    supabase.from("materials").select("id, supplier_id, quantity, unit_cost, status, billed").is("archived_at", null),
  ]);

  const paymentsBy = new Map<string, { id: string; amount: number; status: string }[]>();
  for (const p of payments ?? []) {
    if (!p.supplier_id) continue;
    (paymentsBy.get(p.supplier_id) ?? paymentsBy.set(p.supplier_id, []).get(p.supplier_id)!).push({ id: p.id, amount: Number(p.amount), status: p.status });
  }
  const advancesBy = new Map<string, { amount: number; payment_id: string | null; material_id: string | null }[]>();
  for (const a of advances ?? []) {
    if (!a.supplier_id) continue;
    (advancesBy.get(a.supplier_id) ?? advancesBy.set(a.supplier_id, []).get(a.supplier_id)!).push({ amount: Number(a.amount), payment_id: a.payment_id, material_id: a.material_id });
  }
  const materialsBy = new Map<string, { id: string; quantity: number; unit_cost: number; status: string; billed: boolean }[]>();
  for (const m of materials ?? []) {
    if (!m.supplier_id) continue;
    (materialsBy.get(m.supplier_id) ?? materialsBy.set(m.supplier_id, []).get(m.supplier_id)!).push({
      id: m.id, quantity: Number(m.quantity), unit_cost: Number(m.unit_cost), status: m.status, billed: Boolean(m.billed),
    });
  }

  const out: Record<string, SupplierAccountFigures> = {};
  const ids = new Set<string>([...paymentsBy.keys(), ...advancesBy.keys(), ...materialsBy.keys()]);
  for (const id of ids) {
    const money = supplierMoney({
      payments: paymentsBy.get(id) ?? [],
      advances: advancesBy.get(id) ?? [],
      materials: materialsBy.get(id) ?? [],
    });
    out[id] = { remaining: money.remaining, lifetimePayment: money.lifetimePayment, advanceBalance: money.advanceBalance };
  }
  return out;
}
