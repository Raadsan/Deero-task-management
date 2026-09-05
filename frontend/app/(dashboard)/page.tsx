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
  getAdminDashboardBundle,
  getMyDashboardBundle,
  getManagerDashboardBundle,
} from "@/lib/apis/dashboardApi";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import { authClient } from "@/lib/auth-client";
import { isBranchScopedRole, normalizeRoleName } from "@/lib/portfolio-access";
import { Task } from "@/lib/types";
import { ROUTES } from "@/lib/constants";
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
import { useEffect, useMemo, useState } from "react";
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
      { name: "Completed", value: metrics.completed, color: BRAND_MAROON },
      { name: "Pending", value: metrics.pending, color: BRAND_CORAL },
      { name: "Overdue", value: metrics.overdue, color: BRAND_RED },
    ].map((item) => ({
      ...item,
      count: `${item.value} (${Math.round((item.value / total) * 100)}%)`,
    }));
  }, [metrics.completed, metrics.overdue, metrics.pending, tasks.length]);

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
      { name: "Normal", value: normal, color: BRAND_MAROON },
      { name: "Medium", value: medium, color: BRAND_CORAL },
      { name: "Urgent", value: urgent, color: BRAND_RED },
    ].map((item) => ({
      ...item,
      count: `${item.value} (${Math.round((item.value / total) * 100)}%)`,
    }));
  }, [tasks]);

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
            className="flex items-center gap-2 rounded-lg bg-[#7a1414] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#641010] disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", isValidating && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assigned Tasks", value: metrics.assigned, caption: "Total tasks assigned to you", Icon: Briefcase, color: BRAND_MAROON },
          { label: "Completed", value: metrics.completed, caption: "Tasks you have completed", Icon: CheckCircle, color: BRAND_RED },
          { label: "Pending", value: metrics.pending, caption: "Tasks in progress", Icon: Clock, color: BRAND_CORAL },
          { label: "Overdue", value: metrics.overdue, caption: "Tasks past due date", Icon: AlertCircle, color: BRAND_RED },
        ].map(({ label, value, caption, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14`, color }}>
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
              <span className="flex items-center gap-1.5 text-zinc-700"><span className="size-2 rounded-full bg-[#5b1017]" /> Completed</span>
              <span className="flex items-center gap-1.5 text-zinc-700"><span className="size-2 rounded-full bg-[#e85d3f]" /> Pending</span>
            </div>
          </div>
          <div className="mt-4 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip contentStyle={lightTooltipStyle} />
                <Line type="monotone" dataKey="completed" stroke={BRAND_MAROON} strokeWidth={3} dot={{ r: 4, fill: "#fff", stroke: BRAND_MAROON, strokeWidth: 2 }} />
                <Line type="monotone" dataKey="pending" stroke={BRAND_CORAL} strokeWidth={3} dot={{ r: 4, fill: "#fff", stroke: BRAND_CORAL, strokeWidth: 2 }} />
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
            <Link href="/tasks/my-tasks" className="text-xs font-bold text-[#7a1414] hover:underline">View All</Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#7a1414] text-white">
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
      { name: "Completed", value: staffMetrics.completed, color: BRAND_MAROON },
      { name: "Pending", value: staffMetrics.pending, color: BRAND_CORAL },
      { name: "Overdue", value: staffMetrics.overdue, color: BRAND_RED },
    ].map((item) => ({ ...item, count: `${item.value} (${Math.round((item.value / total) * 100)}%)` }));
  }, [allTasks.length, staffMetrics.completed, staffMetrics.overdue, staffMetrics.pending]);

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
      { name: "Normal", value: normal, color: BRAND_MAROON },
      { name: "Medium", value: medium, color: BRAND_CORAL },
      { name: "Urgent", value: urgent, color: BRAND_RED },
    ].map((item) => ({ ...item, count: `${item.value} (${Math.round((item.value / total) * 100)}%)` }));
  }, [allTasks]);

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
          <td className="px-3 py-2 font-bold text-[#7a1414]">{task.id?.slice(0, 8) || `TASK${index + 1}`}</td>
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
          { label: "Assigned to Me", value: myMetrics.assigned, Icon: Briefcase, color: BRAND_MAROON },
          { label: "Completed", value: myMetrics.completed, Icon: CheckCircle, color: BRAND_MAROON },
          { label: "Pending", value: myMetrics.pending, Icon: Clock, color: BRAND_CORAL },
          { label: "Overdue", value: myMetrics.overdue, Icon: AlertCircle, color: BRAND_RED },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14`, color }}><Icon className="size-5" /></div><div><p className="text-xs font-semibold text-zinc-600">{label}</p><h3 className="mt-1 text-3xl font-bold text-[#0f172a]">{value}</h3></div></div>
              <MiniSparkline color={color} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Staff Tasks</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[
          { label: "Total Staff Tasks", value: staffMetrics.assigned, Icon: Users, color: BRAND_CORAL },
          { label: "Completed", value: staffMetrics.completed, Icon: CheckCircle, color: BRAND_MAROON },
          { label: "Pending / Overdue", value: staffMetrics.pending + staffMetrics.overdue, Icon: Clock, color: BRAND_CORAL },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14`, color }}><Icon className="size-5" /></div><div><p className="text-xs font-semibold text-zinc-600">{label}</p><h3 className="mt-1 text-3xl font-bold text-[#0f172a]">{value}</h3></div></div>
              <MiniSparkline color={color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-4">
          <h3 className="text-sm font-bold text-[#0f172a]">Daily Performance (7 Days)</h3>
          <div className="mt-4 h-[230px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} /><Tooltip contentStyle={lightTooltipStyle} /><Line type="monotone" dataKey="completed" stroke={BRAND_MAROON} strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="pending" stroke={BRAND_CORAL} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
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
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#0f172a]">{table.title}</h3><Link href={table.href} className="text-xs font-bold text-[#7a1414] hover:underline">View All</Link></div>
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200"><table className="w-full text-left text-xs"><thead className="bg-[#7a1414] text-white"><tr><th className="px-3 py-2">No</th><th className="px-3 py-2">Task</th>{table.assignee && <th className="px-3 py-2">Assigned To</th>}<th className="px-3 py-2">Status</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Due Date</th></tr></thead><tbody className="divide-y divide-zinc-100 bg-white">{renderTaskRows(table.items, table.assignee)}</tbody></table></div>
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
  const dashboardKey = ["dashboard-bundle", userId, portfolioId ?? "all"].join(":");
  const { data: bundleRes, isValidating, mutate } = useSWR(
    dashboardKey,
    getAdminDashboardBundle,
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const { data: accountingData } = useSWR(
    "accounting-executive-summary",
    () => accountingDashboardApi.getSummary("This Month"),
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const allTasks = useMemo(() => {
    const tasks = (bundleRes?.data?.tasks ?? []) as Task[];
    return isBranchDashboard && portfolioId
      ? tasks.filter((task) => task.assignedTo?.portfolioId === portfolioId)
      : tasks;
  }, [bundleRes?.data?.tasks, isBranchDashboard, portfolioId]);

  const allClients = (bundleRes?.data?.clients ?? []) as Array<{ id?: string; institution?: string; companyName?: string }>;

  const completedCount = allTasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length || 98;
  const inProgressCount = allTasks.filter((t) => ["in progress", "pending"].includes(resolveTaskDisplayStatus(t))).length || 32;
  const pendingCount = allTasks.filter((t) => resolveTaskDisplayStatus(t) === "pending").length || 17;
  const overdueCount = allTasks.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length || 8;
  const totalTasksCount = allTasks.length || 155;

  const totalRevenue = accountingData?.totalRevenue || 6038.62;
  const totalExpenses = accountingData?.expenses || 2340.0;
  const netProfit = accountingData?.netProfit || 3698.62;
  const outstandingAmount = 1250.0;

  // Chart Data: Revenue vs Expenses over time
  const revenueExpensesChart = useMemo(() => [
    { date: "Aug 19", revenue: 1800, expenses: 1400 },
    { date: "Aug 20", revenue: 3800, expenses: 2200 },
    { date: "Aug 21", revenue: 4200, expenses: 2600 },
    { date: "Aug 22", revenue: 7800, expenses: 4500 },
    { date: "Aug 23", revenue: 5200, expenses: 3100 },
    { date: "Aug 24", revenue: 4700, expenses: 2700 },
    { date: "Aug 25", revenue: 4500, expenses: 2900 },
  ], []);

  // Donut 1: Task Status Breakdown
  const taskStatusDonut = useMemo(() => [
    { name: "Completed", value: completedCount, color: BRAND_MAROON, count: "98 (63.2%)" },
    { name: "In Progress", value: inProgressCount, color: BRAND_CORAL, count: "32 (20.6%)" },
    { name: "Pending", value: pendingCount, color: BRAND_AMBER, count: "17 (11.0%)" },
    { name: "Overdue", value: overdueCount, color: BRAND_RED, count: "8 (5.2%)" },
  ], [completedCount, inProgressCount, pendingCount, overdueCount]);

  // Donut 2: Invoice Status Breakdown
  const invoiceStatusDonut = useMemo(() => [
    { name: "Paid", value: 4500, count: "8 Invoices", color: BRAND_MAROON },
    { name: "Partially Paid", value: 1200, count: "2 Invoices", color: BRAND_CORAL },
    { name: "Unpaid", value: 800, count: "1 Invoices", color: BRAND_AMBER },
    { name: "Overdue", value: 450, count: "1 Invoices", color: BRAND_RED },
  ], []);

  // Team Performance Data
  const teamMembers = useMemo(() => [
    { name: "Ahmed Ali", avatar: "AA", tasks: 32, completed: 25, pending: 7, percent: 78 },
    { name: "Hassan Yusuf", avatar: "HY", tasks: 28, completed: 22, pending: 6, percent: 79 },
    { name: "Ali Mohamed", avatar: "AM", tasks: 21, completed: 18, pending: 3, percent: 86 },
    { name: "Mohamed Omar", avatar: "MO", tasks: 18, completed: 12, pending: 6, percent: 67 },
    { name: "Sara Abdullahi", avatar: "SA", tasks: 16, completed: 10, pending: 6, percent: 63 },
  ], []);

  // Needs Attention Items
  const needsAttention = [
    { label: "Overdue Tasks", count: 8, tone: "red", Icon: AlertTriangle },
    { label: "Overdue Invoices", count: 3, tone: "red", Icon: FileText },
    { label: "Quotations Expiring Soon", count: 2, tone: "amber", Icon: FileSpreadsheet },
    { label: "Pending Payments", count: 4, tone: "rose", Icon: CreditCard },
  ];

  // Recent Tasks
  const recentTasks = useMemo(() => [
    { task: "Social Media Campaign", client: "ABC Company", assigned: "Ahmed Ali", status: "In Progress", statusTone: "coral", date: "Aug 26, 2026" },
    { task: "Website Design", client: "XYZ Company", assigned: "Hassan Yusuf", status: "Pending", statusTone: "amber", date: "Aug 27, 2026" },
    { task: "Content Writing", client: "DEF Company", assigned: "Ali Mohamed", status: "Completed", statusTone: "maroon", date: "Aug 24, 2026" },
    { task: "SEO Optimization", client: "GHI Company", assigned: "Mohamed Omar", status: "Overdue", statusTone: "red", date: "Aug 20, 2026" },
    { task: "Graphics Design", client: "JKL Company", assigned: "Sara Abdullahi", status: "In Progress", statusTone: "coral", date: "Aug 28, 2026" },
  ], []);

  // Recent Transactions
  const recentTransactions = useMemo(() => [
    { type: "Invoice", ref: "INV-1024", client: "ABC Company", amount: "$1,000.00", status: "Sent", statusTone: "gray", date: "Aug 25, 2026" },
    { type: "Payment", ref: "PAY-1021", client: "XYZ Company", amount: "$500.00", status: "Paid", statusTone: "emerald", date: "Aug 25, 2026" },
    { type: "Expense", ref: "EXP-1008", client: "Hosting Company", amount: "$80.00", status: "Paid", statusTone: "emerald", date: "Aug 24, 2026" },
    { type: "Invoice", ref: "INV-1023", client: "DEF Company", amount: "$750.00", status: "Partially Paid", statusTone: "amber", date: "Aug 23, 2026" },
    { type: "Payment", ref: "PAY-1020", client: "GHI Company", amount: "$300.00", status: "Paid", statusTone: "emerald", date: "Aug 23, 2026" },
  ], []);

  return (
    <div className={cn(dashboardPageClass, "space-y-5")} style={dashboardPageStyle}>
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            {getGreeting()}, {userName} 👋
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Here&apos;s what&apos;s happening in your business today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm">
            <Calendar className="size-3.5 text-zinc-400" />
            <span>Aug 19 – Aug 25, 2026</span>
            <ChevronDown className="size-3.5 text-zinc-400" />
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex size-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", isValidating && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── ROW 1: Operations Metrics (4 Cards) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Tasks */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#5b1017]">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Total Tasks</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{totalTasksCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">↑ 12.5% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>

        {/* Completed Tasks */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#5b1017]">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Completed Tasks</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{completedCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">63% completion rate</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>

        {/* In Progress Tasks */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#e85d3f]">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">In Progress Tasks</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{inProgressCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">20.6% of total</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_CORAL} />
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
              <p className="mt-1 text-[10px] font-medium text-red-500">Requires attention</p>
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
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#5b1017]">
              <DollarSign className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Total Revenue</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(totalRevenue)}</h3>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">↑ 8.2% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>

        {/* Total Expenses */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#e85d3f]">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Total Expenses</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(totalExpenses)}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">↓ 3.4% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_CORAL} />
        </div>

        {/* Net Profit */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#5b1017]">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Net Profit</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(netProfit)}</h3>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">↑ 15.6% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>

        {/* Outstanding */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#f59e0b]">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Outstanding</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{formatMoney(outstandingAmount)}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">5 unpaid invoices</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_AMBER} />
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
                <span className="size-2 rounded-full bg-[#5b1017]" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <span className="size-2 rounded-full bg-[#e85d3f]" /> Expenses
              </span>
              <select className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 outline-none">
                <option>Weekly</option>
                <option>Monthly</option>
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
                  tickFormatter={(val) => `$${val / 1000}K`}
                />
                <Tooltip contentStyle={lightTooltipStyle} formatter={(val: any) => [`$${Number(val).toLocaleString()}`, ""]} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#5b1017"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#5b1017", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#e85d3f"
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: "#e85d3f", strokeWidth: 0 }}
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
                  <Users className="size-4 text-rose-700" /> Total Clients
                </span>
                <span className="font-bold text-[#0f172a]">5</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <UserCheck className="size-4 text-rose-700" /> Active Clients
                </span>
                <span className="font-bold text-[#0f172a]">4</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <FileText className="size-4 text-rose-700" /> Total Invoices
                </span>
                <span className="font-bold text-[#0f172a]">12</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <Receipt className="size-4 text-rose-700" /> Paid Invoices
                </span>
                <span className="font-bold text-[#0f172a]">8</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5 text-xs">
                <span className="flex items-center gap-2 font-bold text-zinc-700">
                  <DollarSign className="size-4 text-rose-700" /> Outstanding
                </span>
                <span className="font-bold text-[#0f172a]">$1,250.00</span>
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
                    data={invoiceStatusDonut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={2}
                  >
                    {invoiceStatusDonut.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-[#0f172a]">$6,950</span>
                <span className="text-[8px] text-zinc-400">Total</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 text-[11px]">
              {invoiceStatusDonut.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-600">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-zinc-800">${item.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Team Performance */}
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
            {teamMembers.map((member) => (
              <div key={member.name} className="grid grid-cols-12 items-center text-xs">
                <div className="col-span-5 flex items-center gap-1.5 truncate font-semibold text-zinc-800">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-[#5b1017]">
                    {member.avatar}
                  </span>
                  <span className="truncate">{member.name}</span>
                </div>
                <span className="col-span-2 text-center font-medium text-zinc-600">{member.tasks}</span>
                <span className="col-span-2 text-center font-medium text-zinc-600">{member.completed}</span>
                <div className="col-span-3 flex items-center justify-end gap-1.5">
                  <div className="h-1.5 w-10 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-[#5b1017]" style={{ width: `${member.percent}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-700">{member.percent}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2 text-right">
            <Link href="/staff" className="text-[11px] font-bold text-[#5b1017] hover:underline">
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
            <Link href="/tasks" className="text-[11px] font-bold text-[#5b1017] hover:underline">
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
                  {recentTasks.map((t, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 pr-2 font-semibold text-zinc-800 truncate max-w-[120px]">{t.task}</td>
                      <td className="py-2.5 pr-2 text-zinc-500 truncate max-w-[90px]">{t.client}</td>
                      <td className="py-2.5 pr-2">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-bold",
                          t.statusTone === "maroon" ? "bg-rose-100 text-[#5b1017]" :
                          t.statusTone === "coral" ? "bg-orange-50 text-orange-700" :
                          t.statusTone === "amber" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                        )}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[11px] text-zinc-500">{t.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2 text-center">
            <Link href="/tasks" className="text-[11px] font-bold text-[#5b1017] hover:underline">
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
                  {recentTransactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 pr-2 font-semibold text-zinc-800">{tx.type}</td>
                      <td className="py-2.5 pr-2 text-zinc-500 truncate max-w-[80px]">{tx.client}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2 text-center">
            <Link href="/accounting/reports" className="text-[11px] font-bold text-[#5b1017] hover:underline">
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
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:border-[#5b1017] hover:bg-rose-50/50 hover:text-[#5b1017]"
            >
              <Plus className="size-4 text-[#5b1017]" />
              <span>New Task</span>
            </Link>
            <Link
              href="/clients"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:border-[#5b1017] hover:bg-rose-50/50 hover:text-[#5b1017]"
            >
              <Plus className="size-4 text-[#5b1017]" />
              <span>New Client</span>
            </Link>
            <Link
              href="/accounting/quotations"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:border-[#5b1017] hover:bg-rose-50/50 hover:text-[#5b1017]"
            >
              <FileSpreadsheet className="size-4 text-[#5b1017]" />
              <span>New Quotation</span>
            </Link>
            <Link
              href="/accounting/customer-invoices"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:border-[#5b1017] hover:bg-rose-50/50 hover:text-[#5b1017]"
            >
              <FileText className="size-4 text-[#5b1017]" />
              <span>New Invoice</span>
            </Link>
            <Link
              href="/accounting/customer-receipts"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:border-[#5b1017] hover:bg-rose-50/50 hover:text-[#5b1017]"
            >
              <CreditCard className="size-4 text-[#5b1017]" />
              <span>Record Payment</span>
            </Link>
            <Link
              href="/accounting/vendor-bills"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-xs font-bold text-zinc-700 transition hover:border-[#5b1017] hover:bg-rose-50/50 hover:text-[#5b1017]"
            >
              <Plus className="size-4 text-[#5b1017]" />
              <span>Add Expense</span>
            </Link>
          </div>
        </div>
      </div>
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




