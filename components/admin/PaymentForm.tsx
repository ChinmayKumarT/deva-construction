"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { OTHER_CATEGORY } from "@/components/admin/CategoryField";
import { ConfirmPopup } from "@/components/admin/ConfirmPopup";
import { CollapsibleForm } from "@/components/admin/CollapsibleForm";
import { WORK_CATEGORIES } from "@/lib/workCategories";
import { wageDueKey } from "@/lib/wages";
import { lineTotal } from "@/lib/money";
import type { CreatePaymentState } from "@/app/admin/actions";

const initialCreatePaymentState: CreatePaymentState = { error: null, success: false };

const OTHER_SUPPLIER = "__other_supplier__";
const OTHER_PURCHASE = "__other_purchase__";

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const selectClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

type Material = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  work_category: string | null;
  supplier_id: string | null;
  project_id: string | null;
  /** Advance already put against this purchase. The picker offers the NET
   *  still owed (line total minus this), never the full line total, so a
   *  part-covered purchase can't be paid for twice. */
  advance_applied?: number;
};

type Assignment = { labourer_id: string; project_id: string };

type SupplierAccount = { remaining: number; lifetimePayment: number; advanceBalance: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

type Initial = {
  payeeType: string;
  projectId: string;
  amount: string;
  supplierId: string;
  labourerId: string;
  description: string;
  workCategory: string;
};

function PaymentFormFields({
  action,
  projects,
  suppliers,
  labourers,
  materials,
  assignments,
  wageDue,
  supplierAccounts,
  initial,
  paymentId,
  submitLabel,
  cancelHref,
  fixedProject,
  allowMulti = false,
}: {
  action: (fd: FormData) => void;
  projects: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  labourers: { id: string; name: string; familyId?: string | null; category?: string | null }[];
  materials: Material[];
  assignments: Assignment[];
  wageDue: Record<string, number>;
  supplierAccounts?: Record<string, SupplierAccount>;
  initial: Initial;
  paymentId?: string;
  submitLabel: string;
  cancelHref?: string;
  fixedProject?: { id: string; name: string };
  allowMulti?: boolean;
}) {
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/custom-categories")
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setCustomCategories(data))
      .catch(() => {});
  }, []);

  const [projectId, setProjectId] = useState(fixedProject?.id ?? initial.projectId);
  const [purchaseId, setPurchaseId] = useState("none");
  const [payeeType, setPayeeType] = useState(initial.payeeType);
  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [supplierOtherName, setSupplierOtherName] = useState("");
  const [labourerId, setLabourerId] = useState(initial.labourerId);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedLabourerIds, setSelectedLabourerIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState(initial.amount);
  const [description, setDescription] = useState(initial.description);
  const [purchaseOtherText, setPurchaseOtherText] = useState("");
  const allKnownCategories = [...(WORK_CATEGORIES as readonly string[]), ...customCategories];
  const initialCategoryKnown = allKnownCategories.includes(initial.workCategory);
  const [workCategory, setWorkCategory] = useState(
    initialCategoryKnown ? initial.workCategory : initial.workCategory ? OTHER_CATEGORY : "",
  );
  const [workCategoryOther, setWorkCategoryOther] = useState(initialCategoryKnown ? "" : initial.workCategory);

  // Supplier "pay what's owed" mode: only when creating (an edit still tweaks a
  // single existing payment). Pick a supplier -> see their account and open
  // purchases, settle any subset, and let extra spill into advance or a plain
  // payment.
  const supplierCreate = payeeType === "supplier" && !paymentId;
  const [selectedPurchases, setSelectedPurchases] = useState<Set<string>>(new Set());
  // Unset on purpose: an amount above the selected purchases must be sent
  // somewhere deliberately, so neither option is pre-picked.
  const [extraMode, setExtraMode] = useState<"advance" | "payment" | "">("");

  const netOf = (m: Material) => Math.max(0, lineTotal(m.quantity, m.unit_cost) - (m.advance_applied ?? 0));
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const supplierRealId = supplierId !== "none" && supplierId !== OTHER_SUPPLIER ? supplierId : null;
  const supplierPurchases = useMemo(
    () => (supplierRealId ? materials.filter((m) => m.supplier_id === supplierRealId) : []),
    [materials, supplierRealId],
  );
  const selectedNet = useMemo(
    () => round2(supplierPurchases.filter((m) => selectedPurchases.has(m.id)).reduce((s, m) => s + netOf(m), 0)),
    [supplierPurchases, selectedPurchases],
  );
  const account = supplierRealId ? supplierAccounts?.[supplierRealId] : undefined;
  const amountNum = Number(amount) || 0;
  const extraAmount = round2(amountNum - selectedNet);

  function selectSupplierForPay(id: string) {
    setSupplierId(id);
    const ps = id !== "none" && id !== OTHER_SUPPLIER ? materials.filter((m) => m.supplier_id === id) : [];
    setSelectedPurchases(new Set(ps.map((m) => m.id)));
    setAmount(String(round2(ps.reduce((s, m) => s + netOf(m), 0))));
  }
  function setPurchasesAndAmount(next: Set<string>) {
    setSelectedPurchases(next);
    setAmount(String(round2(supplierPurchases.filter((m) => next.has(m.id)).reduce((s, m) => s + netOf(m), 0))));
  }
  function togglePurchase(id: string) {
    const next = new Set(selectedPurchases);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPurchasesAndAmount(next);
  }

  const projectMaterials = useMemo(
    () => materials.filter((m) => projectId !== "none" && m.project_id === projectId),
    [materials, projectId],
  );

  // Only labourers currently assigned to the selected project -- plus
  // whichever labourer this payment already has, so editing an older
  // payment doesn't hide its existing value if they've since moved sites.
  const assignedLabourers = useMemo(() => {
    const assignedIds = new Set(
      assignments.filter((a) => a.project_id === projectId).map((a) => a.labourer_id),
    );
    return labourers.filter((l) => assignedIds.has(l.id) || l.id === initial.labourerId);
  }, [labourers, assignments, projectId, initial.labourerId]);

  function handleProjectChange(id: string) {
    setProjectId(id);
    setPurchaseId("none");
    setLabourerId("none");
    setSelectedLabourerIds(new Set());
  }

  function toggleLabourer(id: string) {
    setSelectedLabourerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const multiTotal = useMemo(() => {
    if (!multiSelect || projectId === "none") return 0;
    let sum = 0;
    for (const id of selectedLabourerIds) {
      sum += wageDue[wageDueKey(projectId, id)] ?? 0;
    }
    return sum;
  }, [multiSelect, selectedLabourerIds, projectId, wageDue]);

  function handleLabourerChange(id: string) {
    setLabourerId(id);
    if (id === "none" || projectId === "none") return;
    setAmount(String(wageDue[wageDueKey(projectId, id)] ?? 0));
    const l = labourers.find((x) => x.id === id);
    if (l?.category) {
      const catKnown = allKnownCategories.includes(l.category);
      setWorkCategory(catKnown ? l.category : OTHER_CATEGORY);
      setWorkCategoryOther(catKnown ? "" : l.category);
    }
  }

  function handlePurchaseChange(id: string) {
    setPurchaseId(id);
    if (id === "none") return;
    if (id === OTHER_PURCHASE) {
      setPayeeType("supplier");
      return;
    }
    const m = materials.find((x) => x.id === id);
    if (!m) return;
    setPayeeType("supplier");
    setSupplierId(m.supplier_id ?? "none");
    // Net still owed, never the full line total: an advance already put against
    // this purchase has been paid, so only the remainder is due.
    const net = Math.max(0, lineTotal(m.quantity, m.unit_cost) - (m.advance_applied ?? 0));
    setAmount(String(net));
    setDescription(`${m.name} (${m.quantity} ${m.unit})`);
    const mCategory = m.work_category ?? "";
    const mCategoryKnown = allKnownCategories.includes(mCategory);
    setWorkCategory(mCategoryKnown ? mCategory : mCategory ? OTHER_CATEGORY : "");
    setWorkCategoryOther(mCategoryKnown ? "" : mCategory);
  }

  return (
    <form action={action} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
      {paymentId && <input type="hidden" name="id" value={paymentId} />}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Payee type</span>
        <select
          name="payee_type"
          className={selectClass}
          value={payeeType}
          onChange={(e) => setPayeeType(e.target.value)}
        >
          <option value="supplier">Supplier (bill)</option>
          <option value="labour">Labourer (wages)</option>
        </select>
      </label>

      {/* Supplier "pay what's owed" takes the project from each purchase, so it
          has no project field. Labour and edit keep it. */}
      {!supplierCreate && (fixedProject ? (
        <input type="hidden" name="project_id" value={fixedProject.id} />
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Project</span>
          <select
            name="project_id"
            className={selectClass}
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            <option value="none">— none —</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </label>
      ))}

      {payeeType === "labour" ? (
        <>
          {allowMulti && (
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <button
                type="button"
                onClick={() => {
                  setMultiSelect((v) => !v);
                  setLabourerId("none");
                  setSelectedLabourerIds(new Set());
                  setAmount("");
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  multiSelect
                    ? "border-brand bg-brand text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {multiSelect ? "Multiple labourers" : "Single labourer"}
              </button>
              <span className="text-xs text-slate-500">
                {multiSelect ? "Creating one payment per labourer" : "Click to pay multiple labourers at once"}
              </span>
            </div>
          )}

          {multiSelect ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="mb-2 block text-sm font-medium text-slate-700">Select labourers</span>
              {projectId === "none" ? (
                <p className="text-sm text-slate-500">Choose a project first.</p>
              ) : assignedLabourers.length === 0 ? (
                <p className="text-sm text-slate-500">No labourers assigned to this project.</p>
              ) : (
                <>
                  <div className="mb-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLabourerIds(new Set(assignedLabourers.map((l) => l.id)))}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLabourerIds(new Set())}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {assignedLabourers.map((l) => {
                      const due = wageDue[wageDueKey(projectId, l.id)] ?? 0;
                      const checked = selectedLabourerIds.has(l.id);
                      return (
                        <label
                          key={l.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-brand bg-brand/5"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="labourer_id"
                            value={l.id}
                            checked={checked}
                            onChange={() => toggleLabourer(l.id)}
                            className="accent-brand"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{l.name}</span>
                            {l.category && (
                              <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                {l.category}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">₹{due.toLocaleString()}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Total: ₹{multiTotal.toLocaleString()} ({selectedLabourerIds.size} labourers)
                  </p>
                </>
              )}
              <input type="hidden" name="multi" value="1" />
              <input
                type="hidden"
                name="labourer_amounts"
                value={JSON.stringify(
                  Object.fromEntries(
                    [...selectedLabourerIds].map((id) => {
                      const l = labourers.find((x) => x.id === id);
                      return [id, { amount: wageDue[wageDueKey(projectId, id)] ?? 0, category: l?.category ?? "" }];
                    }),
                  ),
                )}
              />
            </div>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Labourer</span>
                <select
                  name="labourer_id"
                  className={selectClass}
                  value={labourerId}
                  onChange={(e) => handleLabourerChange(e.target.value)}
                  disabled={projectId === "none"}
                >
                  <option value="none">
                    {projectId === "none" ? "— choose a project first —" : "— none —"}
                  </option>
                  {assignedLabourers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  Only labourers currently assigned to this project. Selecting one fills in the
                  wages owed based on their attendance.
                </span>
              </label>
              {(() => {
                const selected = labourers.find((l) => l.id === labourerId);
                if (!selected?.familyId) return null;
                const family = labourers.filter((l) => l.familyId === selected.familyId && l.id !== labourerId);
                if (family.length === 0) return null;
                return (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Collected by</span>
                    <select name="collected_by" className={selectClass} defaultValue="">
                      <option value="">— self —</option>
                      {family.map((f) => (<option key={f.id} value={f.id}>{f.name} (family)</option>))}
                    </select>
                    <span className="mt-1 block text-xs text-slate-500">
                      If a family member collects the payment on their behalf.
                    </span>
                  </label>
                );
              })()}
            </>
          )}
        </>
      ) : supplierCreate ? (
        <div className="grid gap-4 sm:col-span-2 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Supplier</span>
                <select
                  name={supplierId === OTHER_SUPPLIER ? undefined : "supplier_id"}
                  className={selectClass}
                  value={supplierId}
                  onChange={(e) => selectSupplierForPay(e.target.value)}
                >
                  <option value="none">— select a supplier —</option>
                  {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  <option value={OTHER_SUPPLIER}>Other…</option>
                </select>
              </label>
              {suppliers.length === 0 && supplierId === "none" && (
                <p className="mt-1 text-xs text-slate-500">
                  No suppliers yet — pick <span className="font-medium">Other…</span> to type a new name, or{" "}
                  <Link href="/admin/suppliers" className="font-medium text-brand-700 hover:underline">add one first</Link>.
                </p>
              )}
              {supplierId === OTHER_SUPPLIER && (
                <input
                  name="new_supplier_name"
                  value={supplierOtherName}
                  onChange={(e) => setSupplierOtherName(e.target.value)}
                  placeholder="Enter supplier name"
                  required
                  className={`mt-2 ${inputClass}`}
                />
              )}
            </div>
            {account && (
              <div className="flex flex-wrap items-end gap-2">
                <span className={`rounded-lg border px-3 py-2 text-xs ${account.remaining > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  <span className="block text-[10px] font-medium uppercase tracking-wide">Remaining</span>
                  <span className="text-sm font-semibold">₹{account.remaining.toLocaleString()}</span>
                </span>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <span className="block text-[10px] font-medium uppercase tracking-wide">Lifetime payment</span>
                  <span className="text-sm font-semibold">₹{account.lifetimePayment.toLocaleString()}</span>
                </span>
                <span className={`rounded-lg border px-3 py-2 text-xs ${account.advanceBalance > 0 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  <span className="block text-[10px] font-medium uppercase tracking-wide">Advance</span>
                  <span className="text-sm font-semibold">₹{account.advanceBalance.toLocaleString()}</span>
                </span>
              </div>
            )}
          </div>

          {supplierRealId && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Purchases</span>
                {supplierPurchases.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPurchasesAndAmount(new Set(supplierPurchases.map((m) => m.id)))} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Select all</button>
                    <button type="button" onClick={() => setPurchasesAndAmount(new Set())} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Clear</button>
                  </div>
                )}
              </div>
              {supplierPurchases.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">No open purchases for this supplier.</p>
              ) : (
                <div className="grid gap-1 sm:grid-cols-2">
                  {supplierPurchases.map((m) => {
                    const net = netOf(m);
                    const applied = m.advance_applied ?? 0;
                    const checked = selectedPurchases.has(m.id);
                    return (
                      <label key={m.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${checked ? "border-brand bg-brand/5" : "border-slate-200 hover:border-slate-300"}`}>
                        <input type="checkbox" checked={checked} onChange={() => togglePurchase(m.id)} className="accent-brand" />
                        <span className="flex-1">
                          <span className="font-medium">{m.name}</span>
                          <span className="ml-1 text-xs text-slate-500">
                            ({Number(m.quantity)} {m.unit}{m.project_id ? ` · ${projectNameById.get(m.project_id) ?? ""}` : ""})
                          </span>
                          {applied > 0 && <span className="ml-1 rounded bg-blue-50 px-1 text-[10px] text-blue-700">₹{applied.toLocaleString()} from advance</span>}
                        </span>
                        <span className="tabular-nums text-slate-700">₹{net.toLocaleString()}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {[...selectedPurchases].map((id) => (<input key={id} type="hidden" name="material_id" value={id} />))}
              <p className="mt-2 text-sm text-slate-600">
                Selected: <span className="font-medium">₹{selectedNet.toLocaleString()}</span> ({selectedPurchases.size} {selectedPurchases.size === 1 ? "purchase" : "purchases"})
              </p>
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Description</span>
            <input name="description" className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note" />
          </label>
        </div>
      ) : (
        <div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Purchase (optional)</span>
            <select
              name={purchaseId !== "none" && purchaseId !== OTHER_PURCHASE ? "material_id" : undefined}
              className={selectClass}
              value={purchaseId}
              onChange={(e) => handlePurchaseChange(e.target.value)}
              disabled={projectId === "none"}
            >
              <option value="none">
                {projectId === "none" ? "— choose a project first —" : "— none —"}
              </option>
              {projectMaterials.map((m) => {
                const applied = m.advance_applied ?? 0;
                const net = Math.max(0, lineTotal(m.quantity, m.unit_cost) - applied);
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} ({Number(m.quantity)} {m.unit}) — ₹{net.toLocaleString()}
                    {applied > 0 ? ` (₹${applied.toLocaleString()} from advance)` : ""}
                  </option>
                );
              })}
              <option value={OTHER_PURCHASE}>Other…</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Selecting a purchase fills in the amount, supplier, description and category below.
            </span>
          </label>
          {purchaseId === OTHER_PURCHASE && (
            <input
              value={purchaseOtherText}
              onChange={(e) => {
                setPurchaseOtherText(e.target.value);
                setDescription(e.target.value);
              }}
              placeholder="Describe the purchase"
              className={`mt-2 ${inputClass}`}
            />
          )}
        </div>
      )}

      {payeeType === "supplier" && !supplierCreate && (
        <>
          <div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Supplier</span>
              <select
                name={supplierId === OTHER_SUPPLIER ? undefined : "supplier_id"}
                className={selectClass}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="none">— select a supplier —</option>
                {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                <option value={OTHER_SUPPLIER}>Other…</option>
              </select>
            </label>
            {suppliers.length === 0 && supplierId === "none" && (
              <p className="mt-1 text-xs text-slate-500">
                No suppliers yet — pick <span className="font-medium">Other…</span> to type a new supplier name, or{" "}
                <Link href="/admin/suppliers" className="font-medium text-brand-700 hover:underline">add one first</Link>.
              </p>
            )}
            {supplierId === OTHER_SUPPLIER && (
              <input
                name="new_supplier_name"
                value={supplierOtherName}
                onChange={(e) => setSupplierOtherName(e.target.value)}
                placeholder="Enter supplier name"
                required
                className={`mt-2 ${inputClass}`}
              />
            )}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Description</span>
            <input
              name="description"
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </>
      )}

      {!(multiSelect && payeeType === "labour") && (
        <div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Work category</span>
            <select
              name={workCategory === OTHER_CATEGORY ? undefined : "work_category"}
              className={selectClass}
              value={workCategory}
              onChange={(e) => setWorkCategory(e.target.value)}
              required={!supplierCreate}
            >
              <option value="">— select category —</option>
              {WORK_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              {customCategories.length > 0 && (
                <optgroup label="Custom">
                  {customCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
                </optgroup>
              )}
              <option value={OTHER_CATEGORY}>Other…</option>
            </select>
          </label>
          {workCategory === OTHER_CATEGORY && (
            <input
              name="work_category"
              value={workCategoryOther}
              onChange={(e) => setWorkCategoryOther(e.target.value)}
              placeholder="Enter category"
              required
              className={`mt-2 ${inputClass}`}
            />
          )}
        </div>
      )}

      {!(multiSelect && payeeType === "labour") && (
        <div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Amount (₹)</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required={!multiSelect}
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {supplierCreate && (
            <>
              <input type="hidden" name="extra_mode" value={extraMode} />
              {extraAmount > 0 ? (
                <div className={`mt-2 rounded-lg border p-2 text-xs ${extraMode === "" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                  <p className="mb-1 text-slate-600">
                    ₹{extraAmount.toLocaleString()} is more than the selected purchases — where should it go?
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setExtraMode("advance")} className={`rounded-md border px-2 py-1 ${extraMode === "advance" ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>Advance (credit)</button>
                    <button type="button" onClick={() => setExtraMode("payment")} className={`rounded-md border px-2 py-1 ${extraMode === "payment" ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>Just a payment</button>
                  </div>
                  {extraMode === "" && <p className="mt-1 text-amber-700">Pick one — it won&apos;t be saved as credit unless you choose Advance.</p>}
                  {extraMode === "advance" && <p className="mt-1 text-slate-500">Adds ₹{extraAmount.toLocaleString()} of advance credit for this supplier.</p>}
                  {extraMode === "payment" && <p className="mt-1 text-slate-500">Records ₹{extraAmount.toLocaleString()} as paid, with no credit.</p>}
                </div>
              ) : extraAmount < 0 ? (
                <p className="mt-1 text-xs text-red-600">Amount is less than the selected purchases (₹{selectedNet.toLocaleString()}).</p>
              ) : null}
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {cancelHref && (
          <Link href={cancelHref} className="text-sm text-slate-600 hover:underline">Cancel</Link>
        )}
      </div>
    </form>
  );
}

export function CreatePaymentForm({
  action,
  projects,
  suppliers,
  labourers,
  materials,
  assignments,
  wageDue,
  supplierAccounts,
  defaultProjectId,
  fixedProject,
}: {
  action: (prevState: CreatePaymentState, fd: FormData) => Promise<CreatePaymentState>;
  projects: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  labourers: { id: string; name: string; familyId?: string | null; category?: string | null }[];
  materials: Material[];
  assignments: Assignment[];
  wageDue: Record<string, number>;
  supplierAccounts?: Record<string, SupplierAccount>;
  defaultProjectId?: string;
  fixedProject?: { id: string; name: string };
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(action, initialCreatePaymentState);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state.success) {
      setShowConfirm(true);
      setFormKey((k) => k + 1);
      router.refresh();
    }
  }, [state, router]);

  return (
    <CollapsibleForm label="Create payment" icon="payment">
      {state.error && <p className="mb-4 text-sm text-red-600">{state.error}</p>}
      <PaymentFormFields
        key={formKey}
        action={formAction}
        projects={projects}
        suppliers={suppliers}
        labourers={labourers}
        materials={materials}
        assignments={assignments}
        wageDue={wageDue}
        supplierAccounts={supplierAccounts}
        fixedProject={fixedProject}
        initial={{
          payeeType: "supplier",
          projectId: fixedProject?.id ?? defaultProjectId ?? "none",
          amount: "",
          supplierId: "none",
          labourerId: "none",
          description: "",
          workCategory: "",
        }}
        submitLabel="Create payment"
        allowMulti
      />
      <ConfirmPopup open={showConfirm} message="Payment(s) created." onClose={() => setShowConfirm(false)} />
    </CollapsibleForm>
  );
}

export function EditPaymentForm({
  action,
  projects,
  suppliers,
  labourers,
  materials,
  assignments,
  wageDue,
  paymentId,
  initial,
  cancelHref,
}: {
  action: (fd: FormData) => Promise<void>;
  projects: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  labourers: { id: string; name: string; familyId?: string | null; category?: string | null }[];
  materials: Material[];
  assignments: Assignment[];
  wageDue: Record<string, number>;
  paymentId: string;
  initial: Initial;
  cancelHref: string;
}) {
  return (
    <PaymentFormFields
      action={action}
      projects={projects}
      suppliers={suppliers}
      labourers={labourers}
      materials={materials}
      assignments={assignments}
      wageDue={wageDue}
      initial={initial}
      paymentId={paymentId}
      submitLabel="Save changes"
      cancelHref={cancelHref}
    />
  );
}
