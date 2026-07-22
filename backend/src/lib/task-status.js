const ACTIVE_STATUSES = ["pending", "overdue"];
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
  if (task.status === "completed") return "completed";
  if (!task.deadline) return task.status || "pending";
  if (isTaskPastDeadline(task.deadline, task.extraTimeMinutes)) return "overdue";
  if (task.status === "overdue") return "pending";
  return task.status || "pending";
}

export async function syncOverdueTasks(prisma) {
  const currentTime = Date.now();
  if (overdueSyncPromise) return overdueSyncPromise;
  if (currentTime - lastOverdueSyncAt < OVERDUE_SYNC_INTERVAL_MS) return;

  overdueSyncPromise = (async () => {
    const now = new Date();
    await Promise.all([
      // Mark as overdue: deadline passed AND no extra time
      prisma.task.updateMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          deadline: { not: null, lt: now },
          extraTimeMinutes: { lte: 0 },
        },
        data: { status: "overdue" },
      }),
      // Mark as overdue: deadline+extraTime window also expired
      prisma.$executeRawUnsafe(
        `UPDATE tasks SET status = 'overdue'
         WHERE status IN ('pending','overdue')
           AND deadline IS NOT NULL
           AND extraTimeMinutes > 0
           AND DATE_ADD(deadline, INTERVAL extraTimeMinutes MINUTE) < NOW()`,
      ).catch(() => { }), // non-fatal if raw fails on non-MySQL
      // Restore to pending: overdue but deadline is now in future
      prisma.task.updateMany({
        where: {
          status: "overdue",
          deadline: { not: null, gte: now },
        },
        data: { status: "pending" },
      }),
    ]);
    lastOverdueSyncAt = Date.now();
  })();

  try {
    await overdueSyncPromise;
  } finally {
    overdueSyncPromise = null;
  }
}

export function normalizeTaskWriteStatus({
  status,
  progress,
  deadline,
  extraTimeMinutes,
  currentStatus,
  currentProgress,
}) {
  const nextProgress =
    progress !== undefined ? Number(progress) : Number(currentProgress ?? 0);
  let nextStatus = (status ?? currentStatus ?? "pending").toLowerCase();
  const nextDeadline = deadline ? new Date(deadline) : null;
  const hasExtraTime = Number(extraTimeMinutes ?? 0) > 0;

  if (currentStatus === "overdue" && nextProgress !== Number(currentProgress ?? 0)) {
    return {
      error: "Cannot update progress of an overdue task. Extra time must be granted first.",
    };
  }

  if (nextStatus === "completed" && nextProgress < 100) {
    return {
      error: "Task cannot be marked completed until progress is 100%",
    };
  }

  if (nextProgress >= 100) {
    nextStatus = "completed";
  } else if (nextStatus === "completed") {
    return {
      error: "Task cannot be marked completed until progress is 100%",
    };
  } else if (!hasExtraTime && nextDeadline && isTaskPastDeadline(nextDeadline)) {
    // Only force overdue when no extra time is being added
    nextStatus = "overdue";
  } else if (ACTIVE_STATUSES.includes(nextStatus)) {
    nextStatus = "pending";
  }

  return { status: nextStatus, progress: nextProgress };
}
