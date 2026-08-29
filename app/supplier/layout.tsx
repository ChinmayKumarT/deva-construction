import { requireRole } from "@/lib/guard";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  await requireRole("supplier");
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {children}
    </div>
  );
}
