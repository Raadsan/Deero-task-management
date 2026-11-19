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
  priorities: string[];
  taskTypes: string[];
  departments: string[];
  jobTitles: string[];
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
  taskType: string;
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
  workKind?: string;
  transferredTo?: string;
  transferredAt?: string | null;
};

export type StatusSummaryWithRate = StatusSummary & { completionRate: number };

export type EmployeePerformanceRow = {
  employeeId: string;
  employee: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  onHold: number;
  completionRate: number;
};

export type ProjectAnalysisRow = {
  projectId: string;
  project: string;
  client: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completionRate: number;
};

export type ClientAnalysisRow = {
  clientId: string;
  client: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  onHold: number;
};

export type StatusDistributionItem = {
  status: string;
  count: number;
  percent: number;
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

export type EmployeeOverviewRow = {
  employeeId: string;
  employee: string;
  staffCode: string;
  department: string;
  jobTitle: string;
  employmentStatus: string;
  image: string | null;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  onHold: number;
  completionRate: number;
};

export type EmployeeProjectRow = {
  projectId: string;
  project: string;
  client: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
};

export type EmployeeProjectParticipationRow = {
  employeeId: string;
  employee: string;
  projectId: string;
  project: string;
  client: string;
  assigned: number;
  completed: number;
  remaining: number;
};

export type EmployeeMonthlyTrend = {
  month: string;
  label: string;
  assigned: number;
  completed: number;
  overdue: number;
  completionRate: number;
};

export function getEmployeeReport(params: Query) {
  return getReport<{
    periodLabel: string;
    generatedAt: string;
    subject: { employee: string; project: string; client: string };
    organization: {
      totalEmployees: number;
      activeEmployees: number;
      employeesWithTasks: number;
      totalAssignedTasks: number;
      completed: number;
      inProgress: number;
      pending: number;
      overdue: number;
      onHold: number;
      completionRate: number;
    };
    summary: StatusSummary & { projects: number; completionRate: number };
    employeeOverview: EmployeeOverviewRow[];
    employeeOverviewTotal: number;
    employeeOverviewPage: number;
    employeeOverviewPageSize: number;
    statusDistribution: StatusDistributionItem[];
    workloadChart: Array<{ name: string; total: number; completed: number; pending: number; inProgress: number; overdue: number }>;
    projectParticipation: EmployeeProjectParticipationRow[];
    monthlyTrends: EmployeeMonthlyTrend[];
    selectedEmployee: {
      id: string;
      name: string;
      staffCode: string;
      jobTitle: string;
      department: string;
      employmentStatus: string;
      employmentType: string;
      image: string | null;
    } | null;
    projectsParticipated: EmployeeProjectRow[];
    tasks: ReportTaskRow[];
    tasksTotal: number;
    taskPage: number;
    taskPageSize: number;
    history: ReportTaskRow[];
    filters: ReportFilters;
  }>("employees", params);
}

export type ClientServicePerformanceRow = {
  serviceName: string;
  subService: string;
  monthlyTarget: number | string;
  completed: number;
  remaining: number;
  extraWork: number;
  progress: number;
  kind: string;
};

export type ClientFinancialOverview = {
  openingBalance: number;
  openingBalanceType: string;
  totalContractValue: number;
  totalInvoiced: number;
  totalAdvanceCreditApplied: number;
  totalAmountPaid: number;
  totalCreditNotes: number;
  outstandingInvoiceBalance: number;
  availableCustomerCredit: number;
  netCustomerBalance: number;
  balanceDirection: string;
};

export function getClientReport(params: Query) {
  return getReport<{
    periodLabel: string;
    generatedAt: string;
    subject: { client: string };
    organization: {
      totalClients: number;
      activeClients: number;
      clientsWithActiveProjects: number;
      totalProjects: number;
      activeContracts: number;
      totalContractValue: number;
      totalInvoiced: number;
      totalAmountReceived: number;
      outstandingReceivables: number;
    };
    selectedClient: {
      id: string;
      clientCode: string;
      name: string;
      contactPerson: string;
      phone: string;
      email: string;
      address: string;
      status: string;
      registrationDate: string;
    } | null;
    financial: ClientFinancialOverview;
    summary: StatusSummary & {
      totalProjects: number;
      activeProjects: number;
      completedProjects: number;
      onHoldProjects: number;
      plannedServices: number;
      plannedTasks: number;
      completedTasks: number;
      remainingTasks: number;
      completionRate: number;
      taskCompletionRate: number;
    };
    statusDistribution: StatusDistributionItem[];
    services: ClientServicePerformanceRow[];
    projects: Array<{
      id: string;
      code: string;
      name: string;
      contract: string;
      contractType: string;
      projectType: string;
      start: string;
      end: string;
      cycle: string;
      planned: number;
      completed: number;
      totalTasks?: number;
      pendingTasks?: number;
      overdueTasks?: number;
      inProgressTasks?: number;
      progress: number;
      status: string;
    }>;
    contracts: Array<{
      id: string;
      clientId: string;
      number: string;
      title: string;
      type: string;
      duration: string;
      startDate: string;
      endDate: string;
      amount: number;
      paymentTerms: string;
      status: string;
      project: string;
    }>;
    invoices: Array<{
      id: number;
      number: string;
      date: string;
      amount: number;
      paid: number;
      balanceDue: number;
      status: string;
    }>;
    receipts: Array<{
      id: number;
      number: string;
      date: string;
      invoiceNumber: string;
      method: string;
      amount: number;
      status: string;
    }>;
    creditNotes: Array<{
      id: number;
      number: string;
      date: string;
      originalInvoice: string;
      totalCredit: number;
      appliedReceivable: number;
      customerCredit: number;
      status: string;
    }>;
    employeeParticipation: Array<{
      employee: string;
      projectsParticipated: number;
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
      overdue: number;
    }>;
    tasks: Array<{
      id: string;
      name: string;
      project: string;
      service: string;
      employee: string;
      scheduledLabel: string;
      progress: number;
      status: string;
      workKind?: string;
    }>;
    tasksTotal: number;
    taskPage: number;
    taskPageSize: number;
    chart: {
      serviceCompletion: Array<{ name: string; completed: number; remaining: number }>;
      invoiceVsReceived: Array<{ label: string; value: number }>;
      outstandingBalance: number;
    };
    filters: ReportFilters;
  }>("clients", params);
}

export function getTaskReport(params: Query) {
  return getReport<{
    periodLabel: string;
    generatedAt: string;
    summary: StatusSummaryWithRate;
    taskTypeSummary: { project: StatusSummary; standalone: StatusSummary };
    statusDistribution: StatusDistributionItem[];
    employeePerformance: EmployeePerformanceRow[];
    projectAnalysis: ProjectAnalysisRow[];
    clientAnalysis: ClientAnalysisRow[];
    totalRows: number;
    page: number;
    pageSize: number;
    tasks: ReportTaskRow[];
    filters: ReportFilters;
  }>("tasks", params);
}
