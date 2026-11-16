"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  dashboardCardClass,
  dashboardSelectClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { exportExcel, exportPdf, printReport, type ReportSection } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import { Download, FileText, Printer } from "lucide-react";
import { ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import toast from "react-hot-toast";

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
  ON_HOLD: "On Hold",
};

export const STATUS_COLOR: Record<string, string> = {
  Completed: "#009966",
  "In Progress": "#f59e0b",
  Pending: "#651210",
  Overdue: "#e6005c",
  "On Hold": "#7c3aed",
};

export function statusLabel(status?: string) {
  return STATUS_LABEL[String(status || "").toUpperCase()] || status || "—";
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(status.toLowerCase()))}>
      {statusLabel(status)}
    </span>
  );
}

export const dateClass = "h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-600 outline-none focus:border-primary";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select className={cn(dashboardSelectClass, "w-full")} value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  );
}

export function StatGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{item.label}</p>
          <p className="mt-1 text-xl font-bold leading-none text-zinc-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={dashboardCardClass}>
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function ReportTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader className={dashboardTableHeaderClass}>
          <TableRow className={dashboardTableHeadRowClass}>
            {headers.map((header) => (
              <TableHead key={header} className={dashboardTableHeadClass}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map((row, index) => (
            <TableRow key={index} className={dashboardTableBodyRowClass}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex} className={dashboardTableCellClass}>{cell}</TableCell>
              ))}
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={headers.length} className="px-4 py-8 text-center text-xs text-zinc-500">{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function StatusChart({ summary }: { summary: { completed: number; inProgress: number; pending: number; overdue: number; onHold: number } }) {
  const data = [
    { name: "Completed", value: summary.completed },
    { name: "In Progress", value: summary.inProgress },
    { name: "Pending", value: summary.pending },
    { name: "Overdue", value: summary.overdue },
    { name: "On Hold", value: summary.onHold },
  ].filter((item) => item.value > 0);
  if (!data.length) return null;
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
            {data.map((item) => <Cell key={item.name} fill={STATUS_COLOR[item.name]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export async function runReportExport(
  kind: "excel" | "pdf" | "print",
  title: string,
  lines: string[],
  sections: ReportSection[],
) {
  try {
    if (kind === "excel") {
      exportExcel(title.toLowerCase().replace(/\s+/g, "-"), sections, lines.map((line) => ["Report", line]));
      return;
    }
    if (kind === "print") {
      printReport(title, [], [], { subtitle: lines[0], lines, sections });
      return;
    }
    await exportPdf(title.toLowerCase().replace(/\s+/g, "-"), title, [], [], {
      subtitle: lines[0],
      lines: lines.slice(1),
      sections,
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not export this report");
  }
}

export function ExportButtons({
  onExport,
}: {
  onExport: (kind: "excel" | "pdf" | "print") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="h-9" onClick={() => onExport("pdf")}>
        <FileText className="size-4" /> PDF
      </Button>
      <Button type="button" variant="outline" className="h-9" onClick={() => onExport("excel")}>
        <Download className="size-4" /> Excel
      </Button>
      <Button type="button" variant="outline" className="h-9" onClick={() => onExport("print")}>
        <Printer className="size-4" /> Print
      </Button>
    </div>
  );
}
