import { requireRole } from "@/lib/guard";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireRole("client");
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {children}
    </div>
  );
}
