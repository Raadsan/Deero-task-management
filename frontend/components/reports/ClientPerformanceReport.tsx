"use client";

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
  dateClass,
  runReportExport,
  statusLabel,
} from "./report-kit";
import { getClientReport } from "@/lib/apis/performanceReportApi";
import { dashboardCardClass, dashboardInputClass } from "@/lib/dashboard-ui";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";

const DEFAULT_FILTERS = {
  clientId: "",
  from: "",
  to: "",
  projectId: "",
  contractId: "",
  contractType: "",
  status: "",
  paymentStatus: "",
  serviceId: "",
  serviceName: "",
  cycleId: "",
  month: "",
  year: "",
  search: "",
  sort: "scheduledDate",
  direction: "desc",
  page: "1",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatGeneratedAt(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function money(value?: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-zinc-600">{pct}%</span>
    </div>
  );
}

export default function ClientPerformanceReport() {
  const detailRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const { data, error, isLoading } = useSWR(["client-report", filters], () => getClientReport({ ...filters, pageSize: 25 }));

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
      page: key === "page" ? value : "1",
      ...(key === "clientId" ? { projectId: "", contractId: "" } : {}),
    }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
  };

  const selectedClient = Boolean(filters.clientId);
  const projectOptions = useMemo(() => {
    if (!data?.filters.projects) return [];
    if (!filters.clientId) return data.filters.projects;
    return data.filters.projects.filter((project) => project.clientId === filters.clientId);
  }, [data?.filters.projects, filters.clientId]);

  const contractOptions = useMemo(() => {
    if (!data?.filters.contracts) return [];
    if (!filters.clientId) return data.filters.contracts;
    return data.filters.contracts.filter((contract) => contract.clientId === filters.clientId);
  }, [data?.filters.contracts, filters.clientId]);

  const page = Number(filters.page) || 1;
  const pageCount = Math.max(1, Math.ceil((data?.tasksTotal || 0) / 25));

  const exportReport = async (kind: "excel" | "pdf" | "print") => {
    if (!data) return;
    let full;
    try {
      full = await getClientReport({ ...filters, page: 1, pageSize: 5000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export this report");
      return;
    }
    const title = selectedClient && full.selectedClient ? `Client Report — ${full.selectedClient.name}` : "Client Report";
    void runReportExport(kind, title, [full.periodLabel, `Generated ${formatGeneratedAt(full.generatedAt)}`, full.subject.client], [
      {
        title: "Projects",
        headers: ["Project", "Type", "Contract", "Start", "End", "Total Tasks", "Completed", "Pending", "Overdue", "Progress", "Status"],
        rows: full.projects.map((row) => [
          row.name,
          row.projectType,
          row.contract,
          row.start,
          row.end,
          row.totalTasks,
          row.completed,
          row.pendingTasks,
          row.overdueTasks,
          `${row.progress}%`,
          row.status,
        ]),
      },
      {
        title: "Monthly service performance",
        headers: ["Service", "Sub Service", "Target", "Completed", "Remaining", "Extra Work", "Progress"],
        rows: full.services.map((row) => [
          row.serviceName,
          row.subService,
          row.monthlyTarget,
          row.completed,
          row.remaining,
          row.extraWork,
          `${row.progress}%`,
        ]),
      },
      {
        title: "Financial overview",
        headers: ["Metric", "Amount"],
        rows: Object.entries(full.financial).map(([key, value]) => [key, String(value)]),
      },
      {
        title: "Invoices",
        headers: ["Invoice", "Date", "Amount", "Paid", "Balance", "Status"],
        rows: full.invoices.map((row) => [row.number, row.date, row.amount, row.paid, row.balanceDue, row.status]),
      },
    ]);
  };

  const invoiceChart = data?.chart?.invoiceVsReceived || [];

  return (
    <div className="space-y-4">
      <header className={`${dashboardCardClass} px-4 py-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Client Report</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Complete overview of client projects, contracted services, task progress, payments, invoices, and outstanding balances.
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
          <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50" onClick={resetFilters}>
            <RotateCcw className="size-3.5" /> Reset filters
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client">
            <Select value={filters.clientId} onChange={(value) => set("clientId", value)}>
              <option value="">All clients</option>
              {(data?.filters.clients || []).map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Start date">
            <input className={dateClass} type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} />
          </Field>
          <Field label="End date">
            <input className={dateClass} type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} />
          </Field>
          <Field label="Project">
            <Select value={filters.projectId} onChange={(value) => set("projectId", value)}>
              <option value="">All projects</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Contract">
            <Select value={filters.contractId} onChange={(value) => set("contractId", value)}>
              <option value="">All contracts</option>
              {contractOptions.map((contract) => (
                <option key={contract.id} value={contract.id}>{contract.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Project type">
            <Select value={filters.contractType} onChange={(value) => set("contractType", value)}>
              <option value="">All</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ONE_TIME">One-Time</option>
            </Select>
          </Field>
          <Field label="Task status">
            <Select value={filters.status} onChange={(value) => set("status", value)}>
              <option value="">All</option>
              {(data?.filters.statuses || []).map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status">
            <Select value={filters.paymentStatus} onChange={(value) => set("paymentStatus", value)}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partially paid</option>
              <option value="unpaid">Unpaid</option>
            </Select>
          </Field>
          <Field label="Service">
            <Select
              value={filters.serviceId}
              onChange={(value) => {
                const service = data?.filters.services.find((item) => item.id === value);
                setFilters((current) => ({ ...current, serviceId: value, serviceName: service?.name || "", page: "1" }));
              }}
            >
              <option value="">All services</option>
              {data?.filters.services.map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Month">
            <Select value={filters.month} onChange={(value) => set("month", value)}>
              <option value="">All months</option>
              {MONTHS.map((name, index) => (
                <option key={name} value={String(index + 1)}>{name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Year">
            <Select value={filters.year} onChange={(value) => set("year", value)}>
              <option value="">All years</option>
              {(data?.filters.years || []).map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </Select>
          </Field>
          <Field label="Monthly cycle">
            <Select value={filters.cycleId} onChange={(value) => set("cycleId", value)}>
              <option value="">Current cycle</option>
              <option value="all">All cycles</option>
              {data?.filters.cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>{cycle.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Search tasks">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <input className={dashboardInputClass} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Task, project, employee…" />
            </div>
          </Field>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading && !data ? <p className="text-sm text-zinc-500">Loading client report…</p> : null}

      {data ? (
        <>
          <StatGrid
            items={
              selectedClient
                ? [
                    { label: "Total Tasks", value: data.summary.total || 0 },
                    { label: "Completed", value: data.summary.completed || 0 },
                    { label: "In Progress", value: data.summary.inProgress || 0 },
                    { label: "Pending", value: data.summary.pending || 0 },
                    { label: "Overdue", value: data.summary.overdue || 0 },
                    { label: "On Hold", value: data.summary.onHold || 0 },
                    { label: "Task Completion", value: `${data.summary.taskCompletionRate || 0}%` },
                    { label: "Service Completion", value: `${data.summary.completionRate}%` },
                  ]
                : [
                    { label: "Total Clients", value: data.organization.totalClients },
                    { label: "Active Clients", value: data.organization.activeClients },
                    { label: "Clients w/ Projects", value: data.organization.clientsWithActiveProjects },
                    { label: "Total Projects", value: data.organization.totalProjects },
                    { label: "Active Contracts", value: data.organization.activeContracts },
                    { label: "Contract Value", value: money(data.organization.totalContractValue) },
                    { label: "Total Invoiced", value: money(data.organization.totalInvoiced) },
                    { label: "Received", value: money(data.organization.totalAmountReceived) },
                    { label: "Outstanding AR", value: money(data.organization.outstandingReceivables) },
                  ]
            }
          />

          {data.selectedClient ? (
            <ReportPanel title="Client information">
              <dl className="grid grid-cols-1 gap-3 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Client ID", data.selectedClient.clientCode],
                  ["Client name", data.selectedClient.name],
                  ["Contact person", data.selectedClient.contactPerson],
                  ["Phone", data.selectedClient.phone],
                  ["Email", data.selectedClient.email],
                  ["Address", data.selectedClient.address],
                  ["Status", data.selectedClient.status],
                  ["Registration date", data.selectedClient.registrationDate],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
                    <dd className="text-zinc-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </ReportPanel>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportPanel title="Task status distribution">
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <StatusChart summary={data.summary} />
                <StatusDistributionTable items={data.statusDistribution} />
              </div>
            </ReportPanel>
            <ReportPanel title="Invoice amount vs received">
              {invoiceChart.length ? (
                <div className="h-52 px-2 py-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={invoiceChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={48} />
                      <Tooltip formatter={(value: number) => money(value)} />
                      <Bar dataKey="value" fill="#651210" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="px-4 py-6 text-xs text-zinc-500">No invoice data for this selection.</p>
              )}
            </ReportPanel>
          </div>

          <ReportPanel title="Project overview">
            <ReportTable
              headers={["Project", "Type", "Contract", "Start", "End", "Total Tasks", "Completed", "Pending", "Overdue", "Progress", "Status"]}
              empty="No projects match these filters."
              rows={data.projects.map((row) => [
                <button key={row.id} type="button" className="text-left font-medium text-primary hover:underline" onClick={() => { set("projectId", row.id); detailRef.current?.scrollIntoView({ behavior: "smooth" }); }}>{row.name}</button>,
                row.projectType,
                row.contract,
                row.start,
                row.end,
                row.totalTasks ?? row.planned,
                row.completed,
                row.pendingTasks ?? "—",
                row.overdueTasks ?? "—",
                `${row.progress}%`,
                statusLabel(row.status),
              ])}
            />
          </ReportPanel>

          <ReportPanel title="Monthly service performance">
            <ReportTable
              headers={["Service", "Sub service", "Monthly target", "Completed", "Remaining", "Extra work", "Progress"]}
              empty="No service quantities for this period."
              rows={data.services.map((row) => [
                row.serviceName,
                row.subService,
                row.monthlyTarget,
                row.completed,
                row.remaining,
                row.extraWork,
                <ProgressBar key={`${row.serviceName}-${row.subService}`} value={row.progress} />,
              ])}
            />
          </ReportPanel>

          {selectedClient ? (
            <>
              <ReportPanel title="Financial overview">
                <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Opening balance", money(Number(data.financial.openingBalance))],
                    ["Total contract value", money(data.financial.totalContractValue)],
                    ["Total invoiced", money(data.financial.totalInvoiced)],
                    ["Advance/credit applied", money(data.financial.totalAdvanceCreditApplied)],
                    ["Amount paid", money(data.financial.totalAmountPaid)],
                    ["Credit notes", money(data.financial.totalCreditNotes)],
                    ["Outstanding invoice balance", money(data.financial.outstandingInvoiceBalance)],
                    ["Available customer credit", money(data.financial.availableCustomerCredit)],
                    ["Net customer balance", money(data.financial.netCustomerBalance)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-zinc-100 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
                  Balance direction: <span className="font-medium text-zinc-700">{data.financial.balanceDirection}</span>
                </p>
              </ReportPanel>

              <ReportPanel title="Contract overview">
                <ReportTable
                  headers={["Contract #", "Title", "Type", "Duration", "Start", "End", "Amount", "Payment terms", "Status"]}
                  empty="No contracts for this client."
                  rows={data.contracts.map((row) => [
                    row.number,
                    row.title,
                    row.type,
                    row.duration,
                    row.startDate,
                    row.endDate,
                    money(row.amount),
                    row.paymentTerms,
                    row.status,
                  ])}
                />
              </ReportPanel>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ReportPanel title="Invoice history">
                  <ReportTable
                    headers={["Invoice", "Date", "Amount", "Paid", "Balance", "Status", ""]}
                    empty="No posted invoices."
                    rows={data.invoices.map((row) => [
                      row.number,
                      row.date,
                      money(row.amount),
                      money(row.paid),
                      money(row.balanceDue),
                      row.status,
                      <Link key={row.id} href="/accounting/customer-invoices" className="text-xs font-medium text-primary hover:underline">View</Link>,
                    ])}
                  />
                </ReportPanel>
                <ReportPanel title="Receipt & payment history">
                  <ReportTable
                    headers={["Receipt", "Date", "Invoice", "Method", "Amount", "Status"]}
                    empty="No posted receipts."
                    rows={data.receipts.map((row) => [
                      row.number,
                      row.date,
                      row.invoiceNumber,
                      row.method,
                      money(row.amount),
                      row.status,
                    ])}
                  />
                </ReportPanel>
              </div>

              <ReportPanel title="Employee participation">
                <ReportTable
                  headers={["Employee", "Projects", "Assigned tasks", "Completed", "In progress", "Pending", "Overdue"]}
                  empty="No employee assignments for this client."
                  rows={data.employeeParticipation.map((row) => [
                    row.employee,
                    row.projectsParticipated,
                    row.total,
                    row.completed,
                    row.inProgress,
                    row.pending,
                    row.overdue,
                  ])}
                />
              </ReportPanel>
            </>
          ) : null}

          <div ref={detailRef}>
            <ReportPanel title="Task details">
              <ReportTable
                headers={["Task ID", "Task name", "Project", "Service", "Employee", "Scheduled", "Progress", "Status"]}
                empty="No tasks match these filters."
                rows={data.tasks.map((row) => [
                  row.id,
                  row.workKind === "Extra Work" ? `${row.name} (Extra)` : row.name,
                  row.project,
                  row.service,
                  row.employee,
                  row.scheduledLabel,
                  `${row.progress}%`,
                  <StatusBadge key={row.id} status={row.status} />,
                ])}
              />
              <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
                <span>{data.tasksTotal} tasks</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>Previous</button>
                  <span>{page} / {pageCount}</span>
                  <button type="button" className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40" disabled={page >= pageCount} onClick={() => set("page", String(page + 1))}>Next</button>
                </div>
              </div>
            </ReportPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}