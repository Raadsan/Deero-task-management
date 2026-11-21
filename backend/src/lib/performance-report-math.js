import { evaluateScheduledTask, zonedNowParts } from "./scheduled-task-window.js";
import { evaluateTaskLifecycle } from "./task-lifecycle.js";

export function isoDay(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    if (match) return match[1];
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return "";
}

export function todayIso(now = new Date()) {
  return zonedNowParts(now).date;
}

export function normName(value) {
  return String(value || "").trim().toLowerCase();
}

const LIFECYCLE_TO_REPORT = {
  pending: "PENDING",
  in_progress: "IN_PROGRESS",
  pending_review: "PENDING_REVIEW",
  completed: "COMPLETED",
  overdue: "OVERDUE",
  on_hold: "ON_HOLD",
};

export function reportStatus(task, now = new Date()) {
  const features = task?.features;
  const stored = String(typeof features === "object" && features ? features.projectStatus || "" : "").toUpperCase();
  if (stored === "CANCELLED" || stored === "REJECTED") return stored;
  const life = evaluateTaskLifecycle(task, now);
  return LIFECYCLE_TO_REPORT[life.displayStatus] || "PENDING";
}

export function isQuantityComplete(task) {
  return task.status === "COMPLETED" && Number(task.progress) >= 100;
}

function taskKind(task) {
  return task?.projectId ? "project" : "standalone";
}

export function countStatuses(tasks) {
  const summary = {
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    pendingReview: 0,
    overdue: 0,
    onHold: 0,
  };
  for (const task of tasks) {
    if (task.status === "CANCELLED" || task.status === "REJECTED") continue;
    summary.total += 1;
    if (task.status === "COMPLETED") summary.completed += 1;
    else if (task.status === "IN_PROGRESS") summary.inProgress += 1;
    else if (task.status === "PENDING_REVIEW") summary.pendingReview += 1;
    else if (task.status === "OVERDUE") summary.overdue += 1;
    else if (task.status === "ON_HOLD") summary.onHold += 1;
    else summary.pending += 1;
  }
  return summary;
}

export function completionRate(completed, total) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

export function openCycleId(cycles, today = todayIso()) {
  const list = Array.isArray(cycles) ? cycles : [];
  if (!list.length) return "";
  const open = list.find((cycle) => {
    const start = isoDay(cycle.startDate);
    const end = isoDay(cycle.endDate);
    return Boolean(start && end && start <= today && today <= end);
  });
  if (open) return open.id;
  return [...list].sort((left, right) => isoDay(right.endDate).localeCompare(isoDay(left.endDate)))[0]?.id || "";
}

function monthBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

function rangeOverlaps(start, end, from, to) {
  if (!start || !end) return false;
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
}

export function overlapsPeriod(cycle, query) {
  const start = isoDay(cycle.startDate);
  const end = isoDay(cycle.endDate);
  if (query.month && query.year) {
    const bounds = monthBounds(query.year, query.month);
    if (bounds && !rangeOverlaps(start, end, bounds.start, bounds.end)) return false;
  }
  if ((query.from || query.to) && !rangeOverlaps(start, end, query.from, query.to)) return false;
  return true;
}

export function cyclesInScope(project, query, today = todayIso()) {
  const cycles = [...(project?.cycles || [])].sort((left, right) => isoDay(left.startDate).localeCompare(isoDay(right.startDate)));
  const monthly = String(project?.billingMode || "").toUpperCase() === "MONTHLY" && cycles.length > 0;
  if (!monthly) return { monthly: false, cycles: [] };
  if (query.cycleId === "all") return { monthly: true, cycles };
  if (query.cycleId) return { monthly: true, cycles: cycles.filter((cycle) => cycle.id === query.cycleId) };
  if (query.month || query.from || query.to) {
    return { monthly: true, cycles: cycles.filter((cycle) => overlapsPeriod(cycle, query)) };
  }
  const open = openCycleId(cycles, today);
  return { monthly: true, cycles: cycles.filter((cycle) => cycle.id === open) };
}

function scheduledInPeriod(scheduledDate, query) {
  if (!scheduledDate) return false;
  if (query.month && query.year) {
    const [year, month] = scheduledDate.split("-");
    if (Number(year) !== Number(query.year) || Number(month) !== Number(query.month)) return false;
  }
  if (query.from && scheduledDate < query.from) return false;
  if (query.to && scheduledDate > query.to) return false;
  return true;
}

function unscheduledBelongsToPeriod(task, project, query, scope, today) {
  if (query.month && query.year) {
    const bounds = monthBounds(query.year, query.month);
    if (!bounds) return false;
    if (!scope.monthly) return false;
    const taskCycle = task.cycleId || openCycleId(project.cycles, today);
    return scope.cycles.some((cycle) => cycle.id === taskCycle && isoDay(cycle.startDate) >= bounds.start && isoDay(cycle.startDate) <= bounds.end);
  }
  if (query.from || query.to) {
    if (!scope.monthly) return false;
    const taskCycle = task.cycleId || openCycleId(project.cycles, today);
    return scope.cycles.some((cycle) => cycle.id === taskCycle && rangeOverlaps(isoDay(cycle.startDate), isoDay(cycle.endDate), query.from, query.to));
  }
  return true;
}

export function taskInReport(task, project, query, today = todayIso()) {
  if (task.status === "CANCELLED" || task.status === "REJECTED") return false;
  const kind = taskKind(task);
  if (query.taskType === "project" && kind !== "project") return false;
  if (query.taskType === "standalone" && kind !== "standalone") return false;
  if (query.status && task.status !== query.status) return false;
  if (query.employeeId && task.assigneeId !== query.employeeId) return false;
  if (query.projectId && task.projectId !== query.projectId) return false;
  if (query.clientId && task.clientId !== query.clientId) return false;
  if (query.priority && query.priority !== "all") {
    const wanted = String(query.priority).toLowerCase();
    const actual = String(task.priority || "normal").toLowerCase();
    if (actual !== wanted) return false;
  }
  if (query.serviceId && task.serviceId !== query.serviceId && normName(task.serviceName) !== normName(query.serviceName)) return false;
  if (query.subServiceId && task.subServiceId !== query.subServiceId && normName(task.subServiceName) !== normName(query.subServiceName)) return false;

  if (!project) {
    if (query.projectId || query.contractId || query.contractType || query.projectStatus) return false;
    if (query.cycleId && query.cycleId !== "all") return false;
    if (!query.month && !query.from && !query.to) return true;
    return scheduledInPeriod(task.scheduledDate, query);
  }

  const scope = cyclesInScope(project, query, today);
  if (scope.monthly) {
    if (!scope.cycles.length) return false;
    const ids = new Set(scope.cycles.map((cycle) => cycle.id));
    const open = openCycleId(project.cycles, today);
    const inCycle = task.cycleId ? ids.has(task.cycleId) : ids.has(open);
    if (!inCycle) return false;
  }
  if (!query.month && !query.from && !query.to) return true;
  if (!task.scheduledDate) return unscheduledBelongsToPeriod(task, project, query, scope, today);
  return scheduledInPeriod(task.scheduledDate, query);
}

function statusCounts(tasks) {
  const counts = countStatuses(tasks);
  const completedQty = tasks.filter(isQuantityComplete).length;
  return {
    assigned: counts.total,
    completed: completedQty,
    inProgress: counts.inProgress,
    pending: counts.pending,
    overdue: counts.overdue,
    onHold: counts.onHold,
  };
}

export function rollupServices(subs, tasks, cycleCountByProject) {
  const claimed = new Set();
  const rows = [];
  for (const sub of subs) {
    const matched = tasks.filter((task) => {
      if (claimed.has(task.id) || task.isExtra || task.projectId !== sub.projectId) return false;
      if (task.subServiceId) return task.subServiceId === sub.id;
      return normName(task.subServiceName) === normName(sub.name);
    });
    matched.forEach((task) => claimed.add(task.id));
    const multiplier = cycleCountByProject.get(sub.projectId) ?? 1;
    const planned = Math.max(0, Number(sub.quantity) || 0) * multiplier;
    const counts = statusCounts(matched);
    rows.push({
      serviceName: sub.serviceName || "Service",
      name: sub.name || "Item",
      kind: "original",
      projectId: sub.projectId,
      planned,
      ...counts,
      remaining: Math.max(0, planned - counts.completed),
    });
  }

  const extras = new Map();
  for (const task of tasks) {
    if (!task.isExtra || claimed.has(`extra:${task.id}`)) continue;
    const key = `${task.projectId}:${task.subServiceId || normName(task.subServiceName)}`;
    if (!extras.has(key)) extras.set(key, []);
    extras.get(key).push(task);
  }
  for (const list of extras.values()) {
    const sample = list[0];
    const sub = subs.find((item) => item.id === sample.subServiceId)
      || subs.find((item) => item.projectId === sample.projectId && normName(item.name) === normName(sample.subServiceName));
    const counts = statusCounts(list);
    rows.push({
      serviceName: sample.serviceName || sub?.serviceName || "Service",
      name: sample.subServiceName || sub?.name || "Extra",
      kind: "extra",
      projectId: sample.projectId,
      planned: list.length,
      ...counts,
      remaining: Math.max(0, list.length - counts.completed),
    });
  }
  return rows;
}

export function mergeServiceRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.kind}:${normName(row.serviceName)}:${normName(row.name)}`;
    const current = map.get(key) || {
      serviceName: row.serviceName,
      name: row.name,
      kind: row.kind,
      planned: 0,
      assigned: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      overdue: 0,
      onHold: 0,
      remaining: 0,
    };
    current.planned += row.planned;
    current.assigned += row.assigned;
    current.completed += row.completed;
    current.inProgress += row.inProgress;
    current.pending += row.pending;
    current.overdue += row.overdue;
    current.onHold += row.onHold;
    current.remaining += row.remaining;
    map.set(key, current);
  }
  return [...map.values()].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "original" ? -1 : 1;
    return `${left.serviceName} ${left.name}`.localeCompare(`${right.serviceName} ${right.name}`);
  });
}

export function averageProgress(tasks) {
  const eligible = tasks.filter((task) => task.status !== "CANCELLED" && task.status !== "REJECTED");
  if (!eligible.length) return 0;
  const total = eligible.reduce((sum, task) => sum + Math.min(100, Math.max(0, Number(task.progress) || 0)), 0);
  return Math.round(total / eligible.length);
}
