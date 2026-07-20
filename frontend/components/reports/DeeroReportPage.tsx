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
import { getAllClients } from "@/lib/actions/client.action";
import { getBillingReportData } from "@/lib/actions/billing.action";
import { getAllTasks } from "@/lib/actions/task.action";
import { getAllUsers } from "@/lib/actions/user.action";
import { clientTypeLabel } from "@/lib/client-types";
import {
  exportCsv,
  exportPdf,
  inDateRange,
  printReport,
} from "@/lib/report-export";
import {
  chartAxisTick,
  chartPrimary,
  chartPrimaryVariants,
  chartSecondary,
  chartTooltipStyle,
  dashboardCardClass,
  dashboardControlsRowClass,
  dashboardInputClass,
  dashboardLabelClass,
  dashboardPageClass,
  dashboardPageStyle,
  dashboardPaginationClass,
  dashboardSelectClass,
  dashboardStatIconClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleAlert,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Handshake,
  Printer,
  ReceiptText,
  Search,
  Timer,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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

export type DeeroReportType = "payments" | "users" | "clients" | "tasks";

type SummaryItem = {
  label: string;
  value: number | string;
  money?: boolean;
  icon: React.ElementType;
};

const compactSelectClass = dashboardSelectClass;
const compactInputClass = dashboardInputClass;

const reportMeta = {
  payments: {
    title: "Payment Report",
    subtitle: "Monthly client bills — paid, partial, unpaid, and overdue",
    search: "Search client, contract, period…",
  },
  users: {
    title: "Users Report",
    subtitle: "All system users — ID, name, email, and role",
    search: "Search user id, name, email…",
  },
  clients: {
    title: "Client Report",
    subtitle: "All clients, types, contact info, and active status",
    search: "Search client, email, phone…",
  },
  tasks: {
    title: "Tasks Report",
    subtitle: "All tasks with status, assignee, client, and due dates",
    search: "Search task, client, assignee…",
  },
} as const;

function formatMoney(amount?: number) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function taskDueDate(task: any) {
  return task.deadline ?? task.dueDate ?? null;
}

function taskExtraMinutes(task: any) {
  return Math.max(0, Number(task.extraTimeMinutes) || 0);
}

function taskFinalDueDate(task: any) {
  const due = taskDueDate(task);
  if (!due) return null;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + taskExtraMinutes(task) * 60_000);
}

function formatExtraTime(task: any) {
  const totalMinutes = taskExtraMinutes(task);
  if (!totalMinutes) return "No extra time";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""]
    .filter(Boolean)
    .join(" ");
}

function taskRemaining(task: any) {
  const due = taskFinalDueDate(task);
  if (!due) return "N/A";
  const dueTime = due.getTime();
  const completedAt = task.status === "completed" ? (task.completedAt ?? task.updatedAt) : null;
  const comparisonTime = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (Number.isNaN(dueTime) || Number.isNaN(comparisonTime)) return "—";

  const difference = dueTime - comparisonTime;
  const absoluteMinutes = Math.floor(Math.abs(difference) / 60_000);
  const days = Math.floor(absoluteMinutes / 1440);
  const hours = Math.floor((absoluteMinutes % 1440) / 60);
  const minutes = absoluteMinutes % 60;
  const duration = [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`]
    .filter(Boolean)
    .join(" ");
  return difference >= 0 ? `${duration} early` : `${duration} late`;
}

function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="trezo-card flex min-h-[92px] flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div className={cn(dashboardStatIconClass(index), "p-2 [&_svg]:size-4")}>
                <Icon className="size-4 text-white" />
              </div>
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {item.label}
              </p>
              <h3 className="shrink-0 text-xl font-bold leading-none tracking-tight text-[#1e293b]">
                {item.money ? formatMoney(Number(item.value)) : item.value}
              </h3>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportCharts({
  areaData,
  barData,
  pieData,
  lineData,
  chartId,
}: {
  areaData: Array<{ name: string; value: number }>;
  barData: Array<{ name: string; value: number }>;
  pieData: Array<{ name: string; value: number }>;
  lineData: Array<{ name: string; paid: number; balance: number }>;
  chartId: string;
}) {
  const gradientId = `${chartId}-area-gradient`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="trezo-card p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Trends</h3>
        <div className="mt-4 h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} />
              <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartPrimary}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="trezo-card p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Breakdown</h3>
        <div className="mt-4 h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} />
              <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {barData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="trezo-card p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
          Status distribution
        </h3>
        <div className="mt-4 h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                {pieData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="trezo-card p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
          Comparison
        </h3>
        <div className="mt-4 h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} />
              <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
              <Legend />
              <Bar dataKey="paid" fill={chartPrimary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="balance" fill={chartSecondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function DeeroReportPage({ type, chartsOnly = false }: { type: DeeroReportType; chartsOnly?: boolean }) {
  const meta = reportMeta[type];
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"all" | "week" | "month" | "custom">("all");
  const [taskUserFilter, setTaskUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentRows, setPaymentRows] = useState<any[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [paymentChart, setPaymentChart] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate, statusFilter, taskUserFilter, reportPeriod, pageSize, type]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (type === "payments") {
          const result = await getBillingReportData();
          if (result.success && result.data) {
            setPaymentRows(result.data.rows);
            setPaymentSummary(result.data.summary);
            setPaymentChart(result.data.chartByMonth);
          }
        }
        if (type === "clients") {
          const result = await getAllClients();
          if (result.success) setClients(result.data ?? []);
        }
        if (type === "tasks") {
          const taskResult = await getAllTasks();
          if (taskResult.success) setTasks(taskResult.data ?? []);
        }
        if (type === "users") {
          const userResult = await getAllUsers();
          if (userResult.success) setUsers(userResult.data ?? []);
        }
      } catch {
        toast.error("Failed to load report data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type]);

  const filteredPaymentRows = useMemo(() => {
    return paymentRows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return inDateRange(row.dueDate, startDate, endDate);
    });
  }, [paymentRows, startDate, endDate, statusFilter]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter === "active" && c.isActive === false) return false;
      if (statusFilter === "inactive" && c.isActive !== false) return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "active" &&
        statusFilter !== "inactive" &&
        c.clientType !== statusFilter
      ) {
        return false;
      }
      return inDateRange(c.createdAt, startDate, endDate);
    });
  }, [clients, startDate, endDate, statusFilter]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (taskUserFilter !== "all" && String(t.assignedTo?.id) !== taskUserFilter) return false;
      const dateValue = taskDueDate(t) ?? t.createdAt;
      return inDateRange(dateValue, startDate, endDate);
    });
  }, [tasks, startDate, endDate, statusFilter, taskUserFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === "active" && u.banned) return false;
      if (statusFilter === "inactive" && !u.banned) return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "active" &&
        statusFilter !== "inactive" &&
        String(u.role ?? "").toLowerCase() !== statusFilter.toLowerCase()
      ) {
        return false;
      }
      return inDateRange(u.createdAt, startDate, endDate);
    });
  }, [users, startDate, endDate, statusFilter]);

  const summaryItems: SummaryItem[] = useMemo(() => {
    if (type === "payments") {
      const paid = filteredPaymentRows.filter((r) => r.status === "PAID");
      const unpaid = filteredPaymentRows.filter((r) =>
        ["PENDING", "OVERDUE"].includes(r.status),
      );
      const partial = filteredPaymentRows.filter(
        (r) => r.paidAmount > 0 && r.status !== "PAID",
      );
      return [
        { label: "Total bills", value: filteredPaymentRows.length, icon: ReceiptText },
        { label: "Paid", value: paid.length, icon: BadgeCheck },
        { label: "Unpaid", value: unpaid.length, icon: Timer },
        { label: "Partial", value: partial.length, icon: CircleAlert },
        {
          label: "Collected",
          value: filteredPaymentRows.reduce((s, r) => s + r.paidAmount, 0),
          money: true,
          icon: WalletCards,
        },
        {
          label: "Outstanding",
          value: filteredPaymentRows.reduce((s, r) => s + r.balance, 0),
          money: true,
          icon: WalletCards,
        },
      ];
    }
    if (type === "clients") {
      return [
        { label: "Total clients", value: filteredClients.length, icon: Handshake },
        {
          label: "Single Job",
          value: filteredClients.filter((c) => c.clientType === "ONE_TIME").length,
          icon: Handshake,
        },
        {
          label: "Regular",
          value: filteredClients.filter((c) => c.clientType === "MANAGED_ON_DEMAND").length,
          icon: Handshake,
        },
        {
          label: "Scheduled",
          value: filteredClients.filter((c) => c.clientType === "MANAGED_RECURRING").length,
          icon: Handshake,
        },
        {
          label: "Active",
          value: filteredClients.filter((c) => c.isActive !== false).length,
          icon: BadgeCheck,
        },
        {
          label: "With budget",
          value: filteredClients.filter((c) => Number(c.monthlyBudget) > 0).length,
          icon: WalletCards,
        },
      ];
    }
    if (type === "users") {
      return [
        { label: "Total users", value: filteredUsers.length, icon: Users },
        {
          label: "Active",
          value: filteredUsers.filter((u) => !u.banned).length,
          icon: BadgeCheck,
        },
        {
          label: "Inactive",
          value: filteredUsers.filter((u) => u.banned).length,
          icon: Timer,
        },
        {
          label: "Admins",
          value: filteredUsers.filter((u) => u.role === "admin").length,
          icon: BriefcaseBusiness,
        },
        {
          label: "Superadmins",
          value: filteredUsers.filter((u) => u.role === "superadmin").length,
          icon: ClipboardCheck,
        },
        {
          label: "Users",
          value: filteredUsers.filter((u) => u.role === "user").length,
          icon: Users,
        },
      ];
    }
    return [
      { label: "Total tasks", value: filteredTasks.length, icon: ClipboardCheck },
      { label: "Completed", value: filteredTasks.filter((t) => t.status === "completed").length, icon: BadgeCheck },
      { label: "Pending", value: filteredTasks.filter((t) => t.status === "pending").length, icon: Timer },
      { label: "Overdue", value: filteredTasks.filter((t) => t.status === "overdue").length, icon: CircleAlert },
      { label: "Urgent", value: filteredTasks.filter((t) => t.priority === "urgent").length, icon: CircleAlert },
      { label: "Personal", value: filteredTasks.filter((t) => t.isPersonal).length, icon: Users },
    ];
  }, [type, filteredPaymentRows, filteredClients, filteredTasks, filteredUsers]);

  const chartData = useMemo(() => {
    if (type === "payments") {
      const byMonth: Record<string, { label: string; paid: number; balance: number }> = {};
      for (const row of filteredPaymentRows) {
        const key = row.periodLabel;
        if (!byMonth[key]) byMonth[key] = { label: key, paid: 0, balance: 0 };
        byMonth[key].paid += row.paidAmount;
        byMonth[key].balance += row.balance;
      }
      const monthList = Object.values(byMonth).slice(0, 8);
      const paidCount = filteredPaymentRows.filter((r) => r.status === "PAID").length;
      const unpaidCount = filteredPaymentRows.filter((r) =>
        ["PENDING", "OVERDUE"].includes(r.status),
      ).length;
      const partialCount = filteredPaymentRows.filter(
        (r) => r.paidAmount > 0 && r.status !== "PAID",
      ).length;
      return {
        areaData: monthList.map((m) => ({ name: m.label, value: m.paid })),
        barData: [
          { name: "Paid", value: paidCount },
          { name: "Unpaid", value: unpaidCount },
          { name: "Partial", value: partialCount },
        ],
        pieData: [
          { name: "Paid", value: paidCount },
          { name: "Unpaid", value: unpaidCount },
          { name: "Partial", value: partialCount },
        ],
        lineData: monthList.slice(0, 6).map((m) => ({
          name: m.label,
          paid: m.paid,
          balance: m.balance,
        })),
      };
    }
    if (type === "clients") {
      const byType = [
        { name: "Scheduled", value: filteredClients.filter((c) => c.clientType === "MANAGED_RECURRING").length },
        { name: "Single Job", value: filteredClients.filter((c) => c.clientType === "ONE_TIME").length },
        { name: "Regular", value: filteredClients.filter((c) => c.clientType === "MANAGED_ON_DEMAND").length },
      ];
      return {
        areaData: byType,
        barData: byType,
        pieData: byType.filter((b) => b.value > 0),
        lineData: byType.map((b) => ({ name: b.name, paid: b.value, balance: 0 })),
      };
    }
    if (type === "users") {
      const byRole = [
        { name: "Admin", value: filteredUsers.filter((u) => u.role === "admin").length },
        { name: "Superadmin", value: filteredUsers.filter((u) => u.role === "superadmin").length },
        { name: "User", value: filteredUsers.filter((u) => u.role === "user").length },
      ];
      const byStatus = [
        { name: "Active", value: filteredUsers.filter((u) => !u.banned).length },
        { name: "Inactive", value: filteredUsers.filter((u) => u.banned).length },
      ];
      return {
        areaData: byRole,
        barData: byRole,
        pieData: byStatus.filter((b) => b.value > 0),
        lineData: byRole.map((b) => ({ name: b.name, paid: b.value, balance: 0 })),
      };
    }
    const byStatus = [
      { name: "Completed", value: filteredTasks.filter((t) => t.status === "completed").length },
      { name: "Pending", value: filteredTasks.filter((t) => t.status === "pending").length },
      { name: "Overdue", value: filteredTasks.filter((t) => t.status === "overdue").length },
    ];
    return {
      areaData: byStatus,
      barData: byStatus,
      pieData: byStatus.filter((b) => b.value > 0),
      lineData: byStatus.map((b) => ({ name: b.name, paid: b.value, balance: 0 })),
    };
  }, [type, filteredPaymentRows, filteredClients, filteredUsers, filteredTasks]);

  const { headers, rows, filteredCount } = useMemo(() => {
    const s = search.toLowerCase();

    if (type === "payments") {
      const filtered = filteredPaymentRows.filter((row) =>
        [row.clientName, row.contractNumber, row.periodLabel, row.status]
          .some((v) => String(v || "").toLowerCase().includes(s)),
      );
      return {
        headers: ["Client", "Period", "Due", "Paid", "Balance", "Status", "Due date"],
        rows: filtered.map((r) => [
          r.clientName,
          r.periodLabel,
          formatMoney(r.dueAmount),
          formatMoney(r.paidAmount),
          formatMoney(r.balance),
          r.status,
          formatDate(r.dueDate),
        ]),
        filteredCount: filtered.length,
      };
    }

    if (type === "clients") {
      const filtered = filteredClients.filter((c) =>
        [c.institution, c.companyName, c.email, c.phone, c.clientType]
          .some((v) => String(v || "").toLowerCase().includes(s)),
      );
      return {
        headers: ["Client", "Type", "Email", "Phone", "Budget", "Status"],
        rows: filtered.map((c) => [
          c.institution ?? c.companyName,
          clientTypeLabel(c.clientType),
          c.email,
          c.phone,
          c.monthlyBudget ? formatMoney(c.monthlyBudget) : "—",
          c.isActive !== false ? "Active" : "Inactive",
        ]),
        filteredCount: filtered.length,
      };
    }

    if (type === "users") {
      const filtered = filteredUsers.filter((u) =>
        [u.id, u.name, u.email, u.role].some((v) =>
          String(v || "").toLowerCase().includes(s),
        ),
      );
      return {
        headers: ["User ID", "Name", "Email", "Role", "Status"],
        rows: filtered.map((u) => [
          u.id,
          u.name ?? "—",
          u.email ?? "—",
          u.role ?? "—",
          u.banned ? "Inactive" : "Active",
        ]),
        filteredCount: filtered.length,
      };
    }

    const filtered = filteredTasks.filter((task) =>
      [task.title, task.description, task.serviceInformation, task.status, task.assignedTo?.name]
        .some((value) => String(value || "").toLowerCase().includes(s)),
    );
    return {
      headers: ["Task Name", "Assigned", "Priority", "Status", "Due Date", "Extra Time", "Completed Date", "Remained", "Action"],
      rows: filtered.map((task) => [
        task.title ?? task.serviceInformation ?? task.description ?? "N/A",
        task.assignedTo?.name ?? "N/A",
        task.priority ?? "normal",
        task.status,
        formatDateTime(taskDueDate(task)),
        formatExtraTime(task),
        task.status === "completed" ? formatDateTime(task.completedAt ?? task.updatedAt) : "N/A",
        taskRemaining(task),
        "View",
      ]),
      filteredCount: filtered.length,
    };
  }, [type, search, filteredPaymentRows, filteredClients, filteredUsers, filteredTasks]);

  const searchedTasks = useMemo(() => {
    if (type !== "tasks") return [];
    const normalizedSearch = search.toLowerCase();
    return filteredTasks.filter((task) =>
      [task.title, task.description, task.serviceInformation, task.status, task.assignedTo?.name]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch)),
    );
  }, [type, search, filteredTasks]);

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searchedTasks.slice(start, start + pageSize);
  }, [searchedTasks, currentPage, pageSize]);

  const statusOptions = useMemo(() => {
    if (type === "payments") {
      return [
        { value: "all", label: "All statuses" },
        { value: "PAID", label: "Paid" },
        { value: "PARTIAL", label: "Partial" },
        { value: "PENDING", label: "Unpaid" },
        { value: "OVERDUE", label: "Overdue" },
      ];
    }
    if (type === "clients") {
      return [
        { value: "all", label: "All clients" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "MANAGED_RECURRING", label: "Scheduled" },
        { value: "ONE_TIME", label: "Single Job" },
        { value: "MANAGED_ON_DEMAND", label: "Regular" },
      ];
    }
    if (type === "tasks") {
      return [
        { value: "all", label: "All statuses" },
        { value: "completed", label: "Completed" },
        { value: "pending", label: "Pending" },
        { value: "overdue", label: "Overdue" },
      ];
    }
    if (type === "users") {
      return [
        { value: "all", label: "All users" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "admin", label: "Admin" },
        { value: "superadmin", label: "Superadmin" },
        { value: "user", label: "User" },
      ];
    }
    return [{ value: "all", label: "All" }];
  }, [type]);

  const taskAssigneeOptions = useMemo(() => {
    const assignees = new Map<string, string>();
    tasks.forEach((task) => {
      const id = String(task.assignedTo?.id ?? "");
      if (id) assignees.set(id, task.assignedTo?.name ?? "Unnamed user");
    });
    return Array.from(assignees, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tasks]);

  function inputDate(date: Date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }

  function handleReportPeriod(value: "all" | "week" | "month" | "custom") {
    setReportPeriod(value);
    if (value === "custom") {
      setStartDate("");
      setEndDate("");
      return;
    }
    if (value === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (value === "week" ? 6 : 29));
    setStartDate(inputDate(start));
    setEndDate(inputDate(end));
  }
  const handleExport = () => exportCsv(`${type}-report.csv`, headers, rows);

  const handlePrint = () => {
    try {
      printReport(meta.title, headers, rows);
    } catch {
      toast.error("Please allow popups to print report");
    }
  };

  const handlePdf = async () => {
    try {
      await exportPdf(`${type}-report.pdf`, meta.title, headers, rows);
    } catch {
      toast.error("Failed to export PDF");
    }
  };

  return (
    <div className={cn(dashboardPageClass, "space-y-6")} style={dashboardPageStyle}>
      <SummaryCards items={summaryItems} />
      <ReportCharts {...chartData} chartId={type} />

      {!chartsOnly && <div className={dashboardCardClass}>
        <div className={cn(dashboardControlsRowClass, "gap-x-3 gap-y-2 py-3")}>
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cn("w-16", compactSelectClass)}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>

          {type === "tasks" && (
            <label className={cn("flex flex-col gap-1", dashboardLabelClass)}>
              <span>Period</span>
              <select
                value={reportPeriod}
                onChange={(event) => handleReportPeriod(event.target.value as "all" | "week" | "month" | "custom")}
                className={cn(compactSelectClass, "min-w-[130px]")}
              >
                <option value="all">All time</option>
                <option value="week">1 Week</option>
                <option value="month">1 Month</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          )}

          {(type !== "tasks" || reportPeriod === "custom") && (
            <div className="flex flex-wrap items-center gap-2">
              <label className={cn("flex flex-col gap-1", dashboardLabelClass)}>
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={cn(compactInputClass, "w-40")} />
              </label>
              <label className={cn("flex flex-col gap-1", dashboardLabelClass)}>
                <span>End date</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={cn(compactInputClass, "w-40")} />
              </label>
            </div>
          )}

          {type === "tasks" && (
            <label className={cn("flex flex-col gap-1", dashboardLabelClass)}>
              <span>User</span>
              <select value={taskUserFilter} onChange={(event) => setTaskUserFilter(event.target.value)} className={cn(compactSelectClass, "min-w-[150px]")}>
                <option value="all">All users</option>
                {taskAssigneeOptions.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={cn(compactSelectClass, "min-w-[140px] self-end")}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {(startDate || endDate) && (
            <Button
              type="button"
              variant="outline"
              className="h-[42px] self-end"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                if (type === "tasks") setReportPeriod("all");
              }}
            >
              Clear dates
            </Button>
          )}

          <div className="min-w-4 flex-1" />

          <div className="relative w-52 self-end">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={meta.search}
              className={cn(compactInputClass, "w-full pl-10")}
            />
          </div>

          <Button onClick={handleExport} variant="outline" className="h-[42px] self-end">
            <Download className="mr-2 size-4" />
            CSV
          </Button>
          <Button onClick={handlePdf} variant="outline" className="h-[42px] self-end">
            <FileText className="mr-2 size-4" />
            PDF
          </Button>
          <Button
            onClick={handlePrint}
            className="h-[42px] self-end bg-primary text-white hover:bg-primary/90"
          >
            <Printer className="mr-2 size-4" />
            Print
          </Button>
        </div>

        <div className="border-b border-zinc-50 px-8 py-2 text-xs text-zinc-500">
          {loading ? "Loading…" : `${filteredCount} rows`}
          {(startDate || endDate) && " · filtered by date range"}
        </div>

        <div className={cn(dashboardTableWrapClass, "border-0")}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                {headers.map((h) => (
                  <TableHead key={h} className={dashboardTableHeadClass}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="py-10 text-center text-zinc-500">
                    Loading report…
                  </TableCell>
                </TableRow>
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="py-10 text-center text-zinc-500">
                    No data found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row, idx) => (
                  <TableRow key={idx} className={dashboardTableBodyRowClass}>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx} className={dashboardTableCellClass}>
                        {type === "tasks" && cellIdx === row.length - 1 ? (
                          <button
                            type="button"
                            aria-label="View task details"
                            onClick={() => setSelectedTask(paginatedTasks[idx])}
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
                          >
                            <Eye className="size-4" />
                          </button>
                        ) : (
                          cell
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {rows.length === 0
              ? "0 of 0"
              : `${Math.min(rows.length, (currentPage - 1) * pageSize + 1)}-${Math.min(rows.length, currentPage * pageSize)} of ${rows.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded border border-zinc-200 px-3 py-1 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 text-sm text-zinc-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-zinc-200 px-3 py-1 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>}

      {type === "tasks" && selectedTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Task details"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onMouseDown={() => setSelectedTask(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Task details</p>
                <h3 className="mt-1 text-lg font-bold text-slate-800">
                  {selectedTask.title ?? selectedTask.serviceInformation ?? selectedTask.description ?? "Untitled task"}
                </h3>
              </div>
              <button type="button" aria-label="Close task details" onClick={() => setSelectedTask(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
              {[
                ["Task ID", selectedTask.id ?? "N/A"],
                ["Assigned", selectedTask.assignedTo?.name ?? "N/A"],
                ["Client", selectedTask.institutions?.[0]?.institution ?? "N/A"],
                ["Service / Task Name", selectedTask.serviceInformation ?? selectedTask.title ?? "N/A"],
                ["Department", selectedTask.department ?? "N/A"],
                ["Supervisor", selectedTask.supervisor || "N/A"],
                ["Priority", selectedTask.priority ?? "normal"],
                ["Status", selectedTask.status ?? "N/A"],
                ["Progress", `${Number(selectedTask.progress ?? 0)}%`],
                ["Created Date", formatDateTime(selectedTask.createdAt)],
                ["Due Date", formatDateTime(taskDueDate(selectedTask))],
                ["Extra Time", formatExtraTime(selectedTask)],
                ["Final / Expired Date", formatDateTime(taskFinalDueDate(selectedTask))],
                ["Completed Date", selectedTask.status === "completed" ? formatDateTime(selectedTask.completedAt ?? selectedTask.updatedAt) : "N/A"],
                ["Remained", taskRemaining(selectedTask)],
                ["Last Progress Change", selectedTask.progressUpdatedAt || selectedTask.updatedAt ? formatDateTime(selectedTask.progressUpdatedAt ?? selectedTask.updatedAt) : "N/A"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1.5 text-sm font-semibold capitalize text-slate-700">{value}</p>
                </div>
              ))}
              {selectedTask.description && (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Description</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTask.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
