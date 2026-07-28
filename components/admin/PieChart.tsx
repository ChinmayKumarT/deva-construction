// Small hand-rolled SVG pie chart -- no charting library, mirrors the Canvas
// drawArc approach in the Android app's ui/Charts.kt for visual parity.

export type PieSlice = { fraction: number; color: string };

const CX = 50;
const CY = 50;
const R = 48;

function polarToCartesian(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

export function PieChart({ slices, size = 64 }: { slices: PieSlice[]; size?: number }) {
  const total = Math.max(
    slices.reduce((sum, s) => sum + s.fraction, 0),
    0.0001,
  );
  let angle = 0;
  const arcs = slices
    .filter((s) => s.fraction > 0)
    .map((s, i) => {
      const sweep = (s.fraction / total) * 360;
      const start = polarToCartesian(angle);
      const end = polarToCartesian(angle + sweep);
      const largeArc = sweep > 180 ? 1 : 0;
      const path =
        sweep >= 359.999
          ? `M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX - 0.01} ${CY - R} Z`
          : `M ${CX} ${CY} L ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
      angle += sweep;
      return <path key={i} d={path} fill={s.color} />;
    });

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {arcs}
    </svg>
  );
}

export function PieLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
