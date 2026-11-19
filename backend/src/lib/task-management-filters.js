import { mergeWhere, taskBranchWhere } from "./portfolio-scope.js";
import { evaluateTaskLifecycle } from "./task-lifecycle.js";

export function managementDisplayStatus(task, now = new Date()) {
  return evaluateTaskLifecycle(task, now).displayStatus;
}

export function buildManagementTaskWhere(scope, query = {}) {
  const where = mergeWhere({ isPersonal: false }, taskBranchWhere(scope));
  const taskType = String(query.taskType || query.task_type || "").toLowerCase();
  const clientId = query.clientId || query.client_id;
  const projectId = query.projectId || query.project_id;
  const serviceId = query.serviceId || query.service_id;
  const employeeId = query.employeeId || query.employee_id || query.assgineeId;

  if (employeeId && String(employeeId) !== "all") {
    where.assgineeId = String(employeeId);
  }
  if (taskType === "project") where.projectId = { not: null };
  if (taskType === "standalone") where.projectId = null;
  if (projectId && String(projectId) !== "all") where.projectId = String(projectId);

  const and = [];

  if (clientId && String(clientId) !== "all") {
    and.push({
      OR: [
        { project: { clientId: String(clientId) } },
        { clientTask: { some: { clientId: String(clientId) } } },
      ],
    });
  }

  if (serviceId && String(serviceId) !== "all") {
    and.push({
      OR: [
        {
          clientTask: {
            some: {
              Client: {
                clientService: { some: { serviceId: String(serviceId) } },
              },
            },
          },
        },
        {
          clientTask: {
            some: {
              Client: {
                clientSubService: {
                  some: { subService: { categoryId: String(serviceId) } },
                },
              },
            },
          },
        },
        { project: { serviceLinks: { some: { serviceId: String(serviceId) } } } },
      ],
    });
  }

  const scheduledFrom = query.scheduledFrom || query.scheduled_from || query.dateFrom;
  const scheduledTo = query.scheduledTo || query.scheduled_to || query.dateTo;
  if (scheduledFrom || scheduledTo) {
    const startDate = { not: null };
    if (scheduledFrom) {
      const from = new Date(String(scheduledFrom));
      if (!Number.isNaN(from.getTime())) startDate.gte = from;
    }
    if (scheduledTo) {
      const to = new Date(String(scheduledTo));
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        startDate.lte = to;
      }
    }
    and.push({ startDate });
  }

  if (and.length) where.AND = [...(where.AND || []), ...and];
  return where;
}

export function taskMatchesManagementSearch(task, search) {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  const parts = [
    task.id,
    task.description,
    task.serviceInformation,
    task.user?.name,
    task.project?.name,
    task.project?.client?.institution,
    ...(task.clientTask || []).map((row) => row.Client?.institution),
  ];
  const haystack = parts.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

export function filterTasksByManagementStatus(tasks, status, now = new Date()) {
  const normalized = String(status || "all").toLowerCase();
  if (!normalized || normalized === "all") return tasks;
  return tasks.filter((task) => managementDisplayStatus(task, now) === normalized);
}

export const managementTaskInclude = {
  user: { select: { id: true, name: true, portfolioId: true, image: true, jobTitle: true } },
  project: {
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: { id: true, institution: true } },
    },
  },
  clientTask: {
    include: {
      Client: {
        select: {
          id: true,
          institution: true,
          clientSubService: {
            select: { subService: { select: { id: true, name: true, categoryId: true } } },
          },
        },
      },
    },
  },
  transferHistory: {
    include: {
      fromAssignee: { select: { id: true, name: true, portfolioId: true } },
      toAssignee: { select: { id: true, name: true, portfolioId: true } },
      transferredBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
};

export function enrichManagementTask(task, allTasks) {
  const taskType = task.projectId ? "project" : "standalone";
  let siblings = [];
  if (task.createdAt && Array.isArray(allTasks)) {
    const taskTime = task.createdAt instanceof Date ? task.createdAt.getTime() : new Date(task.createdAt).getTime();
    const window = 5 * 60 * 1000;
    siblings = allTasks
      .filter((t) => {
        if (t.id === task.id) return false;
        if (t.description !== task.description || t.serviceInformation !== task.serviceInformation) return false;
        if (!t.createdAt) return false;
        const tTime = t.createdAt instanceof Date ? t.createdAt.getTime() : new Date(t.createdAt).getTime();
        return Math.abs(tTime - taskTime) <= window;
      })
      .map((t) => ({
        id: t.id,
        assgineeId: t.assgineeId,
        user: t.user ? { id: t.user.id, name: t.user.name } : null,
      }));
  }
  return {
    ...task,
    taskType,
    siblings,
    displayStatus: managementDisplayStatus(task),
  };
}