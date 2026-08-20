"use client";

import { useState } from "react";
import { Field, SubmitButton } from "@/components/admin/Page";

export function CreateClientForm({
  action,
  unlinkedProfiles,
}: {
  action: (fd: FormData) => Promise<void>;
  unlinkedProfiles: { id: string; full_name: string | null; email: string | null; phone: string | null }[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <form action={action} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Name</span>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Phone</span>
        <input
          name="phone"
          type="tel"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <Field label="Address" name="address" />
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Link to login (optional)</span>
        <select
          name="profile_id"
          defaultValue="none"
          onChange={(e) => {
            const profile = unlinkedProfiles.find((p) => p.id === e.target.value);
            if (profile) {
              setName(profile.full_name ?? "");
              setEmail(profile.email ?? "");
              setPhone(profile.phone ?? "");
            }
          }}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value="none">— none —</option>
          {unlinkedProfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <SubmitButton>Add client</SubmitButton>
      </div>
    </form>
  );
}
