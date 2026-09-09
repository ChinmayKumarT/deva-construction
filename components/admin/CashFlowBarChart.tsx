// Small hand-rolled SVG bar chart -- no charting library, mirrors PieChart.tsx's
// approach (fixed colors, no CSS vars) so it renders the same in the PDF export.

export type CashFlowBar = { label: string; value: number; color: string };

const FONT_SIZE = 12;
// SVG text has no ellipsis, and measuring needs a DOM we don't have during the
// PDF export -- so estimate from an average glyph width for the label font.
const CHAR_W = FONT_SIZE * 0.55;

function truncate(label: string, maxW: number) {
  const maxChars = Math.floor(maxW / CHAR_W);
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(maxChars - 1, 1)).trimEnd()}…`;
}

export function CashFlowBarChart({ bars, width = 500 }: { bars: CashFlowBar[]; width?: number }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const rowH = 40;
  const labelW = 120;
  const labelGap = 8;
  const barMaxW = width - labelW - 90;
  const height = bars.length * rowH + 10;

  return (
    <svg
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {bars.map((b, i) => {
        const y = i * rowH;
        const w = (b.value / max) * barMaxW;
        const shown = truncate(b.label, labelW - labelGap);
        return (
          <g key={b.label}>
            <text x={0} y={y + 18} fontSize={FONT_SIZE} fill="#334155">
              {shown !== b.label && <title>{b.label}</title>}
              {shown}
            </text>
            <rect x={labelW} y={y + 6} width={Math.max(w, 2)} height={16} rx={3} fill={b.color} />
            <text x={labelW + w + 8} y={y + 18} fontSize={FONT_SIZE} fill="#334155">
              {`₹${b.value.toLocaleString()}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
