// Sparse dot-grid texture accent -- used behind blob shapes as a restrained
// background detail, not a full-page background (matching the reference's
// usage: a small patch, not wallpaper).
export function DottedPattern({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    />
  );
}
