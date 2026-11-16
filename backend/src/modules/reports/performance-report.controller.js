import { prisma } from "../../lib/prisma.js";
import { contractBranchWhere, getScope, mergeWhere, projectBranchWhere, taskBranchWhere, userBranchWhere } from "../../lib/portfolio-scope.js";
import { objectFeatures } from "../../lib/scheduled-task-window.js";
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
    projectStatus: text(q.projectStatus).toUpperCase(),
    from: text(q.from).slice(0, 10),
    to: text(q.to).slice(0, 10),
    serviceId: text(q.serviceId),
    serviceName: text(q.serviceName),
    subServiceId: text(q.subServiceId),
    subServiceName: text(q.subServiceName),
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

function periodLabel(query, projects, today) {
  if (query.from || query.to) return `${formatDay(query.from)} to ${formatDay(query.to)}`;
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
  const [projects, tasks, staff, contracts] = await Promise.all([
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
  ]);
  return { projects, tasks, staff, contracts };
}

function normalizeTask(task, projectsById) {
  const features = objectFeatures(task.features) || {};
  const project = task.projectId ? projectsById.get(task.projectId) : null;
  const linkedClient = task.clientTask?.[0]?.Client || null;
  const client = project?.client || linkedClient;
  const info = String(task.serviceInformation || "");
  const infoService = info.split(" - ")[0] || "";
  const status = reportStatus({ ...task, features });
  return {
    id: task.id,
    name: task.description || "Task",
    status,
    progress: Number(task.progress) || 0,
    priority: String(features.priorityLabel || task.priority || "normal"),
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
    scheduledDate: isoDay(features.scheduledDate),
    startTime: String(features.startTime || "").slice(0, 5),
    endTime: String(features.endTime || "").slice(0, 5),
    transfers: task.transferHistory || [],
  };
}

function rowFromTask(task) {
  return {
    id: task.id,
    name: task.name,
    client: task.clientName || "—",
    project: task.projectName || "—",
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
  };
}

function buildFilters({ projects, tasks, staff, contracts }, query) {
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
  const clientIds = new Set(visibleProjects.map((project) => project.clientId));
  const clients = [];
  const seenClients = new Set();
  for (const project of projects) {
    if (seenClients.has(project.clientId)) continue;
    seenClients.add(project.clientId);
    clients.push({ id: project.clientId, name: clientName(project.client) || "Client" });
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
      if (!seenServices.has(link.serviceId)) {
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

  const visibleContracts = contracts.filter((contract) => {
    if (!clientIds.has(contract.clientId)) return false;
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
    statuses: ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "ON_HOLD"],
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

export const employeeReport = async (req, res) => {
  try {
    const query = readQuery(req);
    const today = todayIso();
    const source = await loadReportSource(getScope(req));
    const projectsById = new Map(source.projects.map((project) => [project.id, project]));
    const tasks = source.tasks.map((task) => normalizeTask(task, projectsById)).filter((task) => {
      const project = task.projectId ? projectsById.get(task.projectId) : null;
      return !project || projectMatches(project, { ...query, contractId: "", contractType: "", projectStatus: "" });
    });
    const filters = buildFilters({ ...source, tasks }, query);
    const workloadQuery = { ...query, contractId: "", contractType: "", projectStatus: "" };
    const current = tasks.filter((task) => taskInReport(task, task.projectId ? projectsById.get(task.projectId) : null, workloadQuery, today));
    const history = query.employeeId
      ? tasks.filter((task) => {
        if (task.assigneeId === query.employeeId) return false;
        if (!task.transfers.some((item) => item.fromAssigneeId === query.employeeId)) return false;
        return taskInReport(task, task.projectId ? projectsById.get(task.projectId) : null, { ...workloadQuery, employeeId: "" }, today);
      })
      : [];
    const summaryCounts = countStatuses(current);
    const projectsTouched = new Set(current.map((task) => task.projectId).filter(Boolean));
    const serviceGroups = new Map();
    for (const task of current) {
      const key = `${normName(task.serviceName)}:${normName(task.subServiceName)}:${task.isExtra ? "extra" : "original"}`;
      if (!serviceGroups.has(key)) {
        serviceGroups.set(key, {
          serviceName: task.serviceName || "—",
          name: task.subServiceName || task.name || "Item",
          kind: task.isExtra ? "extra" : "original",
          tasks: [],
        });
      }
      serviceGroups.get(key).tasks.push(task);
    }
    const services = [...serviceGroups.values()].map((group) => {
      const counts = countStatuses(group.tasks);
      return {
        serviceName: group.serviceName,
        name: group.name,
        kind: group.kind,
        assigned: counts.total,
        completed: counts.completed,
        inProgress: counts.inProgress,
        pending: counts.pending,
        overdue: counts.overdue,
        onHold: counts.onHold,
      };
    }).sort((a, b) => `${a.serviceName} ${a.name}`.localeCompare(`${b.serviceName} ${b.name}`));
    const employee = filters.employees.find((person) => person.id === query.employeeId);
    const project = filters.projects.find((item) => item.id === query.projectId);
    const client = source.projects.find((item) => item.clientId === query.clientId)?.client;

    res.json({
      success: true,
      data: {
        periodLabel: periodLabel(query, source.projects, today),
        generatedAt: new Date().toISOString(),
        subject: {
          employee: employee?.name || "All employees",
          project: project?.name || "All projects",
          client: clientName(client) || "All clients",
        },
        summary: {
          projects: projectsTouched.size,
          ...summaryCounts,
          completionRate: completionRate(summaryCounts.completed, summaryCounts.total),
        },
        services,
        tasks: current.map(rowFromTask),
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

export const clientReport = async (req, res) => {
  try {
    const query = readQuery(req);
    const today = todayIso();
    const source = await loadReportSource(getScope(req));
    const projects = source.projects.filter((project) => projectMatches(project, query));
    const projectsById = new Map(source.projects.map((project) => [project.id, project]));
    const tasks = source.tasks.map((task) => normalizeTask(task, projectsById));
    const filters = buildFilters({ ...source, tasks }, query);
    const scopedProjects = projects.filter((project) => {
      const scope = cyclesInScope(project, query, today);
      return scope.monthly ? scope.cycles.length > 0 : true;
    });
    const inScope = tasks.filter((task) => {
      const project = projectsById.get(task.projectId);
      if (!project || !scopedProjects.some((item) => item.id === project.id)) return false;
      return taskInReport(task, project, { ...query, employeeId: "" }, today);
    });
    const cycleCountByProject = new Map(scopedProjects.map((project) => {
      const scope = cyclesInScope(project, query, today);
      return [project.id, scope.monthly ? scope.cycles.length : 1];
    }));
    const services = mergeServiceRows(rollupServices(subsForProjects(scopedProjects), inScope, cycleCountByProject));
    const original = services.filter((row) => row.kind === "original");
    const plannedTasks = original.reduce((sum, row) => sum + row.planned, 0);
    const completedTasks = original.reduce((sum, row) => sum + row.completed, 0);
    const projectRows = scopedProjects.map((project) => {
      const scope = cyclesInScope(project, query, today);
      const ordered = [...project.cycles].sort((a, b) => isoDay(a.startDate).localeCompare(isoDay(b.startDate)));
      const cycleText = scope.monthly
        ? scope.cycles.map((cycle) => {
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
      return {
        id: project.id,
        code: project.projectCode || project.id,
        name: project.name,
        contract: project.primaryContract?.title || project.primaryContract?.contractNumber || "—",
        contractType: contractTypeLabel(project.primaryContract, project),
        start: formatDay(project.startDate),
        end: formatDay(project.dueDate),
        cycle: cycleText || "—",
        planned,
        completed,
        progress: averageProgress(inScope.filter((task) => task.projectId === project.id)),
        status: project.lifecycleStatus || project.status || "—",
      };
    });
    const selectedClient = query.clientId ? source.projects.find((project) => project.clientId === query.clientId)?.client : null;

    res.json({
      success: true,
      data: {
        periodLabel: periodLabel(query, source.projects, today),
        generatedAt: new Date().toISOString(),
        subject: { client: clientName(selectedClient) || "All clients" },
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
        },
        services,
        projects: projectRows,
        filters,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

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
    const sorted = sortTasks(tasks, query.sort, query.direction);
    const start = (query.page - 1) * query.pageSize;
    res.json({
      success: true,
      data: {
        periodLabel: periodLabel(query, source.projects, today),
        generatedAt: new Date().toISOString(),
        summary,
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
