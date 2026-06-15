const ACTIVE_STATUSES = ["pending", "overdue"];

export function isTaskPastDeadline(deadline) {
  return new Date(deadline).getTime() < Date.now();
}

export function resolveTaskStatus(task) {
  if (task.status === "completed") return "completed";
  if (isTaskPastDeadline(task.deadline)) return "overdue";
  if (task.status === "overdue") return "pending";
  return task.status || "pending";
}

export async function syncOverdueTasks(prisma) {
  const now = new Date();

  await prisma.task.updateMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      deadline: { lt: now },
    },
    data: { status: "overdue" },
  });

  await prisma.task.updateMany({
    where: {
      status: "overdue",
      deadline: { gte: now },
    },
    data: { status: "pending" },
  });
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
