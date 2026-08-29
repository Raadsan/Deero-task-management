"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDashboardBundle } from "@/lib/apis/dashboardApi";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import { Task } from "@/lib/types";
import {
  chartAxisTick,
  chartPrimary,
  chartPrimaryVariants,
  chartSecondary,
  chartTooltipStyle,
  dashboardPageClass,
  dashboardPageStyle,
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
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
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

type DashboardPeriod = "today" | "yesterday" | "week" | "month" | "custom";

type DashboardClient = {
  id?: string;
  institution?: string;
  companyName?: string | null;
  createdAt?: string | Date | null;
};

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

function asDate(value?: string | Date) {
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

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function TaskManagementDashboard({
  userId = "",
  portfolioId = null,
  branchName = "",
  isBranchDashboard = false,
  userName = "Super Admin",
}: {
  userId?: string;
  portfolioId?: string | null;
  branchName?: string;
  isBranchDashboard?: boolean;
  userName?: string;
}) {
  const dashboardKey = ["dashboard-bundle", userId, portfolioId ?? "all"].join(":");
  const { data: bundleRes, isLoading, isValidating, mutate } = useSWR(
    dashboardKey,
    getAdminDashboardBundle,
    { revalidateOnFocus: false, revalidateOnMount: true },
  );

  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const todayValue = dateInputValue(new Date());
  const [customFrom, setCustomFrom] = useState(todayValue);
  const [customTo, setCustomTo] = useState(todayValue);
  const [portfolioFilter, setPortfolioFilter] = useState<string | null>(null);

  const { data: portfolioRes } = useSWR("dashboard-all-portfolios", getTaskFormBranchOptions);
  const allPortfolios = portfolioRes?.data?.portfolios ?? [];

  // Filter tasks by branch / portfolio
  const allTasks = useMemo(() => {
    const tasks = (bundleRes?.data?.tasks ?? []) as Task[];
    const byBranch = isBranchDashboard && portfolioId
      ? tasks.filter((task) => task.assignedTo?.portfolioId === portfolioId)
      : tasks;
    if (portfolioFilter) {
      return byBranch.filter((task) => String(task.assignedTo?.portfolioId) === portfolioFilter);
    }
    return byBranch;
  }, [bundleRes?.data?.tasks, isBranchDashboard, portfolioId, portfolioFilter]);

  const allClients = (bundleRes?.data?.clients ?? []) as DashboardClient[];

  // Compute dynamic date range
  const range = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    if (period === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (period === "week") {
      start.setDate(start.getDate() - 6);
    } else if (period === "month") {
      start.setDate(start.getDate() - 29);
    } else if (period === "custom") {
      const parsedStart = new Date(`${customFrom}T00:00:00`);
      const parsedEnd = new Date(`${customTo}T23:59:59.999`);
      if (!Number.isNaN(parsedStart.getTime())) start.setTime(parsedStart.getTime());
      if (!Number.isNaN(parsedEnd.getTime())) end.setTime(parsedEnd.getTime());
    }
    return { start, end };
  }, [period, customFrom, customTo]);

  const inRange = (value?: string | Date | null) => {
    const date = asDate(value ?? undefined);
    return Boolean(date && date >= range.start && date <= range.end);
  };

  // Filter tasks in selected date range
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => inRange(task.createdAt ?? task.deadline));
  }, [allTasks, range.start, range.end]);

  // Status breakdown
  const statusData = useMemo(() => {
    const statuses = ["completed", "in progress", "pending", "overdue"];
    return statuses.map((status) => ({
      name: formatStatusLabel(status),
      value: filteredTasks.filter((task) => resolveTaskDisplayStatus(task) === status).length,
    }));
  }, [filteredTasks]);

  const completedCount = filteredTasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length;
  const inProgressCount = filteredTasks.filter((t) => resolveTaskDisplayStatus(t) === "in progress").length;
  const pendingCount = filteredTasks.filter((t) => resolveTaskDisplayStatus(t) === "pending").length;
  const overdueCount = filteredTasks.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length;

  // Staff Performance (Assigned vs Completed)
  const staffPerformance = useMemo(() => {
    const staff = new Map<string, { name: string; assigned: number; completed: number }>();
    filteredTasks.forEach((task) => {
      const id = task.assignedTo?.id || "unassigned";
      const name = task.assignedTo?.name || "Unassigned";
      if (name === "Unassigned") return;
      const row = staff.get(id) ?? { name, assigned: 0, completed: 0 };
      row.assigned += 1;
      if (resolveTaskDisplayStatus(task) === "completed") row.completed += 1;
      staff.set(id, row);
    });
    return Array.from(staff.values()).sort((a, b) => b.assigned - a.assigned).slice(0, 5);
  }, [filteredTasks]);

  // Clients by Tasks
  const clientsByTasks = useMemo(() => {
    const clients = new Map<string, { id: string; name: string; total: number; completed: number; inProgress: number; overdue: number }>();
    filteredTasks.forEach((task) => {
      task.institutions?.forEach((client) => {
        const id = String(client.id);
        const name = client.institution || "Unnamed client";
        const row = clients.get(id) ?? { id, name, total: 0, completed: 0, inProgress: 0, overdue: 0 };
        row.total += 1;
        const status = resolveTaskDisplayStatus(task);
        if (status === "completed") row.completed += 1;
        else if (status === "overdue") row.overdue += 1;
        else row.inProgress += 1;
        clients.set(id, row);
      });
    });
    return Array.from(clients.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredTasks]);

  // Task Overview Trend
  const taskTrend = useMemo(() => {
    const days = Math.max(1, Math.min(14, Math.ceil((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1));
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(range.end);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (days - 1 - index));
      const tasks = filteredTasks.filter((task) => {
        const taskDate = asDate(task.createdAt ?? task.deadline);
        return taskDate ? sameDay(taskDate, date) : false;
      });
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        created: tasks.length,
        completed: tasks.filter((task) => resolveTaskDisplayStatus(task) === "completed").length,
      };
    });
  }, [filteredTasks, range.start, range.end]);

  // My Tasks Count
  const myTasksCount = useMemo(() => {
    if (!userId) return 0;
    const targetId = String(userId).toLowerCase();
    return filteredTasks.filter((t: any) => {
      const taskAssigneeId = String(
        t.assignedTo?.id ?? t.assigneeId ?? t.assgineeId ?? t.userId ?? "",
      ).toLowerCase();
      return taskAssigneeId === targetId;
    }).length;
  }, [filteredTasks, userId]);

  // Unique staff assigned in period
  const staffAssignedInPeriod = useMemo(() => {
    const ids = new Set<string>();
    filteredTasks.forEach((task: any) => {
      const id = task.assignedTo?.id ?? task.assigneeId ?? task.assgineeId ?? task.userId;
      if (id) ids.add(String(id));
    });
    return ids.size;
  }, [filteredTasks]);

  // Priority Breakdown
  const priorityBreakdown = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    filteredTasks.forEach((t) => {
      const p = String(t.priority || "").toLowerCase();
      if (p.includes("urgent") || p.includes("high")) high += 1;
      else if (p.includes("medium")) medium += 1;
      else low += 1;
    });
    return [
      { name: "High", value: high, color: BRAND_MAROON, count: `${high}` },
      { name: "Medium", value: medium, color: BRAND_CORAL, count: `${medium}` },
      { name: "Low", value: low, color: BRAND_AMBER, count: `${low}` },
    ];
  }, [filteredTasks]);

  // Upcoming Deadlines (Next 5 tasks sorted by deadline)
  const upcomingDeadlines = useMemo(() => {
    return filteredTasks
      .filter((t) => t.deadline)
      .sort((a, b) => new Date(String(a.deadline)).getTime() - new Date(String(b.deadline)).getTime())
      .slice(0, 5)
      .map((t) => ({
        title: t.serviceInformation || t.description?.slice(0, 32) || "Task item",
        date: asDate(t.deadline)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "Upcoming",
      }));
  }, [filteredTasks]);

  const taskStatusDonut = [
    { name: "Completed", value: completedCount, color: BRAND_MAROON, count: `${completedCount}` },
    { name: "In Progress", value: inProgressCount, color: BRAND_CORAL, count: `${inProgressCount}` },
    { name: "Pending", value: pendingCount, color: BRAND_AMBER, count: `${pendingCount}` },
    { name: "Overdue", value: overdueCount, color: BRAND_RED, count: `${overdueCount}` },
  ];

  const maxClientTasks = clientsByTasks[0]?.total || 1;

  return (
    <div className={cn(dashboardPageClass, "space-y-5")} style={dashboardPageStyle}>
      {/* ── Top Header with Left Portfolio Pills & Right Date Range Pills ── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            Welcome back, {userName} 👋
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {isBranchDashboard && branchName ? `Showing data for ${branchName}` : "Here's what's happening in your business today."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Left Pill Group: Portfolios / Branches */}
          {!isBranchDashboard && allPortfolios.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setPortfolioFilter(null)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                  portfolioFilter === null ? "bg-[#5b1017] text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                All
              </button>
              {allPortfolios.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPortfolioFilter(portfolioFilter === p.id ? null : p.id)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                    portfolioFilter === p.id ? "bg-[#5b1017] text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Right Pill Group: Date Range Filter */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-sm">
            {([
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["week", "1 Week"],
              ["month", "Last Month"],
              ["custom", "Custom"],
            ] as Array<[DashboardPeriod, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                  period === value ? "bg-[#5b1017] text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                {label}
              </button>
            ))}

            {period === "custom" && (
              <div className="flex items-center gap-1.5 px-1 text-xs">
                <input
                  aria-label="From date"
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold outline-none"
                />
                <span className="text-zinc-400">to</span>
                <input
                  aria-label="To date"
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => mutate()}
              disabled={isValidating}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", isValidating && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 1: 6 KPI Metric Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* TOTAL TASKS */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5b1017] text-white">
              <Briefcase className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">TOTAL TASKS</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{filteredTasks.length}</h3>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">↑ 12.5% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>

        {/* MY TASKS */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5b1017] text-white">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">MY TASKS</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{myTasksCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">↑ 8.2% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>

        {/* IN PROGRESS */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e85d3f] text-white">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">IN PROGRESS</p>
            <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{inProgressCount}</h3>
            <p className="mt-1 text-[10px] font-medium text-zinc-400">— 0% vs last week</p>
          </div>
        </div>

        {/* COMPLETED */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5b1017] text-white">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">COMPLETED</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{completedCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">↑ 18.6% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>

        {/* OVERDUE TASKS */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#dc2626] text-white">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">OVERDUE TASKS</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{overdueCount}</h3>
              <p className="mt-1 text-[10px] font-medium text-red-500">↓ 3.1% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_RED} />
        </div>

        {/* STAFFS */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5b1017] text-white">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">STAFFS</p>
              <h3 className="mt-0.5 text-2xl font-bold text-[#0f172a]">{staffAssignedInPeriod}</h3>
              <p className="mt-1 text-[10px] font-medium text-zinc-400">— 0% vs last week</p>
            </div>
          </div>
          <MiniSparkline color={BRAND_MAROON} />
        </div>
      </div>

      {/* ── ROW 2: Main Operations Charts (2 Equal Columns Grid) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: Tasks Overview Curve */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">TASKS OVERVIEW</h3>
              <p className="text-[11px] text-zinc-400">Created vs Completed Tasks</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <span className="size-2 rounded-full bg-[#5b1017]" /> Created
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <span className="size-2 rounded-full bg-[#e85d3f]" /> Completed
              </span>
            </div>
          </div>

          <div className="mt-4 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={taskTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip contentStyle={lightTooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="#5b1017"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#5b1017", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#e85d3f"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#e85d3f", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Staff Performance Dual Bars */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">STAFF PERFORMANCE</h3>
              <p className="text-[11px] text-zinc-400">Assigned Tasks vs Completed Tasks</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <span className="size-2 rounded-full bg-[#5b1017]" /> Assigned
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <span className="size-2 rounded-full bg-[#e85d3f]" /> Completed
              </span>
            </div>
          </div>

          <div className="mt-4 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip contentStyle={lightTooltipStyle} />
                <Bar dataKey="assigned" fill="#5b1017" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#e85d3f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ROW 3: 4 Columns Grid ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Task Statuses */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">TASK STATUSES</h3>
            <p className="text-[10px] text-zinc-400">Current Status Distribution</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="relative h-[110px] w-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusDonut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={2}
                  >
                    {taskStatusDonut.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-[#0f172a]">{filteredTasks.length}</span>
                <span className="text-[8px] text-zinc-400">Total Tasks</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 text-[11px]">
              {taskStatusDonut.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-zinc-800">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Clients By Tasks */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">CLIENTS BY TASKS</h3>
            <p className="text-[10px] text-zinc-400">Top clients by total tasks</p>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {clientsByTasks.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-2">
                <span className="w-24 truncate font-medium text-zinc-600">{item.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-[#5b1017]"
                    style={{ width: `${Math.round((item.total / maxClientTasks) * 100)}%` }}
                  />
                </div>
                <span className="w-5 text-right font-bold text-zinc-800">{item.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Task Priority */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">TASK PRIORITY</h3>
            <p className="text-[10px] text-zinc-400">Tasks by Priority</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="relative h-[110px] w-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={2}
                  >
                    {priorityBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-[#0f172a]">{filteredTasks.length}</span>
                <span className="text-[8px] text-zinc-400">Total Tasks</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 text-[11px]">
              {priorityBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-zinc-800">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: Upcoming Deadlines */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">UPCOMING DEADLINES</h3>
            <p className="text-[10px] text-zinc-400">Next 5 tasks due soon</p>
          </div>

          <div className="mt-3 space-y-2.5 text-xs">
            {upcomingDeadlines.length ? (
              upcomingDeadlines.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <CalendarDays className="size-4 shrink-0 text-red-500" />
                    <span className="truncate font-semibold text-zinc-800">{item.title}</span>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-zinc-500">{item.date}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-xs text-zinc-400">No upcoming deadlines</p>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 4: 2 Columns Grid (Recent Tasks & Top Clients) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Tasks */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">RECENT TASKS</h3>
            <p className="text-[10px] text-zinc-400">Latest tasks in the selected period</p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="pb-2">TASK</th>
                    <th className="pb-2">CLIENT</th>
                    <th className="pb-2">STAFF</th>
                    <th className="pb-2">STATUS</th>
                    <th className="pb-2 text-right">DUE DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredTasks.slice(0, 6).map((t, idx) => {
                    const displayStatus = resolveTaskDisplayStatus(t);
                    return (
                      <tr key={t.id ?? idx} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 pr-2 font-semibold text-zinc-800 truncate max-w-[120px]">
                          {t.serviceInformation || t.description?.slice(0, 32) || "Task item"}
                        </td>
                        <td className="py-2.5 pr-2 text-zinc-500 truncate max-w-[90px]">
                          {t.institutions?.[0]?.institution || "N/A"}
                        </td>
                        <td className="py-2.5 pr-2 text-zinc-600 truncate max-w-[80px]">
                          {t.assignedTo?.name || "Unassigned"}
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(displayStatus))}>
                            {formatStatusLabel(displayStatus)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-[11px] text-zinc-500">
                          {asDate(t.deadline)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 border-t border-zinc-100 pt-2">
            <Link href="/tasks" className="text-[11px] font-bold text-[#5b1017] hover:underline">
              View All Tasks →
            </Link>
          </div>
        </div>

        {/* Top Clients Table */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">TOP CLIENTS</h3>
            <p className="text-[10px] text-zinc-400">Clients ranked by task volume</p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="pb-2">CLIENT</th>
                    <th className="pb-2 text-center">TOTAL TASKS</th>
                    <th className="pb-2 text-center">COMPLETED</th>
                    <th className="pb-2 text-center">IN PROGRESS</th>
                    <th className="pb-2 text-right">OVERDUE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {clientsByTasks.map((c, idx) => (
                    <tr key={c.id ?? idx} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 pr-2 font-semibold text-zinc-800">{c.name}</td>
                      <td className="py-2.5 text-center font-bold text-zinc-900">{c.total}</td>
                      <td className="py-2.5 text-center text-zinc-600">{c.completed}</td>
                      <td className="py-2.5 text-center text-zinc-600">{c.inProgress}</td>
                      <td className="py-2.5 text-right font-medium text-red-600">{c.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 border-t border-zinc-100 pt-2">
            <Link href="/clients" className="text-[11px] font-bold text-[#5b1017] hover:underline">
              View All Clients →
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
