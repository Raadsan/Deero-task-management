"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAdminDashboardBundle,
  getMyDashboardBundle,
  getManagerDashboardBundle,
} from "@/lib/apis/dashboardApi";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import { authClient } from "@/lib/auth-client";
import { isBranchScopedRole, normalizeRoleName } from "@/lib/portfolio-access";
import { Task } from "@/lib/types";
import { ROUTES } from "@/lib/constants";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import {
  dashboardPageClass,
  dashboardPageStyle,
  dashboardStatIconClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeadRowClass,
  dashboardTableHeaderClass,
  formatStatusLabel,
  getTaskStatusBadgeClass,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";
import { cn, resolveTaskDisplayStatus } from "@/lib/utils";
import { accountingDashboardApi } from "@/lib/api/accounting/accountingDashboardApi";
import { customerInvoiceApi, type CustomerInvoice } from "@/lib/api/accounting/receivables/customerInvoiceApi";
import { vendorBillApi, type VendorBill } from "@/lib/api/accounting/payables/vendorBillApi";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import { getAllUsers } from "@/lib/apis/userApi";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Landmark,
  Layers,
  LayoutDashboard,
  Percent,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND_MAROON = "#5b1017";
const BRAND_CORAL = "#e85d3f";
const BRAND_AMBER = "#f59e0b";
const BRAND_RED = "#dc2626";
const BRAND_GREEN = "#059669";

const lightTooltipStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  boxShadow: "0 8px 16px -2px rgb(0 0 0 / 0.08)",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: "600",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
function asDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─────────────────────────────────────────────────────────────
// Staff personal dashboard
// ─────────────────────────────────────────────────────────────
function StaffDashboard({ userId, userName }: { userId: string; userName: string }) {
  const { primaryColor, secondaryColor } = useBranchTheme();
  const { data: bundleRes, isLoading, isValidating, mutate } = useSWR(
    ["staff-dashboard", userId],
    () => getMyDashboardBundle(),
    { revalidateOnFocus: true, revalidateOnMount: true },
  );

  const tasks = useMemo(() => {
    return (bundleRes?.data?.tasks ?? []) as Task[];
  }, [bundleRes?.data?.tasks]);

  const metrics = useMemo(() => {
    const completed = tasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length;
    const pending = tasks.filter((t) => resolveTaskDisplayStatus(t) === "pending").length;
    const overdue = tasks.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length;
    return { assigned: tasks.length, completed, pending, overdue };
  }, [tasks]);

  const dailyPerformance = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dayTasks = tasks.filter((task) => {
        const taskDate = asDate(task.completedAt ?? task.updatedAt ?? task.createdAt ?? task.deadline);
        return taskDate ? sameDay(taskDate, date) : false;
      });
      return {
        day: labels[date.getDay()],
        completed: dayTasks.filter((task) => resolveTaskDisplayStatus(task) === "completed").length,
        pending: dayTasks.filter((task) => resolveTaskDisplayStatus(task) === "pending").length,
      };
    });
  }, [tasks]);

  const statusData = useMemo(() => {
    const total = Math.max(tasks.length, 1);
    return [
      { name: "Completed", value: metrics.completed, color: primaryColor },
      { name: "Pending", value: metrics.pending, color: secondaryColor },
      { name: "Overdue", value: metrics.overdue, color: BRAND_RED },
    ].map((item) => ({
      ...item,
      count: `${item.value} (${Math.round((item.value / total) * 100)}%)`,
    }));
  }, [metrics.completed, metrics.overdue, metrics.pending, tasks.length, primaryColor, secondaryColor]);

  const priorityData = useMemo(() => {
    let normal = 0;
    let medium = 0;
    let urgent = 0;
    tasks.forEach((task) => {
      const priority = String(task.priority ?? "").toLowerCase();
      if (priority.includes("urgent") || priority.includes("high")) urgent += 1;
      else if (priority.includes("medium")) medium += 1;
      else normal += 1;
    });
    const total = Math.max(tasks.length, 1);
    return [
      { name: "Normal", value: normal, color: primaryColor },
      { name: "Medium", value: medium, color: secondaryColor },
      { name: "Urgent", value: urgent, color: BRAND_RED },
    ].map((item) => ({
      ...item,
      count: `${item.value} (${Math.round((item.value / total) * 100)}%)`,
    }));
  }, [tasks, primaryColor, secondaryColor]);

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((task) => resolveTaskDisplayStatus(task) !== "completed")
      .sort((a, b) => {
        const aTime = asDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = asDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, 5);
  }, [tasks]);

  const dateRangeLabel = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    return `${fmt.format(start)} - ${fmt.format(end)}, ${end.getFullYear()}`;
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse px-1">
        <div className="h-20 rounded-xl bg-muted/20" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(dashboardPageClass, "space-y-5")} style={dashboardPageStyle}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            {getGreeting()}, {userName || "Staff"} {"\uD83D\uDC4B"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Here&apos;s what&apos;s happening with your tasks today.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm">
            <Calendar className="size-4 text-zinc-500" />
            <span>{dateRangeLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: primaryColor }}
          >
            <RefreshCw className={cn("size-4", isValidating && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assigned Tasks", value: metrics.assigned, caption: "Total tasks assigned to you", Icon: Briefcase, color: primaryColor },
          { label: "Completed", value: metrics.completed, caption: "Tasks you have completed", Icon: CheckCircle, color: primaryColor },
          { label: "Pending", value: metrics.pending, caption: "Tasks in progress", Icon: Clock, color: secondaryColor },
          { label: "Overdue", value: metrics.overdue, caption: "Tasks past due date", Icon: AlertCircle, color: BRAND_RED },
        ].map(({ label, value, caption, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, white)`, color }}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-600">{label}</p>
                  <h3 className="mt-1 text-3xl font-bold text-[#0f172a]">{value}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{caption}</p>
                </div>
              </div>
              <MiniSparkline color={color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f172a]">Daily Performance (7 Days)</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-700"><span className="size-2 rounded-full" style={{ backgroundColor: primaryColor }} /> Completed</span>
              <span className="flex items-center gap-1.5 text-zinc-700"><span className="size-2 rounded-full" style={{ backgroundColor: secondaryColor }} /> Pending</span>
            </div>
          </div>
          <div className="mt-4 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip contentStyle={lightTooltipStyle} />
                <Line type="monotone" dataKey="completed" stroke={primaryColor} strokeWidth={3} dot={{ r: 4, fill: "#fff", stroke: primaryColor, strokeWidth: 2 }} />
                <Line type="monotone" dataKey="pending" stroke={secondaryColor} strokeWidth={3} dot={{ r: 4, fill: "#fff", stroke: secondaryColor, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-3">
          <h3 className="text-sm font-bold text-[#0f172a]">Task Status</h3>
          <div className="mt-4 h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={2}>
                  {statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={lightTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-xs">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-700"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
                <span className="font-semibold text-zinc-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-3">
          <h3 className="text-sm font-bold text-[#0f172a]">Tasks by Priority</h3>
          <div className="relative mt-4 h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={2}>
                  {priorityData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={lightTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#0f172a]">{tasks.length}</span>
              <span className="text-[10px] text-zinc-500">Total Tasks</span>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            {priorityData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-700"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
                <span className="font-semibold text-zinc-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-6">
          <h3 className="text-sm font-bold text-[#0f172a]">Task Priority Breakdown</h3>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip contentStyle={lightTooltipStyle} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {priorityData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f172a]">Upcoming Tasks</h3>
            <Link href="/tasks/my-tasks" className="text-xs font-bold hover:underline" style={{ color: primaryColor }}>View All</Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="text-white" style={{ backgroundColor: primaryColor }}>
                <tr>
                  <th className="px-3 py-2 font-bold">Task</th>
                  <th className="px-3 py-2 font-bold">Priority</th>
                  <th className="px-3 py-2 font-bold">Deadline</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {upcomingTasks.length ? upcomingTasks.map((task, index) => {
                  const status = resolveTaskDisplayStatus(task);
                  const priority = String(task.priority ?? "Normal");
                  return (
                    <tr key={task.id ?? index}>
                      <td className="px-3 py-2 font-semibold text-zinc-800">{task.serviceInformation || task.description?.slice(0, 42) || "Task item"}</td>
                      <td className="px-3 py-2"><span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{priority}</span></td>
                      <td className="px-3 py-2 text-zinc-600">{asDate(task.deadline)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "N/A"}</td>
                      <td className="px-3 py-2"><span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(status))}>{formatStatusLabel(status)}</span></td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">No upcoming tasks</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-center">
            <Link href="/tasks/my-tasks" className="inline-flex rounded-lg border border-zinc-200 px-16 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">View All Tasks</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
// -------------------------------------------------------------
// Manager Dashboard
// ─────────────────────────────────────────────────────────────
function ManagerDashboard({ userId, userName }: { userId: string; userName: string }) {
  const { primaryColor, secondaryColor } = useBranchTheme();
  const { data: bundleRes, isLoading, isValidating, mutate } = useSWR(
    ["manager-dashboard", userId],
    () => getManagerDashboardBundle(),
    { revalidateOnFocus: true, revalidateOnMount: true },
  );

  const myTasks = useMemo(() => (bundleRes?.data?.myTasks ?? []) as Task[], [bundleRes?.data?.myTasks]);
  const allTasks = useMemo(() => (bundleRes?.data?.allTasks ?? []) as Task[], [bundleRes?.data?.allTasks]);

  const getMetrics = (items: Task[]) => {
    const completed = items.filter((t) => resolveTaskDisplayStatus(t) === "completed").length;
    const pending = items.filter((t) => resolveTaskDisplayStatus(t) === "pending").length;
    const overdue = items.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length;
    return { assigned: items.length, completed, pending, overdue };
  };

  const myMetrics = useMemo(() => getMetrics(myTasks), [myTasks]);
  const staffMetrics = useMemo(() => getMetrics(allTasks), [allTasks]);

  const dateRangeLabel = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    return `${fmt.format(start)} - ${fmt.format(end)}, ${end.getFullYear()}`;
  }, []);

  const dailyPerformance = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dayTasks = allTasks.filter((task) => {
        const taskDate = asDate(task.completedAt ?? task.updatedAt ?? task.createdAt ?? task.deadline);
        return taskDate ? sameDay(taskDate, date) : false;
      });
      return {
        day: labels[date.getDay()],
        completed: dayTasks.filter((task) => resolveTaskDisplayStatus(task) === "completed").length,
        pending: dayTasks.filter((task) => resolveTaskDisplayStatus(task) === "pending").length,
      };
    });
  }, [allTasks]);

  const statusData = useMemo(() => {
    const total = Math.max(allTasks.length, 1);
    return [
      { name: "Completed", value: staffMetrics.completed, color: primaryColor },
      { name: "Pending", value: staffMetrics.pending, color: secondaryColor },
      { name: "Overdue", value: staffMetrics.overdue, color: BRAND_RED },
    ].map((item) => ({ ...item, count: `${item.value} (${Math.round((item.value / total) * 100)}%)` }));
  }, [allTasks.length, staffMetrics.completed, staffMetrics.overdue, staffMetrics.pending, primaryColor, secondaryColor]);

  const priorityData = useMemo(() => {
    let normal = 0;
    let medium = 0;
    let urgent = 0;
    allTasks.forEach((task) => {
      const priority = String(task.priority ?? "").toLowerCase();
      if (priority.includes("urgent") || priority.includes("high")) urgent += 1;
      else if (priority.includes("medium")) medium += 1;
      else normal += 1;
    });
    const total = Math.max(allTasks.length, 1);
    return [
      { name: "Normal", value: normal, color: primaryColor },
      { name: "Medium", value: medium, color: secondaryColor },
      { name: "Urgent", value: urgent, color: BRAND_RED },
    ].map((item) => ({ ...item, count: `${item.value} (${Math.round((item.value / total) * 100)}%)` }));
  }, [allTasks, primaryColor, secondaryColor]);

  const tableTasks = (items: Task[]) =>
    items
      .slice()
      .sort((a, b) => {
        const aTime = asDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = asDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, 5);

  const myTableTasks = useMemo(() => tableTasks(myTasks), [myTasks]);
  const staffTableTasks = useMemo(() => tableTasks(allTasks), [allTasks]);

  const taskTitle = (task: Task) => task.serviceInformation || task.description?.slice(0, 42) || "Task item";
  const taskDeadline = (task: Task) => asDate(task.deadline)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "N/A";

  const renderTaskRows = (items: Task[], includeAssignee = false) => (
    items.length ? items.map((task, index) => {
      const status = resolveTaskDisplayStatus(task);
      return (
        <tr key={task.id ?? index}>
          <td className="px-3 py-2 font-bold" style={{ color: primaryColor }}>{task.id?.slice(0, 8) || `TASK${index + 1}`}</td>
          <td className="px-3 py-2 font-semibold text-zinc-800">{taskTitle(task)}</td>
          {includeAssignee && <td className="px-3 py-2 text-zinc-700">{task.assignedTo?.name || "Unassigned"}</td>}
          <td className="px-3 py-2"><span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(status))}>{formatStatusLabel(status)}</span></td>
          <td className="px-3 py-2 text-zinc-700">{String(task.priority ?? "Normal")}</td>
          <td className="px-3 py-2 text-zinc-600">{taskDeadline(task)}</td>
        </tr>
      );
    }) : (
      <tr><td colSpan={includeAssignee ? 6 : 5} className="px-3 py-8 text-center text-zinc-500">No tasks found</td></tr>
    )
  );

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse px-1">
        <div className="h-20 rounded-xl bg-muted/20" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-muted/20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(dashboardPageClass, "space-y-5")} style={dashboardPageStyle}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">{getGreeting()}, {userName || "Manager"} {"\uD83D\uDC4B"}</h1>
          <p className="mt-1 text-sm text-zinc-500">Here&apos;s what&apos;s happening with your team today.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm">
            <Calendar className="size-4 text-zinc-500" />
            <span>{dateRangeLabel}</span>
          </div>
          <button type="button" onClick={() => mutate()} disabled={isValidating} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60">
            <RefreshCw className={cn("size-4", isValidating && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">My Tasks</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assigned to Me", value: myMetrics.assigned, Icon: Briefcase, color: primaryColor },
          { label: "Completed", value: myMetrics.completed, Icon: CheckCircle, color: primaryColor },
          { label: "Pending", value: myMetrics.pending, Icon: Clock, color: secondaryColor },
          { label: "Overdue", value: myMetrics.overdue, Icon: AlertCircle, color: BRAND_RED },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, white)`, color }}><Icon className="size-5" /></div><div><p className="text-xs font-semibold text-zinc-600">{label}</p><h3 className="mt-1 text-3xl font-bold text-[#0f172a]">{value}</h3></div></div>
              <MiniSparkline color={color} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Staff Tasks</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[
          { label: "Total Staff Tasks", value: staffMetrics.assigned, Icon: Users, color: secondaryColor },
          { label: "Completed", value: staffMetrics.completed, Icon: CheckCircle, color: primaryColor },
          { label: "Pending / Overdue", value: staffMetrics.pending + staffMetrics.overdue, Icon: Clock, color: secondaryColor },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, white)`, color }}><Icon className="size-5" /></div><div><p className="text-xs font-semibold text-zinc-600">{label}</p><h3 className="mt-1 text-3xl font-bold text-[#0f172a]">{value}</h3></div></div>
              <MiniSparkline color={color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-4">
          <h3 className="text-sm font-bold text-[#0f172a]">Daily Performance (7 Days)</h3>
          <div className="mt-4 h-[230px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} /><Tooltip contentStyle={lightTooltipStyle} /><Line type="monotone" dataKey="completed" stroke={primaryColor} strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="pending" stroke={secondaryColor} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-4">
          <h3 className="text-sm font-bold text-[#0f172a]">Task Status</h3>
          <div className="mt-4 h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2}>{statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={lightTooltipStyle} /></PieChart></ResponsiveContainer></div>
          <div className="space-y-2 text-xs">{statusData.map((item) => <div key={item.name} className="flex items-center justify-between"><span className="flex items-center gap-2 text-zinc-700"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold text-zinc-900">{item.count}</span></div>)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-4">
          <h3 className="text-sm font-bold text-[#0f172a]">Tasks by Priority</h3>
          <div className="relative mt-4 h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2}>{priorityData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={lightTooltipStyle} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-[#0f172a]">{allTasks.length}</span><span className="text-[10px] text-zinc-500">Total Tasks</span></div></div>
          <div className="space-y-2 text-xs">{priorityData.map((item) => <div key={item.name} className="flex items-center justify-between"><span className="flex items-center gap-2 text-zinc-700"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold text-zinc-900">{item.count}</span></div>)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {[{ title: "My Tasks", items: myTableTasks, href: "/tasks/my-tasks", assignee: false }, { title: "Staff Tasks", items: staffTableTasks, href: "/tasks", assignee: true }].map((table) => (
          <div key={table.title} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#0f172a]">{table.title}</h3><Link href={table.href} className="text-xs font-bold hover:underline" style={{ color: primaryColor }}>View All</Link></div>
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200"><table className="w-full text-left text-xs"><thead className="text-white" style={{ backgroundColor: primaryColor }}><tr><th className="px-3 py-2">No</th><th className="px-3 py-2">Task</th>{table.assignee && <th className="px-3 py-2">Assigned To</th>}<th className="px-3 py-2">Status</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Due Date</th></tr></thead><tbody className="divide-y divide-zinc-100 bg-white">{renderTaskRows(table.items, table.assignee)}</tbody></table></div>
          </div>
        ))}
      </div>
    </div>
  );
}
// -------------------------------------------------------------
// Superadmin Main Dashboard (Pixel-Perfect Clean Executive View)
// ─────────────────────────────────────────────────────────────
function AdminDashboard({
  userId,
  portfolioId,
  branchName,
  isBranchDashboard,
  userName = "Super Admin",
}: {
  userId: string;
  portfolioId?: string | null;
  branchName: string;
  isBranchDashboard: boolean;
  userName?: string;
}) {
  const { primaryColor, secondaryColor } = useBranchTheme();
  const dashboardKey = ["dashboard-bundle", userId, portfolioId ?? "all"].join(":");
  const { data: bundleRes, isValidating, mutate: mutateBundle } = useSWR(
    dashboardKey,
    getAdminDashboardBundle,
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  type DashboardTimePeriod = "Today" | "Yesterday" | "1 Week" | "Last Month" | "Custom";
  const [periodFilter, setPeriodFilter] = useState<DashboardTimePeriod>("Today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);

  const { data: accountingData, mutate: mutateAccounting } = useSWR(
    ["accounting-executive-summary", periodFilter, customStart, customEnd],
    () => accountingDashboardApi.getSummary(periodFilter, customStart, customEnd),
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const { data: usersRes, mutate: mutateUsers } = useSWR(
    "dashboard-all-staff",
    getAllUsers,
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const { data: invoicesRes, mutate: mutateInvoices } = useSWR(
    "dashboard-customer-invoices",
    () => customerInvoiceApi.getAll(),
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const { data: vendorBillsRes, mutate: mutateBills } = useSWR(
    "dashboard-vendor-bills",
    () => vendorBillApi.getAll(),
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const { data: quotationsRes, mutate: mutateQuotations } = useSWR(
    "dashboard-quotations",
    () => quotationApi.getAll(),
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const [chartPeriod, setChartPeriod] = useState<"Weekly" | "Monthly">("Weekly");

  const handleRefresh = async () => {
    await Promise.all([
      mutateBundle(),
      mutateAccounting(),
      mutateUsers(),
      mutateInvoices(),
      mutateBills(),
      mutateQuotations(),
    ]);
  };

  const isDateInFilter = useCallback((rawDate?: string | Date | null) => {
    if (!rawDate) return false;
    const d = asDate(rawDate);
    if (!d) return false;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const time = d.getTime();

    if (periodFilter === "Today") {
      return time >= todayStart.getTime() && time < tomorrowStart.getTime();
    }
    if (periodFilter === "Yesterday") {
      return time >= yesterdayStart.getTime() && time < todayStart.getTime();
    }
    if (periodFilter === "1 Week") {
      const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      return time >= weekStart.getTime() && time < tomorrowStart.getTime();
    }
    if (periodFilter === "Last Month") {
      const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      return time >= monthStart.getTime() && time < tomorrowStart.getTime();
    }
    if (periodFilter === "Custom") {
      if (!customStart && !customEnd) return true;
      const start = customStart ? new Date(`${customStart}T00:00:00`).getTime() : 0;
      const end = customEnd ? new Date(`${customEnd}T23:59:59`).getTime() : Infinity;
      return time >= start && time <= end;
    }
    return true;
  }, [periodFilter, customStart, customEnd]);

  const rawTasks = useMemo(() => {
    const tasks = (bundleRes?.data?.tasks ?? []) as Task[];
    return isBranchDashboard && portfolioId
      ? tasks.filter((task) => task.assignedTo?.portfolioId === portfolioId)
      : tasks;
  }, [bundleRes?.data?.tasks, isBranchDashboard, portfolioId]);

  const allTasks = useMemo(() => {
    return rawTasks.filter((task) => {
      if (periodFilter === "Today") {
        const deadlineDate = task.deadline ? asDate(task.deadline) : null;
        const createdDate = task.createdAt ? asDate(task.createdAt) : null;
        const completedDate = (task as any).completedAt ? asDate((task as any).completedAt) : null;

        const isDueToday = deadlineDate ? isDateInFilter(deadlineDate) : false;
        const isCreatedToday = createdDate ? isDateInFilter(createdDate) : false;
        const isCompletedToday = completedDate ? isDateInFilter(completedDate) : false;

        return isDueToday || isCreatedToday || isCompletedToday;
      }

      const taskDate = asDate(task.deadline ?? task.createdAt ?? task.updatedAt);
      return isDateInFilter(taskDate);
    });
  }, [rawTasks, isDateInFilter, periodFilter]);

  const allClients = (bundleRes?.data?.clients ?? []) as Array<{ id?: string; institution?: string; companyName?: string }>;

  const isTaskInProgress = (t: any) => {
    const s = resolveTaskDisplayStatus(t);
    return s === "in_progress" || s === "in progress" || s === "inprocess" || s === "in process";
  };

  const totalTasksCount = allTasks.length;
  const completedCount = allTasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length;
  const inProgressCount = allTasks.filter(isTaskInProgress).length;
  const pendingCount = allTasks.filter((t) => resolveTaskDisplayStatus(t) === "pending").length;
  const overdueCount = allTasks.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length;

  const completionRate = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;
  const inProgressPercent = totalTasksCount > 0 ? ((inProgressCount / totalTasksCount) * 100).toFixed(1) : "0.0";

  const rawInvoices = useMemo(() => (invoicesRes ?? []) as CustomerInvoice[], [invoicesRes]);
  const rawVendorBills = useMemo(() => (vendorBillsRes ?? []) as VendorBill[], [vendorBillsRes]);
  const rawQuotations = useMemo(() => (quotationsRes ?? []) as Quotation[], [quotationsRes]);

  const invoices = useMemo(() => {
    const filtered = rawInvoices.filter((inv) => isDateInFilter((inv.invoice_date || inv.created_at) as string | Date));
    return filtered.length > 0 ? filtered : rawInvoices;
  }, [rawInvoices, isDateInFilter]);

  const vendorBills = useMemo(() => {
    const filtered = rawVendorBills.filter((b) => isDateInFilter((b.bill_date || b.created_at) as string | Date));
    return filtered.length > 0 ? filtered : rawVendorBills;
  }, [rawVendorBills, isDateInFilter]);

  const quotations = useMemo(() => {
    const filtered = rawQuotations.filter((q) => {
      const row = q as unknown as Record<string, unknown>;
      return isDateInFilter((row.quotation_date || row.issue_date || row.created_at || row.createdAt) as string | Date);
    });
    return filtered.length > 0 ? filtered : rawQuotations;
  }, [rawQuotations, isDateInFilter]);

  const invoiceRevenue = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
  }, [invoices]);

  const billExpenses = useMemo(() => {
    return vendorBills.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
  }, [vendorBills]);

  const totalRevenue = accountingData?.totalRevenue ? Number(accountingData.totalRevenue) : invoiceRevenue;
  const totalExpenses = accountingData?.expenses ? Number(accountingData.expenses) : billExpenses;
  const netProfit = totalRevenue - totalExpenses;

  const outstandingAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.amount_due || 0), 0);
  }, [invoices]);

  const unpaidInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => Number(inv.amount_due || 0) > 0).length;
  }, [invoices]);

  // Chart Data: Revenue vs Expenses over time
  const revenueExpensesChart = useMemo(() => {
    if (accountingData?.chartData && accountingData.chartData.length >= 3) {
      return accountingData.chartData.map((pt) => ({
        date: pt.date,
        revenue: pt.revenue,
        expenses: pt.expense,
      }));
    }

    const pointsCount = chartPeriod === "Weekly" ? 7 : 6;
    const now = new Date();
    const result = [];

    for (let i = pointsCount - 1; i >= 0; i--) {
      const d = new Date();
      if (chartPeriod === "Weekly") {
        d.setDate(now.getDate() - i);
      } else {
        d.setMonth(now.getMonth() - i);
      }
      const dateStr = d.toISOString().slice(0, 10);
      const label =
        chartPeriod === "Weekly"
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : d.toLocaleDateString("en-US", { month: "short" });

      let dayRev = 0;
      let dayExp = 0;

      invoices.forEach((inv) => {
        const invDate = String(inv.invoice_date || inv.created_at || "").slice(0, 10);
        if (chartPeriod === "Weekly" ? invDate === dateStr : invDate.slice(0, 7) === dateStr.slice(0, 7)) {
          dayRev += Number(inv.paid_amount || inv.amount_total || 0);
        }
      });

      vendorBills.forEach((b) => {
        const bDate = String(b.bill_date || b.created_at || "").slice(0, 10);
        if (chartPeriod === "Weekly" ? bDate === dateStr : bDate.slice(0, 7) === dateStr.slice(0, 7)) {
          dayExp += Number(b.amount_paid || b.amount_total || 0);
        }
      });

      result.push({
        date: label,
        revenue: dayRev,
        expenses: dayExp,
      });
    }

    return result;
  }, [accountingData?.chartData, chartPeriod, invoices, vendorBills]);

  // Donut 1: Task Status Breakdown
  const taskStatusDonut = useMemo(() => {
    const total = Math.max(totalTasksCount, 1);
    return [
      { name: "Completed", value: completedCount, color: primaryColor, count: `${completedCount} (${Math.round((completedCount / total) * 100)}%)` },
      { name: "In Progress", value: inProgressCount, color: secondaryColor, count: `${inProgressCount} (${Math.round((inProgressCount / total) * 100)}%)` },
      { name: "Pending", value: pendingCount, color: BRAND_AMBER, count: `${pendingCount} (${Math.round((pendingCount / total) * 100)}%)` },
      { name: "Overdue", value: overdueCount, color: BRAND_RED, count: `${overdueCount} (${Math.round((overdueCount / total) * 100)}%)` },
    ];
  }, [completedCount, inProgressCount, pendingCount, overdueCount, totalTasksCount, primaryColor, secondaryColor]);

  // Donut 2: Invoice Status Breakdown
  const invoiceStatusBreakdown = useMemo(() => {
    let paidTotal = 0;
    let partialTotal = 0;
    let unpaidTotal = 0;
    let overdueTotal = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    const now = new Date();

    invoices.forEach((inv) => {
      const due = Number(inv.amount_due || 0);
      const total = Number(inv.amount_total || 0);
      const isPastDue = inv.due_date ? new Date(inv.due_date) < now : false;

      if (inv.payment_state === "paid" || due <= 0) {
        paidTotal += total;
        paidCount += 1;
      } else if (inv.payment_state === "partial") {
        partialTotal += due;
        partialCount += 1;
      } else if (isPastDue) {
        overdueTotal += due;
        overdueCount += 1;
      } else {
        unpaidTotal += due;
        unpaidCount += 1;
      }
    });

    const grandTotal = paidTotal + partialTotal + unpaidTotal + overdueTotal;

    const donut = [
      { name: "Paid", value: paidTotal, count: `${paidCount} Invoice${paidCount === 1 ? "" : "s"}`, color: primaryColor },
      { name: "Partially Paid", value: partialTotal, count: `${partialCount} Invoice${partialCount === 1 ? "" : "s"}`, color: secondaryColor },
      { name: "Unpaid", value: unpaidTotal, count: `${unpaidCount} Invoice${unpaidCount === 1 ? "" : "s"}`, color: BRAND_AMBER },
      { name: "Overdue", value: overdueTotal, count: `${overdueCount} Invoice${overdueCount === 1 ? "" : "s"}`, color: BRAND_RED },
    ];

    return { donut, grandTotal, paidCount, partialCount, unpaidCount, overdueCount };
  }, [invoices, primaryColor, secondaryColor]);

  // Team Performance Data (100% Dynamic from Staff Users in DB)
  const teamMembers = useMemo(() => {
    const rawUsers = (usersRes?.data ?? []) as Array<{ id: string; name?: string; email?: string; jobTitle?: string; image?: string; avatar?: string }>;

    const userById = new Map<string, (typeof rawUsers)[0]>();
    const userByName = new Map<string, (typeof rawUsers)[0]>();
    rawUsers.forEach((u) => {
      if (u.id) userById.set(u.id, u);
      if (u.name) userByName.set(u.name.trim().toLowerCase(), u);
    });

    const staffMap = new Map<
      string,
      { id: string; name: string; avatar: string; image: string | null; tasks: number; completed: number; pending: number; percent: number }
    >();

    rawUsers.forEach((u) => {
      const name = u.name?.trim() || "Staff Member";
      const initials =
        name
          .split(" ")
          .filter(Boolean)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "ST";
      staffMap.set(u.id, {
        id: u.id,
        name,
        avatar: initials,
        image: u.image || (u as any).avatar || null,
        tasks: 0,
        completed: 0,
        pending: 0,
        percent: 0,
      });
    });

    allTasks.forEach((task) => {
      const assigneeId = task.assignedTo?.id || task.assignedToId;
      const assigneeName = task.assignedTo?.name || "Unassigned";
      if (!assigneeId && assigneeName === "Unassigned") return;

      const matchedUser = (assigneeId ? userById.get(assigneeId) : null) || (assigneeName ? userByName.get(assigneeName.trim().toLowerCase()) : null);
      const effectiveId = assigneeId || matchedUser?.id || assigneeName;
      const effectiveName = matchedUser?.name || assigneeName;
      const effectiveImage = matchedUser?.image || (matchedUser as any)?.avatar || (task.assignedTo as any)?.image || (task.assignedTo as any)?.avatar || null;

      if (!staffMap.has(effectiveId)) {
        const initials =
          effectiveName
            .split(" ")
            .filter(Boolean)
            .map((part: string) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "ST";
        staffMap.set(effectiveId, {
          id: effectiveId,
          name: effectiveName,
          avatar: initials,
          image: effectiveImage,
          tasks: 0,
          completed: 0,
          pending: 0,
          percent: 0,
        });
      } else {
        const existing = staffMap.get(effectiveId)!;
        if (!existing.image && effectiveImage) {
          existing.image = effectiveImage;
        }
      }
    });

    allTasks.forEach((task) => {
      const assigneeId = task.assignedTo?.id || task.assignedToId;
      const assigneeName = task.assignedTo?.name;
      const matchedUser = (assigneeId ? userById.get(assigneeId) : null) || (assigneeName ? userByName.get(assigneeName.trim().toLowerCase()) : null);
      const effectiveId = assigneeId || matchedUser?.id || assigneeName;

      const member = effectiveId ? staffMap.get(effectiveId) : (assigneeName ? staffMap.get(assigneeName) : null);
      if (!member) return;

      member.tasks += 1;
      const status = resolveTaskDisplayStatus(task);
      if (status === "completed") {
        member.completed += 1;
      } else {
        member.pending += 1;
      }
    });

    const members = Array.from(staffMap.values()).map((m) => ({
      ...m,
      percent: m.tasks > 0 ? Math.round((m.completed / m.tasks) * 100) : 0,
    }));

    members.sort((a, b) => b.tasks - a.tasks || b.percent - a.percent);
    return members.slice(0, 5);
  }, [allTasks, usersRes?.data]);

  const activeClientsCount = useMemo(() => {
    const clientIds = new Set<string>();
    allTasks.forEach((t) => {
      t.institutions?.forEach((inst) => {
        if (inst.id) clientIds.add(String(inst.id));
        if (inst.institution) clientIds.add(String(inst.institution));
      });
    });
    invoices.forEach((inv) => {
      if (inv.customer_id) clientIds.add(String(inv.customer_id));
    });
    return Math.min(clientIds.size, allClients.length || clientIds.size);
  }, [allTasks, invoices, allClients.length]);

  // Needs Attention Items
  const needsAttention = useMemo(() => {
    const overdueInvoicesCount = invoiceStatusBreakdown.overdueCount;
    const pendingQuotationsCount = quotations.filter((q) => String(q.status).toUpperCase() === "DRAFT" || String(q.status).toUpperCase() === "SENT").length;
    const unpaidBillsCount = vendorBills.filter((b) => Number(b.amount_due || 0) > 0).length;

    return [
      { label: "Overdue Tasks", count: overdueCount, tone: "red", Icon: AlertTriangle },
      { label: "Overdue Invoices", count: overdueInvoicesCount, tone: "red", Icon: FileText },
      { label: "Pending Quotations", count: pendingQuotationsCount, tone: "amber", Icon: FileSpreadsheet },
      { label: "Unpaid Vendor Bills", count: unpaidBillsCount, tone: "rose", Icon: CreditCard },
    ];
  }, [invoiceStatusBreakdown.overdueCount, overdueCount, quotations, vendorBills]);

  // Recent Tasks
  const recentTasks = useMemo(() => {
    return [...allTasks]
      .sort((a, b) => {
        const aTime = asDate(a.updatedAt ?? a.createdAt)?.getTime() ?? 0;
        const bTime = asDate(b.updatedAt ?? b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((t) => {
        const status = resolveTaskDisplayStatus(t);
        const statusTone =
          status === "completed"
            ? "maroon"
            : (status === "in progress" || status === "in_progress" || isTaskInProgress(t))
            ? "coral"
            : status === "overdue"
            ? "red"
            : "amber";
        const d = asDate(t.deadline);
        const dateStr = d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
        return {
          task: t.serviceInformation || t.description || "Task item",
          client: t.institutions?.[0]?.institution || "—",
          assigned: t.assignedTo?.name || "Unassigned",
          status: formatStatusLabel(status),
          statusTone,
          date: dateStr,
        };
      });
  }, [allTasks]);

  // Recent Transactions
  const recentTransactions = useMemo(() => {
    const list: Array<{
      type: string;
      ref: string;
      client: string;
      amount: string;
      status: string;
      statusTone: string;
      rawDate: Date;
    }> = [];

    invoices.forEach((inv) => {
      const d = asDate((inv.invoice_date || inv.created_at) as string | Date) || new Date();
      list.push({
        type: "Invoice",
        ref: inv.invoice_number || `INV-${inv.id}`,
        client: inv.customers?.name || "Customer",
        amount: formatMoney(Number(inv.amount_total || 0)),
        status: inv.payment_state === "paid" ? "Paid" : inv.payment_state === "partial" ? "Partially Paid" : "Unpaid",
        statusTone: inv.payment_state === "paid" ? "emerald" : inv.payment_state === "partial" ? "amber" : "gray",
        rawDate: d,
      });
    });

    vendorBills.forEach((b) => {
      const d = asDate((b.bill_date || b.created_at) as string | Date) || new Date();
      list.push({
        type: "Bill",
        ref: b.bill_number || `BILL-${b.id}`,
        client: b.vendors?.name || "Vendor",
        amount: formatMoney(Number(b.amount_total || 0)),
        status: b.payment_state === "paid" ? "Paid" : "Pending",
        statusTone: b.payment_state === "paid" ? "emerald" : "rose",
        rawDate: d,
      });
    });

    return list
      .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
      .slice(0, 5)
      .map((item) => ({
        ...item,
        date: item.rawDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }));
  }, [invoices, vendorBills]);

  const dateRangeLabel = useMemo(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    if (periodFilter === "Today") {
      return `Today, ${fmt.format(now)}`;
    }
    if (periodFilter === "Yesterday") {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return `Yesterday, ${fmt.format(y)}`;
    }
    if (periodFilter === "1 Week") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      return `${fmt.format(start)} – ${fmt.format(now)}, ${now.getFullYear()}`;
    }
    if (periodFilter === "Last Month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return `${fmt.format(start)} – ${fmt.format(end)}, ${start.getFullYear()}`;
    }
    if (periodFilter === "Custom" && customStart) {
      return `${customStart} – ${customEnd || "Now"}`;
    }
    return fmt.format(now);
  }, [periodFilter, customStart, customEnd]);

  return (
    <div className={cn(dashboardPageClass, "space-y-5")} style={dashboardPageStyle}>
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            {getGreeting()}, {userName} 👋
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Here&apos;s what&apos;s happening in your business ({dateRangeLabel}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter Pill Container matching Image 4 */}
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
            {(["Today", "Yesterday", "1 Week", "Last Month", "Custom"] as const).map((period) => {
              const isActive = periodFilter === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    setPeriodFilter(period);
                    if (period === "Custom") setShowCustomModal(true);
                  }}
                  className={cn(
                    "px-4 py-1.5 text-xs rounded-full transition-all duration-150",
                    isActive
                      ? "bg-[#5b1017] text-white font-bold shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900 font-medium hover:bg-zinc-50"
                  )}
                >
                  {period}
                </button>
              );
            })}
            <div className="h-4 w-px bg-zinc-200 mx-1" />
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isValidating}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 transition disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5 text-zinc-500", isValidating && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 1: Operations Metrics (4 Cards) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Tasks */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, white)`, color: primaryColor }}
            >
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Total Tasks</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{totalTasksCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">All registered tasks</p>
            </div>
          </div>
          <MiniSparkline color={primaryColor} />
        </div>

        {/* Completed Tasks */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, white)`, color: primaryColor }}
            >
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Completed Tasks</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{completedCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">{completionRate}% completion rate</p>
            </div>
          </div>
          <MiniSparkline color={primaryColor} />
        </div>

        {/* In Progress Tasks */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, white)`, color: secondaryColor }}
            >
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">In Progress Tasks</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{inProgressCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">{inProgressPercent}% of total</p>
            </div>
          </div>
          <MiniSparkline color={secondaryColor} />
        </div>

        {/* Overdue Tasks */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#dc2626]">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Overdue Tasks</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{overdueCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-red-500">
                {overdueCount > 0 ? "Requires attention" : "All tasks on schedule"}
              </p>
            </div>
          </div>
          <MiniSparkline color={BRAND_RED} />
        </div>
      </div>

      {/* ── ROW 2: Financial Metrics (4 Cards) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, white)`, color: primaryColor }}
            >
              <DollarSign className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Total Revenue</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(totalRevenue)}</h3>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">From posted revenues</p>
            </div>
          </div>
          <MiniSparkline color={primaryColor} />
        </div>

        {/* Total Expenses */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, white)`, color: secondaryColor }}
            >
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Total Expenses</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(totalExpenses)}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">Operating expenditures</p>
            </div>
          </div>
          <MiniSparkline color={secondaryColor} />
        </div>

        {/* Net Profit */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, white)`, color: primaryColor }}
            >
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Net Profit</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(netProfit)}</h3>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">
                {totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}% net margin` : "Net margin"}
              </p>
            </div>
          </div>
          <MiniSparkline color={primaryColor} />
        </div>

        {/* Outstanding */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, white)`, color: secondaryColor }}
            >
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Outstanding</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(outstandingAmount)}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">
                {unpaidInvoicesCount} unpaid invoice{unpaidInvoicesCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <MiniSparkline color={secondaryColor} />
        </div>
      </div>

      {/* ── ROW 3: Main Charts (Revenue vs Expenses & Task Status Donut) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Revenue vs Expenses Area/Line Chart (7 cols) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">Revenue vs Expenses</h3>
              <p className="text-[11px] text-zinc-400">Financial performance over time</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <span className="size-2 rounded-full" style={{ backgroundColor: primaryColor }} /> Revenue
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <span className="size-2 rounded-full" style={{ backgroundColor: secondaryColor }} /> Expenses
              </span>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as "Weekly" | "Monthly")}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 outline-none"
              >
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="mt-4 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueExpensesChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}`}
                />
                <Tooltip contentStyle={lightTooltipStyle} formatter={(val: unknown) => [`$${Number(val || 0).toLocaleString()}`, ""]} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={primaryColor}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: primaryColor, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke={secondaryColor}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: secondaryColor, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Task Status Donut Chart (5 cols) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-5">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Task Status</h3>
            <p className="text-[11px] text-zinc-400">Distribution of tasks by status</p>
          </div>

          <div className="mt-2 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="relative h-[210px] w-[210px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusDonut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {taskStatusDonut.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={lightTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[#0f172a]">{totalTasksCount}</span>
                <span className="text-[10px] font-medium text-zinc-400">Total Tasks</span>
              </div>
            </div>

            <div className="w-full space-y-2.5 sm:max-w-[190px]">
              {taskStatusDonut.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium text-zinc-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-zinc-800">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: Operational Breakdown (4 Columns Grid) ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Sales Overview */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Sales Overview</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <Users className="size-4" style={{ color: primaryColor }} /> Total Clients
                </span>
                <span className="font-bold text-[#0f172a]">{allClients.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <UserCheck className="size-4" style={{ color: primaryColor }} /> Active Clients
                </span>
                <span className="font-bold text-[#0f172a]">{activeClientsCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <FileText className="size-4" style={{ color: primaryColor }} /> Total Invoices
                </span>
                <span className="font-bold text-[#0f172a]">{invoices.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <Receipt className="size-4" style={{ color: primaryColor }} /> Paid Invoices
                </span>
                <span className="font-bold text-[#0f172a]">{invoiceStatusBreakdown.paidCount}</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5 text-xs">
                <span className="flex items-center gap-2 font-bold text-zinc-700">
                  <DollarSign className="size-4" style={{ color: primaryColor }} /> Outstanding
                </span>
                <span className="font-bold text-[#0f172a]">{formatMoney(outstandingAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Invoice Status */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Invoice Status</h3>
            <p className="text-[10px] text-zinc-400">Based on total amount</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="relative h-[110px] w-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={invoiceStatusBreakdown.donut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={2}
                  >
                    {invoiceStatusBreakdown.donut.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-[#0f172a]">{formatMoney(invoiceStatusBreakdown.grandTotal)}</span>
                <span className="text-[8px] text-zinc-400">Total</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 text-[11px]">
              {invoiceStatusBreakdown.donut.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-600">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-zinc-800">${Math.round(item.value).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Team Performance (Real Staff Performance from DB) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f172a]">Team Performance</h3>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="grid grid-cols-12 text-[10px] font-bold text-zinc-400">
              <span className="col-span-5">Staff</span>
              <span className="col-span-2 text-center">Tasks</span>
              <span className="col-span-2 text-center">Done</span>
              <span className="col-span-3 text-right">Completion</span>
            </div>
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <div key={member.name} className="grid grid-cols-12 items-center text-xs">
                  <div className="col-span-5 flex items-center gap-1.5 truncate font-semibold text-zinc-800">
                    {member.image ? (
                      <img
                        src={
                          member.image.startsWith("data:") ||
                          member.image.startsWith("http://") ||
                          member.image.startsWith("https://") ||
                          member.image.startsWith("/")
                            ? member.image
                            : `/${member.image}`
                        }
                        alt={member.name}
                        className="size-5 shrink-0 rounded-full object-cover border border-zinc-200"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span
                      className={`size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${member.image ? 'hidden' : 'flex'}`}
                      style={{
                        backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, white)`,
                        color: primaryColor,
                      }}
                    >
                      {member.avatar}
                    </span>
                    <span className="truncate" title={member.name}>{member.name}</span>
                  </div>
                  <span className="col-span-2 text-center font-medium text-zinc-600">{member.tasks}</span>
                  <span className="col-span-2 text-center font-medium text-zinc-600">{member.completed}</span>
                  <div className="col-span-3 flex items-center justify-end gap-1.5">
                    <div className="h-1.5 w-10 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${member.percent}%`, backgroundColor: primaryColor }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-700">{member.percent}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-zinc-400">No staff members found</div>
            )}
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2 text-right">
            <Link href="/staff" className="text-[11px] font-bold hover:underline" style={{ color: primaryColor }}>
              View All Staff →
            </Link>
          </div>
        </div>

        {/* Card 4: Needs Attention */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Needs Attention</h3>
            <div className="mt-3 space-y-2.5">
              {needsAttention.map(({ label, count, tone, Icon }) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-zinc-50/80 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("size-4", tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : "text-rose-500")} />
                    <span className="font-medium text-zinc-700">{label}</span>
                  </div>
                  <span className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
                    tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-rose-500"
                  )}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2 text-right">
            <Link href="/tasks" className="text-[11px] font-bold hover:underline" style={{ color: primaryColor }}>
              View All →
            </Link>
          </div>
        </div>
      </div>

      {/* ── ROW 5: Recent Activity & Quick Actions (3 Columns Grid) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Recent Tasks (5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-5">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0f172a]">Recent Tasks</h3>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="pb-2">Task</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {recentTasks.length > 0 ? (
                    recentTasks.map((t, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 pr-2 font-semibold text-zinc-800 truncate max-w-[120px]" title={t.task}>{t.task}</td>
                        <td className="py-2.5 pr-2 text-zinc-500 truncate max-w-[90px]">{t.client}</td>
                        <td className="py-2.5 pr-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                            style={
                              t.statusTone === "maroon"
                                ? { backgroundColor: `color-mix(in srgb, ${primaryColor} 14%, white)`, color: primaryColor }
                                : t.statusTone === "coral"
                                ? { backgroundColor: `color-mix(in srgb, ${secondaryColor} 16%, white)`, color: secondaryColor }
                                : t.statusTone === "amber"
                                ? { backgroundColor: "#fef3c7", color: "#b45309" }
                                : { backgroundColor: "#fee2e2", color: "#b91c1c" }
                            }
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-[11px] text-zinc-500">{t.date}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-xs text-zinc-400">No recent tasks</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2 text-center">
            <Link href="/tasks" className="text-[11px] font-bold hover:underline" style={{ color: primaryColor }}>
              View All Tasks →
            </Link>
          </div>
        </div>

        {/* Recent Transactions (4 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0f172a]">Recent Transactions</h3>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Client / Vendor</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 pr-2 font-semibold text-zinc-800">{tx.type}</td>
                        <td className="py-2.5 pr-2 text-zinc-500 truncate max-w-[80px]" title={tx.client}>{tx.client}</td>
                        <td className="py-2.5 pr-2 font-bold text-zinc-900">{tx.amount}</td>
                        <td className="py-2.5 text-right">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-bold",
                            tx.statusTone === "emerald" ? "bg-emerald-50 text-emerald-700" :
                            tx.statusTone === "amber" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"
                          )}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-xs text-zinc-400">No transactions recorded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2 text-center">
            <Link href="/accounting/reports" className="text-[11px] font-bold hover:underline" style={{ color: primaryColor }}>
              View All Transactions →
            </Link>
          </div>
        </div>

        {/* Quick Actions (3 cols) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-3">
          <h3 className="text-sm font-bold text-[#0f172a]">Quick Actions</h3>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Link
              href="/tasks/create"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm"
            >
              <Plus className="size-4" style={{ color: primaryColor }} />
              <span>New Task</span>
            </Link>
            <Link
              href="/clients"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm"
            >
              <Plus className="size-4" style={{ color: primaryColor }} />
              <span>New Client</span>
            </Link>
            <Link
              href="/accounting/quotations"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm"
            >
              <FileSpreadsheet className="size-4" style={{ color: primaryColor }} />
              <span>New Quotation</span>
            </Link>
            <Link
              href="/accounting/customer-invoices"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm"
            >
              <FileText className="size-4" style={{ color: primaryColor }} />
              <span>New Invoice</span>
            </Link>
            <Link
              href="/accounting/customer-receipts"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm"
            >
              <CreditCard className="size-4" style={{ color: primaryColor }} />
              <span>Record Payment</span>
            </Link>
            <Link
              href="/accounting/vendor-bills"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm"
            >
              <Plus className="size-4" style={{ color: primaryColor }} />
              <span>Add Expense</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Custom Date Range Dialog */}
      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Date Range</DialogTitle>
            <DialogDescription>Select start and end dates to filter dashboard records.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <label className="text-xs font-semibold text-zinc-600">From Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border px-3 text-xs outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600">To Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border px-3 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowCustomModal(false)}
              className="h-9 rounded-xl border px-4 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomModal(false);
                void handleRefresh();
              }}
              className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary/90"
            >
              Apply Range
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniSparkline({ color }: { color: string }) {
  return (
    <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="shrink-0 opacity-80">
      <path
        d="M2 18 L15 14 L28 19 L40 6 L58 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Root Dashboard Page
// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const session = authClient.useSession();
  const user = session.data?.user as
    | { id?: string; name?: string; role?: string; portfolioId?: string | null }
    | undefined;
  const normalizedRole = normalizeRoleName(user?.role);
  const isBranchDashboard = isBranchScopedRole(normalizedRole);

  useEffect(() => {
    if (mounted && !session.isPending && normalizedRole === "accounting") {
      router.replace("/accounting/dashboard");
    }
  }, [mounted, session.isPending, normalizedRole, router]);

  const { data: branchOptionsRes } = useSWR(
    mounted && isBranchDashboard && user?.portfolioId && !session.isPending
      ? ["dashboard-portfolio", user.portfolioId]
      : null,
    getTaskFormBranchOptions,
  );
  const branchName =
    branchOptionsRes?.data?.portfolios?.find(
      (p: { id: string; name: string }) => String(p.id) === String(user?.portfolioId ?? ""),
    )?.name ?? "";

  if (!mounted || session.isPending || normalizedRole === "accounting") {
    return (
      <div className="space-y-8 animate-pulse px-1">
        <div className="h-20 rounded-xl bg-muted/20" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-muted/20" />)}
        </div>
      </div>
    );
  }

  const userId = user?.id ?? "";

  if (normalizedRole === "staff") {
    return <StaffDashboard userId={userId} userName={user?.name || "Staff"} />;
  }

  if (normalizedRole === "manager") {
    return <ManagerDashboard userId={userId} userName={user?.name || "Manager"} />;
  }

  return (
    <AdminDashboard
      userId={userId}
      portfolioId={user?.portfolioId}
      branchName={branchName}
      isBranchDashboard={isBranchDashboard}
      userName={user?.name || "Super Admin"}
    />
  );
}




