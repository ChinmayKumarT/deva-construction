"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";

// Clears a form's fields after a successful submit -- without this, a
// plain <form action={...}> keeps whatever the user typed sitting in its
// (uncontrolled) inputs after the request finishes, so clicking the submit
// button again resubmits the exact same data as a brand-new row. Remounting
// via `key` is the standard way to reset a form full of uncontrolled inputs
// without hand-wiring useState + onChange for every field.
export function ResettableForm<S extends { success: boolean }>({
  action,
  initialState,
  children,
  className,
  encType,
}: {
  action: (prevState: S, fd: FormData) => Promise<S>;
  initialState: S;
  children: (state: S) => ReactNode;
  className?: string;
  encType?: string;
}) {
  const [formKey, setFormKey] = useState(0);
  // useActionState's generic can't resolve Awaited<S> for an abstract S here
  // (a known TS limitation with this hook's overloads) -- the runtime
  // behavior is exactly the documented (action, initialState) => [state,
  // dispatch] shape, so the cast is safe.
  const [state, formAction] = useActionState(
    action as (state: Awaited<S>, payload: FormData) => S | Promise<S>,
    initialState as Awaited<S>,
  ) as unknown as [S, (payload: FormData) => void, boolean];

  useEffect(() => {
    if (state.success) setFormKey((k) => k + 1);
  }, [state]);

  return (
    <form key={formKey} action={formAction} className={className} encType={encType}>
      {children(state)}
    </form>
  );
}
