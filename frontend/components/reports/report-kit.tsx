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
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export function EmployeeWorkloadChart({
  data,
}: {
  data: Array<{ name: string; total: number; completed: number; pending: number; inProgress: number; overdue: number }>;
}) {
  if (!data.length) return <p className="px-4 py-6 text-xs text-zinc-500">No workload data for this period.</p>;
  return (
    <div className="h-64 px-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="completed" stackId="a" fill={STATUS_COLOR.Completed} name="Completed" />
          <Bar dataKey="inProgress" stackId="a" fill={STATUS_COLOR["In Progress"]} name="In Progress" />
          <Bar dataKey="pending" stackId="a" fill={STATUS_COLOR.Pending} name="Pending" />
          <Bar dataKey="overdue" stackId="a" fill={STATUS_COLOR.Overdue} name="Overdue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaskTypeComparisonChart({
  project,
  standalone,
}: {
  project: { total: number; pending: number; inProgress: number; completed: number; overdue: number; onHold: number };
  standalone: { total: number; pending: number; inProgress: number; completed: number; overdue: number; onHold: number };
}) {
  const data = [
  { type: "Project-Based", total: project.total, pending: project.pending, inProgress: project.inProgress, completed: project.completed, overdue: project.overdue, onHold: project.onHold },
  { type: "Standalone", total: standalone.total, pending: standalone.pending, inProgress: standalone.inProgress, completed: standalone.completed, overdue: standalone.overdue, onHold: standalone.onHold },
  ];
  if (!project.total && !standalone.total) return <p className="px-4 py-6 text-xs text-zinc-500">No tasks in this period.</p>;
  return (
    <div className="h-56 px-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="type" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="completed" stackId="a" fill={STATUS_COLOR.Completed} name="Completed" />
          <Bar dataKey="inProgress" stackId="a" fill={STATUS_COLOR["In Progress"]} name="In Progress" />
          <Bar dataKey="pending" stackId="a" fill={STATUS_COLOR.Pending} name="Pending" />
          <Bar dataKey="overdue" stackId="a" fill={STATUS_COLOR.Overdue} name="Overdue" />
          <Bar dataKey="onHold" stackId="a" fill={STATUS_COLOR["On Hold"]} name="On Hold" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionTable({
  items,
}: {
  items: Array<{ status: string; count: number; percent: number }>;
}) {
  if (!items.some((item) => item.count > 0)) return <p className="text-xs text-zinc-500">No status data.</p>;
  return (
    <ul className="space-y-2 text-xs text-zinc-600">
      {items.map((item) => (
        <li key={item.status} className="flex items-center justify-between gap-3 border-b border-zinc-50 pb-2 last:border-0">
          <span className="font-medium text-zinc-800">{statusLabel(item.status)}</span>
          <span className="tabular-nums text-zinc-500">
            {item.count} <span className="text-zinc-400">({item.percent}%)</span>
          </span>
        </li>
      ))}
    </ul>
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
