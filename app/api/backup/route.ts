import { NextRequest, NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/supabase/server";
import { generateFullBackup, type BackupResult } from "@/lib/backup";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}

type Row = Record<string, unknown>;

function buildLookup(rows: Row[], key = "id", label = "name") {
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r[key] && r[label]) map[String(r[key])] = String(r[label]);
  }
  return map;
}

function fmtDate(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function fmtDateTime(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  if (s.length >= 16) return s.slice(0, 10) + " " + s.slice(11, 16);
  return s;
}

function money(v: unknown): string {
  if (v == null) return "";
  return `₹${Number(v).toLocaleString("en-IN")}`;
}

function yesNo(v: unknown): string {
  return v ? "Yes" : "No";
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function resolve(v: unknown, lookup: Record<string, string>): string {
  if (!v) return "";
  return lookup[String(v)] ?? String(v);
}

function buildReadableSheets(backup: BackupResult) {
  const projects = buildLookup(backup.tables.projects);
  const clients = buildLookup(backup.tables.clients);
  const suppliers = buildLookup(backup.tables.suppliers);
  const labourers = buildLookup(backup.tables.labourers);
  const profiles = buildLookup(backup.tables.profiles, "id", "full_name");

  const sheets: { name: string; data: Row[] }[] = [];

  sheets.push({
    name: "Projects",
    data: backup.tables.projects.map(r => ({
      "Project Name": r.name,
      "Client": resolve(r.client_id, clients),
      "Address": r.address ?? "",
      "Status": titleCase(String(r.status ?? "")),
      "Stage": r.current_stage ?? "",
      "Start Date": fmtDate(r.start_date),
      "End Date": fmtDate(r.end_date),
      "Total Cost": money(r.total_cost),
      "Completion %": r.completion_pct != null ? `${r.completion_pct}%` : "",
      "Next Payment Date": fmtDate(r.next_payment_date),
      "Next Payment Amount": r.next_payment_amount ? money(r.next_payment_amount) : "",
      "Created": fmtDate(r.created_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Clients",
    data: backup.tables.clients.map(r => ({
      "Name": r.name,
      "Email": r.email ?? "",
      "Phone": r.phone ?? "",
      "Address": r.address ?? "",
      "Created": fmtDate(r.created_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Suppliers",
    data: backup.tables.suppliers.map(r => ({
      "Name": r.name,
      "Email": r.email ?? "",
      "Phone": r.phone ?? "",
      "Address": r.address ?? "",
      "Created": fmtDate(r.created_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Labourers",
    data: backup.tables.labourers.map(r => ({
      "Name": r.name,
      "Phone": r.phone ?? "",
      "Category": r.category ?? "",
      "Daily Wage": money(r.daily_wage),
      "Active": yesNo(r.active),
      "Created": fmtDate(r.created_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Payments",
    data: backup.tables.payments.map(r => ({
      "Project": resolve(r.project_id, projects),
      "Payee Type": titleCase(String(r.payee_type ?? "")),
      "Payee": r.payee_type === "supplier"
        ? resolve(r.supplier_id, suppliers)
        : resolve(r.labourer_id, labourers),
      "Amount": money(r.amount),
      "Status": titleCase(String(r.status ?? "")),
      "Description": r.description ?? "",
      "Work Category": r.work_category ?? "",
      "Created": fmtDate(r.created_at),
      "Approved": fmtDateTime(r.approved_at),
      "Approved By": resolve(r.approved_by, profiles),
      "Paid On": fmtDateTime(r.paid_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Client Payments",
    data: backup.tables.client_payments.map(r => ({
      "Project": resolve(r.project_id, projects),
      "Amount": money(r.amount),
      "Description": r.description ?? "",
      "Paid On": fmtDate(r.paid_on),
      "Created": fmtDate(r.created_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Materials",
    data: backup.tables.materials.map(r => ({
      "Project": resolve(r.project_id, projects),
      "Supplier": resolve(r.supplier_id, suppliers),
      "Material": r.name,
      "Unit": r.unit ?? "",
      "Quantity": r.quantity ?? "",
      "Unit Cost": money(r.unit_cost),
      "Total Cost": r.quantity && r.unit_cost ? money(Number(r.quantity) * Number(r.unit_cost)) : "",
      "Status": titleCase(String(r.status ?? "")),
      "Work Category": r.work_category ?? "",
      "Billed": yesNo(r.billed),
      "Ordered": fmtDate(r.ordered_at),
      "Delivered": fmtDate(r.delivered_at),
      "Photo": r.image_url ?? "",
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Attendance",
    data: backup.tables.attendance.map(r => ({
      "Labourer": resolve(r.labourer_id, labourers),
      "Project": resolve(r.project_id, projects),
      "Date": fmtDate(r.date),
      "Status": titleCase(String(r.status ?? "")),
      "Check In": r.check_in ?? "",
      "Check Out": r.check_out ?? "",
    })),
  });

  sheets.push({
    name: "Project Updates",
    data: backup.tables.project_updates.map(r => ({
      "Project": resolve(r.project_id, projects),
      "Stage": r.stage ?? "",
      "Note": r.note ?? "",
      "Image": r.image_url ?? "",
      "Created": fmtDateTime(r.created_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Change Orders",
    data: backup.tables.project_change_orders.map(r => ({
      "Project": resolve(r.project_id, projects),
      "Description": r.description ?? "",
      "Amount": money(r.amount),
      "Status": titleCase(String(r.status ?? "")),
      "Created": fmtDate(r.created_at),
    })),
  });

  sheets.push({
    name: "Personal Transactions",
    data: backup.tables.personal_transactions.map(r => ({
      "Type": titleCase(String(r.type ?? "")),
      "Amount": money(r.amount),
      "Description": r.description ?? "",
      "Date": fmtDate(r.date),
      "Created": fmtDate(r.created_at),
      "Archived": r.archived_at ? fmtDate(r.archived_at) : "",
    })),
  });

  sheets.push({
    name: "Team",
    data: backup.tables.profiles.map(r => ({
      "Name": r.full_name ?? "",
      "Role": titleCase(String(r.role ?? "")),
      "Owner": yesNo(r.is_owner),
      "Joined": fmtDate(r.created_at),
    })),
  });

  sheets.push({
    name: "Uploaded Images",
    data: backup.storageManifest.map(f => ({
      "File": f.name,
      "URL": f.url,
    })),
  });

  return sheets;
}

export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (bearer) {
    if (!process.env.BACKUP_API_SECRET || bearer !== process.env.BACKUP_API_SECRET) {
      return unauthorized("Invalid token");
    }
  } else {
    const { user, role, isOwner } = await getSessionAndRole();
    if (!user || role !== "admin" || !isOwner) {
      return unauthorized("Owner access required");
    }
  }

  const backup = await generateFullBackup();
  const format = req.nextUrl.searchParams.get("format");

  if (format === "json") {
    return NextResponse.json(backup);
  }

  const wb = XLSX.utils.book_new();
  const sheets = buildReadableSheets(backup);

  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    const cols = sheet.data[0] ? Object.keys(sheet.data[0]).map(k => ({
      wch: Math.max(k.length, 12),
    })) : [];
    ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  const summaryRows = sheets.map(s => ({
    "Sheet": s.name,
    "Rows": s.data.length,
  }));
  summaryRows.push({ Sheet: "Backup Date", Rows: 0 });
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  summaryWs["!cols"] = [{ wch: 22 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const date = new Date().toISOString().slice(0, 10);

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="deva-backup-${date}.xlsx"`,
    },
  });
}
