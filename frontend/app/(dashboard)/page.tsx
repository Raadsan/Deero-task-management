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
  getManagerDashboardBundle,
  getMyDashboardBundle,
} from "@/lib/actions/dashboard.action";
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
  CalendarDays,
  Clock,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Staff personal dashboard
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StaffDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: bundleRes, isLoading } = useSWR(
    ["staff-dashboard", userId],
    getMyDashboardBundle,
    { revalidateOnFocus: true, revalidateOnMount: true, refreshInterval: 15000 },
  );

  const tasks = (bundleRes?.data?.tasks ?? []) as Task[];

  const metrics = useMemo(() => {
    const completed = tasks.filter(
      (t) => resolveTaskDisplayStatus(t) === "completed",
    ).length;
    const pending = tasks.filter(
      (t) => resolveTaskDisplayStatus(t) === "pending",
    ).length;
    const overdue = tasks.filter(
      (t) => resolveTaskDisplayStatus(t) === "overdue",
    ).length;
    return { assigned: tasks.length, completed, pending, overdue };
  }, [tasks]);

  const dailyPerformance = useMemo(() => {
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { name: dayLabel(d), completed: 0, pending: 0, _date: d };
    });
    tasks.forEach((task) => {
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
  }, [tasks]);

  const statusBreakdown = useMemo(
    () => [
      { name: "Completed", value: metrics.completed },
      { name: "Pending", value: metrics.pending },
      { name: "Overdue", value: metrics.overdue },
    ],
    [metrics],
  );

  const priorityBreakdown = useMemo(() => {
    const map = new Map<string, number>([
      ["normal", 0],
      ["medium", 0],
      ["urgent", 0],
    ]);
    tasks.forEach((task) => {
      const key = String(task.priority ?? "normal").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({
      name: name[0].toUpperCase() + name.slice(1),
      value,
    }));
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
    <div className={cn(dashboardPageClass, "space-y-8")} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>My Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your personal task overview
        </p>
      </div>

      {/* Metric boxes */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Assigned Tasks", value: metrics.assigned, Icon: Briefcase },
          { label: "Completed", value: metrics.completed, Icon: CheckCircle },
          { label: "Pending", value: metrics.pending, Icon: Clock },
          { label: "Overdue", value: metrics.overdue, Icon: AlertCircle },
        ].map(({ label, value, Icon }, index) => (
          <div key={label} className="trezo-card flex min-h-[92px] flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                <Icon className="size-4 text-white" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
              <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">{value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
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
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Task Status</h3>
          <div className="mt-4 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                  {statusBreakdown.map((_, idx) => (
                    <Cell key={`status-${idx}`} fill={chartPrimaryVariants[idx % chartPrimaryVariants.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="trezo-card p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-4">Task Priority Breakdown</h3>
        <div className="h-[220px] w-full">
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

      {/* My tasks table â€” clickable rows */}
      <div className="trezo-card overflow-hidden">
        <div className="border-b border-border px-8 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">My Tasks</h3>
          <Link href={ROUTES["my-tasks"] ?? "/my-tasks"} className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:underline">
            View All â†’
          </Link>
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
              {tasks.length > 0 ? (
                tasks.slice(0, 8).map((task) => {
                  const displayStatus = resolveTaskDisplayStatus(task);
                  return (
                    <TableRow
                      key={task.id}
                      className={cn(dashboardTableBodyRowClass, "cursor-pointer hover:bg-primary/5")}
                      onClick={() => router.push("/my-tasks")}
                    >
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{String(task.id).slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-700">
                          {task.serviceInformation || task.description?.slice(0, 50) || "N/A"}
                        </span>
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Manager dashboard
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ManagerDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: bundleRes, isLoading } = useSWR(
    ["manager-dashboard", userId],
    getManagerDashboardBundle,
    { revalidateOnFocus: true, revalidateOnMount: true, refreshInterval: 15000 },
  );

  const myTasks = (bundleRes?.data?.myTasks ?? []) as Task[];
  const allTasks = (bundleRes?.data?.allTasks ?? []) as Task[];
  const chartData = (bundleRes?.data?.chart ?? []).map(
    (item: Record<string, string | number>) => ({
      name: String(item.month ?? "").slice(0, 3),
      registered: Number(item["Registered Tasks"] ?? 0),
      completed: Number(item["Completed Tasks"] ?? 0),
    }),
  );

  const myMetrics = useMemo(() => {
    const completed = myTasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length;
    const pending = myTasks.filter((t) => resolveTaskDisplayStatus(t) === "pending").length;
    const overdue = myTasks.filter((t) => resolveTaskDisplayStatus(t) === "overdue").length;
    return { assigned: myTasks.length, completed, pending, overdue };
  }, [myTasks]);

  // Group all tasks by assignee for staff task chart
  const staffTaskBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; assigned: number; completed: number }>();
    allTasks.forEach((task) => {
      const id = task.assignedTo?.id ?? "unknown";
      const name = task.assignedTo?.name ?? "Unassigned";
      if (!map.has(id)) map.set(id, { name, assigned: 0, completed: 0 });
      const entry = map.get(id)!;
      entry.assigned += 1;
      if (resolveTaskDisplayStatus(task) === "completed") entry.completed += 1;
    });
    return Array.from(map.values()).slice(0, 10);
  }, [allTasks]);

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
    <div className={cn(dashboardPageClass, "space-y-8")} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Manager Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Team overview and personal tasks</p>
      </div>

      {/* My task metrics */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">My Tasks</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Assigned to Me", value: myMetrics.assigned, Icon: Briefcase },
            { label: "Completed", value: myMetrics.completed, Icon: CheckCircle },
            { label: "Pending", value: myMetrics.pending, Icon: Clock },
            { label: "Overdue", value: myMetrics.overdue, Icon: AlertCircle },
          ].map(({ label, value, Icon }, index) => (
            <div key={label} className="trezo-card flex min-h-[92px] flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                  <Icon className="size-4 text-white" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
                <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">{value}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff task metrics */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">Staff Tasks</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { label: "Total Staff Tasks", value: allTasks.length, Icon: Users },
            { label: "Completed", value: allTasks.filter((t) => resolveTaskDisplayStatus(t) === "completed").length, Icon: CheckCircle },
            { label: "Pending / Overdue", value: allTasks.filter((t) => ["pending", "overdue"].includes(resolveTaskDisplayStatus(t))).length, Icon: Clock },
          ].map(({ label, value, Icon }, index) => (
            <div key={label} className="trezo-card flex min-h-[92px] flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div className={cn(dashboardStatIconClass(index + 4), "p-2 [&_svg]:size-4")}>
                  <Icon className="size-4 text-white" />
                </div>
                <div className="flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-500">
                  <ArrowUpRight className="mr-0.5 size-2.5" />Live
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
                <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">{value}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly task chart */}
        <div className="trezo-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-4">Monthly Tasks</h3>
          <div className="h-[260px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  <Area type="monotone" dataKey="registered" stroke={chartPrimary} strokeWidth={2.5} fillOpacity={1} fill="url(#colorReg)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No chart data</div>
            )}
          </div>
        </div>

        {/* Staff tasks breakdown chart */}
        <div className="trezo-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-4">Tasks by Staff Member</h3>
          <div className="h-[260px] w-full">
            {staffTaskBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffTaskBreakdown} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} interval={0} angle={-20} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  <Legend />
                  <Bar dataKey="assigned" name="Assigned" radius={[4, 4, 0, 0]} fill={chartPrimary} />
                  <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]} fill={chartSecondary} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No task data</div>
            )}
          </div>
        </div>
      </div>

      {/* My tasks table */}
      <div className="trezo-card overflow-hidden">
        <div className="border-b border-border px-8 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">My Tasks</h3>
          <Link href="/my-tasks" className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:underline">View All â†’</Link>
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
              {myTasks.length > 0 ? (
                myTasks.slice(0, 6).map((task) => {
                  const displayStatus = resolveTaskDisplayStatus(task);
                  return (
                    <TableRow
                      key={task.id}
                      className={cn(dashboardTableBodyRowClass, "cursor-pointer hover:bg-primary/5")}
                      onClick={() => router.push("/my-tasks")}
                    >
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{String(task.id).slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-700">
                          {task.serviceInformation || task.description?.slice(0, 50) || "N/A"}
                        </span>
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
                  <TableCell colSpan={4} className="px-6 py-10 text-center text-zinc-500">No tasks assigned to you</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Staff tasks table */}
      <div className="trezo-card overflow-hidden">
        <div className="border-b border-border px-8 py-4">
          <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">Staff Tasks</h3>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">All team tasks</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Task</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Assigned To</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {allTasks.length > 0 ? (
                allTasks.slice(0, 8).map((task) => {
                  const displayStatus = resolveTaskDisplayStatus(task);
                  return (
                    <TableRow key={task.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{String(task.id).slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-700">
                          {task.serviceInformation || task.description?.slice(0, 40) || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-600">{task.assignedTo?.name || "Unassigned"}</span>
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
                  <TableCell colSpan={5} className="px-6 py-10 text-center text-zinc-500">No tasks found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-border bg-white p-5 text-center">
          <Link href={ROUTES.tasks} className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:underline">
            View All Tasks
          </Link>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Admin dashboard (superadmin / no specific role)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type DashboardPeriod = "today" | "yesterday" | "week" | "month" | "custom";

type DashboardClient = {
  id?: string;
  institution?: string;
  companyName?: string | null;
  createdAt?: string | Date | null;
};

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function AdminDashboard({
  userId,
  portfolioId,
  branchName,
  isBranchDashboard,
}: {
  userId: string;
  portfolioId?: string | null;
  branchName: string;
  isBranchDashboard: boolean;
}) {
  const dashboardKey = ["dashboard-bundle", userId, portfolioId ?? "all"].join(":");
  const { data: bundleRes, isLoading, isValidating, mutate } = useSWR(
    dashboardKey,
    getAdminDashboardBundle,
    { revalidateOnFocus: true, revalidateOnMount: true, refreshInterval: 15000 },
  );
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const todayValue = dateInputValue(new Date());
  const [customFrom, setCustomFrom] = useState(todayValue);
  const [customTo, setCustomTo] = useState(todayValue);
  const [portfolioFilter, setPortfolioFilter] = useState<string | null>(null);

  const { data: portfolioRes } = useSWR("dashboard-all-portfolios", getTaskFormBranchOptions);
  const allPortfolios = portfolioRes?.data?.portfolios ?? [];

  const allTasks = useMemo(() => {
    const tasks = (bundleRes?.data?.tasks ?? []) as Task[];
    const byBranch = isBranchDashboard && portfolioId
      ? tasks.filter((task) => task.assignedTo?.portfolioId === portfolioId)
      : tasks;
    // Apply portfolio filter button
    if (portfolioFilter) {
      return byBranch.filter((task) => String(task.assignedTo?.portfolioId) === portfolioFilter);
    }
    return byBranch;
  }, [bundleRes?.data?.tasks, isBranchDashboard, portfolioId, portfolioFilter]);
  const allClients = (bundleRes?.data?.clients ?? []) as DashboardClient[];

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
  const filteredTasks = allTasks.filter((task) =>
    inRange(task.createdAt ?? task.deadline),
  );
  const filteredClients = allClients.filter((client) => inRange(client.createdAt));

  const statusData = useMemo(() => {
    const statuses = ["completed", "pending", "overdue"];
    return statuses.map((status) => ({
      name: formatStatusLabel(status),
      value: filteredTasks.filter((task) => resolveTaskDisplayStatus(task) === status).length,
    }));
  }, [filteredTasks]);

  const staffPerformance = useMemo(() => {
    const staff = new Map<string, { name: string; assigned: number; completed: number }>();
    filteredTasks.forEach((task) => {
      const id = task.assignedTo?.id || "unassigned";
      const row = staff.get(id) ?? { name: task.assignedTo?.name || "Unassigned", assigned: 0, completed: 0 };
      row.assigned += 1;
      if (resolveTaskDisplayStatus(task) === "completed") row.completed += 1;
      staff.set(id, row);
    });
    return Array.from(staff.values()).sort((a, b) => b.completed - a.completed).slice(0, 8);
  }, [filteredTasks]);

  const clientsByTasks = useMemo(() => {
    const clients = new Map<string, { id: string; name: string; tasks: number; completed: number }>();
    filteredTasks.forEach((task) => {
      task.institutions?.forEach((client) => {
        const id = String(client.id);
        const row = clients.get(id) ?? { id, name: client.institution || "Unnamed client", tasks: 0, completed: 0 };
        row.tasks += 1;
        if (resolveTaskDisplayStatus(task) === "completed") row.completed += 1;
        clients.set(id, row);
      });
    });
    return Array.from(clients.values()).sort((a, b) => b.tasks - a.tasks).slice(0, 8);
  }, [filteredTasks]);

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
        name: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tasks: tasks.length,
        completed: tasks.filter((task) => resolveTaskDisplayStatus(task) === "completed").length,
      };
    });
  }, [filteredTasks, range.start, range.end]);

  const overdueTasks = statusData[2]?.value ?? 0;
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

  const allStaff = useMemo(() => {
    const ids = new Set<string>();
    allTasks.forEach((t: any) => {
      const id = t.assignedTo?.id ?? t.assigneeId ?? t.assgineeId ?? t.userId;
      if (id) ids.add(String(id));
    });
    return ids.size;
  }, [allTasks]);

  const metricCards = [
    { label: "Total Tasks", value: filteredTasks.length, Icon: Briefcase, color: "primary" },
    { label: "My Tasks", value: myTasksCount, Icon: Users, color: "secondary" },
    { label: "In Progress", value: statusData[1]?.value ?? 0, Icon: Clock, color: "amber" },
    { label: "Overdue Tasks", value: overdueTasks, Icon: AlertCircle, color: "red" },
    { label: "Staffs", value: allStaff, Icon: Users, color: "green" },
  ];

  const metricCardStyle = (color: string) => {
    if (color === "green") return "bg-emerald-500";
    if (color === "amber") return "bg-amber-500";
    if (color === "red") return "bg-rose-600";
    if (color === "secondary") return "bg-secondary";
    return "bg-primary";
  };

  if (isLoading) {
    return <div className="space-y-8 animate-pulse"><div className="h-20 rounded-xl bg-muted/20" /><div className="grid grid-cols-1 gap-6 md:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-28 rounded-xl bg-muted/20" />)}</div></div>;
  }

  return (
    <div className={cn(dashboardPageClass, "space-y-6")} style={dashboardPageStyle}>
      <div className={cn(pageHeaderWrapperClass, "flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between")}>
        <div>
          <h1 className={pageHeaderTitleClass}>{isBranchDashboard ? "Portfolio Dashboard" : "Superadmin Dashboard"}</h1>
          <p className="mt-1 text-sm text-zinc-500">{isBranchDashboard && branchName ? `Showing data for ${branchName}` : "Tasks, staff and client performance overview"}</p>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-2">
          {/* Portfolio filter buttons */}
          {!isBranchDashboard && allPortfolios.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => setPortfolioFilter(null)}
                className={cn("rounded-xl px-3 py-2 text-[11px] font-bold transition-colors", portfolioFilter === null ? "bg-[#651210] text-white" : "text-zinc-500 hover:bg-zinc-100")}
              >
                All
              </button>
              {allPortfolios.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPortfolioFilter(portfolioFilter === p.id ? null : p.id)}
                  className={cn("rounded-xl px-3 py-2 text-[11px] font-bold transition-colors", portfolioFilter === p.id ? "bg-[#651210] text-white" : "text-zinc-500 hover:bg-zinc-100")}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {/* Date filter */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          {([
            ["today", "Today"], ["yesterday", "Yesterday"], ["week", "1 Week"], ["month", "Last Month"], ["custom", "Custom"],
          ] as Array<[DashboardPeriod, string]>).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriod(value)} className={cn("rounded-xl px-3 py-2 text-[11px] font-bold transition-colors", period === value ? "bg-[#651210] text-white" : "text-zinc-500 hover:bg-zinc-100")}>{label}</button>
          ))}
          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 px-1">
              <CalendarDays className="size-4 text-zinc-400" />
              <input aria-label="From date" type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary" />
              <span className="text-xs text-zinc-400">to</span>
              <input aria-label="To date" type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary" />
            </div>
          )}
          <button type="button" onClick={() => mutate()} disabled={isValidating} className="ml-1 flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-zinc-50 disabled:opacity-60"><RefreshCw className={cn("size-3.5", isValidating && "animate-spin")} />Refresh</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map(({ label, value, Icon, color }) => (
          <div key={label} className="trezo-card flex min-h-[100px] items-center justify-between p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-800">{value}</h3>
            </div>
            <div className={cn("w-fit shrink-0 self-start p-3 rounded-xl text-white shadow-md", metricCardStyle(color))}>
              <Icon className="size-5 text-white" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Tasks Chart" subtitle="Created and completed tasks">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={taskTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={chartAxisTick} /><Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#fff" }} /><Legend /><Line type="monotone" dataKey="tasks" name="Tasks" stroke={chartPrimary} strokeWidth={2.5} /><Line type="monotone" dataKey="completed" name="Completed" stroke={chartSecondary} strokeWidth={2.5} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Staff Performance" subtitle="Assigned versus completed tasks">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={staffPerformance}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={chartAxisTick} /><Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#fff" }} /><Legend /><Bar dataKey="assigned" name="Assigned" fill={chartPrimary} radius={[4,4,0,0]} /><Bar dataKey="completed" name="Completed" fill={chartSecondary} radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Task Statuses" subtitle="Current status distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                {statusData.map((entry, index) => {
                  const fill = entry.name.toLowerCase() === "completed"
                    ? chartPrimary
                    : entry.name.toLowerCase() === "in process"
                    ? chartSecondary
                    : entry.name.toLowerCase() === "overdue"
                    ? "#e11d48"
                    : chartPrimaryVariants[index % chartPrimaryVariants.length];
                  return <Cell key={index} fill={fill} />;
                })}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#fff" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Clients by Tasks" subtitle="Clients with the most tasks">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={clientsByTasks} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={chartAxisTick} /><YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={chartAxisTick} /><Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#fff" }} /><Bar dataKey="tasks" name="Tasks" fill={chartPrimary} radius={[0,4,4,0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardTable
          title="Recent Tasks"
          subtitle="Latest tasks in the selected period"
          empty="No tasks found"
          headers={["Task", "Staff", "Status"]}
          rows={filteredTasks.slice(0, 6).map((task) => {
            const displayStatus = resolveTaskDisplayStatus(task);
            return [
              task.description?.slice(0, 34) || task.serviceInformation || "N/A",
              task.assignedTo?.name || "Unassigned",
              <span
                key={task.id}
                className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(displayStatus))}
              >
                {formatStatusLabel(displayStatus)}
              </span>,
            ];
          })}
        />
        <DashboardTable title="Top Clients" subtitle="Clients ranked by task volume" empty="No client tasks found" headers={["Client", "Tasks", "Completed"]} rows={clientsByTasks.slice(0, 6).map((client) => [client.name, client.tasks, client.completed])} />
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="trezo-card p-6"><h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</h3><p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{subtitle}</p><div className="mt-4 h-[300px] w-full">{children}</div></div>;
}

function DashboardTable({ title, subtitle, headers, rows, empty }: { title: string; subtitle: string; headers: string[]; rows: Array<Array<React.ReactNode>>; empty: string }) {
  return <div className="trezo-card overflow-hidden"><div className="border-b border-border px-6 py-4"><h3 className="text-sm font-bold uppercase tracking-tight text-foreground">{title}</h3><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{subtitle}</p></div><div className="overflow-x-auto"><Table><TableHeader className={dashboardTableHeaderClass}><TableRow className={dashboardTableHeadRowClass}>{headers.map((header) => <TableHead key={header} className={cn(dashboardTableHeadClass, "text-left")}>{header}</TableHead>)}</TableRow></TableHeader><TableBody className="bg-white">{rows.length ? rows.map((row, rowIndex) => <TableRow key={rowIndex} className={dashboardTableBodyRowClass}>{row.map((cell, cellIndex) => <TableCell key={cellIndex} className={dashboardTableCellClass}>{typeof cell === "string" || typeof cell === "number" ? <span className="text-[12px] font-medium text-zinc-700">{cell}</span> : cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="py-10 text-center text-sm text-zinc-500">{empty}</TableCell></TableRow>}</TableBody></Table></div></div>;
}

// ─────────────────────────────────────────────────────────────
// Root: picks the right dashboard based on role
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const session = authClient.useSession();
  const user = session.data?.user as
    | { id?: string; role?: string; portfolioId?: string | null }
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

  // Staff: only see their own tasks
  if (normalizedRole === "staff") {
    return <StaffDashboard userId={userId} />;
  }

  // Manager: see my tasks + team tasks + staff chart
  if (normalizedRole === "manager") {
    return <ManagerDashboard userId={userId} />;
  }

  // Superadmin / portfolio admin / others
  return (
    <AdminDashboard
      userId={userId}
      portfolioId={user?.portfolioId}
      branchName={branchName}
      isBranchDashboard={isBranchDashboard}
    />
  );
}
