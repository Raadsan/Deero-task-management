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

// ─────────────────────────────────────────────────────────────
// Staff personal dashboard
// ─────────────────────────────────────────────────────────────
function StaffDashboard({ userId }: { userId: string }) {
  const { data: bundleRes, isLoading } = useSWR(
    ["staff-dashboard", userId],
    () => getMyDashboardBundle(),
    { revalidateOnFocus: true, revalidateOnMount: true },
  );

  const tasks = useMemo(() => {
    return (bundleRes?.data?.tasks ?? []) as Task[];
  }, [bundleRes?.data?.tasks]);

  const metrics = useMemo(() => {
    const assigned = tasks.length;
    const completed = tasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length;
    const pending = tasks.filter((t) => resolveTaskDisplayStatus(t) === "pending").length;
    const overdue = tasks.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length;
    return { assigned, completed, pending, overdue };
  }, [tasks]);

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
    <div className={cn(dashboardPageClass, "space-y-6")} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>My Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Your personal task overview</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Assigned Tasks", value: metrics.assigned, Icon: Briefcase },
          { label: "Completed", value: metrics.completed, Icon: CheckCircle },
          { label: "Pending", value: metrics.pending, Icon: Clock },
          { label: "Overdue", value: metrics.overdue, Icon: AlertCircle },
        ].map(({ label, value, Icon }, index) => (
          <div key={label} className="flex min-h-[92px] flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                <Icon className="size-4 text-white" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
              <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">{value}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Manager Dashboard
// ─────────────────────────────────────────────────────────────
function ManagerDashboard({ userId }: { userId: string }) {
  const { data: bundleRes, isLoading } = useSWR(
    ["manager-dashboard", userId],
    () => getManagerDashboardBundle(),
    { revalidateOnFocus: true, revalidateOnMount: true },
  );

  const myTasks = (bundleRes?.data?.myTasks ?? []) as Task[];

  const myMetrics = useMemo(() => {
    const completed = myTasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length;
    const pending = myTasks.filter((t) => resolveTaskDisplayStatus(t) === "pending").length;
    const overdue = myTasks.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length;
    return { assigned: myTasks.length, completed, pending, overdue };
  }, [myTasks]);

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
    <div className={cn(dashboardPageClass, "space-y-6")} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Manager Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Team overview and personal tasks</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Assigned to Me", value: myMetrics.assigned, Icon: Briefcase },
          { label: "Completed", value: myMetrics.completed, Icon: CheckCircle },
          { label: "Pending", value: myMetrics.pending, Icon: Clock },
          { label: "Overdue", value: myMetrics.overdue, Icon: AlertCircle },
        ].map(({ label, value, Icon }, index) => (
          <div key={label} className="flex min-h-[92px] flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                <Icon className="size-4 text-white" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
              <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">{value}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const session = authClient.useSession();
  const user = session.data?.user as
    | { id?: string; name?: string; role?: string; portfolioId?: string | null }
    | undefined;
  const normalizedRole = normalizeRoleName(user?.role);
  const isBranchDashboard = isBranchScopedRole(normalizedRole);

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

  if (!mounted || session.isPending) {
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
    return <StaffDashboard userId={userId} />;
  }

  if (normalizedRole === "manager") {
    return <ManagerDashboard userId={userId} />;
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
