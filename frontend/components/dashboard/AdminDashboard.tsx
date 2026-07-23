"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDashboardBundle } from "@/lib/actions/dashboard.action";
import { getTaskFormBranchOptions } from "@/lib/actions/shared.action";
import { authClient } from "@/lib/auth-client";
import { isBranchScopedRole, normalizeRoleName } from "@/lib/portfolio-access";
import { Task } from "@/lib/types";
import { ROUTES } from "@/lib/constants";
import {
  chartAxisTick,
  chartPrimary,
  chartPrimaryVariants,
  chartSecondary,
  chartTooltipStyle,
  dashboardPageClass,
  dashboardPageStyle,
  dashboardStatIconClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeadRowClass,
  dashboardTableHeaderClass,
  dashboardTableIdClass,
  formatStatusLabel,
  getTaskStatusBadgeClass,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";
import { cn, resolveTaskDisplayStatus } from "@/lib/utils";
import {
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  CheckCircle,
  Clock,
  Filter,
  MoreHorizontal,
  Search,
  Users,
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

const metricIcons: Record<string, typeof Briefcase> = {
  "Total Tasks": Briefcase,
  "Completed Tasks": CheckCircle,
  "In Process Tasks": Clock,
  "Total Clients": Users,
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

function dayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const session = authClient.useSession();
  const user = session.data?.user as
    | { id?: string; role?: string; portfolioId?: string | null }
    | undefined;
  const normalizedRole = normalizeRoleName(user?.role);
  const isBranchDashboard = isBranchScopedRole(normalizedRole);
  const dashboardKey = [
    "dashboard-bundle",
    normalizedRole || "guest",
    user?.portfolioId ?? "all",
  ].join(":");

  const { data: bundleRes, isLoading } = useSWR(
    mounted && !session.isPending ? dashboardKey : null,
    getAdminDashboardBundle,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    },
  );

  const { data: branchOptionsRes } = useSWR(
    mounted && isBranchDashboard && user?.portfolioId && !session.isPending
      ? ["dashboard-portfolio", user.portfolioId]
      : null,
    getTaskFormBranchOptions,
  );

  const branchName =
    branchOptionsRes?.data?.portfolios?.find(
      (portfolio: { id: string; name: string }) =>
        String(portfolio.id) === String(user?.portfolioId ?? ""),
    )?.name ?? "";

  const metrics = (bundleRes?.data?.metrics ?? []) as Array<{
    title?: string;
    totalTasks?: number;
    totallPending?: number;
    totalEarning?: number;
  }>;
  const chartData = (bundleRes?.data?.chart ?? []).map(
    (item: Record<string, string | number>) => ({
      name: String(item.month ?? "").slice(0, 3),
      registered: Number(item["Registered Tasks"] ?? 0),
      completed: Number(item["Completed Tasks"] ?? 0),
    }),
  );

  const sourcesData = (bundleRes?.data?.sources ?? []).map(
    ({ source, count }: { source: string; count: number }) => ({
      name: source,
      value: count,
    }),
  );

  const paymentData = (bundleRes?.data?.payment ?? []).map(
    (item: { month: string; income: number; expense: number }) => ({
      name: String(item.month ?? "").slice(0, 3),
      income: Number(item.income ?? 0),
      expense: Number(item.expense ?? 0),
    }),
  );

  const recentTasks = useMemo(() => {
    const tasks = (bundleRes?.data?.tasks ?? []) as Task[];
    const scoped =
      isBranchDashboard && user?.portfolioId
        ? tasks.filter((task) => task.assignedTo?.portfolioId === user.portfolioId)
        : tasks;
    return scoped.slice(0, 5);
  }, [bundleRes?.data?.tasks, isBranchDashboard, user?.portfolioId]);

  const isPersonalDashboard = ["employee", "manager", "portfolio manager"].includes(
    normalizedRole,
  );
  const personalTasks = useMemo(() => {
    if (!user?.id) return [];
    return ((bundleRes?.data?.tasks ?? []) as Task[]).filter(
      (task) => String(task.assignedTo?.id ?? "") === String(user.id),
    );
  }, [bundleRes?.data?.tasks, user?.id]);

  const personalMetrics = useMemo(() => {
    const completed = personalTasks.filter(
      (task) => resolveTaskDisplayStatus(task) === "completed",
    ).length;
    const pending = personalTasks.filter(
      (task) => resolveTaskDisplayStatus(task) === "pending",
    ).length;
    const overdue = personalTasks.filter(
      (task) => resolveTaskDisplayStatus(task) === "overdue",
    ).length;
    return {
      assigned: personalTasks.length,
      completed,
      pending,
      overdue,
    };
  }, [personalTasks]);

  const dailyPerformance = useMemo(() => {
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - index));
      return {
        name: dayLabel(d),
        completed: 0,
        pending: 0,
        _date: d,
      };
    });

    personalTasks.forEach((task) => {
      const taskDate =
        asDate(task.deadline) ??
        asDate((task as Task & { createdAt?: string | Date }).createdAt);
      if (!taskDate) return;
      const bucket = last7.find((item) => sameDay(item._date, taskDate));
      if (!bucket) return;
      const status = resolveTaskDisplayStatus(task);
      if (status === "completed") bucket.completed += 1;
      else bucket.pending += 1;
    });

    return last7.map(({ _date, ...rest }) => rest);
  }, [personalTasks]);

  const weeklyPerformance = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 27);
    const weeks = [
      { name: "Week 1", completed: 0 },
      { name: "Week 2", completed: 0 },
      { name: "Week 3", completed: 0 },
      { name: "Week 4", completed: 0 },
    ];

    personalTasks.forEach((task) => {
      if (resolveTaskDisplayStatus(task) !== "completed") return;
      const d =
        asDate(task.deadline) ??
        asDate((task as Task & { createdAt?: string | Date }).createdAt);
      if (!d || d < start) return;
      const diffDays = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const weekIdx = Math.min(3, Math.max(0, Math.floor(diffDays / 7)));
      weeks[weekIdx].completed += 1;
    });

    return weeks;
  }, [personalTasks]);

  const statusBreakdown = useMemo(
    () => [
      { name: "Completed", value: personalMetrics.completed },
      { name: "In Process", value: personalMetrics.pending },
      { name: "Overdue", value: personalMetrics.overdue },
    ],
    [personalMetrics],
  );

  const priorityBreakdown = useMemo(() => {
    const map = new Map<string, number>([
      ["normal", 0],
      ["medium", 0],
      ["urgent", 0],
    ]);
    personalTasks.forEach((task) => {
      const key = String(task.priority ?? "normal").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({
      name: name[0].toUpperCase() + name.slice(1),
      value,
    }));
  }, [personalTasks]);

  const isDashboardLoading = !mounted || session.isPending || isLoading;

  if (isDashboardLoading) {
    return (
      <div className="space-y-8 animate-pulse px-1">
        <div className="h-20 rounded-xl bg-muted/20" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/20" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-[400px] rounded-xl bg-muted/20" />
          <div className="h-[400px] rounded-xl bg-muted/20" />
          <div className="h-[400px] rounded-xl bg-muted/20" />
        </div>
        <div className="h-[420px] rounded-xl bg-muted/20" />
      </div>
    );
  }

  if (isPersonalDashboard) {
    return (
      <div className={cn(dashboardPageClass, "space-y-8")} style={dashboardPageStyle}>
        <div className={pageHeaderWrapperClass}>
          <h1 className={pageHeaderTitleClass}>My Performance Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Personal task analytics for <span className="font-semibold text-zinc-700">{user?.role}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Assigned Tasks", value: personalMetrics.assigned, Icon: Briefcase },
            { label: "Completed", value: personalMetrics.completed, Icon: CheckCircle },
            { label: "In Process", value: personalMetrics.pending, Icon: Clock },
            { label: "Overdue", value: personalMetrics.overdue, Icon: AlertCircle },
          ].map(({ label, value, Icon }, index) => (
            <div key={label} className="trezo-card flex min-h-[92px] flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                  <Icon className="size-4 text-white" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {label}
                </p>
                <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">
                  {value}
                </h3>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="trezo-card p-6 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Daily Performance (7 days)</h3>
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  <Legend />
                  <Line type="monotone" dataKey="completed" stroke={chartPrimary} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="pending" stroke={chartSecondary} strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="trezo-card p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Weekly Completed</h3>
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                    {weeklyPerformance.map((_, index) => (
                      <Cell key={`wk-${index}`} fill={chartPrimaryVariants[index % chartPrimaryVariants.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="trezo-card p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Status Breakdown</h3>
            <div className="mt-4 h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {statusBreakdown.map((entry, idx) => {
                      const fill = entry.name.toLowerCase() === "completed" ? "#059669" :
                                   entry.name.toLowerCase() === "in process" ? "#f59e0b" :
                                   entry.name.toLowerCase() === "overdue" ? "#e11d48" :
                                   chartPrimaryVariants[idx % chartPrimaryVariants.length];
                      return <Cell key={`status-${idx}`} fill={fill} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="trezo-card p-6 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Task Priority</h3>
            <div className="mt-4 h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityBreakdown.map((_, idx) => (
                      <Cell key={`prio-${idx}`} fill={chartPrimaryVariants[idx % chartPrimaryVariants.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="trezo-card overflow-hidden">
          <div className="border-b border-border px-8 py-4">
            <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">My Tasks</h3>
          </div>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Task</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {personalTasks.length > 0 ? (
                  personalTasks.slice(0, 8).map((task) => {
                    const displayStatus = resolveTaskDisplayStatus(task);
                    return (
                      <TableRow key={task.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>{String(task.id).slice(0, 8)}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className="text-[13px] font-medium text-zinc-700">{task.description?.slice(0, 50) || "—"}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(displayStatus))}>
                            {formatStatusLabel(displayStatus)}
                          </span>
                        </TableCell>
                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                          <span className="text-[13px] font-bold text-zinc-700">{formatStatusLabel(task.priority)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="px-6 py-10 text-center text-zinc-500">
                      No assigned tasks found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(dashboardPageClass, "space-y-8")}
      style={dashboardPageStyle}
    >
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>
          {isBranchDashboard ? "Portfolio Dashboard" : "Admin Dashboard"}
        </h1>
        {isBranchDashboard && branchName ? (
          <p className="mt-1 text-sm text-zinc-500">
            Showing data for <span className="font-semibold text-zinc-700">{branchName}</span>
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric, index) => {
          const title = String(metric.title ?? "Metric");
          const Icon = metricIcons[title] ?? Briefcase;
          const value =
            metric.totalTasks ??
            metric.totallPending ??
            metric.totalEarning ??
            0;

          return (
            <div
              key={title}
              className="trezo-card group flex min-h-[92px] flex-col gap-3 p-5 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                  <Icon className="size-4 text-white" />
                </div>
                <div className="flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-500">
                  <ArrowUpRight className="mr-0.5 size-2.5" />
                  Live
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {title}
                </p>
                <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">
                  {value}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="trezo-card p-6 lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                Task Analytics
              </h3>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Monthly registered tasks
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="mr-4 flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Registered
                </span>
              </div>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </div>
          </div>

          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRegistered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={chartAxisTick}
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="registered"
                    stroke={chartPrimary}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRegistered)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No chart data available
              </div>
            )}
          </div>
        </div>

        <div className="trezo-card p-6">
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
              Completed Tasks
            </h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              By month
            </p>
          </div>

          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={chartAxisTick}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(101, 18, 16, 0.06)" }}
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          chartPrimaryVariants[
                            index % chartPrimaryVariants.length
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No chart data available
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="trezo-card p-6">
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
              Clients by Source
            </h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Acquisition channels
            </p>
          </div>

          <div className="relative h-[260px] w-full">
            {sourcesData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourcesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {sourcesData.map((_, index) => (
                        <Cell
                          key={`source-${index}`}
                          fill={
                            chartPrimaryVariants[
                              index % chartPrimaryVariants.length
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e2e8f0",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  {sourcesData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor:
                            chartPrimaryVariants[
                              index % chartPrimaryVariants.length
                            ],
                        }}
                      />
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {entry.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No source data available
              </div>
            )}
          </div>
        </div>

        <div className="trezo-card p-6 lg:col-span-2">
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
              Income & Expense Overview
            </h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Monthly financial trends
            </p>
          </div>

          <div className="h-[260px] w-full">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={paymentData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={chartAxisTick}
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      paddingBottom: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke={chartPrimary}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: chartPrimary }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Expense"
                    stroke={chartSecondary}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: chartSecondary }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No payment data available
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="trezo-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between border-b border-border px-8 py-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">
                Recent Tasks
              </h3>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Last 5 activities
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="group relative w-48">
                <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="h-9 w-full rounded-md border border-border bg-muted/30 pr-3 pl-9 text-xs font-medium text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/10"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 border border-border bg-muted/30 px-3 text-muted-foreground hover:border-primary/30 hover:text-primary"
              >
                <Filter className="mr-1.5 size-3.5" />
                <span className="text-xs font-semibold">Filter</span>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-border">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    No
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Task
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Assigned To
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Status
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                    Priority
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {recentTasks.length > 0 ? (
                  recentTasks.map((task) => {
                    const displayStatus = resolveTaskDisplayStatus(task);
                    return (
                    <TableRow key={task.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>
                          {String(task.id).slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-700">
                          {task.description?.slice(0, 40) || "—"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-600">
                          {task.assignedTo?.name || "Unassigned"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span
                          className={cn(
                            dashboardStatusBadgeClass,
                            getTaskStatusBadgeClass(displayStatus),
                          )}
                        >
                          {formatStatusLabel(displayStatus)}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(dashboardTableCellClass, "text-right")}
                      >
                        <span className="text-[13px] font-bold text-zinc-700">
                          {formatStatusLabel(task.priority)}
                        </span>
                      </TableCell>
                    </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="px-6 py-10 text-center text-zinc-500"
                    >
                      No recent tasks found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="border-t border-border bg-white p-5 text-center">
            <Link
              href={ROUTES.tasks}
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:underline"
            >
              View All Tasks
            </Link>
          </div>
        </div>
    </div>
  );
}
