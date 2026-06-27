import Link from "next/link";

export const metadata = {
  title: "Delete your account — Construction Manager",
  description: "How to delete your Construction Manager account and what data is removed.",
};

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">Delete your account</h1>
      <p className="mt-3 text-slate-700">
        You can delete your Construction Manager account at any time. Deletion is permanent and
        cannot be undone.
      </p>

      <h2 className="mt-8 text-xl font-semibold">How to delete in the app</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700">
        <li>Open the app (web or Android) and sign in.</li>
        <li>Go to your dashboard's <strong>Sign out</strong> menu / sidebar.</li>
        <li>
          Tap <strong>Delete account</strong> and confirm. Your login is removed immediately and you are
          signed out.
        </li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">What gets deleted</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>Your authentication record (email, password hash, session tokens).</li>
        <li>Your <code>profiles</code> row (name, role).</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">What is kept</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>
          Business records linked to you (the client, supplier, or labourer row, plus any projects,
          materials, payments, attendance, and project updates you were associated with).
        </li>
        <li>
          These records belong to the construction business that uses this app, not to you, and are
          retained for accounting and audit reasons. The records are <em>unlinked</em> from your
          login so they no longer identify you.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Need help?</h2>
      <p className="mt-3 text-slate-700">
        Contact the admin of your construction business directly. If you cannot reach them, email
        the developer (replace with your support email).
      </p>

      <div className="mt-10 flex gap-6">
        <Link href="/" className="text-slate-900 underline">← Back to sign in</Link>
        <Link href="/privacy" className="text-slate-900 underline">Privacy policy</Link>
      </div>
    </main>
  );
}
