import { isTerminalStatus, normalizeDbStatus } from "./task-status-workflow.js";

const ACTIVE_STATUSES = ["pending", "in_progress", "overdue"];
const OVERDUE_SYNC_INTERVAL_MS = 60_000;
let overdueSyncPromise = null;
let lastOverdueSyncAt = 0;

export function isTaskPastDeadline(deadline, extraTimeMinutes = 0) {
  if (!deadline) return false;
  const deadlineMs = new Date(deadline).getTime();
  const extraMs = Math.max(0, Number(extraTimeMinutes || 0)) * 60_000;
  return (deadlineMs + extraMs) < Date.now();
}

export function resolveTaskStatus(task) {
  const db = normalizeDbStatus(task.status);
  if (db === "completed" || db === "pending_review" || db === "on_hold") return db;
  if (isTaskPastDeadline(task.deadline, task.extraTimeMinutes)) return "overdue";
  return db || "pending";
}

export async function syncOverdueTasks(prisma) {
  const currentTime = Date.now();
  if (overdueSyncPromise) return overdueSyncPromise;
  if (currentTime - lastOverdueSyncAt < OVERDUE_SYNC_INTERVAL_MS) return;

  overdueSyncPromise = (async () => {
    const now = new Date();
    try {
      await prisma.task.updateMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          deadline: { not: null, lt: now },
          extraTimeMinutes: { lte: 0 },
          OR: [{ startDate: null }, { startDate: { lte: now } }],
        },
        data: { status: "overdue" },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE tasks SET status = 'overdue'
         WHERE status IN ('pending','in_progress','overdue')
           AND deadline IS NOT NULL
           AND extraTimeMinutes > 0
           AND (startDate IS NULL OR startDate <= NOW())
           AND DATE_ADD(deadline, INTERVAL extraTimeMinutes MINUTE) < NOW()`,
      ).catch(() => { });
    } catch (error) {
      const message = String(error?.message || "");
      if (!message.includes("Lock wait timeout") && !message.includes("1205")) {
        throw error;
      }
    }
    lastOverdueSyncAt = Date.now();
  })();

  try {
    await overdueSyncPromise;
  } finally {
    overdueSyncPromise = null;
  }
}

/**
 * Normalize status/progress on write. Never auto-completes from progress alone.
 */
export function normalizeTaskWriteStatus({
  status,
  progress,
  deadline,
  startDate,
  extraTimeMinutes,
  currentStatus,
  currentProgress,
  isCreate = false,
  isManager = false,
}) {
  const nextProgress =
    progress !== undefined ? Number(progress) : Number(currentProgress ?? 0);
  let nextStatus = normalizeDbStatus(status ?? currentStatus ?? "pending");
  const current = normalizeDbStatus(currentStatus);
  const nextDeadline = deadline ? new Date(deadline) : null;
  const nextStartDate = startDate ? new Date(startDate) : null;
  const now = new Date();
  const hasActiveDeadlineExtension =
    nextDeadline && !isTaskPastDeadline(nextDeadline, extraTimeMinutes);

  if (!isManager && nextStatus !== current && status !== undefined && status !== null) {
    return { error: "Employees cannot change task status directly." };
  }

  if (isCreate) {
    if (nextProgress >= 100 && !isManager) {
      return { error: "Set progress below 100% when creating a task; employees submit for review to finish." };
    }
    if (isManager && nextStatus === "completed" && nextProgress < 100) {
      return { error: "Task cannot be marked completed until progress is 100%." };
    }
    if (nextStartDate && !Number.isNaN(nextStartDate.getTime()) && nextStartDate > now) {
      return { status: "pending", progress: Math.min(100, Math.max(0, nextProgress)) };
    }
    if (nextDeadline && isTaskPastDeadline(nextDeadline, extraTimeMinutes)) {
      return { status: "overdue", progress: Math.min(100, Math.max(0, nextProgress)) };
    }
    if (nextStartDate && !Number.isNaN(nextStartDate.getTime()) && nextStartDate <= now) {
      return { status: "in_progress", progress: Math.min(100, Math.max(0, nextProgress)) };
    }
    return { status: "pending", progress: Math.min(100, Math.max(0, nextProgress)) };
  }

  if (isTerminalStatus(current) && nextStatus !== "completed") {
    return { error: "Completed tasks cannot be reopened from this endpoint." };
  }

  if (current === "pending_review" && nextProgress !== Number(currentProgress ?? 0)) {
    return { error: "Progress is locked while this task is pending review." };
  }

  if (
    current === "overdue" &&
    nextProgress !== Number(currentProgress ?? 0) &&
    !hasActiveDeadlineExtension
  ) {
    return {
      error: "Cannot update progress of an overdue task. Extra time must be granted first.",
    };
  }

  if (nextStatus === "completed" && nextProgress < 100) {
    return {
      error: "Task cannot be marked completed until progress is 100%",
    };
  }

  if (nextStatus === "completed" && !isManager) {
    return { error: "Only a manager can approve and complete a task." };
  }

  if (nextProgress >= 100 && nextStatus !== "completed" && nextStatus !== "pending_review") {
    nextStatus = current === "pending_review" ? "pending_review" : current;
  }

  if (nextDeadline && isTaskPastDeadline(nextDeadline, extraTimeMinutes)) {
    if (current === "pending_review" || current === "on_hold" || current === "completed") {
      // frozen statuses are not overwritten by deadline evaluation here
    } else {
      nextStatus = "overdue";
    }
  } else if (nextStatus === "overdue" && hasActiveDeadlineExtension) {
    nextStatus = nextStartDate && nextStartDate.getTime() > Date.now()
      ? "pending"
      : "in_progress";
  }

  return { status: nextStatus, progress: Math.min(100, Math.max(0, nextProgress)) };
}