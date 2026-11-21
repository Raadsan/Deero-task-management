import { evaluateScheduledTask, objectFeatures } from "./scheduled-task-window.js";
import { isTaskPastDeadline } from "./task-status.js";
import { normalizeDbStatus, isTerminalStatus } from "./task-status-workflow.js";

function scheduledSlotFromFeatures(features) {
  const source = objectFeatures(features) || {};
  const date = String(source.scheduledDate || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Authoritative lifecycle for display + persisted status (standalone and scheduled).
 */
export function evaluateTaskLifecycle(task, now = new Date()) {
  const moment = now instanceof Date ? now : new Date(now);
  const progress = Number(task?.progress ?? 0);
  const dbStatus = normalizeDbStatus(task?.status);

  if (isTerminalStatus(dbStatus)) {
    return {
      displayStatus: "completed",
      persistStatus: "completed",
      onHold: false,
      scheduled: false,
    };
  }

  if (dbStatus === "pending_review") {
    return {
      displayStatus: "pending_review",
      persistStatus: "pending_review",
      onHold: false,
      scheduled: Boolean(scheduledSlotFromFeatures(task?.features)),
    };
  }

  const scheduledEval = evaluateScheduledTask(task, moment);

  if (dbStatus === "on_hold" || scheduledEval.onHold || scheduledEval.status === "on_hold") {
    return {
      displayStatus: "on_hold",
      persistStatus: "on_hold",
      onHold: true,
      scheduled: Boolean(scheduledEval.scheduled),
    };
  }

  if (scheduledEval.scheduled && scheduledEval.status) {
    return {
      displayStatus: scheduledEval.status,
      persistStatus: scheduledEval.status,
      onHold: false,
      scheduled: true,
    };
  }

  const start = task?.startDate ? new Date(task.startDate) : null;
  const end = task?.deadline ? new Date(task.deadline) : null;
  const hasStart = start && !Number.isNaN(start.getTime());
  const hasWindow = hasStart && end && !Number.isNaN(end.getTime());

  if (hasStart && moment < start) {
    return {
      displayStatus: "pending",
      persistStatus: "pending",
      onHold: false,
      scheduled: hasWindow,
    };
  }

  if (end && isTaskPastDeadline(end, task?.extraTimeMinutes) && progress < 100) {
    return {
      displayStatus: "overdue",
      persistStatus: "overdue",
      onHold: false,
      scheduled: hasWindow,
    };
  }

  if (hasStart && moment >= start) {
    return {
      displayStatus: "in_progress",
      persistStatus: "in_progress",
      onHold: false,
      scheduled: hasWindow,
    };
  }

  if (dbStatus === "overdue" && !(end && isTaskPastDeadline(end, task?.extraTimeMinutes))) {
    return {
      displayStatus: "in_progress",
      persistStatus: "in_progress",
      onHold: false,
      scheduled: hasWindow,
    };
  }

  return {
    displayStatus: dbStatus === "in_progress" ? "in_progress" : "pending",
    persistStatus: dbStatus === "in_progress" ? "in_progress" : "pending",
    onHold: false,
    scheduled: hasWindow,
  };
}

export function initialPersistedStatusForCreate(task, now = new Date()) {
  const draft = {
    ...task,
    status: "pending",
    progress: Number(task?.progress ?? 0),
  };
  const life = evaluateTaskLifecycle(draft, now);
  if (life.onHold) return "on_hold";
  return life.persistStatus;
}

const MAX_LIFECYCLE_UPDATES_PER_RUN = 80;

export async function syncTaskLifecycleStatuses(prisma, now = new Date()) {
  const tasks = await prisma.task.findMany({
    where: {
      isPersonal: false,
      status: { in: ["pending", "in_progress", "overdue"] },
    },
    select: {
      id: true,
      status: true,
      progress: true,
      features: true,
      startDate: true,
      deadline: true,
      extraTimeMinutes: true,
      projectId: true,
      completedAt: true,
    },
    take: 400,
  });

  let updated = 0;
  for (const task of tasks) {
    if (updated >= MAX_LIFECYCLE_UPDATES_PER_RUN) break;
    if (task.projectId && scheduledSlotFromFeatures(task.features)) continue;

    const life = evaluateTaskLifecycle(task, now);
    if (life.onHold) continue;
    if (life.persistStatus === task.status) continue;

    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: life.persistStatus,
        },
      });
      updated += 1;
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("Lock wait timeout") || message.includes("1205")) {
        break;
      }
      throw error;
    }
  }
  return updated;
}