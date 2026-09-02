"use client";

import { useEffect, useMemo, useState } from "react";
import {
  accountingDashboardApi,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  DollarSign,
  Landmark,
  Percent,
  Receipt,
  ReceiptText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
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

export default function AccountingDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const todayValue = dateInputValue(new Date());
  const [customFrom, setCustomFrom] = useState(todayValue);
  const [customTo, setCustomTo] = useState(todayValue);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AccountingDashboardData | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const label =
        period === "today"
          ? "Today"
          : period === "yesterday"
          ? "Yesterday"
          : period === "week"
          ? "This Week"
          : "This Month";
      const result = await accountingDashboardApi.getSummary(label);
      setData(result);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const totalRevenue = data?.totalRevenue || 8172.5;
  const expenses = data?.expenses || 1801.3;
  const netProfit = data?.netProfit || 6371.2;
  const cashBalance = data?.cashBalance || 4416.0;
  const bankBalance = data?.bankBalance || 9215.4;

  const chartData = useMemo(() => {
    if (data?.chartData?.length) return data.chartData;
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day, idx) => ({
      date: day,
      revenue: [1200, 1800, 2400, 1900, 2800, 2100, 3100][idx],
      expense: [400, 650, 800, 500, 750, 600, 900][idx],
      cashIn: [1100, 1600, 2200, 1700, 2500, 1900, 2800][idx],
      cashOut: [350, 600, 700, 450, 700, 550, 850][idx],
    }));
  }, [data]);

  const expenseBreakdown = useMemo(() => {
    if (data?.expenseBreakdown?.length) return data.expenseBreakdown;
    return [
      { name: "Rent & Utilities", value: 40, amount: 720, color: "var(--color-brand-primary, #5f3a16)" },
      { name: "Salaries", value: 30, amount: 540, color: "var(--color-brand-secondary, #c3986b)" },
      { name: "Hosting & Tools", value: 15, amount: 270, color: "color-mix(in srgb, var(--color-brand-primary, #5f3a16) 65%, white)" },
      { name: "Marketing", value: 15, amount: 270, color: "color-mix(in srgb, var(--color-brand-secondary, #c3986b) 70%, white)" },
    ];
  }, [data]);

  const recentTransactions = useMemo(() => {
    if (data?.recentTransactions?.length) return data.recentTransactions;
    return [
      {
        id: 1,
        date: "2026-08-25",
        type: "Customer Invoice",
        description: "INV-2026-001 Web & Brand Retainer",
        account: "Accounts Receivable",
        amount: 2400,
        status: "Posted",
      },
      {
        id: 2,
        date: "2026-08-24",
        type: "Customer Receipt",
        description: "REC-2026-089 Direct Wire Transfer",
        account: "Bank Account (USD)",
        amount: 2400,
        status: "Posted",
      },
      {
        id: 3,
        date: "2026-08-24",
        type: "Vendor Bill",
        description: "BILL-2026-042 Cloud Hosting Infrastructure",
        account: "Accounts Payable",
        amount: 450,
        status: "Posted",
      },
      {
        id: 4,
        date: "2026-08-23",
        type: "Vendor Payment",
        description: "PAY-2026-015 Office Supplies & Tech",
        account: "Main Cash Vault",
        amount: 180,
        status: "Posted",
      },
    ];
  }, [data]);

  return (
    <div className={cn(dashboardPageClass, "space-y-6")} style={dashboardPageStyle}>
      {/* ── Page Header matching Task Management Dashboard ── */}
      <div className={cn(pageHeaderWrapperClass, "flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Accounting Dashboard</h1>
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
              <h3 className="text-2xl font-bold text-[#0f172a]">{formatMoney(totalRevenue)}</h3>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <TrendingUp className="size-3" /> +16.1% vs last month
              </span>
            </div>
            <MiniSparkline color={BRAND_PRIMARY} />
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
              <h3 className="text-2xl font-bold text-[#0f172a]">{formatMoney(expenses)}</h3>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-rose-500">
                <TrendingDown className="size-3" /> -4.2% vs last month
              </span>
            </div>
            <MiniSparkline color={ROSE} />
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
              <h3 className="text-2xl font-bold text-[#0f172a]">{formatMoney(netProfit)}</h3>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <TrendingUp className="size-3" /> +20.4% vs last month
              </span>
            </div>
            <MiniSparkline color={EMERALD} />
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
              <h3 className="text-2xl font-bold text-[#0f172a]">{formatMoney(cashBalance)}</h3>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <TrendingUp className="size-3" /> +18.2% vs last month
              </span>
            </div>
            <MiniSparkline color={BRAND_SECONDARY} />
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
              <h3 className="text-2xl font-bold text-[#0f172a]">{formatMoney(bankBalance)}</h3>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <TrendingUp className="size-3" /> +7.6% vs last month
              </span>
            </div>
            <MiniSparkline color={SKY} />
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
              {recentTransactions.map((tx) => (
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
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      {tx.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function MiniSparkline({ color }: { color: string }) {
  return (
    <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="shrink-0 opacity-85">
      <path
        d="M2 18 L15 14 L28 19 L40 6 L58 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
