import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import BackupButton from "@/components/admin/BackupButton";
import BackupLog from "@/components/admin/BackupLog";

export default async function BackupPage() {
  const { isOwner } = await requireRole(["admin", "manager"]);
  if (!isOwner) redirect("/admin");

  return (
    <AdminPage>
      <AdminPageHeader
        title="Backup"
        subtitle="Download a full backup of all your business data."
      />
      <div className="space-y-4 px-1">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
          <h3 className="font-semibold text-sm">What&apos;s included</h3>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-4">
            <li>Projects, clients, suppliers, and labourers</li>
            <li>All payments, materials, and change orders</li>
            <li>Attendance records and project updates</li>
            <li>Personal transactions</li>
            <li>List of all uploaded images (URLs)</li>
          </ul>
        </div>
        <BackupButton />
        <Suspense fallback={
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="font-semibold text-sm mb-3">Backup log</h3>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-[var(--hover)] animate-pulse" />
              ))}
            </div>
          </div>
        }>
          <BackupLog />
        </Suspense>
      </div>
    </AdminPage>
  );
}
