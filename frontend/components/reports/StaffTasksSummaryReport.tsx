"use client";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardSession } from "@/lib/apis/portfolioApi";
import { getAllTasks } from "@/lib/apis/taskApi";
import { getAllUsers } from "@/lib/apis/userApi";
import {
  dashboardCardClass,
  dashboardInputClass,
  dashboardPageClass,
  dashboardPageStyle,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeadRowClass,
  dashboardTableHeaderClass,
  dashboardTableWrapClass,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";
import { exportCsv, exportPdf, printReport, reportDateRangeLabel } from "@/lib/report-export";
import { cn, resolveTaskDisplayStatus } from "@/lib/utils";
import { Download, Eye, FileText, Printer, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

const EMPTY_LIST: any[] = [];

function valueOrNA(value: unknown) {
  return value === null || value === undefined || value === "" ? "N/A" : String(value);
}

function dateTime(value: unknown) {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function taskExtraLabel(task: any) {
  const minutes = Math.max(0, Number(task.extraTimeMinutes) || 0);
  if (!minutes) return "No extra time";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

function taskFinalDue(task: any) {
  if (!task.deadline) return null;
  const due = new Date(task.deadline);
  if (Number.isNaN(due.getTime())) return null;
  return new Date(due.getTime() + Math.max(0, Number(task.extraTimeMinutes) || 0) * 60_000);
}

function taskRemained(task: any) {
  const finalDue = taskFinalDue(task);
  if (!finalDue) return "N/A";
  const completed = resolveTaskDisplayStatus(task) === "completed" ? new Date(task.completedAt ?? task.updatedAt) : new Date();
  const difference = finalDue.getTime() - completed.getTime();
  if (Number.isNaN(difference)) return "N/A";
  const totalMinutes = Math.floor(Math.abs(difference) / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const label = [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean).join(" ");
  return `${label} ${difference >= 0 ? "early" : "late"}`;
}

function portfolioName(staff: any) {
  return staff.portfolio?.name ?? staff.portfolioName ?? "N/A";
}

function jobTitleName(staff: any) {
  return staff.jobTitle ?? staff.job_title ?? "N/A";
}

function formatTotalHoursWorked(totalHours: number) {
  if (!totalHours || totalHours <= 0) return "0hrs";
  const totalMinutes = Math.round(totalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}hrs ${minutes}min`;
  if (hours > 0) return `${hours}hrs`;
  return `${minutes}min`;
}

function taskHoursWorked(task: any): number {
  const startVal = task.startDate ?? task.createdAt;
  const endVal =
    resolveTaskDisplayStatus(task) === "completed"
      ? (task.completedAt ?? task.updatedAt)
      : (task.updatedAt ?? new Date());
  if (!startVal || !endVal) return 0;
  const startTime = new Date(startVal).getTime();
  const endTime = new Date(endVal).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) return 0;
  return (endTime - startTime) / (1000 * 60 * 60);
}

export default function StaffTasksSummaryReport() {
  const { open: sidebarOpen, isMobile } = useSidebar();
  const { data: usersResponse, isLoading: usersLoading } = useSWR("staff-task-summary-users", getAllUsers, { revalidateOnFocus: false });
  const { data: tasksResponse, isLoading: tasksLoading } = useSWR("staff-task-summary-tasks", getAllTasks, { revalidateOnFocus: false });
  const { data: dashboardSession } = useSWR("staff-task-summary-branding", getDashboardSession, { revalidateOnFocus: false });
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"all" | "week" | "month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [selectedDetailTask, setSelectedDetailTask] = useState<any | null>(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailStatus, setDetailStatus] = useState("all");
  const [detailPage, setDetailPage] = useState(1);

  const users = usersResponse?.data ?? EMPTY_LIST;
  const tasks = tasksResponse?.data ?? EMPTY_LIST;
  const loading = usersLoading || tasksLoading;
  const roleOptions = useMemo(() =>
    Array.from(new Set(users.map((staff: any) => String(staff.role ?? "").trim()).filter(Boolean))).sort(),
  [users]);
  const branding = dashboardSession?.branding;
  const brandLogo = resolveBranchLogoUrl(branding?.logoUrl) || "/logo.png";
  const brandColor = branding?.primaryColor ?? "#651210";
  const reportPeriodLabel = reportDateRangeLabel(
    tasks.map((task: any) => task.deadline ?? task.createdAt),
    startDate,
    endDate,
  );
  const dateSuffix = startDate || endDate ? `-${startDate || "beginning"}-to-${endDate || "today"}` : "-all-time";

  const periodTasks = useMemo(() => tasks.filter((task: any) => {
    if (statusFilter !== "all" && resolveTaskDisplayStatus(task) !== statusFilter) return false;
    if (!startDate && !endDate) return true;
    const value = task.deadline ?? task.createdAt;
    if (!value) return false;
    const time = new Date(value).getTime();
    if (startDate && time < new Date(`${startDate}T00:00:00`).getTime()) return false;
    if (endDate && time > new Date(`${endDate}T23:59:59.999`).getTime()) return false;
    return true;
  }), [tasks, startDate, endDate, statusFilter]);

  function dateInput(date: Date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }

  function changePeriod(value: "all" | "week" | "month" | "custom") {
    setPeriod(value);
    if (value === "all" || value === "custom") {
      setStartDate("");
      setEndDate("");
      return;
    }
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (value === "week" ? 6 : 29));
    setStartDate(dateInput(start));
    setEndDate(dateInput(end));
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((staff: any) => roleFilter === "all" || String(staff.role).toLowerCase() === roleFilter.toLowerCase()).map((staff: any) => {
      const staffTasks = periodTasks.filter((task: any) => String(task.assignedTo?.id) === String(staff.id));
      const completed = staffTasks.filter((task: any) => resolveTaskDisplayStatus(task) === "completed").length;
      const pending = staffTasks.filter((task: any) => resolveTaskDisplayStatus(task) === "pending").length;
      const overdue = staffTasks.filter((task: any) => resolveTaskDisplayStatus(task) === "overdue").length;
      const totalHours = staffTasks.reduce((sum: number, task: any) => sum + taskHoursWorked(task), 0);
      return { staff, tasks: staffTasks, total: staffTasks.length, pending, completed, overdue, totalHours };
    }).filter((row: any) => {
      if (row.total === 0) return false;
      return !query || [row.staff.id, row.staff.name, row.staff.role, jobTitleName(row.staff), portfolioName(row.staff)]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [users, periodTasks, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const summaryHeaders = ["Staff ID", "Staff Name", "Job Title", "Role", "Total Tasks", "Processing Tasks", "Completed Tasks", "Overdue Tasks", "Total Hours"];
  const summaryExportRows = rows.map((row: any) => [
    valueOrNA(row.staff.staffCode), row.staff.name, jobTitleName(row.staff), valueOrNA(row.staff.role), row.total, row.pending, row.completed, row.overdue, formatTotalHoursWorked(row.totalHours),
  ]);

  function exportSummaryCsv() {
    exportCsv(`staff-task-summary${dateSuffix}.csv`, summaryHeaders, summaryExportRows, [["Period", reportPeriodLabel]]);
  }

  async function exportSummaryPdf() {
    await exportPdf(`staff-task-summary${dateSuffix}.pdf`, "Staff Tasks Summary", summaryHeaders, summaryExportRows, {
      subtitle: reportPeriodLabel,
      logoUrl: brandLogo,
      primaryColor: brandColor,
    });
  }

  function printSummary() {
    printReport("Staff Tasks Summary", summaryHeaders, summaryExportRows);
  }

  const selected = useMemo(() => {
    if (!selectedStaff) return null;
    return rows.find((row: any) => String(row.staff.id) === String(selectedStaff.id)) ?? (() => {
      const staffTasks = periodTasks.filter((task: any) => String(task.assignedTo?.id) === String(selectedStaff.id));
      const completed = staffTasks.filter((task: any) => resolveTaskDisplayStatus(task) === "completed").length;
      const pending = staffTasks.filter((task: any) => resolveTaskDisplayStatus(task) === "pending").length;
      const overdue = staffTasks.filter((task: any) => resolveTaskDisplayStatus(task) === "overdue").length;
      const totalHours = staffTasks.reduce((sum: number, task: any) => sum + taskHoursWorked(task), 0);
      return { staff: selectedStaff, tasks: staffTasks, total: staffTasks.length, completed, pending, overdue, totalHours };
    })();
  }, [selectedStaff, rows, periodTasks]);

  const filteredDetailTasks = useMemo(() => {
    const query = detailSearch.trim().toLowerCase();
    return (selected?.tasks ?? []).filter((task: any) => {
      const status = resolveTaskDisplayStatus(task);
      if (detailStatus !== "all" && status !== detailStatus) return false;
      if (!query) return true;
      return [task.title, task.serviceInformation, task.description, task.priority, status]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [selected, detailSearch, detailStatus]);

  const detailPageSize = 5;
  const detailTotalPages = Math.max(1, Math.ceil(filteredDetailTasks.length / detailPageSize));
  const paginatedDetailTasks = filteredDetailTasks.slice(
    (detailPage - 1) * detailPageSize,
    detailPage * detailPageSize,
  );

  // UI table includes "Hours" and "Action" columns — exports exclude both
  const detailHeaders = ["Task Name", "Assigned", "Priority", "Status", "Original Due Date", "Extra Time", "Updated Due Date", "Completed Date", "Remained", "Hours", "Action"];
  const detailExportHeaders = ["Task Name", "Assigned", "Priority", "Status", "Original Due Date", "Extra Time", "Updated Due Date", "Completed Date", "Remained", "Hours Worked"];

  const taskDetailRow = (task: any) => [
    valueOrNA(task.title ?? task.serviceInformation ?? task.description),
    valueOrNA(selected?.staff?.name),
    valueOrNA(task.priority),
    valueOrNA(resolveTaskDisplayStatus(task)),
    dateTime(task.originalDeadline ?? task.deadline),
    taskExtraLabel(task),
    Number(task.extraTimeMinutes) > 0 ? dateTime(taskFinalDue(task)) : "N/A",
    resolveTaskDisplayStatus(task) === "completed" ? dateTime(task.completedAt ?? task.updatedAt) : "N/A",
    taskRemained(task),
    formatTotalHoursWorked(taskHoursWorked(task)),
    "View", // Action — last column, rendered as button in UI
  ];

  const taskDetailExportRow = (task: any) => [
    valueOrNA(task.title ?? task.serviceInformation ?? task.description),
    valueOrNA(selected?.staff?.name),
    valueOrNA(task.priority),
    valueOrNA(resolveTaskDisplayStatus(task)),
    dateTime(task.originalDeadline ?? task.deadline),
    taskExtraLabel(task),
    Number(task.extraTimeMinutes) > 0 ? dateTime(taskFinalDue(task)) : "N/A",
    resolveTaskDisplayStatus(task) === "completed" ? dateTime(task.completedAt ?? task.updatedAt) : "N/A",
    taskRemained(task),
    formatTotalHoursWorked(taskHoursWorked(task)),
  ];

  const paginatedDetailRows = paginatedDetailTasks.map(taskDetailRow);

  function exportSelectedExcel() {
    if (!selected) return;
    exportCsv(`${selected.staff.name}-task-report${dateSuffix}.csv`, detailExportHeaders, filteredDetailTasks.map(taskDetailExportRow), [["Period", reportPeriodLabel]]);
  }

  async function exportSelectedPdf() {
    if (!selected) return;
    await exportPdf(`${selected.staff.name}-task-report${dateSuffix}.pdf`, `${selected.staff.name} — Task Report`, detailExportHeaders, filteredDetailTasks.map(taskDetailExportRow), {
      subtitle: reportPeriodLabel,
      logoUrl: brandLogo,
      primaryColor: brandColor,
    });
  }

  function printSelected() {
    if (!selected) return;
    printReport(`${selected.staff.name} — Task Report`, detailExportHeaders, filteredDetailTasks.map(taskDetailExportRow));
  }

  // Summary stat card data for modal header
  const statCards = selected ? [
    { label: "Total Tasks", value: selected.total, color: "bg-slate-50 border-slate-200", valueColor: "text-slate-800" },
    { label: "Processing", value: selected.pending, color: "bg-amber-50 border-amber-200", valueColor: "text-amber-700" },
    { label: "Completed", value: selected.completed, color: "bg-emerald-50 border-emerald-200", valueColor: "text-emerald-700" },
    { label: "Overdue", value: selected.overdue, color: "bg-rose-50 border-rose-200", valueColor: "text-rose-700" },
    { label: "Total Hours", value: formatTotalHoursWorked(selected.totalHours), color: "bg-indigo-50 border-indigo-200", valueColor: "text-indigo-700" },
  ] : [];

  return (
    <div className={cn(dashboardPageClass, "space-y-5")} style={dashboardPageStyle}>
      <div className={cn(dashboardCardClass, "overflow-hidden p-0")}>
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-100 p-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <span>Show</span>
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-slate-700">
              <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <span>entries</span>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500">
            <span>Period</span>
            <select value={period} onChange={(event) => { changePeriod(event.target.value as "all" | "week" | "month" | "custom"); setCurrentPage(1); }} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-slate-700">
              <option value="all">All time</option><option value="week">1 Week</option><option value="month">1 Month</option><option value="custom">Custom</option>
            </select>
          </label>
          {period === "custom" && <>
            <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500"><span>Start date</span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setCurrentPage(1); }} className="h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500"><span>End date</span><input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setCurrentPage(1); }} className="h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
          </>}
          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500"><span>Role</span><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setCurrentPage(1); }} className="h-10 min-w-40 rounded-md border border-zinc-200 bg-white px-3 text-sm capitalize text-slate-700"><option value="all">All roles</option>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500"><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }} className="h-10 min-w-36 rounded-md border border-zinc-200 bg-white px-3 text-sm text-slate-700"><option value="all">All statuses</option><option value="pending">Processing</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select></label>
          <div className="min-w-4 flex-1" />
          <div className="relative w-full sm:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search staff..." className={cn(dashboardInputClass, "w-full pl-10")} /></div>
          <Button type="button" variant="outline" onClick={exportSummaryCsv}><Download className="mr-2 size-4" />CSV</Button>
          <Button type="button" variant="outline" onClick={() => void exportSummaryPdf()}><FileText className="mr-2 size-4" />PDF</Button>
          <Button type="button" onClick={printSummary} className="bg-primary text-white hover:bg-primary/90"><Printer className="mr-2 size-4" />Print</Button>
        </div>

        <div className={cn(dashboardTableWrapClass, "border-0")}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                {["Staff ID", "Staff Name", "Job Title", "Role", "Total Tasks", "Processing Tasks", "Completed Tasks", "Overdue Tasks", "Total Hours", "Action"].map((header) => (
                  <TableHead key={header} className={dashboardTableHeadClass}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="py-12 text-center text-zinc-500">Loading staff task summary...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="py-12 text-center text-zinc-500">No staff found</TableCell></TableRow>
              ) : paginatedRows.map((row: any) => (
                <TableRow key={row.staff.id} className={dashboardTableBodyRowClass}>
                  <TableCell className={dashboardTableCellClass}><span className="font-semibold text-primary">{row.staff.staffCode || "N/A"}</span></TableCell>
                  <TableCell className={dashboardTableCellClass}><span className="font-bold text-slate-800">{row.staff.name}</span></TableCell>
                  <TableCell className={dashboardTableCellClass}>{jobTitleName(row.staff)}</TableCell>
                  <TableCell className={cn(dashboardTableCellClass, "capitalize")}>{valueOrNA(row.staff.role)}</TableCell>
                  <TableCell className={dashboardTableCellClass}><span className="font-bold text-slate-700">{row.total}</span></TableCell>
                  <TableCell className={dashboardTableCellClass}><span className="font-bold text-amber-600">{row.pending}</span></TableCell>
                  <TableCell className={dashboardTableCellClass}><span className="font-bold text-emerald-600">{row.completed}</span></TableCell>
                  <TableCell className={dashboardTableCellClass}><span className="font-bold text-rose-600">{row.overdue}</span></TableCell>
                  <TableCell className={dashboardTableCellClass}><span className="font-bold text-indigo-600">{formatTotalHoursWorked(row.totalHours)}</span></TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <button type="button" onClick={() => { setSelectedStaff(row.staff); setDetailSearch(""); setDetailStatus("all"); setDetailPage(1); }} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-primary hover:border-primary/30 hover:bg-primary/5">
                      <Eye className="size-4" /> View Details
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4 text-xs text-zinc-500"><span>Showing {rows.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, rows.length)} of {rows.length} results</span><div className="flex items-center gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded border border-zinc-200 px-3 py-1.5 disabled:opacity-40">Prev</button><span>Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded border border-zinc-200 px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
      </div>

      {selected && (
        <div role="dialog" aria-modal="true" aria-label="Staff task details" className="fixed inset-y-0 right-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px]" style={{ left: isMobile ? 0 : sidebarOpen ? "16rem" : "5.5rem" }} onMouseDown={() => setSelectedStaff(null)}>
          <div className="max-h-[94vh] w-full max-w-none overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Staff Report</p>
                <h2 className="mt-0.5 text-xl font-bold text-slate-900">{selected.staff.name}</h2>
                <p className="mt-0.5 text-sm text-zinc-500">{jobTitleName(selected.staff)} · {valueOrNA(selected.staff.role)}</p>
              </div>
              <button type="button" aria-label="Close details" onClick={() => setSelectedStaff(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"><X className="size-5" /></button>
            </div>

            {/* Staff identity details — boxes, no colored left border */}
            <div className="border-b border-zinc-100 bg-zinc-50/40 px-6 py-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Staff Information</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "Staff ID", value: selected.staff.staffCode, highlight: true },
                  { label: "Name", value: selected.staff.name },
                  { label: "Job Title", value: jobTitleName(selected.staff) },
                  { label: "Role", value: selected.staff.role },
                  { label: "Branch", value: portfolioName(selected.staff) },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
                    <p className={cn("mt-1 truncate text-sm font-semibold", highlight ? "text-primary" : "text-slate-800")}>{valueOrNA(value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stat cards — Task counts + total hours */}
            <div className="border-b border-zinc-100 px-6 py-5">
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Task Summary</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {statCards.map(({ label, value, color, valueColor }) => (
                  <div key={label} className={cn("rounded-xl border p-4 text-center", color)}>
                    <p className={cn("text-2xl font-extrabold tracking-tight", valueColor)}>{value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Task breakdown table */}
            <div className="py-6">
              <div className="mb-4 flex flex-wrap items-end gap-3 px-6">
                <h3 className="mr-auto text-sm font-bold uppercase tracking-wider text-primary">Task Breakdown</h3>
                <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><input value={detailSearch} onChange={(event) => { setDetailSearch(event.target.value); setDetailPage(1); }} placeholder="Search tasks..." className={cn(dashboardInputClass, "w-full pl-10")} /></div>
                <select value={detailStatus} onChange={(event) => { setDetailStatus(event.target.value); setDetailPage(1); }} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-slate-700"><option value="all">All statuses</option><option value="pending">Processing</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select>
              </div>
              <div className="w-full overflow-x-auto border-y border-zinc-200">
                <Table className="min-w-[1500px]">
                  <TableHeader className={dashboardTableHeaderClass}>
                    <TableRow className={dashboardTableHeadRowClass}>
                      {detailHeaders.map((header) => <TableHead key={header} className={dashboardTableHeadClass}>{header}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDetailRows.length ? paginatedDetailRows.map((row, index) => (
                      <TableRow key={index} className={dashboardTableBodyRowClass}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className={dashboardTableCellClass}>
                            {/* Last col = Action button */}
                            {cellIndex === row.length - 1 ? (
                              <button type="button" aria-label="View task information" onClick={() => setSelectedDetailTask(paginatedDetailTasks[index])} className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-primary hover:bg-primary/5">
                                <Eye className="size-4" />
                              </button>
                            /* Status badge */
                            ) : cellIndex === 3 ? (
                              <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", getTaskStatusBadgeClass(String(cell)))}>{cell}</span>
                            /* Hours col — second to last before Action */
                            ) : cellIndex === row.length - 2 ? (
                              <span className="font-bold text-indigo-600">{cell}</span>
                            ) : cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={detailHeaders.length} className="py-10 text-center text-zinc-500">No tasks assigned</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between px-6 pt-4 text-xs text-zinc-500">
                <span>Showing {filteredDetailTasks.length ? (detailPage - 1) * detailPageSize + 1 : 0}-{Math.min(detailPage * detailPageSize, filteredDetailTasks.length)} of {filteredDetailTasks.length} tasks</span>
                <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={detailPage <= 1} onClick={() => setDetailPage((page) => Math.max(1, page - 1))}>Previous</Button><span>Page {detailPage} of {detailTotalPages}</span><Button type="button" variant="outline" size="sm" disabled={detailPage >= detailTotalPages} onClick={() => setDetailPage((page) => Math.min(detailTotalPages, page + 1))}>Next</Button></div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-6 py-4">
              <Button type="button" variant="outline" onClick={exportSelectedExcel}><Download className="mr-2 size-4" />Export CSV</Button>
              <Button type="button" variant="outline" onClick={() => void exportSelectedPdf()}><FileText className="mr-2 size-4" />Export PDF</Button>
              <Button type="button" onClick={printSelected} className="bg-primary text-white hover:bg-primary/90"><Printer className="mr-2 size-4" />Print</Button>
            </div>
          </div>
        </div>
      )}

      {selectedDetailTask && (
        <div role="dialog" aria-modal="true" aria-label="Task information" className="fixed inset-y-0 right-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4" style={{ left: isMobile ? 0 : sidebarOpen ? "16rem" : "5.5rem" }} onMouseDown={() => setSelectedDetailTask(null)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Task Information</p><h3 className="mt-1 text-lg font-bold text-slate-900">{valueOrNA(selectedDetailTask.title ?? selectedDetailTask.serviceInformation ?? selectedDetailTask.description)}</h3></div>
              <button type="button" aria-label="Close task information" onClick={() => setSelectedDetailTask(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
              {[
                ["Task ID", selectedDetailTask.id], ["Assigned", selectedDetailTask.assignedTo?.name],
                ["Client", selectedDetailTask.institutions?.[0]?.institution], ["Job Title", selectedDetailTask.department],
                ["Supervisor", selectedDetailTask.supervisor], ["Priority", selectedDetailTask.priority],
                ["Status", resolveTaskDisplayStatus(selectedDetailTask)], ["Progress", `${Number(selectedDetailTask.progress ?? 0)}%`],
                ["Created Date", dateTime(selectedDetailTask.createdAt)],
                ["Original Due Date", dateTime(selectedDetailTask.originalDeadline ?? selectedDetailTask.deadline)],
                ["Extra Time Added", taskExtraLabel(selectedDetailTask)],
                ["Updated Due Date", Number(selectedDetailTask.extraTimeMinutes) > 0 ? dateTime(taskFinalDue(selectedDetailTask)) : "N/A"],
                ["Completed Date", resolveTaskDisplayStatus(selectedDetailTask) === "completed" ? dateTime(selectedDetailTask.completedAt ?? selectedDetailTask.updatedAt) : "N/A"],
                ["Remained", taskRemained(selectedDetailTask)],
                ["Hours Worked", formatTotalHoursWorked(taskHoursWorked(selectedDetailTask))],
                ["Last Progress Change", dateTime(selectedDetailTask.progressUpdatedAt ?? selectedDetailTask.updatedAt)],
              ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p><p className="mt-1.5 text-sm font-semibold capitalize text-slate-800">{valueOrNA(value)}</p></div>)}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Description</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{valueOrNA(selectedDetailTask.description)}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}