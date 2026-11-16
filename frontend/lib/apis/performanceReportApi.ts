import { API_URL } from "./config";

export type ReportFilters = {
  employees: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; clientId: string }>;
  contracts: Array<{ id: string; label: string; clientId: string; projectId?: string | null; contractType?: string }>;
  cycles: Array<{ id: string; projectId: string; label: string; start: string; end: string }>;
  services: Array<{ id: string; name: string }>;
  subServices: Array<{ id: string; name: string; serviceId: string; serviceName: string; projectId: string; label: string }>;
  statuses: string[];
  projectStatuses: string[];
  years: number[];
};

export type StatusSummary = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  onHold: number;
};

export type ReportTaskRow = {
  id: string;
  name: string;
  client: string;
  project: string;
  projectId: string;
  service: string;
  subService: string;
  employee: string;
  employeeId: string;
  scheduledDate: string;
  scheduledLabel: string;
  startTime: string;
  endTime: string;
  progress: number;
  status: string;
  priority: string;
  isExtra: boolean;
  transferredTo?: string;
  transferredAt?: string | null;
};

export type ServiceReportRow = {
  serviceName: string;
  name: string;
  kind: "original" | "extra";
  planned?: number;
  assigned?: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  onHold: number;
  remaining?: number;
};

type Query = Record<string, string | number | undefined>;

async function getReport<T>(path: string, params: Query): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const response = await fetch(`${API_URL}/api/reports/${path}?${search.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Could not load this report");
  }
  return result.data as T;
}

export function getEmployeeReport(params: Query) {
  return getReport<{
    periodLabel: string;
    generatedAt: string;
    subject: { employee: string; project: string; client: string };
    summary: StatusSummary & { projects: number; completionRate: number };
    services: ServiceReportRow[];
    tasks: ReportTaskRow[];
    history: ReportTaskRow[];
    filters: ReportFilters;
  }>("employees", params);
}

export function getClientReport(params: Query) {
  return getReport<{
    periodLabel: string;
    generatedAt: string;
    subject: { client: string };
    summary: {
      totalProjects: number;
      activeProjects: number;
      completedProjects: number;
      onHoldProjects: number;
      plannedServices: number;
      plannedTasks: number;
      completedTasks: number;
      remainingTasks: number;
      completionRate: number;
    };
    services: ServiceReportRow[];
    projects: Array<{
      id: string;
      code: string;
      name: string;
      contract: string;
      contractType: string;
      start: string;
      end: string;
      cycle: string;
      planned: number;
      completed: number;
      progress: number;
      status: string;
    }>;
    filters: ReportFilters;
  }>("clients", params);
}

export function getTaskReport(params: Query) {
  return getReport<{
    periodLabel: string;
    generatedAt: string;
    summary: StatusSummary;
    totalRows: number;
    page: number;
    pageSize: number;
    tasks: ReportTaskRow[];
    filters: ReportFilters;
  }>("tasks", params);
}
