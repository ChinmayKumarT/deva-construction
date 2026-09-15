"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

// The one submit button for the whole app. It guards every form against
// double-submit: while the Server Action round-trip is in flight it disables
// itself and shows a loading label, so a second click can't re-fire the same
// insert (duplicate materials, payments, advances -- anything created here).
//
// A drop-in for a plain <button type="submit">: it forwards every native
// button prop (title, name, value, formAction, aria-*, onClick...), so any
// existing submit button becomes safe just by swapping the tag. useFormStatus
// only reports the nearest ancestor <form>'s state, so this must render as a
// child of the <form>, not the component that renders the form.
//
// pendingLabel is what shows while loading (default "Loading…"). For an
// icon-only button pass a short one like "…" so it doesn't overflow.
export function FormSubmitButton({
  children,
  pendingLabel,
  className = "",
  disabled,
  ...rest
}: ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={className + (pending ? " opacity-60 cursor-not-allowed" : "")}
    >
      {pending ? (pendingLabel ?? "Loading…") : children}
    </button>
  );
}
