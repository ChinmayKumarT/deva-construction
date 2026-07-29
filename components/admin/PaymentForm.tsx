"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/admin/Page";
import { WORK_CATEGORIES } from "@/lib/workCategories";

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
};

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
  initial,
  paymentId,
  submitLabel,
  cancelHref,
}: {
  action: (fd: FormData) => Promise<void>;
  projects: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  labourers: { id: string; name: string }[];
  materials: Material[];
  initial: Initial;
  paymentId?: string;
  submitLabel: string;
  cancelHref?: string;
}) {
  const [projectId, setProjectId] = useState(initial.projectId);
  const [purchaseId, setPurchaseId] = useState("none");
  const [payeeType, setPayeeType] = useState(initial.payeeType);
  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [labourerId, setLabourerId] = useState(initial.labourerId);
  const [amount, setAmount] = useState(initial.amount);
  const [description, setDescription] = useState(initial.description);
  const [workCategory, setWorkCategory] = useState(initial.workCategory);

  const projectMaterials = useMemo(
    () => materials.filter((m) => projectId !== "none" && m.project_id === projectId),
    [materials, projectId],
  );

  function handleProjectChange(id: string) {
    setProjectId(id);
    setPurchaseId("none");
  }

  function handlePurchaseChange(id: string) {
    setPurchaseId(id);
    if (id === "none") return;
    const m = materials.find((x) => x.id === id);
    if (!m) return;
    setPayeeType("supplier");
    setSupplierId(m.supplier_id ?? "none");
    setAmount(String(Number(m.quantity) * Number(m.unit_cost)));
    setDescription(`${m.name} (${m.quantity} ${m.unit})`);
    setWorkCategory(m.work_category ?? "");
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

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Purchase (optional)</span>
        <select
          className={selectClass}
          value={purchaseId}
          onChange={(e) => handlePurchaseChange(e.target.value)}
          disabled={projectId === "none"}
        >
          <option value="none">
            {projectId === "none" ? "— choose a project first —" : "— none —"}
          </option>
          {projectMaterials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({Number(m.quantity)} {m.unit}) — ₹{(Number(m.quantity) * Number(m.unit_cost)).toLocaleString()}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          Selecting a purchase fills in the amount, supplier, description and category below.
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Amount (₹)</span>
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          className={inputClass}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Supplier</span>
        <select
          name="supplier_id"
          className={selectClass}
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <option value="none">— if labour, leave —</option>
          {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Labourer</span>
        <select
          name="labourer_id"
          className={selectClass}
          value={labourerId}
          onChange={(e) => setLabourerId(e.target.value)}
        >
          <option value="none">— if supplier, leave —</option>
          {labourers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Description</span>
        <input
          name="description"
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Work category</span>
        <select
          name="work_category"
          className={selectClass}
          value={workCategory}
          onChange={(e) => setWorkCategory(e.target.value)}
        >
          <option value="">— none —</option>
          {WORK_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </label>

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
  defaultProjectId,
}: {
  action: (fd: FormData) => Promise<void>;
  projects: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  labourers: { id: string; name: string }[];
  materials: Material[];
  defaultProjectId: string;
}) {
  return (
    <PaymentFormFields
      action={action}
      projects={projects}
      suppliers={suppliers}
      labourers={labourers}
      materials={materials}
      initial={{
        payeeType: "supplier",
        projectId: defaultProjectId,
        amount: "",
        supplierId: "none",
        labourerId: "none",
        description: "",
        workCategory: "",
      }}
      submitLabel="Create payment"
    />
  );
}

export function EditPaymentForm({
  action,
  projects,
  suppliers,
  labourers,
  materials,
  paymentId,
  initial,
  cancelHref,
}: {
  action: (fd: FormData) => Promise<void>;
  projects: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  labourers: { id: string; name: string }[];
  materials: Material[];
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
      initial={initial}
      paymentId={paymentId}
      submitLabel="Save changes"
      cancelHref={cancelHref}
    />
  );
}
