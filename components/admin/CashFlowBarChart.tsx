// Small hand-rolled SVG bar chart -- no charting library, mirrors PieChart.tsx's
// approach (fixed colors, no CSS vars) so it renders the same in the PDF export.

export type CashFlowBar = { label: string; value: number; color: string };

export function CashFlowBarChart({ bars, width = 500 }: { bars: CashFlowBar[]; width?: number }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const rowH = 40;
  const labelW = 120;
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
        return (
          <g key={b.label}>
            <text x={0} y={y + 18} fontSize="12" fill="#334155">{b.label}</text>
            <rect x={labelW} y={y + 6} width={Math.max(w, 2)} height={16} rx={3} fill={b.color} />
            <text x={labelW + w + 8} y={y + 18} fontSize="12" fill="#334155">
              {`₹${b.value.toLocaleString()}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
