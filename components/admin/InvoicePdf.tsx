"use client";

const BRAND = "#16A34A";
const BRAND_LIGHT = "#F0FDF4";

async function buildPdf() {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  return { doc: new jsPDF({ unit: "pt", format: "a4" }), autoTable };
}

export type InvoiceData = {
  invoiceNo: string;
  date: string;
  project: { name: string; address: string | null };
  client: { name: string; email: string | null; phone: string | null } | null;
  materials: { name: string; qty: number; unit: string; unitCost: number; total: number }[];
  labourPayments: { description: string; amount: number }[];
  changeOrders: { description: string; amount: number }[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
};

export async function downloadInvoicePdf(inv: InvoiceData) {
  const { doc, autoTable } = await buildPdf();
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, pageW, 80, "F");

  doc.setTextColor(255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("DEVA CONSTRUCTION", 40, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Bangalore, Karnataka, India", 40, 50);
  doc.text("thedeva.co@gmail.com", 40, 62);

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageW - 40, 35, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`#${inv.invoiceNo}`, pageW - 40, 50, { align: "right" });
  doc.text(`Date: ${inv.date}`, pageW - 40, 62, { align: "right" });

  doc.setTextColor(0);
  let y = 100;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74);
  doc.text("BILL TO", 40, y);
  doc.text("PROJECT", pageW / 2, y);
  doc.setTextColor(60);
  doc.setFont("helvetica", "normal");
  y += 14;
  if (inv.client) {
    doc.text(inv.client.name, 40, y);
    if (inv.client.email) doc.text(inv.client.email, 40, y + 12);
    if (inv.client.phone) doc.text(inv.client.phone, 40, y + 24);
  } else {
    doc.text("—", 40, y);
  }
  doc.text(inv.project.name, pageW / 2, y);
  if (inv.project.address) doc.text(inv.project.address, pageW / 2, y + 12);

  y += 48;
  doc.setDrawColor(230);
  doc.line(40, y, pageW - 40, y);
  y += 16;

  if (inv.materials.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Materials", 40, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Qty", "Unit", "Rate", "Amount"]],
      body: inv.materials.map((m, i) => [
        i + 1,
        m.name,
        m.qty.toLocaleString(),
        m.unit,
        `Rs ${m.unitCost.toLocaleString()}`,
        `Rs ${m.total.toLocaleString()}`,
      ]),
      headStyles: { fillColor: [22, 163, 74], fontSize: 9 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 30 }, 5: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  if (inv.labourPayments.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Labour Payments", 40, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["#", "Description", "Amount"]],
      body: inv.labourPayments.map((l, i) => [
        i + 1,
        l.description || "Labour payment",
        `Rs ${l.amount.toLocaleString()}`,
      ]),
      headStyles: { fillColor: [22, 163, 74], fontSize: 9 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 30 }, 2: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  if (inv.changeOrders.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Change Orders", 40, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["#", "Description", "Amount"]],
      body: inv.changeOrders.map((c, i) => [
        i + 1,
        c.description,
        `Rs ${c.amount.toLocaleString()}`,
      ]),
      headStyles: { fillColor: [22, 163, 74], fontSize: 9 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 30 }, 2: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 180) {
    doc.addPage();
    y = 50;
  }

  const summaryX = pageW - 240;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);

  const rows = [
    ["Subtotal", `Rs ${inv.subtotal.toLocaleString()}`],
    [`GST (${inv.gstRate}%)`, `Rs ${inv.gstAmount.toLocaleString()}`],
  ];
  rows.forEach(([label, val], i) => {
    doc.text(label, summaryX, y + i * 18);
    doc.text(val, pageW - 40, y + i * 18, { align: "right" });
  });

  y += rows.length * 18 + 4;
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(1.5);
  doc.line(summaryX, y, pageW - 40, y);
  y += 16;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Grand Total", summaryX, y);
  doc.text(`Rs ${inv.grandTotal.toLocaleString()}`, pageW - 40, y, { align: "right" });

  y += 22;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text("Amount Paid", summaryX, y);
  doc.text(`Rs ${inv.amountPaid.toLocaleString()}`, pageW - 40, y, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(inv.amountDue > 0 ? 220 : 22, inv.amountDue > 0 ? 38 : 163, inv.amountDue > 0 ? 38 : 74);
  doc.text("Amount Due", summaryX, y);
  doc.text(`Rs ${inv.amountDue.toLocaleString()}`, pageW - 40, y, { align: "right" });

  y += 36;
  if (y < pageH - 60) {
    doc.setDrawColor(230);
    doc.line(40, y, pageW - 40, y);
    y += 16;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130);
    doc.text("Thank you for your business.", 40, y);
    doc.text("Deva Construction · Bangalore, India", 40, y + 12);
  }

  doc.save(`Invoice-${inv.invoiceNo}.pdf`);
}

export function DownloadInvoiceButton({ data }: { data: InvoiceData }) {
  return (
    <button
      type="button"
      onClick={() => downloadInvoicePdf(data)}
      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
    >
      Generate Invoice
    </button>
  );
}
