"use client";

import TaskViewModal from "@/components/tasks/TaskViewModal";
import { getTaskReport, type ReportTaskRow } from "@/lib/apis/performanceReportApi";
import { getTaskById } from "@/lib/apis/taskApi";
import { actionBtnView, dashboardCardClass, dashboardInputClass } from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import { Eye, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";
import {
  ExportButtons,
  Field,
  ReportPanel,
  ReportTable,
  Select,
  StatGrid,
  StatusBadge,
  StatusChart,
  StatusDistributionTable,
  TaskTypeComparisonChart,
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
  taskType: "",
  clientId: "",
  projectId: "",
  employeeId: "",
  serviceId: "",
  serviceName: "",
  status: "",
  priority: "",
  from: "",
  to: "",
  search: "",
  sort: "scheduledDate",
  direction: "desc",
  page: "1",
};

const DETAIL_COLUMNS = [
  ["id", "Task ID"],
  ["name", "Task Name"],
  ["taskType", "Task Type"],
  ["project", "Project"],
  ["client", "Client"],
  ["service", "Service"],
  ["employee", "Assigned Employee"],
  ["scheduledLabel", "Scheduled Date"],
  ["startTime", "Start Time"],
  ["endTime", "End Time"],
  ["priority", "Priority"],
  ["progress", "Completion Progress"],
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

function priorityLabel(value: string) {
  const lower = String(value || "normal").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default function TasksPerformanceReport() {
  const detailRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const { data, error, isLoading } = useSWR(["task-report", filters], () => getTaskReport({ ...filters, pageSize: 25 }));

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
      if (current.serviceId && !data.filters.services.some((item) => item.id === current.serviceId)) {
        next.serviceId = "";
        next.serviceName = "";
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

  const sortBy = (column: string) => {
    setFilters((current) => ({
      ...current,
      sort: column,
      direction: current.sort === column && current.direction === "asc" ? "desc" : "asc",
      page: "1",
    }));
  };

  const projectOptions = useMemo(() => {
    if (!data?.filters.projects) return [];
    if (!filters.clientId) return data.filters.projects;
    return data.filters.projects.filter((project) => project.clientId === filters.clientId);
  }, [data?.filters.projects, filters.clientId]);

  const showProjectFilters = filters.taskType !== "standalone";
  const page = Number(filters.page) || 1;
  const pageCount = Math.max(1, Math.ceil((data?.totalRows || 0) / 25));

  const openTask = async (row: ReportTaskRow) => {
    const result = await getTaskById(row.id);
    if (!result.success || !result.data) {
      toast.error("Could not open this task");
      return;
    }
    setViewTask(result.data);
  };

  const drillEmployee = (employeeId: string) => {
    set("employeeId", employeeId);
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const drillProject = (projectId: string) => {
    setFilters((current) => ({ ...current, taskType: "project", projectId, page: "1" }));
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const drillClient = (clientId: string) => {
    setFilters((current) => ({ ...current, taskType: "project", clientId, projectId: "", page: "1" }));
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportReport = async (kind: "excel" | "pdf" | "print") => {
    if (!data) return;
    let full;
    try {
      full = await getTaskReport({ ...filters, page: 1, pageSize: 5000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export this report");
      return;
    }
    const summaryLine = [
      `Total ${data.summary.total}`,
      `Pending ${data.summary.pending}`,
      `In Progress ${data.summary.inProgress}`,
      `Completed ${data.summary.completed}`,
      `Overdue ${data.summary.overdue}`,
      `On Hold ${data.summary.onHold}`,
      `Completion ${data.summary.completionRate}%`,
    ].join(" · ");

    void runReportExport(kind, "Tasks Report", [data.periodLabel, `Generated ${formatGeneratedAt(data.generatedAt)}`, summaryLine], [
      {
        title: "Summary",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Tasks", String(data.summary.total)],
          ["Completion Rate", `${data.summary.completionRate}%`],
          ["Pending", String(data.summary.pending)],
          ["In Progress", String(data.summary.inProgress)],
          ["Completed", String(data.summary.completed)],
          ["Overdue", String(data.summary.overdue)],
          ["On Hold", String(data.summary.onHold)],
        ],
      },
      {
        title: "Employee Performance",
        headers: ["Employee", "Total", "Pending", "In Progress", "Completed", "Overdue", "On Hold", "Completion %"],
        rows: full.employeePerformance.map((row) => [
          row.employee,
          row.total,
          row.pending,
          row.inProgress,
          row.completed,
          row.overdue,
          row.onHold,
          `${row.completionRate}%`,
        ]),
      },
      {
        title: "Project Analysis",
        headers: ["Project", "Client", "Total", "Pending", "In Progress", "Completed", "Overdue", "Completion %"],
        rows: full.projectAnalysis.map((row) => [
          row.project,
          row.client,
          row.total,
          row.pending,
          row.inProgress,
          row.completed,
          row.overdue,
          `${row.completionRate}%`,
        ]),
      },
      {
        title: "Client Analysis",
        headers: ["Client", "Total", "Completed", "In Progress", "Pending", "Overdue", "On Hold"],
        rows: full.clientAnalysis.map((row) => [
          row.client,
          row.total,
          row.completed,
          row.inProgress,
          row.pending,
          row.overdue,
          row.onHold,
        ]),
      },
      {
        title: "Task Details",
        headers: DETAIL_COLUMNS.map(([, label]) => label),
        rows: full.tasks.map((row) => [
          row.id,
          row.name,
          row.taskType,
          row.project,
          row.client,
          row.service,
          row.employee,
          row.scheduledLabel,
          row.startTime,
          row.endTime,
          priorityLabel(row.priority),
          `${row.progress}%`,
          statusLabel(row.status),
        ]),
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <header className={`${dashboardCardClass} px-4 py-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Tasks Report</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Comprehensive overview of task performance, assignments, completion, and overdue work.
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
          <Field label="Task type">
            <Select value={filters.taskType} onChange={(value) => set("taskType", value)}>
              <option value="">All tasks</option>
              <option value="project">Project-based tasks</option>
              <option value="standalone">Standalone tasks</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filters.status} onChange={(value) => set("status", value)}>
              <option value="">All statuses</option>
              {(data?.filters.statuses || ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "ON_HOLD"]).map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
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
          <Field label="Service">
            <Select
              value={filters.serviceId}
              onChange={(value) => {
                const service = data?.filters.services.find((item) => item.id === value);
                setFilters((current) => ({
                  ...current,
                  serviceId: value,
                  serviceName: service?.name || "",
                  page: "1",
                }));
              }}
            >
              <option value="">All services</option>
              {data?.filters.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={filters.priority} onChange={(value) => set("priority", value)}>
              <option value="">All priorities</option>
              {(data?.filters.priorities || ["low", "normal", "high", "urgent"]).map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabel(priority)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search tasks">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <input
                className={dashboardInputClass}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Task ID, name, employee, client…"
              />
            </div>
          </Field>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading && !data ? <p className="text-sm text-zinc-500">Loading tasks report…</p> : null}

      {data ? (
        <>
          <StatGrid
            items={[
              { label: "Total Tasks", value: data.summary.total },
              { label: "Pending", value: data.summary.pending },
              { label: "In Progress", value: data.summary.inProgress },
              { label: "Completed", value: data.summary.completed },
              { label: "Overdue", value: data.summary.overdue },
              { label: "On Hold", value: data.summary.onHold },
              { label: "Completion Rate", value: `${data.summary.completionRate}%` },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportPanel title="Task type analysis">
              <TaskTypeComparisonChart project={data.taskTypeSummary.project} standalone={data.taskTypeSummary.standalone} />
              <div className="border-t border-zinc-100 px-4 py-3">
                <ReportTable
                  headers={["Type", "Total", "Pending", "In Progress", "Completed", "Overdue", "On Hold"]}
                  rows={[
                    [
                      "Project-based",
                      data.taskTypeSummary.project.total,
                      data.taskTypeSummary.project.pending,
                      data.taskTypeSummary.project.inProgress,
                      data.taskTypeSummary.project.completed,
                      data.taskTypeSummary.project.overdue,
                      data.taskTypeSummary.project.onHold,
                    ],
                    [
                      "Standalone",
                      data.taskTypeSummary.standalone.total,
                      data.taskTypeSummary.standalone.pending,
                      data.taskTypeSummary.standalone.inProgress,
                      data.taskTypeSummary.standalone.completed,
                      data.taskTypeSummary.standalone.overdue,
                      data.taskTypeSummary.standalone.onHold,
                    ],
                  ]}
                  empty="No tasks"
                />
              </div>
            </ReportPanel>

            <ReportPanel title="Task status analysis">
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <StatusChart summary={data.summary} />
                <StatusDistributionTable items={data.statusDistribution} />
              </div>
            </ReportPanel>
          </div>

          <ReportPanel title="Employee performance">
            <ReportTable
              headers={["Employee", "Total Assigned", "Pending", "In Progress", "Completed", "Overdue", "On Hold", "Completion Rate"]}
              rows={data.employeePerformance.map((row) => [
                <button
                  key={row.employeeId}
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => drillEmployee(row.employeeId)}
                >
                  {row.employee}
                </button>,
                row.total,
                row.pending,
                row.inProgress,
                row.completed,
                row.overdue,
                row.onHold,
                `${row.completionRate}%`,
              ])}
              empty="No assigned tasks match these filters."
            />
          </ReportPanel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportPanel title="Project task analysis">
              <ReportTable
                headers={["Project", "Client", "Total", "Pending", "In Progress", "Completed", "Overdue", "Completion Rate"]}
                rows={data.projectAnalysis.slice(0, 15).map((row) => [
                  <button
                    key={row.projectId}
                    type="button"
                    className="text-left font-medium text-primary hover:underline"
                    onClick={() => drillProject(row.projectId)}
                  >
                    {row.project}
                  </button>,
                  row.client,
                  row.total,
                  row.pending,
                  row.inProgress,
                  row.completed,
                  row.overdue,
                  `${row.completionRate}%`,
                ])}
                empty="No project tasks in this report."
              />
            </ReportPanel>

            <ReportPanel title="Client task analysis">
              <ReportTable
                headers={["Client", "Total", "Completed", "In Progress", "Pending", "Overdue", "On Hold"]}
                rows={data.clientAnalysis.slice(0, 15).map((row) => [
                  <button
                    key={row.clientId}
                    type="button"
                    className="text-left font-medium text-primary hover:underline"
                    onClick={() => drillClient(row.clientId)}
                  >
                    {row.client}
                  </button>,
                  row.total,
                  row.completed,
                  row.inProgress,
                  row.pending,
                  row.overdue,
                  row.onHold,
                ])}
                empty="No client-linked project tasks in this report."
              />
            </ReportPanel>
          </div>
        </>
      ) : null}

      <div ref={detailRef}>
        <ReportPanel title="Detailed tasks">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  {DETAIL_COLUMNS.map(([key, label]) => (
                    <TableHead key={key} className={dashboardTableHeadClass}>
                      <button type="button" className="uppercase" onClick={() => sortBy(key)}>
                        {label}
                      </button>
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
                      <TableCell className={dashboardTableCellClass}>{row.name}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.taskType}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.project}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.client}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.service}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.employee}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.scheduledLabel}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.startTime}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.endTime}</TableCell>
                      <TableCell className={dashboardTableCellClass}>{priorityLabel(row.priority)}</TableCell>
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
                    <TableCell colSpan={DETAIL_COLUMNS.length + 1} className="px-4 py-8 text-center text-xs text-zinc-500">
                      No tasks match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
            <span>{data ? `${data.totalRows} tasks` : ""}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => set("page", String(page - 1))}
              >
                Previous
              </button>
              <span>
                {page} / {pageCount}
              </span>
              <button
                type="button"
                className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40"
                disabled={page >= pageCount}
                onClick={() => set("page", String(page + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </ReportPanel>
      </div>

      <TaskViewModal open={Boolean(viewTask)} onOpenChange={(open) => { if (!open) setViewTask(null); }} task={viewTask} />
    </div>
  );
}