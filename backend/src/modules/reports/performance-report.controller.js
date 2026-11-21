import { prisma } from "../../lib/prisma.js";
import { contractBranchWhere, getScope, mergeWhere, projectBranchWhere, taskBranchWhere, userBranchWhere } from "../../lib/portfolio-scope.js";
import { objectFeatures } from "../../lib/scheduled-task-window.js";
import {
  clientFinancialOverview,
  clientProfile,
  loadClientContracts,
  loadClientFinancials,
  loadReportClients,
  mapContractRow,
  organizationFinancialSummary,
} from "../../lib/client-report-data.js";
import {
  averageProgress,
  completionRate,
  countStatuses,
  cyclesInScope,
  isoDay,
  mergeServiceRows,
  normName,
  openCycleId,
  reportStatus,
  rollupServices,
  taskInReport,
  todayIso,
} from "../../lib/performance-report-math.js";

function text(value) {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function readQuery(req) {
  const q = req.query || {};
  return {
    employeeId: text(q.employeeId),
    projectId: text(q.projectId),
    clientId: text(q.clientId),
    contractId: text(q.contractId),
    contractType: text(q.contractType),
    cycleId: text(q.cycleId),
    month: text(q.month),
    year: text(q.year),
    status: text(q.status).toUpperCase(),
    taskType: text(q.taskType).toLowerCase(),
    priority: text(q.priority).toLowerCase(),
    paymentStatus: text(q.paymentStatus).toLowerCase(),
    projectStatus: text(q.projectStatus).toUpperCase(),
    from: text(q.from).slice(0, 10),
    to: text(q.to).slice(0, 10),
    serviceId: text(q.serviceId),
    serviceName: text(q.serviceName),
    subServiceId: text(q.subServiceId),
    subServiceName: text(q.subServiceName),
    department: text(q.department),
    jobTitle: text(q.jobTitle),
    search: text(q.search).toLowerCase(),
    sort: text(q.sort) || "scheduledDate",
    direction: text(q.direction) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(q.page) || 1),
    pageSize: Math.min(5000, Math.max(1, Number(q.pageSize) || 25)),
  };
}

function clientName(client) {
  if (!client) return "";
  return client.companyName || client.institution || "";
}

function formatDay(value) {
  const iso = isoDay(value);
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function cycleOptionLabel(cycle, index, projectName) {
  return `${projectName} · Month ${index + 1}: ${formatDay(cycle.startDate)} – ${formatDay(cycle.endDate)}`;
}

function contractTypeLabel(contract, project) {
  const raw = String(contract?.contractType || project?.billingMode || "").toUpperCase();
  if (raw === "ONE_TIME") return "One-time";
  if (raw === "MONTHLY") return "Monthly";
  return raw || "—";
}

function projectMatches(project, query) {
  if (query.projectId && project.id !== query.projectId) return false;
  if (query.clientId && project.clientId !== query.clientId) return false;
  if (query.contractId && project.contractId !== query.contractId) return false;
  if (query.contractType) {
    const type = String(project.primaryContract?.contractType || project.billingMode || "").toUpperCase();
    if (type !== query.contractType) return false;
  }
  if (query.projectStatus && String(project.lifecycleStatus || project.status || "").toUpperCase() !== query.projectStatus) return false;
  return true;
}

function clockFromDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function periodLabel(query, projects, today) {
  if (query.from && query.to) return `${formatDay(query.from)} – ${formatDay(query.to)}`;
  if (query.from) return `From ${formatDay(query.from)}`;
  if (query.to) return `Through ${formatDay(query.to)}`;
  if (query.cycleId === "all") return "All cycles";
  if (query.cycleId) {
    for (const project of projects) {
      const cycles = [...(project.cycles || [])].sort((a, b) => isoDay(a.startDate).localeCompare(isoDay(b.startDate)));
      const index = cycles.findIndex((cycle) => cycle.id === query.cycleId);
      if (index >= 0) return cycleOptionLabel(cycles[index], index, project.name);
    }
  }
  if (query.month && query.year) {
    return new Date(Date.UTC(Number(query.year), Number(query.month) - 1, 1)).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return `Current cycle · ${formatDay(today)}`;
}

async function loadReportSource(scope) {
  const [projects, tasks, staff, contracts, catalogServices] = await Promise.all([
    prisma.project.findMany({
      where: mergeWhere(projectBranchWhere(scope), { archived: false, isDraft: false }),
      select: {
        id: true,
        name: true,
        projectCode: true,
        clientId: true,
        billingMode: true,
        lifecycleStatus: true,
        status: true,
        startDate: true,
        dueDate: true,
        contractId: true,
        client: { select: { id: true, institution: true, companyName: true } },
        primaryContract: { select: { id: true, contractNumber: true, title: true, contractType: true } },
        cycles: { select: { id: true, label: true, startDate: true, endDate: true } },
        serviceLinks: {
          select: {
            serviceId: true,
            service: { select: { id: true, serviceName: true } },
            subServices: { select: { id: true, name: true, quantity: true, targetQuantity: true, assigneeId: true } },
          },
        },
      },
    }),
    prisma.task.findMany({
      where: mergeWhere({ isPersonal: false }, taskBranchWhere(scope)),
      select: {
        id: true,
        description: true,
        status: true,
        priority: true,
        progress: true,
        assgineeId: true,
        projectId: true,
        startDate: true,
        deadline: true,
        extraTimeMinutes: true,
        completedAt: true,
        features: true,
        serviceInformation: true,
        user: { select: { id: true, name: true } },
        clientTask: { select: { clientId: true, Client: { select: { id: true, institution: true, companyName: true } } } },
        transferHistory: {
          select: {
            fromAssigneeId: true,
            toAssigneeId: true,
            createdAt: true,
            fromAssignee: { select: { id: true, name: true } },
            toAssignee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.staff.findMany({
      where: mergeWhere(userBranchWhere(scope), { OR: [{ banned: false }, { banned: null }] }),
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.contract.findMany({
      where: contractBranchWhere(scope),
      select: { id: true, contractNumber: true, title: true, contractType: true, clientId: true, projectId: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.service.findMany({
      select: { id: true, serviceName: true },
      orderBy: { serviceName: "asc" },
      take: 500,
    }).catch(() => []),
  ]);
  return { projects, tasks, staff, contracts, catalogServices };
}

function normalizeTask(task, projectsById) {
  const features = objectFeatures(task.features) || {};
  const project = task.projectId ? projectsById.get(task.projectId) : null;
  const linkedClient = task.clientTask?.[0]?.Client || null;
  const client = project?.client || linkedClient;
  const info = String(task.serviceInformation || "");
  const infoService = info.split(" - ")[0] || "";
  const scheduledDate = isoDay(features.scheduledDate) || isoDay(task.startDate);
  const status = reportStatus({
    ...task,
    features,
    startDate: task.startDate,
    deadline: task.deadline,
    extraTimeMinutes: task.extraTimeMinutes,
  });
  const startFromSchedule = String(features.startTime || "").slice(0, 5);
  const endFromSchedule = String(features.endTime || "").slice(0, 5);
  return {
    id: task.id,
    name: task.description || "Task",
    taskType: project ? "project" : "standalone",
    status,
    progress: Number(task.progress) || 0,
    priority: String(task.priority || features.priorityLabel || "normal").toLowerCase(),
    isExtra: Boolean(features.isExtra),
    cycleId: String(features.cycleId || ""),
    subServiceId: String(features.subServiceId || ""),
    subServiceName: String(features.subServiceName || ""),
    serviceId: String(features.serviceId || ""),
    serviceName: String(features.serviceName || infoService || ""),
    projectId: project?.id || "",
    projectName: project?.name || "",
    projectCode: project?.projectCode || "",
    clientId: client?.id || "",
    clientName: clientName(client),
    assigneeId: task.assgineeId,
    employeeName: task.user?.name || "Unassigned",
    scheduledDate,
    startTime: startFromSchedule || clockFromDate(task.startDate),
    endTime: endFromSchedule || clockFromDate(task.deadline),
    transfers: task.transferHistory || [],
    completedAt: task.completedAt ? isoDay(task.completedAt) : "",
  };
}

function rowFromTask(task) {
  const isProject = task.taskType === "project";
  return {
    id: task.id,
    name: task.name,
    taskType: isProject ? "Project-Based" : "Standalone",
    client: isProject ? (task.clientName || "—") : (task.clientName || "N/A"),
    project: isProject ? (task.projectName || "—") : "N/A",
    projectId: task.projectId,
    service: task.serviceName || "—",
    subService: task.subServiceName || "—",
    employee: task.employeeName,
    employeeId: task.assigneeId,
    scheduledDate: task.scheduledDate,
    scheduledLabel: formatDay(task.scheduledDate),
    startTime: task.startTime || "—",
    endTime: task.endTime || "—",
    progress: task.progress,
    status: task.status,
    priority: task.priority,
    isExtra: task.isExtra,
    workKind: task.isExtra ? "Extra Work" : "Standard",
  };
}

function buildFilters({ projects, tasks, staff, contracts, catalogServices }, query) {
  const assigned = new Set(tasks.map((task) => task.assigneeId).filter(Boolean));
  const employees = staff.filter((person) => {
    if (assigned.has(person.id)) return true;
    const role = String(person.role || "").toLowerCase();
    return !role.includes("superadmin") && role !== "admin";
  }).map((person) => ({ id: person.id, name: person.name }));

  const employeeProjectIds = query.employeeId
    ? new Set([
      ...tasks.filter((task) => task.assigneeId === query.employeeId || task.transfers.some((item) => item.fromAssigneeId === query.employeeId || item.toAssigneeId === query.employeeId)).map((task) => task.projectId),
      ...projects.flatMap((project) => project.serviceLinks.flatMap((link) => link.subServices.filter((sub) => sub.assigneeId === query.employeeId).map(() => project.id))),
    ].filter(Boolean))
    : null;

  const visibleProjects = projects.filter((project) => {
    if (employeeProjectIds && !employeeProjectIds.has(project.id)) return false;
    if (query.clientId && project.clientId !== query.clientId) return false;
    return true;
  });

  const optionProjects = visibleProjects.filter((project) => !query.projectId || project.id === query.projectId);
  const clients = [];
  const seenClients = new Set();
  for (const project of projects) {
    if (!project.clientId || seenClients.has(project.clientId)) continue;
    seenClients.add(project.clientId);
    clients.push({ id: project.clientId, name: clientName(project.client) || "Client" });
  }
  for (const task of tasks) {
    if (!task.clientId || seenClients.has(task.clientId)) continue;
    seenClients.add(task.clientId);
    clients.push({ id: task.clientId, name: task.clientName || "Client" });
  }
  clients.sort((a, b) => a.name.localeCompare(b.name));

  const cycles = [];
  const services = [];
  const subServices = [];
  const seenServices = new Set();
  for (const project of optionProjects) {
    const ordered = [...project.cycles].sort((a, b) => isoDay(a.startDate).localeCompare(isoDay(b.startDate)));
    ordered.forEach((cycle, index) => {
      cycles.push({
        id: cycle.id,
        projectId: project.id,
        label: cycleOptionLabel(cycle, index, project.name),
        start: isoDay(cycle.startDate),
        end: isoDay(cycle.endDate),
      });
    });
    for (const link of project.serviceLinks) {
      const serviceName = link.service?.serviceName || "Service";
      if (link.serviceId && !seenServices.has(link.serviceId)) {
        seenServices.add(link.serviceId);
        services.push({ id: link.serviceId, name: serviceName });
      }
      for (const sub of link.subServices) {
        subServices.push({
          id: sub.id,
          name: sub.name,
          serviceId: link.serviceId,
          serviceName,
          projectId: project.id,
          label: visibleProjects.length > 1 ? `${sub.name} · ${project.name}` : sub.name,
        });
      }
    }
  }

  for (const service of catalogServices || []) {
    if (!service?.id || seenServices.has(service.id)) continue;
    seenServices.add(service.id);
    services.push({ id: service.id, name: service.serviceName || "Service" });
  }

  const visibleContracts = contracts.filter((contract) => {
    if (!clients.some((client) => client.id === contract.clientId)) return false;
    if (query.clientId && contract.clientId !== query.clientId) return false;
    if (!query.projectId) return true;
    const selected = optionProjects[0];
    return contract.projectId === query.projectId || selected?.contractId === contract.id;
  }).map((contract) => ({
    id: contract.id,
    label: contract.title ? `${contract.contractNumber} · ${contract.title}` : contract.contractNumber,
    clientId: contract.clientId,
    projectId: contract.projectId,
    contractType: contract.contractType || "",
  }));

  const years = new Set();
  for (const cycle of cycles) years.add(Number(cycle.start.slice(0, 4)));
  for (const task of tasks) if (task.scheduledDate) years.add(Number(task.scheduledDate.slice(0, 4)));
  years.add(Number(todayIso().slice(0, 4)));

  return {
    employees,
    clients,
    projects: visibleProjects.map((project) => ({ id: project.id, name: project.name, clientId: project.clientId })).sort((a, b) => a.name.localeCompare(b.name)),
    contracts: visibleContracts,
    cycles,
    services: services.sort((a, b) => a.name.localeCompare(b.name)),
    subServices,
    statuses: ["PENDING", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED", "OVERDUE", "ON_HOLD"],
    priorities: ["low", "normal", "high", "urgent"],
    taskTypes: ["all", "project", "standalone"],
    projectStatuses: [...new Set(projects.map((project) => String(project.lifecycleStatus || project.status || "").toUpperCase()).filter(Boolean))],
    years: [...years].filter(Boolean).sort((a, b) => b - a),
  };
}

function subsForProjects(projects) {
  return projects.flatMap((project) => project.serviceLinks.flatMap((link) => link.subServices.map((sub) => ({
    id: sub.id,
    name: sub.name,
    quantity: Number(sub.quantity || sub.targetQuantity) || 0,
    projectId: project.id,
    serviceId: link.serviceId,
    serviceName: link.service?.serviceName || "Service",
  }))));
}

function searchable(task) {
  return [task.id, task.name, task.clientName, task.projectName, task.employeeName, task.serviceName, task.subServiceName, task.status].join(" ").toLowerCase();
}

function sortTasks(tasks, sort, direction) {
  const factor = direction === "asc" ? 1 : -1;
  const value = (task) => {
    if (sort === "name") return task.name;
    if (sort === "client") return task.clientName;
    if (sort === "project") return task.projectName;
    if (sort === "employee") return task.employeeName;
    if (sort === "progress") return task.progress;
    if (sort === "status") return task.status;
    if (sort === "priority") return task.priority;
    if (sort === "taskType") return task.taskType;
    if (sort === "id") return task.id;
    return task.scheduledDate || "";
  };
  return [...tasks].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    if (sort === "scheduledDate") {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
    }
    if (typeof a === "number" && typeof b === "number") return (a - b) * factor;
    return String(a).localeCompare(String(b)) * factor;
  });
}

function staffMatchesQuery(person, query) {
  if (query.department && String(person.department || "") !== query.department) return false;
  if (query.jobTitle && String(person.jobTitle || "") !== query.jobTitle) return false;
  return true;
}

function employeeOverviewRow(person, reportTasks) {
  const assigned = reportTasks.filter((task) => task.assigneeId === person.id);
  const counts = countStatuses(assigned);
  return {
    employeeId: person.id,
    employee: person.name,
    staffCode: person.staffCode || person.id,
    department: person.department || "—",
    jobTitle: person.jobTitle || "—",
    employmentStatus: person.banned ? "Inactive" : "Active",
    image: person.image || null,
    total: counts.total,
    completed: counts.completed,
    inProgress: counts.inProgress,
    pending: counts.pending,
    overdue: counts.overdue,
    onHold: counts.onHold,
    completionRate: completionRate(counts.completed, counts.total),
  };
}

function sortEmployeeOverview(rows, sort, direction) {
  const factor = direction === "asc" ? 1 : -1;
  const pick = (row) => {
    if (sort === "total") return row.total;
    if (sort === "completed") return row.completed;
    if (sort === "completionRate") return row.completionRate;
    if (sort === "department") return row.department;
    return row.employee;
  };
  return [...rows].sort((left, right) => {
    const a = pick(left);
    const b = pick(right);
    if (typeof a === "number" && typeof b === "number") return (a - b) * factor;
    return String(a).localeCompare(String(b)) * factor;
  });
}

function projectsForEmployee(reportTasks, employeeId) {
  const map = new Map();
  for (const task of reportTasks) {
    if (task.assigneeId !== employeeId || !task.projectId) continue;
    if (!map.has(task.projectId)) {
      map.set(task.projectId, {
        projectId: task.projectId,
        project: task.projectName,
        client: task.clientName || "—",
        rows: [],
      });
    }
    map.get(task.projectId).rows.push(task);
  }
  return [...map.values()]
    .map((group) => {
      const counts = countStatuses(group.rows);
      return {
        projectId: group.projectId,
        project: group.project,
        client: group.client,
        total: counts.total,
        completed: counts.completed,
        inProgress: counts.inProgress,
        pending: counts.pending,
        overdue: counts.overdue,
      };
    })
    .sort((a, b) => a.project.localeCompare(b.project));
}

function groupProjectParticipation(reportTasks) {
  const map = new Map();
  for (const task of reportTasks) {
    if (!task.projectId || !task.assigneeId) continue;
    const key = `${task.assigneeId}:${task.projectId}`;
    if (!map.has(key)) {
      map.set(key, {
        employeeId: task.assigneeId,
        employee: task.employeeName,
        projectId: task.projectId,
        project: task.projectName,
        client: task.clientName || "—",
        rows: [],
      });
    }
    map.get(key).rows.push(task);
  }
  return [...map.values()]
    .map((group) => {
      const counts = countStatuses(group.rows);
      return {
        employeeId: group.employeeId,
        employee: group.employee,
        projectId: group.projectId,
        project: group.project,
        client: group.client,
        assigned: counts.total,
        completed: counts.completed,
        remaining: Math.max(0, counts.total - counts.completed),
      };
    })
    .sort((a, b) => b.assigned - a.assigned);
}

function monthlyTrends(reportTasks) {
  const buckets = new Map();
  const ensure = (month) => {
    if (!buckets.has(month)) {
      buckets.set(month, { month, label: month, assigned: 0, completed: 0, overdue: 0, completionRate: 0 });
    }
    return buckets.get(month);
  };
  for (const task of reportTasks) {
    const scheduledMonth = task.scheduledDate ? task.scheduledDate.slice(0, 7) : "";
    if (scheduledMonth) {
      const bucket = ensure(scheduledMonth);
      bucket.assigned += 1;
      if (task.status === "OVERDUE") bucket.overdue += 1;
    }
    const completedMonth = task.completedAt ? task.completedAt.slice(0, 7) : "";
    if (task.status === "COMPLETED" && completedMonth) {
      ensure(completedMonth).completed += 1;
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      ...bucket,
      completionRate: completionRate(bucket.completed, bucket.assigned),
    }));
}

function workloadSeries(rows, limit = 12) {
  return [...rows]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((row) => ({
      name: row.employee,
      total: row.total,
      completed: row.completed,
      pending: row.pending,
      inProgress: row.inProgress,
      overdue: row.overdue,
    }));
}

export const employeeReport = async (req, res) => {
  try {
    const scope = getScope(req);
    const query = readQuery(req);
    const today = todayIso();
    const source = await loadReportSource(scope);
    const staffDirectory = await prisma.staff.findMany({
      where: mergeWhere(userBranchWhere(scope)),
      select: {
        id: true,
        name: true,
        department: true,
        jobTitle: true,
        staffCode: true,
        employmentType: true,
        banned: true,
        image: true,
      },
      orderBy: { name: "asc" },
    });
    const projectsById = new Map(source.projects.map((project) => [project.id, project]));
    const tasks = source.tasks.map((task) => normalizeTask(task, projectsById)).filter((task) => {
      const project = task.projectId ? projectsById.get(task.projectId) : null;
      return !project || projectMatches(project, { ...query, contractId: "", contractType: "", projectStatus: "" });
    });
    const normalizedForFilters = source.tasks.map((task) => normalizeTask(task, projectsById));
    const filters = buildFilters({ ...source, tasks: normalizedForFilters }, query);
    filters.departments = [...new Set(staffDirectory.map((person) => person.department).filter(Boolean))].sort();
    filters.jobTitles = [...new Set(staffDirectory.map((person) => person.jobTitle).filter(Boolean))].sort();

    const workloadQuery = { ...query, contractId: "", contractType: "", projectStatus: "" };
  let reportTasks = tasks.filter((task) => taskInReport(task, task.projectId ? projectsById.get(task.projectId) : null, workloadQuery, today));
    if (query.search && query.employeeId) {
      reportTasks = reportTasks.filter((task) => searchable(task).includes(query.search));
    }

    const scopedStaff = staffDirectory.filter((person) => staffMatchesQuery(person, query));
    const activeStaff = scopedStaff.filter((person) => !person.banned);
    let overview = scopedStaff.map((person) => employeeOverviewRow(person, reportTasks));
    if (query.search && !query.employeeId) {
      overview = overview.filter((row) => row.employee.toLowerCase().includes(query.search));
    }
    overview = sortEmployeeOverview(overview, query.sort === "scheduledDate" ? "employee" : query.sort, query.direction);

    const assigneeIds = new Set(reportTasks.map((task) => task.assigneeId).filter(Boolean));
    const organizationSummary = countStatuses(reportTasks);

    const employeeRowsTotal = overview.length;
    const overviewPage = query.employeeId ? 1 : query.page;
    const overviewPageSize = query.employeeId ? overview.length : query.pageSize;
    const overviewStart = (overviewPage - 1) * overviewPageSize;
    const pagedOverview = query.employeeId ? overview : overview.slice(overviewStart, overviewStart + overviewPageSize);

    const selectedStaff = query.employeeId ? scopedStaff.find((person) => person.id === query.employeeId) : null;
    const selectedTasks = query.employeeId
      ? reportTasks.filter((task) => task.assigneeId === query.employeeId)
      : [];
    const selectedSummary = countStatuses(selectedTasks);
    const sortedSelectedTasks = sortTasks(selectedTasks, query.employeeId ? query.sort : "scheduledDate", query.direction);
    const taskStart = query.employeeId ? (query.page - 1) * query.pageSize : 0;
    const pagedTasks = query.employeeId
      ? sortedSelectedTasks.slice(taskStart, taskStart + query.pageSize).map(rowFromTask)
      : [];

    const history = query.employeeId
      ? tasks.filter((task) => {
        if (task.assigneeId === query.employeeId) return false;
        if (!task.transfers.some((item) => item.fromAssigneeId === query.employeeId)) return false;
        return taskInReport(task, task.projectId ? projectsById.get(task.projectId) : null, { ...workloadQuery, employeeId: "" }, today);
      })
      : [];

    const project = filters.projects.find((item) => item.id === query.projectId);
    const client = source.projects.find((item) => item.clientId === query.clientId)?.client;

    res.json({
      success: true,
      data: {
        periodLabel: periodLabel(query, source.projects, today),
        generatedAt: new Date().toISOString(),
        subject: {
          employee: selectedStaff?.name || "All employees",
          project: project?.name || "All projects",
          client: clientName(client) || "All clients",
        },
        organization: {
          totalEmployees: scopedStaff.length,
          activeEmployees: activeStaff.length,
          employeesWithTasks: [...assigneeIds].filter((id) => scopedStaff.some((person) => person.id === id)).length,
          totalAssignedTasks: organizationSummary.total,
          completed: organizationSummary.completed,
          inProgress: organizationSummary.inProgress,
          pending: organizationSummary.pending,
          overdue: organizationSummary.overdue,
          onHold: organizationSummary.onHold,
          completionRate: completionRate(organizationSummary.completed, organizationSummary.total),
        },
        summary: query.employeeId
          ? { ...selectedSummary, completionRate: completionRate(selectedSummary.completed, selectedSummary.total), projects: new Set(selectedTasks.map((task) => task.projectId).filter(Boolean)).size }
          : { ...organizationSummary, completionRate: completionRate(organizationSummary.completed, organizationSummary.total), projects: new Set(reportTasks.map((task) => task.projectId).filter(Boolean)).size },
        employeeOverview: pagedOverview,
        employeeOverviewTotal: employeeRowsTotal,
        employeeOverviewPage: overviewPage,
        employeeOverviewPageSize: overviewPageSize,
        statusDistribution: statusDistribution(query.employeeId ? selectedSummary : organizationSummary),
        workloadChart: workloadSeries(overview),
        projectParticipation: groupProjectParticipation(reportTasks),
        monthlyTrends: monthlyTrends(reportTasks),
        selectedEmployee: selectedStaff
          ? {
            id: selectedStaff.id,
            name: selectedStaff.name,
            staffCode: selectedStaff.staffCode || selectedStaff.id,
            jobTitle: selectedStaff.jobTitle || "—",
            department: selectedStaff.department || "—",
            employmentStatus: selectedStaff.banned ? "Inactive" : "Active",
            employmentType: selectedStaff.employmentType || "—",
            image: selectedStaff.image || null,
          }
          : null,
        projectsParticipated: query.employeeId ? projectsForEmployee(reportTasks, query.employeeId) : [],
        tasks: pagedTasks,
        tasksTotal: query.employeeId ? selectedTasks.length : 0,
        taskPage: query.employeeId ? query.page : 1,
        taskPageSize: query.pageSize,
        history: history.map((task) => {
          const transfer = task.transfers.find((item) => item.fromAssigneeId === query.employeeId);
          return {
            ...rowFromTask(task),
            transferredTo: transfer?.toAssignee?.name || "—",
            transferredAt: transfer?.createdAt || null,
          };
        }),
        filters,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

function mapServicePerformanceRow(row) {
  const target = row.kind === "original" ? row.planned || 0 : row.assigned || 0;
  const completed = row.completed || 0;
  const extraWork = row.kind === "extra" ? row.assigned || 0 : 0;
  const progress = target ? Math.round((completed / target) * 100) : 0;
  return {
    serviceName: row.serviceName,
    subService: row.name,
    monthlyTarget: row.kind === "original" ? target : "—",
    completed,
    remaining: row.remaining ?? Math.max(0, target - completed),
    extraWork,
    progress,
    kind: row.kind,
  };
}

function projectTaskCounts(projectId, taskRows) {
  const rows = taskRows.filter((task) => task.projectId === projectId);
  const counts = countStatuses(rows);
  return {
    total: counts.total,
    completed: counts.completed,
    pending: counts.pending,
    overdue: counts.overdue,
    inProgress: counts.inProgress,
    onHold: counts.onHold,
  };
}

function employeeParticipationForClient(taskRows) {
  const groups = new Map();
  for (const task of taskRows) {
    if (!task.assigneeId) continue;
    if (!groups.has(task.assigneeId)) {
      groups.set(task.assigneeId, { employee: task.employeeName, projects: new Set(), rows: [] });
    }
    const group = groups.get(task.assigneeId);
    if (task.projectId) group.projects.add(task.projectId);
    group.rows.push(task);
  }
  return [...groups.values()]
    .map((group) => {
      const counts = countStatuses(group.rows);
      return {
        employee: group.employee,
        projectsParticipated: group.projects.size,
        total: counts.total,
        completed: counts.completed,
        inProgress: counts.inProgress,
        pending: counts.pending,
        overdue: counts.overdue,
      };
    })
    .sort((a, b) => a.employee.localeCompare(b.employee));
}

export const clientReport = async (req, res) => {
  try {
    const scope = getScope(req);
    const query = readQuery(req);
    const today = todayIso();
    const source = await loadReportSource(scope);
    const clients = await loadReportClients(prisma, scope, query.clientId || "");
    const clientIds = clients.map((client) => client.id);
    const projects = source.projects.filter((project) => projectMatches(project, query));
    const projectsById = new Map(source.projects.map((project) => [project.id, project]));
    const tasks = source.tasks.map((task) => normalizeTask(task, projectsById));
    const filters = buildFilters({ ...source, tasks }, query);
    filters.clients = clients.map((client) => ({
      id: client.id,
      name: client.companyName || client.institution,
    }));
    const scopedProjects = projects.filter((project) => {
      const scopeCycles = cyclesInScope(project, query, today);
      return scopeCycles.monthly ? scopeCycles.cycles.length > 0 : true;
    });
    let inScope = tasks.filter((task) => {
      const project = projectsById.get(task.projectId);
      if (!project || !scopedProjects.some((item) => item.id === project.id)) return false;
      return taskInReport(task, project, { ...query, employeeId: "" }, today);
    });
    if (query.search) {
      inScope = inScope.filter((task) => searchable(task).includes(query.search));
    }
    const cycleCountByProject = new Map(scopedProjects.map((project) => {
      const scopeCycles = cyclesInScope(project, query, today);
      return [project.id, scopeCycles.monthly ? scopeCycles.cycles.length : 1];
    }));
    const services = mergeServiceRows(rollupServices(subsForProjects(scopedProjects), inScope, cycleCountByProject));
    const servicePerformance = services.map(mapServicePerformanceRow);
    const original = services.filter((row) => row.kind === "original");
    const plannedTasks = original.reduce((sum, row) => sum + row.planned, 0);
    const completedTasks = original.reduce((sum, row) => sum + row.completed, 0);
    const taskSummary = countStatuses(inScope);

    const projectRows = scopedProjects.map((project) => {
      const scopeCycles = cyclesInScope(project, query, today);
      const ordered = [...project.cycles].sort((a, b) => isoDay(a.startDate).localeCompare(isoDay(b.startDate)));
      const cycleText = scopeCycles.monthly
        ? scopeCycles.cycles.map((cycle) => {
          const index = ordered.findIndex((item) => item.id === cycle.id);
          return `Month ${index + 1}: ${formatDay(cycle.startDate)} – ${formatDay(cycle.endDate)}`;
        }).join(", ")
        : "Full project";
      const projectRowsSource = rollupServices(
        subsForProjects([project]),
        inScope.filter((task) => task.projectId === project.id),
        cycleCountByProject,
      ).filter((row) => row.kind === "original");
      const planned = projectRowsSource.reduce((sum, row) => sum + row.planned, 0);
      const completed = projectRowsSource.reduce((sum, row) => sum + row.completed, 0);
      const taskCounts = projectTaskCounts(project.id, inScope);
      return {
        id: project.id,
        code: project.projectCode || project.id,
        name: project.name,
        contract: project.primaryContract?.title || project.primaryContract?.contractNumber || "—",
        contractType: contractTypeLabel(project.primaryContract, project),
        projectType: String(project.billingMode || project.primaryContract?.contractType || "ONE_TIME").toUpperCase() === "MONTHLY" ? "Monthly" : "One-Time",
        start: formatDay(project.startDate),
        end: formatDay(project.dueDate),
        cycle: cycleText || "—",
        planned,
        completed,
        totalTasks: taskCounts.total,
        pendingTasks: taskCounts.pending,
        overdueTasks: taskCounts.overdue,
        inProgressTasks: taskCounts.inProgress,
        progress: averageProgress(inScope.filter((task) => task.projectId === project.id)),
        status: project.lifecycleStatus || project.status || "—",
      };
    });

    const financial = await loadClientFinancials(prisma, clientIds, {
      from: query.from,
      to: query.to,
      paymentStatus: query.paymentStatus,
    });
    const financialByClient = new Map();
    for (const clientId of clientIds) {
      const subset = {
        invoices: financial.invoices.filter((row) => row.clientId === clientId),
        receipts: financial.receipts.filter((row) => row.clientId === clientId),
        creditNotes: financial.creditNotes.filter((row) => row.clientId === clientId),
        totals: {
          invoiced: financial.invoices.filter((row) => row.clientId === clientId).reduce((sum, row) => sum + row.amount, 0),
          received: financial.receipts.filter((row) => row.clientId === clientId).reduce((sum, row) => sum + row.amount, 0),
          due: financial.invoices.filter((row) => row.clientId === clientId).reduce((sum, row) => sum + row.balanceDue, 0),
          credit: financial.creditNotes.filter((row) => row.clientId === clientId).reduce((sum, row) => sum + row.customerCredit, 0),
        },
      };
      financialByClient.set(clientId, subset);
    }

    const contractRows = (await loadClientContracts(prisma, scope, clientIds)).map(mapContractRow);
    const scopedContracts = query.clientId ? contractRows.filter((row) => row.clientId === query.clientId) : contractRows;
    const totalContractValue = scopedContracts.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const selectedClientRecord = query.clientId ? clients.find((client) => client.id === query.clientId) : null;
    const selectedFinancial = query.clientId ? financialByClient.get(query.clientId) : financial;

    const sortedTasks = sortTasks(inScope, query.sort, query.direction);
    const taskStart = (query.page - 1) * query.pageSize;
    const pagedTasks = sortedTasks.slice(taskStart, taskStart + query.pageSize).map((task) => ({
      id: task.id,
      name: task.name,
      project: task.projectName || "—",
      service: task.serviceName || "—",
      employee: task.employeeName,
      scheduledLabel: formatDay(task.scheduledDate),
      progress: task.progress,
      status: task.status,
      workKind: task.isExtra ? "Extra Work" : "Standard",
    }));

    const clientsWithProjects = new Set(scopedProjects.map((project) => project.clientId));
    const orgFinancial = organizationFinancialSummary(clients, financialByClient);
    const activeContracts = contractRows.filter((row) => String(row.status).toUpperCase() === "ACTIVE").length;

    res.json({
      success: true,
      data: {
        periodLabel: periodLabel(query, source.projects, today),
        generatedAt: new Date().toISOString(),
        subject: { client: clientProfile(selectedClientRecord)?.name || "All clients" },
        organization: {
          totalClients: clients.length,
          activeClients: clients.filter((client) => client.isActive).length,
          clientsWithActiveProjects: [...clientsWithProjects].filter((id) => clientIds.includes(id)).length,
          totalProjects: scopedProjects.length,
          activeContracts,
          totalContractValue: Math.round(totalContractValue * 100) / 100,
          totalInvoiced: orgFinancial.totalInvoiced,
          totalAmountReceived: orgFinancial.totalAmountReceived,
          outstandingReceivables: orgFinancial.outstandingReceivables,
        },
        selectedClient: clientProfile(selectedClientRecord),
        financial: {
          ...clientFinancialOverview(selectedClientRecord, query.clientId ? selectedFinancial?.totals : financial.totals),
          totalContractValue: Math.round(totalContractValue * 100) / 100,
        },
        summary: {
          totalProjects: scopedProjects.length,
          activeProjects: scopedProjects.filter((project) => String(project.lifecycleStatus || project.status).toUpperCase() === "ACTIVE").length,
          completedProjects: scopedProjects.filter((project) => String(project.lifecycleStatus || project.status).toUpperCase() === "COMPLETED").length,
          onHoldProjects: scopedProjects.filter((project) => String(project.lifecycleStatus || project.status).toUpperCase() === "ON_HOLD").length,
          plannedServices: original.length,
          plannedTasks,
          completedTasks,
          remainingTasks: Math.max(0, plannedTasks - completedTasks),
          completionRate: completionRate(completedTasks, plannedTasks),
          ...taskSummary,
          taskCompletionRate: completionRate(taskSummary.completed, taskSummary.total),
        },
        statusDistribution: statusDistribution(taskSummary),
        services: servicePerformance,
        legacyServices: services,
        projects: projectRows,
        contracts: scopedContracts,
        invoices: query.clientId ? selectedFinancial?.invoices || [] : financial.invoices,
        receipts: query.clientId ? selectedFinancial?.receipts || [] : financial.receipts,
        creditNotes: query.clientId ? selectedFinancial?.creditNotes || [] : financial.creditNotes,
        employeeParticipation: employeeParticipationForClient(inScope),
        tasks: pagedTasks,
        tasksTotal: sortedTasks.length,
        taskPage: query.page,
        taskPageSize: query.pageSize,
        chart: {
          serviceCompletion: servicePerformance.filter((row) => row.kind === "original").slice(0, 8).map((row) => ({
            name: row.subService,
            completed: row.completed,
            remaining: row.remaining,
          })),
          invoiceVsReceived: [
            { label: "Invoiced", value: query.clientId ? selectedFinancial?.totals?.invoiced || 0 : financial.totals.invoiced },
            { label: "Received", value: query.clientId ? selectedFinancial?.totals?.received || 0 : financial.totals.received },
          ],
          outstandingBalance: query.clientId
            ? Number(clientFinancialOverview(selectedClientRecord, selectedFinancial?.totals).netCustomerBalance)
            : orgFinancial.outstandingReceivables,
        },
        filters,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

function statusDistribution(summary) {
  const total = summary.total || 0;
  const entries = [
    ["PENDING", summary.pending],
    ["IN_PROGRESS", summary.inProgress],
    ["COMPLETED", summary.completed],
    ["OVERDUE", summary.overdue],
    ["ON_HOLD", summary.onHold],
  ];
  return entries.map(([status, count]) => ({
    status,
    count,
    percent: total ? Math.round((count / total) * 100) : 0,
  }));
}

function groupEmployeePerformance(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    if (!task.assigneeId) continue;
    if (!groups.has(task.assigneeId)) {
      groups.set(task.assigneeId, { employeeId: task.assigneeId, employee: task.employeeName, rows: [] });
    }
    groups.get(task.assigneeId).rows.push(task);
  }
  return [...groups.values()]
    .map((group) => {
      const counts = countStatuses(group.rows);
      return {
        employeeId: group.employeeId,
        employee: group.employee,
        total: counts.total,
        pending: counts.pending,
        inProgress: counts.inProgress,
        completed: counts.completed,
        overdue: counts.overdue,
        onHold: counts.onHold,
        completionRate: completionRate(counts.completed, counts.total),
      };
    })
    .sort((a, b) => a.employee.localeCompare(b.employee));
}

function groupProjectAnalysis(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    if (!task.projectId) continue;
    if (!groups.has(task.projectId)) {
      groups.set(task.projectId, {
        projectId: task.projectId,
        project: task.projectName,
        client: task.clientName,
        rows: [],
      });
    }
    groups.get(task.projectId).rows.push(task);
  }
  return [...groups.values()]
    .map((group) => {
      const counts = countStatuses(group.rows);
      return {
        projectId: group.projectId,
        project: group.project,
        client: group.client || "—",
        total: counts.total,
        pending: counts.pending,
        inProgress: counts.inProgress,
        completed: counts.completed,
        overdue: counts.overdue,
        completionRate: completionRate(counts.completed, counts.total),
      };
    })
    .sort((a, b) => b.total - a.total);
}

function groupClientAnalysis(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    if (!task.projectId || !task.clientId) continue;
    if (!groups.has(task.clientId)) {
      groups.set(task.clientId, { clientId: task.clientId, client: task.clientName, rows: [] });
    }
    groups.get(task.clientId).rows.push(task);
  }
  return [...groups.values()]
    .map((group) => {
      const counts = countStatuses(group.rows);
      return {
        clientId: group.clientId,
        client: group.client,
        total: counts.total,
        completed: counts.completed,
        inProgress: counts.inProgress,
        pending: counts.pending,
        overdue: counts.overdue,
        onHold: counts.onHold,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export const taskReport = async (req, res) => {
  try {
    const query = readQuery(req);
    const today = todayIso();
    const source = await loadReportSource(getScope(req));
    const projectsById = new Map(source.projects.map((project) => [project.id, project]));
    const tasks = source.tasks.map((task) => normalizeTask(task, projectsById)).filter((task) => {
      const project = task.projectId ? projectsById.get(task.projectId) : null;
      if (project && !projectMatches(project, query)) return false;
      if (!taskInReport(task, project, query, today)) return false;
      if (query.search && !searchable(task).includes(query.search)) return false;
      return true;
    });
    const filters = buildFilters({ ...source, tasks: source.tasks.map((task) => normalizeTask(task, projectsById)) }, query);
    const summary = countStatuses(tasks);
    const projectTasks = tasks.filter((task) => task.taskType === "project");
    const standaloneTasks = tasks.filter((task) => task.taskType === "standalone");
    const sorted = sortTasks(tasks, query.sort, query.direction);
    const start = (query.page - 1) * query.pageSize;
    res.json({
      success: true,
      data: {
        periodLabel: periodLabel(query, source.projects, today),
        generatedAt: new Date().toISOString(),
        summary: {
          ...summary,
          completionRate: completionRate(summary.completed, summary.total),
        },
        taskTypeSummary: {
          project: countStatuses(projectTasks),
          standalone: countStatuses(standaloneTasks),
        },
        statusDistribution: statusDistribution(summary),
        employeePerformance: groupEmployeePerformance(tasks),
        projectAnalysis: groupProjectAnalysis(tasks),
        clientAnalysis: groupClientAnalysis(tasks),
        totalRows: sorted.length,
        page: query.page,
        pageSize: query.pageSize,
        tasks: sorted.slice(start, start + query.pageSize).map(rowFromTask),
        filters,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
