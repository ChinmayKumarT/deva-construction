"use client";

import { useFormStatus } from "react-dom";

// Guards every form that uses this against double-submit: without it, a
// second click before the Server Action round-trip finishes re-fires the
// same insert, producing duplicate rows (materials, payments -- anything
// created here). useFormStatus only reports the nearest ancestor <form>'s
// pending state, so this must render as a child of the <form>, not the
// component that renders the form itself.
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={
        "rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition " +
        (pending ? "opacity-60 cursor-not-allowed" : "hover:bg-brand-700 active:bg-brand-800")
      }
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
