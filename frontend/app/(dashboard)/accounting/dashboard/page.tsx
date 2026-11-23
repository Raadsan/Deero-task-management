"use client";

import { useEffect, useMemo, useState } from "react";
import {
  accountingDashboardApi,
  emptyAccountingDashboard,
  type AccountingDashboardData,
} from "@/lib/api/accounting/accountingDashboardApi";
import {
  dashboardPageClass,
  dashboardPageStyle,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeadRowClass,
  dashboardTableHeaderClass,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  chartAxisTick,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarDays,
  DollarSign,
  Landmark,
  Percent,
  ReceiptText,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DashboardPeriod = "today" | "yesterday" | "week" | "month" | "custom";

const BRAND_PRIMARY = "var(--color-brand-primary, #5f3a16)";
const BRAND_SECONDARY = "var(--color-brand-secondary, #c3986b)";
const ROSE = "#e11d48";
const EMERALD = "#059669";
const AMBER = "#d97706";
const SKY = "#0284c7";

const lightTooltipStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  color: "#1e293b",
  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.08)",
  padding: "10px 14px",
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

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function AccountingDashboard() {
  const session = authClient.useSession();
  const userName = session.data?.user?.name || "Accounting";
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const todayValue = dateInputValue(new Date());
  const [customFrom, setCustomFrom] = useState(todayValue);
  const [customTo, setCustomTo] = useState(todayValue);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<AccountingDashboardData | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let label = "This Month";
      let customStart: string | undefined;
      let customEnd: string | undefined;

      if (period === "today") label = "Today";
      else if (period === "yesterday") label = "Yesterday";
      else if (period === "week") label = "This Week";
      else if (period === "month") label = "Last Month";
      else if (period === "custom") {
        label = "Custom";
        customStart = customFrom;
        customEnd = customTo;
      }

      const result = await accountingDashboardApi.getSummary(label, customStart, customEnd);
      setData(result);
    } catch (error) {
      setData(emptyAccountingDashboard());
      setLoadError(
        error instanceof Error ? error.message : "Failed to load accounting data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, [period, customFrom, customTo]);

  const totalRevenue = data?.totalRevenue ?? 0;
  const expenses = data?.expenses ?? 0;
  const netProfit = data?.netProfit ?? 0;
  const cashBalance = data?.cashBalance ?? 0;
  const bankBalance = data?.bankBalance ?? 0;

  const chartData = useMemo(() => data?.chartData ?? [], [data]);
  const expenseBreakdown = useMemo(() => data?.expenseBreakdown ?? [], [data]);
  const recentTransactions = useMemo(() => data?.recentTransactions ?? [], [data]);
  const hasChartPoints = chartData.length > 0;
  const hasExpenseBreakdown = expenseBreakdown.length > 0;

  return (
    <div className={cn(dashboardPageClass, "space-y-6")} style={dashboardPageStyle}>
      {/* ── Page Header matching Task Management Dashboard ── */}
      <div className={cn(pageHeaderWrapperClass, "flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between")}>
        <div>
          <h1 className={pageHeaderTitleClass}>
            {getGreeting()}, {userName} 👋
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Financial metrics, cash flow, revenue and expense breakdown
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
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
                "rounded-xl px-3 py-2 text-[11px] font-bold transition-all",
                period === value
                  ? "btn-brand shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              {label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 px-1">
              <CalendarDays className="size-4 text-zinc-400" />
              <input
                aria-label="From date"
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                aria-label="To date"
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(event) => setCustomTo(event.target.value)}
                className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary"
              />
            </div>
          )}
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="ml-1 flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-zinc-50 disabled:opacity-60 transition"
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {loadError}. Figures below show zeros until reports load successfully.
        </div>
      )}

      {/* ── 5 KPI Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Total Revenue */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <DollarSign className="size-4.5" />
              </span>
              <span className="text-xs font-semibold text-zinc-700">Total Revenue</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <h3 className={cn("text-2xl font-bold text-[#0f172a]", isLoading && "animate-pulse text-zinc-400")}>
                {isLoading && !data ? "—" : formatMoney(totalRevenue)}
              </h3>
            </div>
            {hasChartPoints ? <MiniSparkline points={chartData.map((p) => p.revenue)} color={BRAND_PRIMARY} /> : null}
          </div>
        </div>

        {/* Expenses */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <ReceiptText className="size-4.5" />
              </span>
              <span className="text-xs font-semibold text-zinc-700">Expenses</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <h3 className={cn("text-2xl font-bold text-[#0f172a]", isLoading && "animate-pulse text-zinc-400")}>
                {isLoading && !data ? "—" : formatMoney(expenses)}
              </h3>
            </div>
            {hasChartPoints ? <MiniSparkline points={chartData.map((p) => p.expense)} color={ROSE} /> : null}
          </div>
        </div>

        {/* Net Profit */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Percent className="size-4.5" />
              </span>
              <span className="text-xs font-semibold text-zinc-700">Net Profit</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <h3 className={cn("text-2xl font-bold text-[#0f172a]", isLoading && "animate-pulse text-zinc-400")}>
                {isLoading && !data ? "—" : formatMoney(netProfit)}
              </h3>
            </div>
            {hasChartPoints ? (
              <MiniSparkline
                points={chartData.map((p) => p.revenue - p.expense)}
                color={EMERALD}
              />
            ) : null}
          </div>
        </div>

        {/* Cash Balance */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <Wallet className="size-4.5" />
              </span>
              <span className="text-xs font-semibold text-zinc-700">Cash Balance</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <h3 className={cn("text-2xl font-bold text-[#0f172a]", isLoading && "animate-pulse text-zinc-400")}>
                {isLoading && !data ? "—" : formatMoney(cashBalance)}
              </h3>
            </div>
            {hasChartPoints ? <MiniSparkline points={chartData.map((p) => p.cashIn)} color={BRAND_SECONDARY} /> : null}
          </div>
        </div>

        {/* Bank Balance */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Landmark className="size-4.5" />
              </span>
              <span className="text-xs font-semibold text-zinc-700">Bank Balance</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <h3 className={cn("text-2xl font-bold text-[#0f172a]", isLoading && "animate-pulse text-zinc-400")}>
                {isLoading && !data ? "—" : formatMoney(bankBalance)}
              </h3>
            </div>
            {hasChartPoints ? <MiniSparkline points={chartData.map((p) => p.cashIn - p.cashOut)} color={SKY} /> : null}
          </div>
        </div>
      </div>

      {/* ── 3 Analytics Charts Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue vs Expense Area Chart */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#0f172a]">
                Revenue vs Expense
              </h3>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Income and spending curves
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                <span className="size-2 rounded-full bg-primary" /> Revenue
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                <span className="size-2 rounded-full bg-secondary" /> Expense
              </span>
            </div>
          </div>

          <div className="mt-4 h-[280px] w-full">
            {!hasChartPoints ? (
              <ChartEmptyState loading={isLoading} />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="accRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-brand-primary, #5f3a16)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-brand-primary, #5f3a16)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="accExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-brand-secondary, #c3986b)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-brand-secondary, #c3986b)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartAxisTick} />
                <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                <Tooltip contentStyle={lightTooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-brand-primary, #5f3a16)" strokeWidth={2.5} fillOpacity={1} fill="url(#accRevGrad)" />
                <Area type="monotone" dataKey="expense" stroke="var(--color-brand-secondary, #c3986b)" strokeWidth={2} fillOpacity={1} fill="url(#accExpGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Cash Flow Bar Chart */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#0f172a]">
                Cash Flow
              </h3>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Cash in versus cash out
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                <span className="size-2 rounded-full bg-primary" /> In
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                <span className="size-2 rounded-full bg-secondary" /> Out
              </span>
            </div>
          </div>

          <div className="mt-4 h-[280px] w-full">
            {!hasChartPoints ? (
              <ChartEmptyState loading={isLoading} />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartAxisTick} />
                <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                <Tooltip contentStyle={lightTooltipStyle} />
                <Bar dataKey="cashIn" fill="var(--color-brand-primary, #5f3a16)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cashOut" fill="var(--color-brand-secondary, #c3986b)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expense Distribution Donut Chart */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#0f172a]">
              Expense Distribution
            </h3>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Spending by category
            </p>
          </div>

          <div className="mt-4 h-[280px] w-full">
            {!hasExpenseBreakdown ? (
              <ChartEmptyState loading={isLoading} message="No expense postings in this period." />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={lightTooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Financial Transactions Table ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-tight text-[#0f172a]">
            Recent Financial Transactions
          </h3>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Latest double-entry journal postings & payments
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={dashboardTableHeadClass}>Date</TableHead>
                <TableHead className={dashboardTableHeadClass}>Type</TableHead>
                <TableHead className={dashboardTableHeadClass}>Description</TableHead>
                <TableHead className={dashboardTableHeadClass}>Account</TableHead>
                <TableHead className={dashboardTableHeadClass}>Amount</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.length === 0 ? (
                <TableRow className={dashboardTableBodyRowClass}>
                  <TableCell
                    colSpan={6}
                    className={cn(dashboardTableCellClass, "py-10 text-center text-sm text-zinc-500")}
                  >
                    {isLoading
                      ? "Loading journal activity…"
                      : "No posted journal entries for the selected period."}
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((tx) => (
                  <TableRow key={tx.id} className={dashboardTableBodyRowClass}>
                    <TableCell className={dashboardTableCellClass}>
                      <span className="text-xs font-semibold text-zinc-600">{tx.date.slice(0, 10)}</span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className="font-semibold text-zinc-800">{tx.type}</span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className="text-zinc-600">{tx.description}</span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className="text-zinc-600">{tx.account}</span>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "font-bold text-[#0f172a]")}>
                      {formatMoney(tx.amount)}
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                          tx.status.toLowerCase() === "posted"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        {tx.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function ChartEmptyState({
  loading,
  message = "No journal activity for the selected period.",
}: {
  loading: boolean;
  message?: string;
}) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 text-center text-sm font-medium text-zinc-500">
      {loading ? "Loading…" : message}
    </div>
  );
}

function MiniSparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;

  const width = 60;
  const height = 24;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const coords = points.map((value, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className="shrink-0 opacity-85">
      <polyline
        points={coords.join(" ")}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
