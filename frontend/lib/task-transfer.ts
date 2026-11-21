import { isScheduleManager } from "@/lib/scheduled-task-window";
import { Task } from "@/lib/types";

function objectFeatures(features: unknown): Record<string, unknown> | null {
  if (!features || typeof features !== "object" || Array.isArray(features)) return null;
  return features as Record<string, unknown>;
}

export function canTransferTaskForUser(
  task: Pick<Task, "supervisor" | "features" | "status">,
  user?: { id?: string; name?: string; role?: string } | null,
) {
  if (!user?.id) return false;
  if (String(task.status).toLowerCase() === "completed") return false;
  if (isScheduleManager(user.role)) return true;

  const features = objectFeatures(task.features);
  if (features?.assignedById && String(features.assignedById) === String(user.id)) {
    return true;
  }

  const supervisor = String(task.supervisor || "").trim();
  if (supervisor && (supervisor === user.id || supervisor === user.name)) {
    return true;
  }

  return false;
}

export function originalAssigneeName(
  task: Task,
  transfers: Array<{ fromAssignee?: { name?: string } | null }>,
) {
  if (transfers.length > 0) {
    return transfers[0].fromAssignee?.name || "Unknown";
  }
  return task.assignedTo?.name || "Unassigned";
}

export function hasTransferHistory(task: Pick<Task, "transferHistory">): boolean {
  return Array.isArray(task.transferHistory) && task.transferHistory.length > 0;
}

/** Minimum progress for the current assignee (from latest transfer snapshot, not completion %). */
export function transferProgressFloor(task: Task): number {
  const history = Array.isArray(task.transferHistory) ? [...task.transferHistory] : [];
  if (history.length) {
    history.sort(
      (a, b) =>
        new Date(String(a.createdAt || 0)).getTime() - new Date(String(b.createdAt || 0)).getTime(),
    );
    const latest = history[history.length - 1];
    return Number(latest.progressAtTransfer ?? task.progress ?? 0);
  }
  return Number(task.transferredFromProgress ?? 0);
}