import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, AdminContent, CostBox, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction, RowActions } from "@/components/admin/RowActions";
import { CollapsibleForm } from "@/components/admin/CollapsibleForm";
import {
  createPersonalTransaction,
  archivePersonalTransaction,
  unarchivePersonalTransaction,
  deletePersonalTransaction,
} from "../actions";
import { roundMoney } from "@/lib/money";

export default async function PersonalTransactionsPage(
  props: {
    searchParams: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // This is the owner's private income/expense ledger, not project data.
  // Managers have no business here — the sidebar hides it, and this guard
  // stops a manager reaching it by typing the URL. The RLS policy on
  // personal_transactions is narrowed to admins too (39_personal_admin_only),
  // so a manager querying the table directly gets zero rows either way.
  const { role } = await requireRole(["superadmin", "admin", "manager"]);
  if (role === "manager") redirect("/admin");

  const showArchived = searchParams.archived === "1";
  const supabase = await createSupabaseServerClient();

  const base = supabase
    .from("personal_transactions")
    .select("id, type, amount, description, occurred_at, archived_at")
    .order("occurred_at", { ascending: false });

  const [{ data: transactions }, { count: archivedCount }] = await Promise.all([
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.from("personal_transactions").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);

  const netBalance = roundMoney(
    (transactions ?? []).reduce(
      (sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)),
      0,
    ),
  );

  const rows =
    transactions?.map((t) => [
      t.occurred_at,
      t.type === "income" ? "Income" : "Expense",
      t.description ?? "—",
      `${t.type === "income" ? "+" : "-"}₹${Number(t.amount).toLocaleString()}`,
    ]) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived personal transactions" : "Personal transactions"}
        subtitle={
          showArchived
            ? "Hidden from your ledger. Never counted in project costs or reports."
            : "Your own income and expenses — separate from every project, never shown to clients or suppliers, never counted in cost/cash-flow reports."
        }
      />
      <AdminContent>

      {!showArchived && (
        <div className="mb-6 max-w-xs">
          <CostBox label="Net balance" value={netBalance} accent />
        </div>
      )}

      <div className="mb-6">
        <ArchivedToggle basePath="/admin/personal" showArchived={showArchived} archivedCount={archivedCount ?? 0} label="transactions" />
      </div>

      {!showArchived && (
        <CollapsibleForm label="Add transaction" icon="transaction">
        <form action={createPersonalTransaction} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Type" name="type" defaultValue="income">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>
          <Field label="Amount (₹)" name="amount" type="number" step="0.01" min="0" required />
          <Field label="Date" name="occurred_at" type="date" />
          <Field label="Description" name="description" />
          <div className="sm:col-span-2 lg:col-span-4">
            <SubmitButton>Add transaction</SubmitButton>
          </div>
        </form>
        </CollapsibleForm>
      )}

      <DataTable
        columns={["Date", "Type", "Description", "Amount"]}
        rows={rows}
        empty={showArchived ? "No archived transactions." : "No personal transactions yet."}
      />

      {transactions && transactions.length > 0 && (
        <ManageSection showArchived={showArchived}>
          {transactions.map((t) => (
            <ManageCard key={t.id} title={t.description || (t.type === "income" ? "Income" : "Expense")}>
              {showArchived ? (
                <div className="flex items-center gap-2">
                  <RestoreAction id={t.id} action={unarchivePersonalTransaction} />
                  <DeleteForeverButton id={t.id} name={t.description || "this transaction"} action={deletePersonalTransaction} />
                </div>
              ) : (
                <form action={archivePersonalTransaction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                  >
                    Archive
                  </button>
                </form>
              )}
            </ManageCard>
          ))}
        </ManageSection>
      )}
      </AdminContent>
    </AdminPage>
  );
}
