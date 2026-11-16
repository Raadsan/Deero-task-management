"use client";

import { getClientReport } from "@/lib/apis/performanceReportApi";
import { dashboardCardClass } from "@/lib/dashboard-ui";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";
import { ExportButtons, Field, ReportPanel, ReportTable, Select, StatGrid, dateClass, runReportExport, statusLabel } from "./report-kit";

export default function ClientPerformanceReport() {
  const [filters, setFilters] = useState({
    clientId: "",
    projectId: "",
    contractType: "",
    cycleId: "",
    projectStatus: "",
    from: "",
    to: "",
  });
  const { data, error, isLoading } = useSWR(["client-report", filters], () => getClientReport(filters));

  useEffect(() => {
    if (!data?.filters) return;
    setFilters((current) => {
      const next = { ...current };
      let changed = false;
      (["projectId", "cycleId"] as const).forEach((key) => {
        const list = key === "projectId" ? data.filters.projects : data.filters.cycles;
        const value = current[key];
        if (value && value !== "all" && !list.some((item) => item.id === value)) {
          next[key] = "";
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [data]);

  const set = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "clientId" ? { projectId: "" } : {}),
    }));
  };

  const chartData = useMemo(() => (data?.services || []).filter((row) => row.kind === "original").slice(0, 8).map((row) => ({
    name: row.name,
    Planned: row.planned || 0,
    Completed: row.completed,
    Remaining: row.remaining || 0,
  })), [data]);

  const exportReport = (kind: "excel" | "pdf" | "print") => {
    if (!data) return;
    const summary = data.summary;
    void runReportExport(kind, "Client Report", [
      data.periodLabel,
      `Client: ${data.subject.client}`,
      `Projects ${summary.totalProjects} · Active ${summary.activeProjects} · Completed ${summary.completedProjects} · On Hold ${summary.onHoldProjects}`,
      `Planned ${summary.plannedTasks} · Completed ${summary.completedTasks} · Remaining ${summary.remainingTasks} · Rate ${summary.completionRate}%`,
    ], [
      {
        title: "Service quantities",
        headers: ["Main Service", "Sub Service", "Work", "Planned", "Completed", "Remaining"],
        rows: data.services.map((row) => [row.serviceName, row.name, row.kind === "extra" ? "Extra" : "Original", row.planned || 0, row.completed, row.remaining || 0]),
      },
      {
        title: "Projects",
        headers: ["Project ID", "Project", "Contract", "Type", "Start", "End", "Cycle", "Planned", "Completed", "Progress", "Status"],
        rows: data.projects.map((row) => [row.code, row.name, row.contract, row.contractType, row.start, row.end, row.cycle, row.planned, row.completed, `${row.progress}%`, row.status]),
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <section className={`${dashboardCardClass} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">{data ? `${data.subject.client} · ${data.periodLabel}. Original contract quantities stay separate from extra work.` : "Choose a client to see that client's projects, contracts, and quantities."}</p>
          <ExportButtons onExport={exportReport} />
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
          <Field label="Contract type">
            <Select value={filters.contractType} onChange={(value) => set("contractType", value)}>
              <option value="">All types</option>
              <option value="ONE_TIME">One-time</option>
              <option value="MONTHLY">Monthly</option>
            </Select>
          </Field>
          <Field label="Monthly cycle">
            <Select value={filters.cycleId} onChange={(value) => set("cycleId", value)}>
              <option value="">Current cycle</option>
              <option value="all">All cycles</option>
              {data?.filters.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}
            </Select>
          </Field>
          <Field label="Project status">
            <Select value={filters.projectStatus} onChange={(value) => set("projectStatus", value)}>
              <option value="">All statuses</option>
              {(data?.filters.projectStatuses || []).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
          </Field>
          <Field label="From">
            <input className={dateClass} type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} />
          </Field>
          <Field label="To">
            <input className={dateClass} type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} />
          </Field>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading && !data ? <p className="text-sm text-zinc-500">Loading client report…</p> : null}

      {data ? (
        <>
          <StatGrid items={[
            { label: "Projects", value: data.summary.totalProjects },
            { label: "Active", value: data.summary.activeProjects },
            { label: "Completed projects", value: data.summary.completedProjects },
            { label: "On hold projects", value: data.summary.onHoldProjects },
            { label: "Planned services", value: data.summary.plannedServices },
            { label: "Planned tasks", value: data.summary.plannedTasks },
            { label: "Completed", value: data.summary.completedTasks },
            { label: "Remaining", value: data.summary.remainingTasks },
            { label: "Completion", value: `${data.summary.completionRate}%` },
          ]} />
          <ReportPanel title="Projects">
            <ReportTable
              headers={["Project ID", "Project", "Contract", "Type", "Start", "End", "Cycle", "Planned", "Completed", "Progress", "Status"]}
              empty="No projects match these filters."
              rows={data.projects.map((row) => [
                row.code,
                row.name,
                row.contract,
                row.contractType,
                row.start,
                row.end,
                row.cycle,
                row.planned,
                row.completed,
                `${row.progress}%`,
                statusLabel(row.status),
              ])}
            />
          </ReportPanel>
          <ReportPanel title="Service quantities">
            <div className="h-52 px-2">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip />
                    <Bar dataKey="Planned" fill="#651210" radius={3} />
                    <Bar dataKey="Completed" fill="#009966" radius={3} />
                    <Bar dataKey="Remaining" fill="#f59e0b" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="px-4 py-8 text-xs text-zinc-500">No services in this period.</p>}
            </div>
            <ReportTable
              headers={["Main Service", "Sub Service", "Work", "Planned", "Completed", "Remaining"]}
              empty="No service quantities for this selection."
              rows={data.services.map((row) => [
                row.serviceName,
                row.name,
                row.kind === "extra" ? "Extra" : "Original",
                row.planned || 0,
                row.completed,
                row.remaining || 0,
              ])}
            />
          </ReportPanel>
        </>
      ) : null}
    </div>
  );
}
