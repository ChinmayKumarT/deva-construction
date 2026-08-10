"use client";

// A file <input> that submits its parent <form> as soon as a file is picked.
// Split out as its own client component because the parent page (e.g. a
// project's admin detail page) is a server component and can't hold an
// onChange handler directly.
export function AutoSubmitFileInput({
  name,
  className,
  accept = "image/*",
}: {
  name: string;
  className?: string;
  accept?: string;
}) {
  return (
    <input
      type="file"
      accept={accept}
      name={name}
      className={className}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}
