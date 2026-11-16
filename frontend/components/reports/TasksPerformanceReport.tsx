"use client";

import TaskViewModal from "@/components/tasks/TaskViewModal";
import { getTaskReport, type ReportTaskRow } from "@/lib/apis/performanceReportApi";
import { getTaskById } from "@/lib/apis/taskApi";
import { actionBtnView, dashboardCardClass, dashboardInputClass } from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import { Eye, Search } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";
import { ExportButtons, Field, ReportPanel, Select, StatGrid, StatusBadge, StatusChart, dateClass, runReportExport, statusLabel } from "./report-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dashboardTableBodyRowClass, dashboardTableCellClass, dashboardTableHeadClass, dashboardTableHeaderClass, dashboardTableHeadRowClass } from "@/lib/dashboard-ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const COLUMNS = [
  ["id", "Task ID"],
  ["name", "Task"],
  ["client", "Client"],
  ["project", "Project"],
  ["service", "Main Service"],
  ["subService", "Sub Service"],
  ["employee", "Employee"],
  ["scheduledDate", "Scheduled"],
  ["startTime", "Start"],
  ["endTime", "End"],
  ["progress", "Progress"],
  ["status", "Status"],
  ["priority", "Priority"],
] as const;

export default function TasksPerformanceReport() {
  const [filters, setFilters] = useState({
    clientId: "",
    projectId: "",
    employeeId: "",
    serviceId: "",
    serviceName: "",
    subServiceId: "",
    subServiceName: "",
    status: "",
    cycleId: "",
    month: "",
    year: "",
    from: "",
    to: "",
    search: "",
    sort: "scheduledDate",
    direction: "desc",
    page: "1",
  });
  const [searchInput, setSearchInput] = useState("");
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const { data, error, isLoading } = useSWR(["task-report", filters], () => getTaskReport({ ...filters, pageSize: 25 }));

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => current.search === searchInput ? current : { ...current, search: searchInput, page: "1" });
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
      if (current.cycleId && current.cycleId !== "all" && !data.filters.cycles.some((item) => item.id === current.cycleId)) {
        next.cycleId = "";
        changed = true;
      }
      if (current.serviceId && !data.filters.services.some((item) => item.id === current.serviceId)) {
        next.serviceId = "";
        next.serviceName = "";
        changed = true;
      }
      if (current.subServiceId && !data.filters.subServices.some((item) => item.id === current.subServiceId)) {
        next.subServiceId = "";
        next.subServiceName = "";
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
      ...(key === "month" && value && !current.year ? { year: String(new Date().getFullYear()) } : {}),
      ...(key === "clientId" ? { projectId: "" } : {}),
    }));
  };

  const sortBy = (column: string) => {
    setFilters((current) => ({
      ...current,
      sort: column,
      direction: current.sort === column && current.direction === "asc" ? "desc" : "asc",
      page: "1",
    }));
  };

  const subs = (data?.filters.subServices || []).filter((item) => !filters.serviceId || item.serviceId === filters.serviceId);
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

  const exportReport = async (kind: "excel" | "pdf" | "print") => {
    if (!data) return;
    let full;
    try {
      full = await getTaskReport({ ...filters, page: 1, pageSize: 5000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export this report");
      return;
    }
    void runReportExport(kind, "Tasks Report", [
      data.periodLabel,
      `Tasks ${data.summary.total} · Completed ${data.summary.completed} · In Progress ${data.summary.inProgress} · Pending ${data.summary.pending} · Overdue ${data.summary.overdue} · On Hold ${data.summary.onHold}`,
    ], [{
      title: "Tasks",
      headers: ["Task ID", "Task", "Client", "Project", "Main Service", "Sub Service", "Employee", "Scheduled", "Start", "End", "Progress", "Status", "Priority"],
      rows: full.tasks.map((row) => [row.id, row.name, row.client, row.project, row.service, row.subService, row.employee, row.scheduledLabel, row.startTime, row.endTime, `${row.progress}%`, statusLabel(row.status), row.priority]),
    }]);
  };

  return (
    <div className="space-y-4">
      {data ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_260px]">
          <StatGrid items={[
            { label: "Total", value: data.summary.total },
            { label: "Completed", value: data.summary.completed },
            { label: "In Progress", value: data.summary.inProgress },
            { label: "Pending", value: data.summary.pending },
            { label: "Overdue", value: data.summary.overdue },
            { label: "On Hold", value: data.summary.onHold },
          ]} />
          <div className={`${dashboardCardClass} px-2`}>
            <StatusChart summary={data.summary} />
          </div>
        </div>
      ) : null}

      <section className={`${dashboardCardClass} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">{data ? `Showing ${data.periodLabel}. Status totals include every task that matches the filters.` : "Filter tasks by client, project, employee, service, and schedule."}</p>
          <ExportButtons onExport={(kind) => void exportReport(kind)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client">
            <Select value={filters.clientId} onChange={(value) => set("clientId", value)}>
              <option value="">All clients</option>
              {data?.filters.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={filters.projectId} onChange={(value) => set("projectId", value)}>
              <option value="">All projects</option>
              {data?.filters.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          </Field>
          <Field label="Employee">
            <Select value={filters.employeeId} onChange={(value) => set("employeeId", value)}>
              <option value="">All employees</option>
              {data?.filters.employees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </Select>
          </Field>
          <Field label="Main service">
            <Select value={filters.serviceId} onChange={(value) => {
              const service = data?.filters.services.find((item) => item.id === value);
              setFilters((current) => ({ ...current, serviceId: value, serviceName: service?.name || "", subServiceId: "", subServiceName: "", page: "1" }));
            }}>
              <option value="">All services</option>
              {data?.filters.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </Select>
          </Field>
          <Field label="Sub service">
            <Select value={filters.subServiceId} onChange={(value) => {
              const sub = subs.find((item) => item.id === value);
              setFilters((current) => ({ ...current, subServiceId: value, subServiceName: sub?.name || "", page: "1" }));
            }}>
              <option value="">All sub services</option>
              {subs.map((sub) => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
            </Select>
          </Field>
          <Field label="Task status">
            <Select value={filters.status} onChange={(value) => set("status", value)}>
              <option value="">All statuses</option>
              {(data?.filters.statuses || ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "ON_HOLD"]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
          </Field>
          <Field label="Monthly cycle">
            <Select value={filters.cycleId} onChange={(value) => set("cycleId", value)}>
              <option value="">Current cycle</option>
              <option value="all">All cycles</option>
              {data?.filters.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}
            </Select>
          </Field>
          <Field label="Month">
            <Select value={filters.month} onChange={(value) => set("month", value)}>
              <option value="">All months</option>
              {MONTHS.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}
            </Select>
          </Field>
          <Field label="Year">
            <Select value={filters.year} onChange={(value) => set("year", value)}>
              <option value="">All years</option>
              {(data?.filters.years || []).map((year) => <option key={year} value={String(year)}>{year}</option>)}
            </Select>
          </Field>
          <Field label="Scheduled from">
            <input className={dateClass} type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} />
          </Field>
          <Field label="Scheduled to">
            <input className={dateClass} type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} />
          </Field>
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <input className={dashboardInputClass} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Task, client, employee…" />
            </div>
          </Field>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading && !data ? <p className="text-sm text-zinc-500">Loading tasks report…</p> : null}

      <ReportPanel title="Task details">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                {COLUMNS.map(([key, label]) => (
                  <TableHead key={key} className={dashboardTableHeadClass}>
                    <button type="button" className="uppercase" onClick={() => sortBy(key)}>{label}</button>
                  </TableHead>
                ))}
                <TableHead className={dashboardTableHeadClass} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.tasks.length ? data.tasks.map((row) => (
                <TableRow key={row.id} className={dashboardTableBodyRowClass}>
                  <TableCell className={dashboardTableCellClass}>{row.id}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.name}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.client}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.project}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.service}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.subService}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.employee}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.scheduledLabel}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.startTime}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.endTime}</TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.progress}%</TableCell>
                  <TableCell className={dashboardTableCellClass}><StatusBadge status={row.status} /></TableCell>
                  <TableCell className={dashboardTableCellClass}>{row.priority}</TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <button type="button" className={actionBtnView} onClick={() => void openTask(row)} aria-label="Open task">
                      <Eye className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={14} className="px-4 py-8 text-center text-xs text-zinc-500">No tasks match these filters.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
          <span>{data ? `${data.totalRows} tasks` : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>Previous</button>
            <span>{page} / {pageCount}</span>
            <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page >= pageCount} onClick={() => set("page", String(page + 1))}>Next</button>
          </div>
        </div>
      </ReportPanel>
      <TaskViewModal open={Boolean(viewTask)} onOpenChange={(open) => { if (!open) setViewTask(null); }} task={viewTask} />
    </div>
  );
}
