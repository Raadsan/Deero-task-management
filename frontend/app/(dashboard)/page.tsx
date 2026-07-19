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
  Clock,
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

// ─────────────────────────────────────────────────────────────
// Staff personal dashboard
// ─────────────────────────────────────────────────────────────
function StaffDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: bundleRes, isLoading } = useSWR(
    ["staff-dashboard", userId],
    getMyDashboardBundle,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
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

      {/* My tasks table — clickable rows */}
      <div className="trezo-card overflow-hidden">
        <div className="border-b border-border px-8 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">My Tasks</h3>
          <Link href={ROUTES["my-tasks"] ?? "/my-tasks"} className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:underline">
            View All →
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

// ─────────────────────────────────────────────────────────────
// Manager dashboard
// ─────────────────────────────────────────────────────────────
function ManagerDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: bundleRes, isLoading } = useSWR(
    ["manager-dashboard", userId],
    getManagerDashboardBundle,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
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
          <Link href="/my-tasks" className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition-all hover:underline">View All →</Link>
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

// ─────────────────────────────────────────────────────────────
// Admin dashboard (superadmin / no specific role)
// ─────────────────────────────────────────────────────────────
const metricIcons: Record<string, typeof Briefcase> = {
  "Total Tasks": Briefcase,
  "Completed Tasks": CheckCircle,
  "Pending Tasks": Clock,
  "Total Clients": Users,
};

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
  const { data: bundleRes, isLoading } = useSWR(
    dashboardKey,
    getAdminDashboardBundle,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );

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
  const recentTasks = useMemo(() => {
    const tasks = (bundleRes?.data?.tasks ?? []) as Task[];
    const scoped =
      isBranchDashboard && portfolioId
        ? tasks.filter((t) => t.assignedTo?.portfolioId === portfolioId)
        : tasks;
    return scoped.slice(0, 5);
  }, [bundleRes?.data?.tasks, isBranchDashboard, portfolioId]);

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
        <h1 className={pageHeaderTitleClass}>
          {isBranchDashboard ? "Portfolio Dashboard" : "Admin Dashboard"}
        </h1>
        {isBranchDashboard && branchName && (
          <p className="mt-1 text-sm text-zinc-500">
            Showing data for <span className="font-semibold text-zinc-700">{branchName}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric, index) => {
          const title = String(metric.title ?? "Metric");
          const Icon = metricIcons[title] ?? Briefcase;
          const value = metric.totalTasks ?? metric.totallPending ?? metric.totalEarning ?? 0;
          return (
            <div key={title} className="trezo-card group flex min-h-[92px] flex-col gap-3 p-5 transition-all hover:border-primary/30 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                  <Icon className="size-4 text-white" />
                </div>
                <div className="flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-500">
                  <ArrowUpRight className="mr-0.5 size-2.5" />Live
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
                <h3 className="shrink-0 text-2xl font-bold leading-none tracking-tight text-[#1e293b]">{value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="trezo-card p-6 lg:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Task Analytics</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monthly registered tasks</p>
          <div className="mt-4 h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRegistered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  <Area type="monotone" dataKey="registered" stroke={chartPrimary} strokeWidth={2.5} fillOpacity={1} fill="url(#colorRegistered)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No chart data available</div>
            )}
          </div>
        </div>

        <div className="trezo-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Completed Tasks</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">By month</p>
          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: "rgba(101, 18, 16, 0.06)" }} contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartPrimaryVariants[index % chartPrimaryVariants.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No chart data available</div>
            )}
          </div>
        </div>
      </div>

      <div className="trezo-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between border-b border-border px-8 py-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">Recent Tasks</h3>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Last 5 activities</p>
          </div>
        </div>
        <div className="overflow-x-auto border-t border-border">
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
              {recentTasks.length > 0 ? (
                recentTasks.map((task) => {
                  const displayStatus = resolveTaskDisplayStatus(task);
                  return (
                    <TableRow key={task.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{String(task.id).slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-700">{task.description?.slice(0, 40) || "N/A"}</span>
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
                  <TableCell colSpan={5} className="px-6 py-10 text-center text-zinc-500">No recent tasks found</TableCell>
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

// ─────────────────────────────────────────────────────────────
// Root: picks the right dashboard based on role
// ─────────────────────────────────────────────────────────────
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
