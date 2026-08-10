"use client";

// A confirmation shown in-page (fixed overlay, not the browser's native
// window.confirm/alert) so it matches the rest of the UI and works the same
// in every browser.
export function ConfirmPopup({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
        <p className="text-sm font-medium text-ink">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          OK
        </button>
      </div>
    </div>
  );
}
