// Cumulative running-total outflow over the selected date range, as a filled
// line chart. Complements CashFlowBarChart's category totals (a snapshot)
// with the one thing a snapshot can't show: whether spend is front-loaded,
// steady, or spiking. Hand-rolled SVG, same convention as PieChart.tsx /
// CashFlowBarChart.tsx -- no charting library, fixed colors (no CSS vars).

const LINE = "#635bff";
const FILL = "#635bff1a";
const AXIS = "#94A3B8";

export function CashFlowTrendChart({
  daily,
  width = 700,
  height = 220,
}: {
  daily: { date: string; total: number }[];
  width?: number;
  height?: number;
}) {
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  let running = 0;
  const cumulative = daily.map((d) => {
    running += d.total;
    return { date: d.date, total: running };
  });

  const max = Math.max(...cumulative.map((d) => d.total), 1);
  const n = Math.max(cumulative.length - 1, 1);
  const x = (i: number) => padL + (i / n) * plotW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const linePoints = cumulative.map((d, i) => `${x(i)},${y(d.total)}`).join(" ");
  const areaPoints = `${padL},${padT + plotH} ${linePoints} ${padL + plotW},${padT + plotH}`;

  // First, middle, last date labels -- enough to orient without cluttering
  // a range that could span anywhere from a week to a year.
  const labelIdx = [0, Math.floor(n / 2), n].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <svg
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 0.5, 1].map((frac) => {
        const gy = padT + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke="#E2E8F0" strokeWidth={1} />
            <text x={padL - 8} y={gy + 4} fontSize="10" fill={AXIS} textAnchor="end">
              {`₹${Math.round(max * frac).toLocaleString()}`}
            </text>
          </g>
        );
      })}

      <polygon points={areaPoints} fill={FILL} />
      <polyline points={linePoints} fill="none" stroke={LINE} strokeWidth={2} />

      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={height - 8} fontSize="10" fill={AXIS} textAnchor="middle">
          {cumulative[i]?.date.slice(5) /* MM-DD */}
        </text>
      ))}
    </svg>
  );
}
