"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { getAllTasks } from "@/lib/apis/taskApi";
import { dashboardInputClass, dashboardPageClass, dashboardPageStyle, dashboardStatusBadgeClass, dashboardTableBodyRowClass, dashboardTableCellClass, dashboardTableHeadClass, dashboardTableHeadRowClass, dashboardTableHeaderClass, getTaskStatusBadgeClass, formatStatusLabel } from "@/lib/dashboard-ui";
import { cn, resolveTaskDisplayStatus } from "@/lib/utils";
import { AlertCircle, BarChart3, CheckCircle2, Clock, Download, Eye, FileText, Hourglass, Printer, Search, TimerReset } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BRAND_MAROON = "#5b1017";
const BRAND_CORAL = "#e85d3f";
const BRAND_AMBER = "#f59e0b";
const BRAND_RED = "#dc2626";
const tooltipStyle = { backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px", fontWeight: 600 };

function valueOrNA(value: unknown) { return value === null || value === undefined || value === "" ? "N/A" : String(value); }
function dateTime(value: unknown) { if (!value) return "N/A"; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function dateOnly(value: unknown) { if (!value) return "N/A"; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }); }
function finalDue(task: any) { if (!task.deadline) return null; const due = new Date(task.deadline); if (Number.isNaN(due.getTime())) return null; return new Date(due.getTime() + Math.max(0, Number(task.extraTimeMinutes) || 0) * 60_000); }
function durationLabel(minutes: number) { const safe = Math.max(0, Math.round(minutes)); if (!safe) return "0min"; const days = Math.floor(safe / 1440); const hours = Math.floor((safe % 1440) / 60); const mins = safe % 60; return [days ? `${days}d` : "", hours ? `${hours}hrs` : "", mins ? `${mins}min` : ""].filter(Boolean).join(" "); }
function extraLabel(task: any) { return durationLabel(Number(task.extraTimeMinutes) || 0); }
function hoursLabel(hours: number) { return durationLabel(hours * 60).replace("0min", "0hrs"); }
function hoursWorked(task: any) { const start = task.startDate ?? task.createdAt; const end = resolveTaskDisplayStatus(task) === "completed" ? (task.completedAt ?? task.updatedAt) : (task.updatedAt ?? new Date()); if (!start || !end) return 0; const s = new Date(start).getTime(); const e = new Date(end).getTime(); return Number.isNaN(s) || Number.isNaN(e) || e <= s ? 0 : (e - s) / 3_600_000; }
function remained(task: any) { const due = finalDue(task); if (!due) return "N/A"; const compare = resolveTaskDisplayStatus(task) === "completed" ? new Date(task.completedAt ?? task.updatedAt) : new Date(); const diff = due.getTime() - compare.getTime(); if (Number.isNaN(diff)) return "N/A"; return `${durationLabel(Math.abs(diff) / 60_000)} ${diff >= 0 ? "remaining" : "late"}`; }
function taskTitle(task: any) { return valueOrNA(task.title ?? task.serviceInformation ?? task.description); }

export default function MyStaffReportPage() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const userId = user?.id ?? "";
  const { data, isLoading } = useSWR(userId ? ["my-staff-report", userId] : null, getAllTasks, { revalidateOnFocus: false });
  const [period, setPeriod] = useState<"all" | "week" | "month">("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const allTasks = useMemo(() => data?.data ?? [], [data?.data]);
  const tasks = useMemo(() => {
    const now = new Date();
    const min = new Date(now);
    if (period === "week") min.setDate(now.getDate() - 6);
    if (period === "month") min.setDate(now.getDate() - 29);
    const q = query.trim().toLowerCase();
    return allTasks.filter((task: any) => String(task.assignedTo?.id ?? task.assignedToId ?? task.userId ?? task.user?.id) === String(userId)).filter((task: any) => {
      if (period !== "all") { const t = new Date(task.deadline ?? task.createdAt).getTime(); if (Number.isNaN(t) || t < min.getTime()) return false; }
      const status = resolveTaskDisplayStatus(task);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      return [task.title, task.serviceInformation, task.description, task.priority, status].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [allTasks, period, query, statusFilter, userId]);

  const metrics = useMemo(() => {
    const completed = tasks.filter((task: any) => resolveTaskDisplayStatus(task) === "completed").length;
    const pending = tasks.filter((task: any) => resolveTaskDisplayStatus(task) === "pending").length;
    const overdue = tasks.filter((task: any) => resolveTaskDisplayStatus(task) === "overdue").length;
    const extraMinutes = tasks.reduce((sum: number, task: any) => sum + Math.max(0, Number(task.extraTimeMinutes) || 0), 0);
    const hours = tasks.reduce((sum: number, task: any) => sum + hoursWorked(task), 0);
    return { total: tasks.length, completed, pending, overdue, remaining: Math.max(0, tasks.length - completed), extraMinutes, hours };
  }, [tasks]);

  const statusData = [
    { name: "Completed", value: metrics.completed, color: BRAND_MAROON },
    { name: "Processing", value: metrics.pending, color: BRAND_CORAL },
    { name: "Overdue", value: metrics.overdue, color: BRAND_RED },
  ];
  const priorityData = useMemo(() => {
    const counts = { Normal: 0, Medium: 0, Urgent: 0 };
    tasks.forEach((task: any) => { const p = String(task.priority ?? "").toLowerCase(); if (p.includes("urgent") || p.includes("high")) counts.Urgent++; else if (p.includes("medium")) counts.Medium++; else counts.Normal++; });
    return [{ name: "Normal", value: counts.Normal, color: BRAND_MAROON }, { name: "Medium", value: counts.Medium, color: BRAND_CORAL }, { name: "Urgent", value: counts.Urgent, color: BRAND_RED }];
  }, [tasks]);

  const cards = [
    { label: "Total Tasks", value: metrics.total, caption: "Assigned to you", icon: FileText, color: BRAND_MAROON },
    { label: "Completed", value: metrics.completed, caption: "Finished tasks", icon: CheckCircle2, color: BRAND_MAROON },
    { label: "Processing", value: metrics.pending, caption: "Tasks in progress", icon: Clock, color: BRAND_CORAL },
    { label: "Remaining", value: metrics.remaining, caption: "Not completed yet", icon: Hourglass, color: BRAND_AMBER },
    { label: "Overdue", value: metrics.overdue, caption: "Past due date", icon: AlertCircle, color: BRAND_RED },
    { label: "Extra Time", value: durationLabel(metrics.extraMinutes), caption: "Extra time added", icon: TimerReset, color: BRAND_CORAL },
    { label: "Hours Worked", value: hoursLabel(metrics.hours), caption: "Estimated work time", icon: BarChart3, color: BRAND_MAROON },
  ];

  function exportCsv() {
    const headers = ["Task", "Priority", "Status", "Start Date", "Due Date", "Extra Time", "Updated Due", "Completed Date", "Remained", "Hours Worked"];
    const rows = tasks.map((task: any) => [taskTitle(task), valueOrNA(task.priority), formatStatusLabel(resolveTaskDisplayStatus(task)), dateTime(task.startDate), dateTime(task.originalDeadline ?? task.deadline), extraLabel(task), Number(task.extraTimeMinutes) > 0 ? dateTime(finalDue(task)) : "N/A", resolveTaskDisplayStatus(task) === "completed" ? dateTime(task.completedAt ?? task.updatedAt) : "N/A", remained(task), hoursLabel(hoursWorked(task))]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "my-task-report.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <div className={cn(dashboardPageClass, "space-y-5")} style={dashboardPageStyle}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">My Report</h1><p className="mt-1 text-sm text-zinc-500">Only your task information, KPIs, charts, hours worked, extra time, and remaining work.</p></div>
      <div className="flex flex-wrap items-center gap-2"><select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"><option value="all">All time</option><option value="week">1 Week</option><option value="month">1 Month</option></select><Button type="button" variant="outline" onClick={exportCsv}><Download className="mr-2 size-4" />CSV</Button><Button type="button" variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" />Print</Button></div>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, caption, icon: Icon, color }) => <div key={label} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14`, color }}><Icon className="size-5" /></div><div><p className="text-[11px] font-medium text-zinc-500">{label}</p><h3 className="mt-0.5 text-2xl font-bold text-slate-900">{value}</h3><p className="mt-1 text-[10px] font-medium text-zinc-400">{caption}</p></div></div></div>)}</div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12"><div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-5"><h3 className="text-sm font-bold text-slate-900">Task Status</h3><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={2}>{statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div></div><div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-7"><h3 className="text-sm font-bold text-slate-900">Tasks by Priority</h3><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" radius={[8, 8, 0, 0]}>{priorityData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></div></div></div>

    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-4"><h3 className="mr-auto text-sm font-bold text-slate-900">My Task Details</h3><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks..." className={cn(dashboardInputClass, "w-full pl-10")} /></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"><option value="all">All statuses</option><option value="pending">Processing</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select></div><div className="w-full overflow-x-auto"><Table className="min-w-[1250px]"><TableHeader className={dashboardTableHeaderClass}><TableRow className={dashboardTableHeadRowClass}>{["Task", "Priority", "Status", "Start Date", "Due Date", "Extra Time", "Updated Due", "Completed", "Remained", "Hours", "Action"].map((h) => <TableHead key={h} className={dashboardTableHeadClass}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{isLoading ? <TableRow><TableCell colSpan={11} className="py-10 text-center text-zinc-500">Loading your report...</TableCell></TableRow> : tasks.length ? tasks.map((task: any) => { const status = resolveTaskDisplayStatus(task); return <TableRow key={task.id} className={dashboardTableBodyRowClass}><TableCell className={dashboardTableCellClass}>{taskTitle(task)}</TableCell><TableCell className={dashboardTableCellClass}>{valueOrNA(task.priority)}</TableCell><TableCell className={dashboardTableCellClass}><span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(status))}>{formatStatusLabel(status)}</span></TableCell><TableCell className={dashboardTableCellClass}>{dateOnly(task.startDate)}</TableCell><TableCell className={dashboardTableCellClass}>{dateOnly(task.originalDeadline ?? task.deadline)}</TableCell><TableCell className={dashboardTableCellClass}>{extraLabel(task)}</TableCell><TableCell className={dashboardTableCellClass}>{Number(task.extraTimeMinutes) > 0 ? dateOnly(finalDue(task)) : "N/A"}</TableCell><TableCell className={dashboardTableCellClass}>{status === "completed" ? dateOnly(task.completedAt ?? task.updatedAt) : "N/A"}</TableCell><TableCell className={dashboardTableCellClass}>{remained(task)}</TableCell><TableCell className={dashboardTableCellClass}><span className="font-bold text-indigo-600">{hoursLabel(hoursWorked(task))}</span></TableCell><TableCell className={dashboardTableCellClass}><button type="button" onClick={() => setSelectedTask(task)} className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-primary hover:bg-primary/5"><Eye className="size-4" /></button></TableCell></TableRow>; }) : <TableRow><TableCell colSpan={11} className="py-10 text-center text-zinc-500">No tasks assigned to you</TableCell></TableRow>}</TableBody></Table></div></div>

    {selectedTask && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={() => setSelectedTask(null)}><div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Task Information</p><h3 className="mt-1 text-lg font-bold text-slate-900">{taskTitle(selectedTask)}</h3></div><button type="button" onClick={() => setSelectedTask(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">x</button></div><div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">{[["Task ID", selectedTask.id], ["Priority", selectedTask.priority], ["Status", formatStatusLabel(resolveTaskDisplayStatus(selectedTask))], ["Progress", `${Number(selectedTask.progress ?? 0)}%`], ["Start Date", dateTime(selectedTask.startDate)], ["Original Due Date", dateTime(selectedTask.originalDeadline ?? selectedTask.deadline)], ["Extra Time", extraLabel(selectedTask)], ["Updated Due", Number(selectedTask.extraTimeMinutes) > 0 ? dateTime(finalDue(selectedTask)) : "N/A"], ["Completed Date", resolveTaskDisplayStatus(selectedTask) === "completed" ? dateTime(selectedTask.completedAt ?? selectedTask.updatedAt) : "N/A"], ["Remained", remained(selectedTask)], ["Hours Worked", hoursLabel(hoursWorked(selectedTask))]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p><p className="mt-1.5 text-sm font-semibold text-slate-800">{valueOrNA(value)}</p></div>)}<div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Description</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{valueOrNA(selectedTask.description)}</p></div></div></div></div>}
  </div>;
}

