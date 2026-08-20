"use client";

import { useFormStatus } from "react-dom";

// Same double-submit guard as components/admin/SubmitButton.tsx, for forms
// outside /admin that need their own visual style. Must render as a child of
// the <form> -- useFormStatus only reports the nearest ancestor form's state.
export function FormSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className + (pending ? " opacity-60 cursor-not-allowed" : "")}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
