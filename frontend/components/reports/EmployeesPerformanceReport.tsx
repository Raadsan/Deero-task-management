"use client";

import TaskViewModal from "@/components/tasks/TaskViewModal";
import { getEmployeeReport, type ReportTaskRow } from "@/lib/apis/performanceReportApi";
import { getTaskById } from "@/lib/apis/taskApi";
import { dashboardCardClass } from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import { Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";
import { ExportButtons, Field, ReportPanel, ReportTable, Select, StatGrid, StatusBadge, StatusChart, dateClass, runReportExport, statusLabel } from "./report-kit";

export default function EmployeesPerformanceReport() {
  const [filters, setFilters] = useState({
    employeeId: "",
    projectId: "",
    cycleId: "",
    from: "",
    to: "",
  });
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [taskPage, setTaskPage] = useState(1);
  const { data, error, isLoading } = useSWR(["employee-report", filters], () => getEmployeeReport(filters));

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
      return changed ? next : current;
    });
  }, [data]);

  const set = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "employeeId" ? { projectId: "" } : {}),
    }));
    setTaskPage(1);
  };

  const chartData = useMemo(() => (data?.services || []).slice(0, 8).map((row) => ({
    name: row.name,
    Assigned: row.assigned || 0,
    Completed: row.completed,
    Overdue: row.overdue,
  })), [data]);

  const openTask = async (row: ReportTaskRow) => {
    const result = await getTaskById(row.id);
    if (!result.success || !result.data) {
      toast.error("Could not open this task");
      return;
    }
    setViewTask(result.data);
  };

  const exportReport = (kind: "excel" | "pdf" | "print") => {
    if (!data) return;
    const lines = [
      data.periodLabel,
      `Employee: ${data.subject.employee}`,
      `Project: ${data.subject.project}`,
      `Tasks ${data.summary.total} · Completed ${data.summary.completed} · In Progress ${data.summary.inProgress} · Pending ${data.summary.pending} · Overdue ${data.summary.overdue} · On Hold ${data.summary.onHold} · Rate ${data.summary.completionRate}%`,
    ];
    void runReportExport(kind, "Employees Report", lines, [
      {
        title: "Service performance",
        headers: ["Main Service", "Sub Service", "Work", "Assigned", "Completed", "In Progress", "Overdue", "Pending", "On Hold"],
        rows: data.services.map((row) => [row.serviceName, row.name, row.kind === "extra" ? "Extra" : "Original", row.assigned || 0, row.completed, row.inProgress, row.overdue, row.pending, row.onHold]),
      },
      {
        title: "Assigned tasks",
        headers: ["Task", "Project", "Client", "Sub Service", "Date", "Start", "End", "Progress", "Status"],
        rows: data.tasks.map((row) => [row.name, row.project, row.client, row.subService, row.scheduledLabel, row.startTime, row.endTime, `${row.progress}%`, statusLabel(row.status)]),
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <section className={`${dashboardCardClass} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">{data ? `Showing ${data.periodLabel}. Monthly projects stay on one cycle until you choose All cycles or a date range.` : "Choose an employee to see that person's projects and assigned tasks."}</p>
          <ExportButtons onExport={exportReport} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Employee">
            <Select value={filters.employeeId} onChange={(value) => set("employeeId", value)}>
              <option value="">All employees</option>
              {data?.filters.employees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={filters.projectId} onChange={(value) => set("projectId", value)}>
              <option value="">All projects</option>
              {data?.filters.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          </Field>
          <Field label="Monthly cycle">
            <Select value={filters.cycleId} onChange={(value) => set("cycleId", value)}>
              <option value="">Current cycle</option>
              <option value="all">All cycles</option>
              {data?.filters.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}
            </Select>
          </Field>
          <Field label="Scheduled from">
            <input className={dateClass} type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} />
          </Field>
          <Field label="Scheduled to">
            <input className={dateClass} type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} />
          </Field>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading && !data ? <p className="text-sm text-zinc-500">Loading employee report…</p> : null}

      {data ? (
        <>
          <StatGrid items={[
            { label: "Projects", value: data.summary.projects },
            { label: "Assigned", value: data.summary.total },
            { label: "Completed", value: data.summary.completed },
            { label: "In Progress", value: data.summary.inProgress },
            { label: "Pending", value: data.summary.pending },
            { label: "Overdue", value: data.summary.overdue },
            { label: "On Hold", value: data.summary.onHold },
            { label: "Completion", value: `${data.summary.completionRate}%` },
          ]} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
            <ReportPanel title="Task status">
              <StatusChart summary={data.summary} />
            </ReportPanel>
            <ReportPanel title="Service performance">
              <div className="h-52 px-2">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                      <Tooltip />
                      <Bar dataKey="Assigned" fill="#651210" radius={3} />
                      <Bar dataKey="Completed" fill="#009966" radius={3} />
                      <Bar dataKey="Overdue" fill="#e6005c" radius={3} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="px-4 py-8 text-xs text-zinc-500">No service tasks in this period.</p>}
              </div>
            </ReportPanel>
          </div>
          <ReportPanel title={`${data.subject.employee} · ${data.subject.project}`}>
            <ReportTable
              headers={["Main Service", "Sub Service", "Work", "Assigned", "Completed", "In Progress", "Overdue", "Pending", "On Hold"]}
              empty="No sub-service work in this period."
              rows={data.services.map((row) => [
                row.serviceName,
                row.name,
                row.kind === "extra" ? "Extra" : "Original",
                row.assigned || 0,
                row.completed,
                row.inProgress,
                row.overdue,
                row.pending,
                row.onHold,
              ])}
            />
          </ReportPanel>
          <ReportPanel title="Assigned tasks">
            <ReportTable
              headers={["Task", "Project", "Client", "Date", "Start", "End", "Progress", "Status", ""]}
              empty="No assigned tasks match these filters."
              rows={data.tasks.slice((taskPage - 1) * 25, taskPage * 25).map((row) => [
                row.name,
                row.project,
                row.client,
                row.scheduledLabel,
                row.startTime,
                row.endTime,
                `${row.progress}%`,
                <StatusBadge key={row.id} status={row.status} />,
                <button key={`${row.id}-open`} type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" onClick={() => void openTask(row)} aria-label="Open task">
                  <Eye className="size-4" />
                </button>,
              ])}
            />
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
              <span>{data.tasks.length} tasks</span>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={taskPage <= 1} onClick={() => setTaskPage((page) => page - 1)}>Previous</button>
                <span>{taskPage} / {Math.max(1, Math.ceil(data.tasks.length / 25))}</span>
                <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={taskPage >= Math.ceil(data.tasks.length / 25)} onClick={() => setTaskPage((page) => page + 1)}>Next</button>
              </div>
            </div>
          </ReportPanel>
          {data.history.length ? (
            <ReportPanel title="Previously assigned">
              <p className="px-4 pt-3 text-xs text-zinc-500">These tasks were reassigned. They are not included in the current workload.</p>
              <ReportTable
                headers={["Task", "Project", "Now assigned to", "Status"]}
                empty=""
                rows={data.history.map((row) => [row.name, row.project, row.transferredTo || row.employee, statusLabel(row.status)])}
              />
            </ReportPanel>
          ) : null}
        </>
      ) : null}
      <TaskViewModal open={Boolean(viewTask)} onOpenChange={(open) => { if (!open) setViewTask(null); }} task={viewTask} />
    </div>
  );
}
