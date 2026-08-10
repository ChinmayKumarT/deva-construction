"use client";

// Client-side PDF export for the Reports section. Charts are drawn onto an
// offscreen <canvas> (same colors as PieChart.tsx) and embedded as images,
// so the PDF mirrors what's on screen instead of being a bare text dump.

const BRAND = "#16a34a";
const SPEND = "#F59E0B";
const TRACK = "#E2E8F0";
const OVER_BUDGET = "#DC2626";

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function drawPie(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  slices: { fraction: number; color: string }[],
) {
  const total = Math.max(slices.reduce((s, x) => s + x.fraction, 0), 0.0001);
  let angle = -Math.PI / 2;
  for (const s of slices) {
    if (s.fraction <= 0) continue;
    const sweep = (s.fraction / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    angle += sweep;
  }
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  items: { label: string; color: string }[],
) {
  ctx.font = "13px Arial";
  items.forEach((it, i) => {
    const ly = y + i * 20;
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(x + 6, ly, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.fillText(it.label, x + 18, ly + 4);
  });
}

function siteChartImage(completionPct: number, budget: number, spent: number) {
  const spendPct = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;
  const overBudget = budget > 0 && spent > budget;

  const c = makeCanvas(560, 200);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.font = "bold 13px Arial";
  ctx.fillStyle = "#334155";
  ctx.fillText("Completion vs remaining work", 20, 20);
  drawPie(ctx, 90, 110, 65, [
    { fraction: completionPct / 100, color: BRAND },
    { fraction: 1 - completionPct / 100, color: TRACK },
  ]);
  ctx.font = "12px Arial";
  ctx.fillText(`${completionPct.toFixed(0)}% complete`, 45, 190);

  ctx.font = "bold 13px Arial";
  ctx.fillText("Budget vs spent", 300, 20);
  if (overBudget) {
    drawPie(ctx, 370, 110, 65, [{ fraction: 1, color: OVER_BUDGET }]);
  } else {
    drawPie(ctx, 370, 110, 65, [
      { fraction: spendPct / 100, color: SPEND },
      { fraction: 1 - spendPct / 100, color: TRACK },
    ]);
  }
  drawLegend(ctx, 460, 85, [
    { label: "Spend", color: overBudget ? OVER_BUDGET : SPEND },
    { label: "Remaining", color: TRACK },
  ]);
  ctx.font = "12px Arial";
  ctx.fillText(
    overBudget ? "Over budget" : `${spendPct.toFixed(0)}% of budget spent`,
    310,
    190,
  );

  return c.toDataURL("image/png");
}

function summaryBarChartImage(
  sites: { name: string; budget: number; spent: number }[],
) {
  const rowH = 34;
  const top = 40;
  const c = makeCanvas(560, top + rowH * Math.max(sites.length, 1) + 20);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.font = "bold 13px Arial";
  ctx.fillStyle = "#334155";
  ctx.fillText("Budget vs spent by site", 20, 20);
  drawLegend(ctx, 380, -4, [
    { label: "Budget", color: TRACK },
    { label: "Spent", color: BRAND },
  ]);

  const maxVal = Math.max(...sites.map((s) => Math.max(s.budget, s.spent)), 1);
  const barMaxW = 300;
  const labelX = 20;
  const barX = 170;

  sites.forEach((s, i) => {
    const y = top + i * rowH;
    ctx.font = "12px Arial";
    ctx.fillStyle = "#334155";
    const label = s.name.length > 22 ? s.name.slice(0, 21) + "…" : s.name;
    ctx.fillText(label, labelX, y + 14);

    const budgetW = (s.budget / maxVal) * barMaxW;
    const spentW = (s.spent / maxVal) * barMaxW;
    const overBudget = s.budget > 0 && s.spent > s.budget;

    ctx.fillStyle = TRACK;
    ctx.fillRect(barX, y, budgetW, 10);
    ctx.fillStyle = overBudget ? OVER_BUDGET : BRAND;
    ctx.fillRect(barX, y + 14, spentW, 10);
  });

  return c.toDataURL("image/png");
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

async function buildPdf() {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  return { doc: new jsPDF({ unit: "pt", format: "a4" }), autoTable };
}

function header(doc: any, title: string, subtitle?: string) {
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 40, 58);
    doc.setTextColor(0);
  }
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, doc.internal.pageSize.getHeight() - 20);
  doc.setTextColor(0);
}

export async function downloadSitePdf(site: {
  name: string;
  status: string;
  completionPct: number;
  budget: number;
  spent: number;
  detail: {
    client: string | null;
    address: string | null;
    stage: string | null;
    startDate: string | null;
    endDate: string | null;
    extended: boolean;
    originalEndDate: string | null;
    extensionReason: string | null;
  };
  transactions: { date: string; type: string; description: string; amount: number; status: string }[];
  updates: { stage: string | null; note: string | null; date: string; imageUrl: string | null }[];
}) {
  const { doc, autoTable } = await buildPdf();
  header(doc, site.name, `Status: ${site.status}`);

  doc.setFontSize(10);
  doc.setTextColor(60);
  const d = site.detail;
  const detailLines = [
    d.client ? `Client: ${d.client}` : null,
    d.address ? `Address: ${d.address}` : null,
    d.stage ? `Current stage: ${d.stage}` : null,
    d.endDate ? `Finish date: ${d.endDate}${d.extended ? ` (extended from ${d.originalEndDate}${d.extensionReason ? " · " + d.extensionReason : ""})` : ""}` : null,
  ].filter(Boolean) as string[];
  detailLines.forEach((line, i) => doc.text(line, 40, 68 + i * 13));
  doc.setTextColor(0);

  const chartsY = 68 + detailLines.length * 13 + 12;
  const img = siteChartImage(site.completionPct, site.budget, site.spent);
  doc.addImage(img, "PNG", 40, chartsY, 500, 178);

  doc.setFontSize(11);
  const summaryY = chartsY + 195;
  doc.text(
    `Budget Rs ${site.budget.toLocaleString()}  ·  Spent Rs ${site.spent.toLocaleString()}  ·  Remaining Rs ${Math.max(site.budget - site.spent, 0).toLocaleString()}`,
    40,
    summaryY,
  );

  doc.setFontSize(12);
  doc.text(`Transactions (${site.transactions.length})`, 40, summaryY + 20);
  autoTable(doc, {
    startY: summaryY + 28,
    head: [["Type", "Description", "Date", "Status", "Amount"]],
    body: site.transactions.map((t) => [
      t.type,
      t.description,
      t.date,
      t.status,
      `Rs ${t.amount.toLocaleString()}`,
    ]),
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  if (site.updates.length > 0) {
    let y = (doc as any).lastAutoTable.finalY + 24;
    const pageH = doc.internal.pageSize.getHeight();
    if (y > pageH - 60) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(12);
    doc.text(`Recent updates (${site.updates.length})`, 40, y);
    y += 16;

    for (const u of site.updates) {
      const textLines = [
        [u.stage, u.date].filter(Boolean).join(" · "),
        u.note ? u.note : null,
      ].filter(Boolean) as string[];
      const neededForText = textLines.length * 13 + 6;

      if (y + neededForText > pageH - 40) {
        doc.addPage();
        y = 50;
      }
      doc.setFontSize(10);
      doc.setTextColor(30);
      textLines.forEach((line, i) => doc.text(line.slice(0, 100), 40, y + i * 13));
      doc.setTextColor(0);
      y += neededForText;

      if (u.imageUrl) {
        const dataUrl = await fetchImageDataUrl(u.imageUrl);
        if (dataUrl) {
          const { w, h } = await imageDims(dataUrl);
          const maxW = 180;
          const maxH = 135;
          let dw = maxW;
          let dh = (h / w) * dw;
          if (dh > maxH) {
            dh = maxH;
            dw = (w / h) * dh;
          }
          if (y + dh > pageH - 40) {
            doc.addPage();
            y = 50;
          }
          try {
            doc.addImage(dataUrl, 40, y, dw, dh);
          } catch {
            // Unsupported image format (e.g. some HEIC/webp) -- skip silently.
          }
          y += dh + 16;
        }
      } else {
        y += 8;
      }
    }
  }

  doc.save(`${site.name.replace(/[^a-z0-9]+/gi, "-")}-report.pdf`);
}

export async function downloadSummaryPdf(data: {
  sites: { name: string; status: string; completionPct: number; budget: number; spent: number }[];
  labour: { name: string; days: string; earn: string }[];
}) {
  const { doc, autoTable } = await buildPdf();
  header(doc, "Reports summary", "All sites");

  const img = summaryBarChartImage(data.sites);
  const imgHeight = (img && data.sites.length > 0) ? 40 + data.sites.length * 34 + 20 : 100;
  doc.addImage(img, "PNG", 40, 75, 500, Math.min(imgHeight, 500) * (500 / 560));

  const afterChartY = 75 + Math.min(imgHeight, 500) * (500 / 560) + 20;

  autoTable(doc, {
    startY: afterChartY,
    head: [["Site", "Status", "Completion", "Budget", "Spent"]],
    body: data.sites.map((s) => [
      s.name,
      s.status,
      `${s.completionPct.toFixed(1)}%`,
      `Rs ${s.budget.toLocaleString()}`,
      `Rs ${s.spent.toLocaleString()}`,
    ]),
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  const afterSites = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(12);
  doc.text("Labour: last 7 days", 40, afterSites);
  autoTable(doc, {
    startY: afterSites + 10,
    head: [["Labourer", "Days worked", "Wages earned"]],
    body: data.labour.map((l) => [l.name, l.days, l.earn]),
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  doc.save("reports-summary.pdf");
}

export function DownloadSitePdfButton({
  site,
}: {
  site: Parameters<typeof downloadSitePdf>[0];
}) {
  return (
    <button
      type="button"
      onClick={() => downloadSitePdf(site)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
    >
      Download PDF
    </button>
  );
}

export function DownloadSummaryPdfButton({
  data,
}: {
  data: Parameters<typeof downloadSummaryPdf>[0];
}) {
  return (
    <button
      type="button"
      onClick={() => downloadSummaryPdf(data)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
    >
      Download PDF
    </button>
  );
}

function cashFlowChartImage(bars: { label: string; value: number; color: string }[]) {
  const rowH = 40;
  const top = 30;
  const c = makeCanvas(560, top + rowH * bars.length + 10);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.font = "bold 13px Arial";
  ctx.fillStyle = "#334155";
  ctx.fillText("Outflow by category", 20, 20);

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const barMaxW = 300;
  const labelX = 20;
  const barX = 170;

  bars.forEach((b, i) => {
    const y = top + i * rowH;
    ctx.font = "12px Arial";
    ctx.fillStyle = "#334155";
    ctx.fillText(b.label, labelX, y + 14);
    const w = (b.value / maxVal) * barMaxW;
    ctx.fillStyle = b.color;
    ctx.fillRect(barX, y, Math.max(w, 2), 16);
    ctx.fillText(`Rs ${b.value.toLocaleString()}`, barX + w + 8, y + 14);
  });

  return c.toDataURL("image/png");
}

export async function downloadCashFlowPdf(data: {
  from: string;
  to: string;
  bars: { label: string; value: number; color: string }[];
  total: number;
  projects: { name: string; materials: number; labour: number; wages: number }[];
}) {
  const { doc, autoTable } = await buildPdf();
  header(doc, "Cash flow", `${data.from} to ${data.to}`);

  const img = cashFlowChartImage(data.bars);
  const imgHeight = (30 + data.bars.length * 40 + 10) * (500 / 560);
  doc.addImage(img, "PNG", 40, 75, 500, imgHeight);

  doc.setFontSize(11);
  doc.text(`Total outflow: Rs ${data.total.toLocaleString()}`, 40, 75 + imgHeight + 20);

  autoTable(doc, {
    startY: 75 + imgHeight + 35,
    head: [["Project", "Materials", "Labour payments", "Wages (attendance)", "Total"]],
    body: data.projects.map((p) => [
      p.name,
      `Rs ${p.materials.toLocaleString()}`,
      `Rs ${p.labour.toLocaleString()}`,
      `Rs ${p.wages.toLocaleString()}`,
      `Rs ${(p.materials + p.labour + p.wages).toLocaleString()}`,
    ]),
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  doc.save(`cash-flow-${data.from}-to-${data.to}.pdf`);
}

export function DownloadCashFlowPdfButton({
  data,
}: {
  data: Parameters<typeof downloadCashFlowPdf>[0];
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCashFlowPdf(data)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
    >
      Download PDF
    </button>
  );
}

function attendanceChartImage(bars: { label: string; value: number }[]) {
  const rowH = 34;
  const top = 30;
  const c = makeCanvas(560, top + rowH * Math.max(bars.length, 1) + 10);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.font = "bold 13px Arial";
  ctx.fillStyle = "#334155";
  ctx.fillText("Wages earned by labourer", 20, 20);

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const barMaxW = 300;
  const labelX = 20;
  const barX = 170;

  bars.forEach((b, i) => {
    const y = top + i * rowH;
    ctx.font = "12px Arial";
    ctx.fillStyle = "#334155";
    const label = b.label.length > 22 ? b.label.slice(0, 21) + "…" : b.label;
    ctx.fillText(label, labelX, y + 14);
    const w = (b.value / maxVal) * barMaxW;
    ctx.fillStyle = BRAND;
    ctx.fillRect(barX, y, Math.max(w, 2), 16);
    ctx.fillText(`Rs ${b.value.toLocaleString()}`, barX + w + 8, y + 14);
  });

  return c.toDataURL("image/png");
}

export async function downloadAttendancePdf(data: {
  from: string;
  to: string;
  labourers: {
    name: string;
    category: string | null;
    present: number;
    halfDay: number;
    absent: number;
    daysWorked: number;
    wages: number;
  }[];
}) {
  const { doc, autoTable } = await buildPdf();
  header(doc, "Attendance summary", `${data.from} to ${data.to}`);

  const bars = data.labourers.map((l) => ({ label: l.name, value: l.wages }));
  const img = attendanceChartImage(bars);
  const imgHeight = (30 + Math.max(bars.length, 1) * 34 + 10) * (500 / 560);
  doc.addImage(img, "PNG", 40, 75, 500, imgHeight);

  autoTable(doc, {
    startY: 75 + imgHeight + 20,
    head: [["Labourer", "Category", "Present", "Half day", "Absent", "Days worked", "Wages earned"]],
    body: data.labourers.map((l) => [
      l.name,
      l.category ?? "—",
      l.present,
      l.halfDay,
      l.absent,
      l.daysWorked,
      `Rs ${l.wages.toLocaleString()}`,
    ]),
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  doc.save(`attendance-${data.from}-to-${data.to}.pdf`);
}

export function DownloadAttendancePdfButton({
  data,
}: {
  data: Parameters<typeof downloadAttendancePdf>[0];
}) {
  return (
    <button
      type="button"
      onClick={() => downloadAttendancePdf(data)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
    >
      Download PDF
    </button>
  );
}
