"use client";

import TaskViewModal from "@/components/tasks/TaskViewModal";
import { getEmployeeReport, type ReportTaskRow } from "@/lib/apis/performanceReportApi";
import { getTaskById } from "@/lib/apis/taskApi";
import { actionBtnView, dashboardCardClass, dashboardInputClass } from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import { Eye, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";
import {
  EmployeeWorkloadChart,
  ExportButtons,
  Field,
  ReportPanel,
  ReportTable,
  Select,
  StatGrid,
  StatusBadge,
  StatusChart,
  StatusDistributionTable,
  dateClass,
  runReportExport,
  statusLabel,
} from "./report-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
} from "@/lib/dashboard-ui";

const DEFAULT_FILTERS = {
  employeeId: "",
  from: "",
  to: "",
  status: "",
  taskType: "",
  projectId: "",
  clientId: "",
  search: "",
  sort: "employee",
  direction: "asc",
  page: "1",
};

const TASK_COLUMNS = [
  ["id", "Task ID"],
  ["name", "Task Name"],
  ["taskType", "Task Type"],
  ["project", "Project"],
  ["client", "Client"],
  ["service", "Service"],
  ["scheduledLabel", "Scheduled Date"],
  ["startTime", "Start Time"],
  ["endTime", "End Time"],
  ["progress", "Progress"],
  ["status", "Status"],
] as const;

function formatGeneratedAt(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function monthLabel(month: string) {
  const [year, part] = month.split("-");
  if (!year || !part) return month;
  return new Date(Number(year), Number(part) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function EmployeesPerformanceReport() {
  const detailRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const { data, error, isLoading } = useSWR(["employee-report", filters], () =>
    getEmployeeReport({ ...filters, pageSize: 25 }),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput, page: "1" }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!data?.filters) return;
    setFilters((current) => {
      const next = { ...current };
      let changed = false;
      if (current.projectId && !data.filters.projects.some((item) => item.id === current.projectId)) {
        next.projectId = "";
        changed = true;
      }
      return changed ? next : current;
    });
  }, [data]);

  const set = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : "1",
      ...(key === "clientId" ? { projectId: "" } : {}),
      ...(key === "taskType" && value === "standalone" ? { projectId: "" } : {}),
    }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
  };

  const overviewSort = (column: string) => {
    setFilters((current) => ({
      ...current,
      sort: column,
      direction: current.sort === column && current.direction === "asc" ? "desc" : "asc",
      page: "1",
    }));
  };

  const selectedEmployee = Boolean(filters.employeeId);
  const showProjectFilters = filters.taskType !== "standalone";
  const projectOptions = useMemo(() => {
    if (!data?.filters.projects) return [];
    if (!filters.clientId) return data.filters.projects;
    return data.filters.projects.filter((project) => project.clientId === filters.clientId);
  }, [data?.filters.projects, filters.clientId]);

  const page = Number(filters.page) || 1;
  const pageCount = selectedEmployee
    ? Math.max(1, Math.ceil((data?.tasksTotal || 0) / 25))
    : Math.max(1, Math.ceil((data?.employeeOverviewTotal || 0) / 25));

  const openTask = async (row: ReportTaskRow) => {
    const result = await getTaskById(row.id);
    if (!result.success || !result.data) {
      toast.error("Could not open this task");
      return;
    }
    setViewTask(result.data);
  };

  const openEmployee = (employeeId: string) => {
    set("employeeId", employeeId);
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportReport = async (kind: "excel" | "pdf" | "print") => {
    if (!data) return;
    let full;
    try {
      full = await getEmployeeReport({ ...filters, page: 1, pageSize: 5000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export this report");
      return;
    }

    const isIndividual = Boolean(filters.employeeId);
    const title = isIndividual && full.selectedEmployee
      ? `Employee Report — ${full.selectedEmployee.name}`
      : "Employees Report";

  const summary = isIndividual ? full.summary : full.organization;
    const lines = [
      full.periodLabel,
      `Generated ${formatGeneratedAt(full.generatedAt)}`,
      isIndividual && full.selectedEmployee
        ? `Employee: ${full.selectedEmployee.name} · ${full.selectedEmployee.jobTitle}`
        : `Employees ${full.organization.totalEmployees} · Tasks ${full.organization.totalAssignedTasks} · Completion ${full.organization.completionRate}%`,
    ];

    void runReportExport(kind, title, lines, [
      {
        title: "Summary",
        headers: ["Metric", "Value"],
        rows: isIndividual
          ? [
              ["Total Assigned", summary.total],
              ["Completed", summary.completed],
              ["In Progress", summary.inProgress],
              ["Pending", summary.pending],
              ["Overdue", summary.overdue],
              ["On Hold", summary.onHold],
              ["Completion Rate", `${summary.completionRate}%`],
            ]
          : [
              ["Total Employees", String(full.organization.totalEmployees)],
              ["Active Employees", String(full.organization.activeEmployees)],
              ["Employees With Tasks", String(full.organization.employeesWithTasks)],
              ["Total Assigned Tasks", String(full.organization.totalAssignedTasks)],
              ["Completed", String(full.organization.completed)],
              ["Completion Rate", `${full.organization.completionRate}%`],
            ],
      },
      ...(isIndividual
        ? [
            {
              title: "Projects participated",
              headers: ["Project", "Client", "Assigned", "Completed", "In Progress", "Pending", "Overdue"],
              rows: full.projectsParticipated.map((row) => [
                row.project,
                row.client,
                row.total,
                row.completed,
                row.inProgress,
                row.pending,
                row.overdue,
              ]),
            },
            {
              title: "Assigned tasks",
              headers: TASK_COLUMNS.map(([, label]) => label),
              rows: full.tasks.map((row) => [
                row.id,
                row.workKind === "Extra Work" ? `${row.name} (Extra)` : row.name,
                row.taskType,
                row.project,
                row.client,
                row.service,
                row.scheduledLabel,
                row.startTime,
                row.endTime,
                `${row.progress}%`,
                statusLabel(row.status),
              ]),
            },
          ]
        : [
            {
              title: "Employee performance",
              headers: ["Employee", "Total", "Completed", "In Progress", "Pending", "Overdue", "On Hold", "Completion %"],
              rows: full.employeeOverview.map((row) => [
                row.employee,
                row.total,
                row.completed,
                row.inProgress,
                row.pending,
                row.overdue,
                row.onHold,
                `${row.completionRate}%`,
              ]),
            },
            {
              title: "Project participation",
              headers: ["Employee", "Project", "Client", "Assigned", "Completed", "Remaining"],
              rows: full.projectParticipation.map((row) => [
                row.employee,
                row.project,
                row.client,
                row.assigned,
                row.completed,
                row.remaining,
              ]),
            },
          ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <header className={`${dashboardCardClass} px-4 py-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Employees Report</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Comprehensive overview of employee workload, task performance, project participation, and productivity.
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
              <div>
                <dt className="inline font-semibold text-zinc-600">Report period: </dt>
                <dd className="inline">{data?.periodLabel || "All scheduled dates"}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-zinc-600">Generated: </dt>
                <dd className="inline">{formatGeneratedAt(data?.generatedAt)}</dd>
              </div>
            </dl>
          </div>
          <ExportButtons onExport={(kind) => void exportReport(kind)} />
        </div>
      </header>

      <section className={`${dashboardCardClass} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Report filters</h2>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            onClick={resetFilters}
          >
            <RotateCcw className="size-3.5" /> Reset filters
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Start date">
            <input className={dateClass} type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} />
          </Field>
          <Field label="End date">
            <input className={dateClass} type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} />
          </Field>
          <Field label="Employee">
            <Select value={filters.employeeId} onChange={(value) => set("employeeId", value)}>
              <option value="">All employees</option>
              {data?.filters.employees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Task status">
            <Select value={filters.status} onChange={(value) => set("status", value)}>
              <option value="">All statuses</option>
              {(data?.filters.statuses || ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "ON_HOLD"]).map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Task type">
            <Select value={filters.taskType} onChange={(value) => set("taskType", value)}>
              <option value="">All tasks</option>
              <option value="project">Project-based tasks</option>
              <option value="standalone">Standalone tasks</option>
            </Select>
          </Field>
          {showProjectFilters ? (
            <>
              <Field label="Client">
                <Select value={filters.clientId} onChange={(value) => set("clientId", value)}>
                  <option value="">All clients</option>
                  {data?.filters.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Project">
                <Select value={filters.projectId} onChange={(value) => set("projectId", value)}>
                  <option value="">All projects</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : null}
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <input
                className={dashboardInputClass}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={selectedEmployee ? "Search tasks…" : "Search employees…"}
              />
            </div>
          </Field>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading && !data ? <p className="text-sm text-zinc-500">Loading employee report…</p> : null}

      {data ? (
        <>
          <StatGrid
            items={
              selectedEmployee
                ? [
                    { label: "Assigned Tasks", value: data.summary.total },
                    { label: "Completed", value: data.summary.completed },
                    { label: "In Progress", value: data.summary.inProgress },
                    { label: "Pending", value: data.summary.pending },
                    { label: "Overdue", value: data.summary.overdue },
                    { label: "On Hold", value: data.summary.onHold },
                    { label: "Completion Rate", value: `${data.summary.completionRate}%` },
                    { label: "Projects", value: data.summary.projects },
                  ]
                : [
                    { label: "Total Employees", value: data.organization.totalEmployees },
                    { label: "Active Employees", value: data.organization.activeEmployees },
                    { label: "With Assigned Tasks", value: data.organization.employeesWithTasks },
                    { label: "Total Assigned Tasks", value: data.organization.totalAssignedTasks },
                    { label: "Completed", value: data.organization.completed },
                    { label: "In Progress", value: data.organization.inProgress },
                    { label: "Pending", value: data.organization.pending },
                    { label: "Overdue", value: data.organization.overdue },
                    { label: "On Hold", value: data.organization.onHold },
                    { label: "Completion Rate", value: `${data.organization.completionRate}%` },
                  ]
            }
          />

          {data.selectedEmployee ? (
            <ReportPanel title="Employee information">
              <dl className="grid grid-cols-1 gap-3 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase text-zinc-500">Name</dt>
                  <dd className="text-zinc-900">{data.selectedEmployee.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-zinc-500">Employee ID</dt>
                  <dd className="text-zinc-900">{data.selectedEmployee.staffCode}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-zinc-500">Job position</dt>
                  <dd className="text-zinc-900">{data.selectedEmployee.jobTitle}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-zinc-500">Department</dt>
                  <dd className="text-zinc-900">{data.selectedEmployee.department}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-zinc-500">Employment status</dt>
                  <dd className="text-zinc-900">{data.selectedEmployee.employmentStatus}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-zinc-500">Report period</dt>
                  <dd className="text-zinc-900">{data.periodLabel}</dd>
                </div>
              </dl>
            </ReportPanel>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportPanel title="Employee workload analysis">
              <EmployeeWorkloadChart data={data.workloadChart} />
            </ReportPanel>
            <ReportPanel title="Task status distribution">
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <StatusChart summary={selectedEmployee ? data.summary : { ...data.organization, total: data.organization.totalAssignedTasks }} />
                <StatusDistributionTable items={data.statusDistribution} />
              </div>
            </ReportPanel>
          </div>

          {!selectedEmployee ? (
            <ReportPanel title="Employee performance overview">
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader className={dashboardTableHeaderClass}>
                    <TableRow className={dashboardTableHeadRowClass}>
                      {[
                        "Employee",
                        "Total Tasks",
                        "Completed",
                        "In Progress",
                        "Pending",
                        "Overdue",
                        "On Hold",
                        "Completion Rate",
                      ].map((header) => (
                        <TableHead key={header} className={dashboardTableHeadClass}>
                          <button
                            type="button"
                            className="uppercase"
                            onClick={() =>
                              overviewSort(
                                header === "Employee"
                                  ? "employee"
                                  : header === "Total Tasks"
                                    ? "total"
                                    : header === "Completed"
                                      ? "completed"
                                      : header === "Completion Rate"
                                        ? "completionRate"
                                        : "employee",
                              )
                            }
                          >
                            {header}
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.employeeOverview.length ? (
                      data.employeeOverview.map((row) => (
                        <TableRow key={row.employeeId} className={dashboardTableBodyRowClass}>
                          <TableCell className={dashboardTableCellClass}>
                            <button type="button" className="font-medium text-primary hover:underline" onClick={() => openEmployee(row.employeeId)}>
                              {row.employee}
                            </button>
                            <p className="text-[11px] text-zinc-400">
                              {row.jobTitle} · {row.department}
                            </p>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>{row.total}</TableCell>
                          <TableCell className={dashboardTableCellClass}>{row.completed}</TableCell>
                          <TableCell className={dashboardTableCellClass}>{row.inProgress}</TableCell>
                          <TableCell className={dashboardTableCellClass}>{row.pending}</TableCell>
                          <TableCell className={dashboardTableCellClass}>{row.overdue}</TableCell>
                          <TableCell className={dashboardTableCellClass}>{row.onHold}</TableCell>
                          <TableCell className={dashboardTableCellClass}>{row.completionRate}%</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="px-4 py-8 text-center text-xs text-zinc-500">
                          No employees match these filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
                <span>{data.employeeOverviewTotal} employees</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>
                    Previous
                  </button>
                  <span>
                    {page} / {pageCount}
                  </span>
                  <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page >= pageCount} onClick={() => set("page", String(page + 1))}>
                    Next
                  </button>
                </div>
              </div>
            </ReportPanel>
          ) : null}

          {!selectedEmployee ? (
            <ReportPanel title="Project participation analysis">
              <ReportTable
                headers={["Employee", "Project", "Client", "Assigned Tasks", "Completed Tasks", "Remaining Tasks"]}
                rows={data.projectParticipation.slice(0, 25).map((row) => [
                  row.employee,
                  row.project,
                  row.client,
                  row.assigned,
                  row.completed,
                  row.remaining,
                ])}
                empty="No project task assignments match these filters."
              />
            </ReportPanel>
          ) : (
            <ReportPanel title="Projects participated in">
              <ReportTable
                headers={["Project", "Client", "Assigned Tasks", "Completed", "In Progress", "Pending", "Overdue"]}
                rows={data.projectsParticipated.map((row) => [
                  row.project,
                  row.client,
                  row.total,
                  row.completed,
                  row.inProgress,
                  row.pending,
                  row.overdue,
                ])}
                empty="This employee has no project tasks in the selected period."
              />
            </ReportPanel>
          )}

          {data.monthlyTrends.length ? (
            <ReportPanel title="Productivity and completion trends">
              <div className="h-56 px-2 py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.monthlyTrends.map((row) => ({ ...row, label: monthLabel(row.month) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="assigned" fill="#651210" name="Assigned" />
                    <Line type="monotone" dataKey="completed" stroke="#009966" name="Completed" strokeWidth={2} />
                    <Line type="monotone" dataKey="overdue" stroke="#e6005c" name="Overdue" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ReportPanel>
          ) : null}
        </>
      ) : null}

      {selectedEmployee ? (
        <div ref={detailRef}>
          <ReportPanel title="Detailed assigned tasks">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader className={dashboardTableHeaderClass}>
                  <TableRow className={dashboardTableHeadRowClass}>
                    {TASK_COLUMNS.map(([key, label]) => (
                      <TableHead key={key} className={dashboardTableHeadClass}>
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className={dashboardTableHeadClass} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.tasks.length ? (
                    data.tasks.map((row) => (
                      <TableRow key={row.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>{row.id}</TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          {row.workKind === "Extra Work" ? `${row.name} (Extra)` : row.name}
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.taskType}</TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.project}</TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.client}</TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.service}</TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.scheduledLabel}</TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.startTime}</TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.endTime}</TableCell>
                        <TableCell className={dashboardTableCellClass}>{row.progress}%</TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <button type="button" className={actionBtnView} onClick={() => void openTask(row)} aria-label="View task">
                            <Eye className="size-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={TASK_COLUMNS.length + 1} className="px-4 py-8 text-center text-xs text-zinc-500">
                        No assigned tasks match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
              <span>{data?.tasksTotal ?? 0} tasks</span>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>
                  Previous
                </button>
                <span>
                  {page} / {pageCount}
                </span>
                <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page >= pageCount} onClick={() => set("page", String(page + 1))}>
                  Next
                </button>
              </div>
            </div>
          </ReportPanel>

          {data?.history.length ? (
            <ReportPanel title="Previously assigned tasks">
              <p className="px-4 pt-3 text-xs text-zinc-500">Reassigned work is shown for context and is not included in current workload totals.</p>
              <ReportTable
                headers={["Task", "Project", "Now assigned to", "Status"]}
                empty=""
                rows={data.history.map((row) => [row.name, row.project, row.transferredTo || row.employee, statusLabel(row.status)])}
              />
            </ReportPanel>
          ) : null}
        </div>
      ) : null}

      <TaskViewModal open={Boolean(viewTask)} onOpenChange={(open) => { if (!open) setViewTask(null); }} task={viewTask} />
    </div>
  );
}