const ACTIVE_STATUSES = ["pending", "overdue"];
const OVERDUE_SYNC_INTERVAL_MS = 60_000;
let overdueSyncPromise = null;
let lastOverdueSyncAt = 0;

export function isTaskPastDeadline(deadline) {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

export function resolveTaskStatus(task) {
  if (task.status === "completed") return "completed";
  if (!task.deadline) return task.status || "pending";
  if (isTaskPastDeadline(task.deadline)) return "overdue";
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
      prisma.task.updateMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          deadline: { not: null, lt: now },
        },
        data: { status: "overdue" },
      }),
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
  currentStatus,
  currentProgress,
}) {
  const nextProgress =
    progress !== undefined ? Number(progress) : Number(currentProgress ?? 0);
  let nextStatus = (status ?? currentStatus ?? "pending").toLowerCase();
  const nextDeadline = deadline ? new Date(deadline) : null;

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
  } else if (nextDeadline && isTaskPastDeadline(nextDeadline)) {
    nextStatus = "overdue";
  } else if (ACTIVE_STATUSES.includes(nextStatus)) {
    nextStatus = "pending";
  }

  return { status: nextStatus, progress: nextProgress };
}
