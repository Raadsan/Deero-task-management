import { resolveCompanyWorkingDays } from "@/lib/company-working-days";
import { evaluateScheduledTask, zonedNowParts } from "@/lib/scheduled-task-window";

export type DraftSubService = {
  clientKey: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  targetQuantity: number;
  assigneeId: string;
};

export type DraftService = {
  serviceId: string;
  serviceName: string;
  subServices: DraftSubService[];
};

export type DraftTask = {
  id?: string;
  clientKey: string;
  name: string;
  description: string;
  serviceId: string;
  serviceName: string;
  subServiceName: string;
  subServiceKey: string;
  assigneeId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  notes: string;
  priority: string;
  status: string;
  isExtra?: boolean;
  pendingExtra?: boolean;
  pendingSignature?: string;
  extraReason?: string;
};

export function formatIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function workingDates(start: string, end: string, workingDays: number[]) {
  const days = new Set(resolveCompanyWorkingDays(workingDays));
  const dates: string[] = [];
  const cursor = parseIsoDate(start);
  const last = parseIsoDate(end) ?? cursor;
  if (!cursor || !last) return [];
  while (cursor.getTime() <= last.getTime() && dates.length < 400) {
    if (days.has(cursor.getDay())) dates.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function slotIndex(clientKey: string) {
  const match = /-(\d+)$/.exec(clientKey);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function belongsToSub(task: DraftTask, subKey: string) {
  return task.subServiceKey === subKey || task.clientKey.startsWith(`${subKey}-`);
}

function itemLabel(sub: DraftSubService) {
  return sub.name.trim() || "Item";
}

function itemNumber(task: DraftTask) {
  const fromName = /(\d+)\s*$/.exec(task.name);
  if (fromName) return fromName[1].padStart(2, "0");
  const fromKey = /-(\d+)$/.exec(task.clientKey);
  return fromKey ? String(fromKey[1]).padStart(2, "0") : "01";
}

function reuseTask(service: DraftService, sub: DraftSubService, prev: DraftTask, label: string): DraftTask {
  const scheduled = Boolean(prev.scheduledDate);
  const named = `${prev.isExtra ? "Extra " : ""}${label} ${itemNumber(prev)}`;
  return {
    ...prev,
    name: named,
    description: sub.description || prev.description || label,
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    subServiceName: label,
    subServiceKey: sub.clientKey,
    assigneeId: scheduled ? prev.assigneeId : (sub.assigneeId || prev.assigneeId || ""),
    scheduledDate: prev.scheduledDate || "",
    startTime: prev.startTime || "",
    endTime: prev.endTime || "",
    notes: prev.notes || "",
    priority: prev.priority || "medium",
    status: prev.status || "PENDING",
  };
}

/** Keep tasks that already have a date when quantity or the default employee changes. New units stay unscheduled. */
export function syncDraftTasks(services: DraftService[], existing: DraftTask[]): DraftTask[] {
  const claimed = new Set<string>();
  const next: DraftTask[] = [];

  for (const service of services) {
    for (const sub of service.subServices) {
      const qty = Number(sub.quantity);
      const label = itemLabel(sub);
      const pool = existing
        .filter((task) => !claimed.has(task.clientKey) && belongsToSub(task, sub.clientKey))
        .sort((left, right) => slotIndex(left.clientKey) - slotIndex(right.clientKey) || left.clientKey.localeCompare(right.clientKey));
      const extras = pool.filter((task) => task.isExtra);
      extras.forEach((task) => claimed.add(task.clientKey));
      const contractPool = pool.filter((task) => !task.isExtra);

      if (!Number.isFinite(qty) || qty < 1) {
        contractPool.forEach((task) => claimed.add(task.clientKey));
        next.push(...contractPool.map((task) => reuseTask(service, sub, task, label)), ...extras);
        continue;
      }

      const kept = qty >= contractPool.length
        ? contractPool
        : [
            ...contractPool.filter((task) => task.scheduledDate),
            ...contractPool.filter((task) => !task.scheduledDate),
          ].slice(0, qty);

      kept.forEach((task) => claimed.add(task.clientKey));
      next.push(...kept.map((task) => reuseTask(service, sub, task, label)));

      const usedSlots = new Set(kept.map((task) => slotIndex(task.clientKey)));
      let slot = 1;
      while (next.filter((task) => task.subServiceKey === sub.clientKey).length < qty) {
        while (usedSlots.has(slot)) slot += 1;
        usedSlots.add(slot);
        next.push({
          clientKey: `${sub.clientKey}-${slot}`,
          name: `${label} ${String(slot).padStart(2, "0")}`,
          description: sub.description || label,
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          subServiceName: label,
          subServiceKey: sub.clientKey,
          assigneeId: sub.assigneeId || "",
          scheduledDate: "",
          startTime: "",
          endTime: "",
          notes: "",
          priority: "medium",
          status: "PENDING",
        });
        slot += 1;
      }
      next.push(...extras);
    }
  }

  return next;
}

export function tasksMatch(left: DraftTask[], right: DraftTask[]) {
  if (left.length !== right.length) return false;
  return left.every((task, index) => {
    const other = right[index];
    return (
      task.id === other.id &&
      task.clientKey === other.clientKey &&
      task.name === other.name &&
      task.description === other.description &&
      task.serviceName === other.serviceName &&
      task.assigneeId === other.assigneeId &&
      task.scheduledDate === other.scheduledDate &&
      task.startTime === other.startTime &&
      task.endTime === other.endTime &&
      task.notes === other.notes
    );
  });
}

export function distributeDraftTasks(
  tasks: DraftTask[],
  start: string,
  end: string,
  workingDays: number[],
  onlyUnscheduled: boolean,
  defaultHours?: { start: string; end: string },
) {
  const dates = workingDates(start, end, workingDays);
  if (!dates.length) return tasks;
  let cursor = 0;
  return tasks.map((task) => {
    if (onlyUnscheduled && task.scheduledDate) return task;
    const date = dates[cursor % dates.length];
    cursor += 1;
    return {
      ...task,
      scheduledDate: date,
      startTime: task.startTime || defaultHours?.start || "",
      endTime: task.endTime || defaultHours?.end || "",
    };
  });
}

export function generateDraftTasks(
  services: DraftService[],
  start: string,
  end: string,
  workingDays: number[],
): DraftTask[] {
  const dates = workingDates(start, end, workingDays);
  const tasks: DraftTask[] = [];
  let cursor = 0;
  for (const service of services) {
    for (const sub of service.subServices) {
      const qty = Math.max(0, Number(sub.quantity) || 0);
      for (let i = 1; i <= qty; i += 1) {
        const date = dates.length ? dates[cursor % dates.length] : "";
        cursor += 1;
        tasks.push({
          clientKey: `${sub.clientKey}-${i}`,
          name: `${itemLabel(sub)} ${String(i).padStart(2, "0")}`,
          description: sub.description || sub.name,
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          subServiceName: sub.name,
          subServiceKey: sub.clientKey,
          assigneeId: sub.assigneeId,
          scheduledDate: date,
          startTime: "",
          endTime: "",
          notes: "",
          priority: "medium",
          status: "PENDING",
        });
      }
    }
  }
  return tasks;
}

export function projectTaskStatus(task: { status?: string; features?: Record<string, unknown> | null }) {
  const stored = String(task.features?.projectStatus || "").toUpperCase();
  const base = String(task.status || "").toLowerCase();
  if (base === "completed" || stored === "COMPLETED") return "COMPLETED";
  if (base === "overdue" || stored === "OVERDUE") return "OVERDUE";
  if (stored === "CANCELLED" || stored === "REJECTED" || stored === "UNDER_REVIEW") return stored;
  if (base === "in_progress" || stored === "IN_PROGRESS") return "IN_PROGRESS";
  return "PENDING";
}

type CountableTask = {
  status?: string;
  progress?: number | null;
  features?: Record<string, unknown> | null;
};

/** Live schedule window first, then the stored status. One task has one current status. */
export function currentProjectTaskStatus(task: CountableTask, now: number | Date = Date.now()) {
  const evaluation = evaluateScheduledTask(task, now);
  if (evaluation.scheduled && evaluation.status) {
    if (evaluation.status === "on_hold") return "ON_HOLD";
    if (evaluation.status === "completed") return "COMPLETED";
    if (evaluation.status === "overdue") return "OVERDUE";
    if (evaluation.status === "in_progress") return "IN_PROGRESS";
    return "PENDING";
  }
  const stored = projectTaskStatus(task);
  if (stored === "UNDER_REVIEW") return "IN_PROGRESS";
  return stored;
}

export type ProjectTaskSummary = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  active: number;
  percent: number;
};

function cycleDay(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return zonedNowParts(parsed).date;
}

export function currentProjectCycleId(
  cycles: Array<{ id: string; startDate?: string | null; endDate?: string | null }> | undefined,
  now: number | Date = Date.now(),
) {
  if (!cycles?.length) return "";
  const today = zonedNowParts(now).date;
  const open = cycles.find((cycle) => {
    const start = cycleDay(cycle.startDate);
    const end = cycleDay(cycle.endDate);
    return Boolean(start && end && start <= today && today <= end);
  });
  if (open) return open.id;
  return [...cycles].sort((left, right) => cycleDay(right.endDate).localeCompare(cycleDay(left.endDate)))[0]?.id ?? "";
}

export function tasksForProjectCycle<T extends { features?: Record<string, unknown> | null }>(
  tasks: T[],
  cycleId: string,
  includeUnscoped = false,
) {
  if (!cycleId) return tasks;
  return tasks.filter((task) => {
    const id = String(task.features?.cycleId || "");
    if (!id) return includeUnscoped;
    return id === cycleId;
  });
}

export function summarizeProjectTasks(tasks: CountableTask[], now: number | Date = Date.now()): ProjectTaskSummary {
  const summary: ProjectTaskSummary = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    active: 0,
    percent: 0,
  };
  let progressTotal = 0;
  for (const task of tasks) {
    const status = currentProjectTaskStatus(task, now);
    if (status === "CANCELLED" || status === "REJECTED") continue;
    summary.total += 1;
    if (status === "COMPLETED") summary.completed += 1;
    else if (status === "OVERDUE") summary.overdue += 1;
    else if (status === "IN_PROGRESS" || status === "ON_HOLD") summary.inProgress += 1;
    else summary.pending += 1;
    const raw = Number(task.progress);
    const value = Number.isFinite(raw)
      ? Math.min(100, Math.max(0, raw))
      : status === "COMPLETED" ? 100 : 0;
    progressTotal += value;
  }
  summary.active = summary.total;
  summary.percent = summary.total ? Math.round(progressTotal / summary.total) : 0;
  return summary;
}

export function taskProgress(tasks: CountableTask[], now: number | Date = Date.now()) {
  return summarizeProjectTasks(tasks, now);
}
