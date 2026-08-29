import Image from "next/image";
import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { SignOutButton, DeleteAccountButton } from "@/components/AccountActions";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("supplier");
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {children}
      <footer className="border-t border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/icon.png" alt="" width={28} height={28} className="rounded-md" style={{ objectFit: "contain" }} />
            <div>
              <div className="text-sm font-semibold text-slate-700">Deva Construction</div>
              <div className="text-xs text-slate-400">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SignOutButton />
            <DeleteAccountButton />
          </div>
        </div>
      </footer>
    </div>
  );
}
