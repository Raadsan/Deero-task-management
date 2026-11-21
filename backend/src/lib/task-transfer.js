import { isScheduleManager, objectFeatures } from "./scheduled-task-window.js";

export function canTransferTask(actor, task) {
  if (!actor?.id) return false;
  if (isScheduleManager(actor.role)) return true;

  const features = objectFeatures(task?.features);
  if (features?.assignedById && String(features.assignedById) === String(actor.id)) {
    return true;
  }

  const supervisor = String(task?.supervisor || "").trim();
  if (supervisor && (supervisor === actor.id || supervisor === actor.name)) {
    return true;
  }

  return false;
}

export function mergeAssignedByOnCreate(features, actorId) {
  if (!actorId) return features;
  if (Array.isArray(features)) return features;
  const base = objectFeatures(features) || {};
  if (base.assignedById) return base;
  return { ...base, assignedById: actorId };
}

function sameTransferField(prev, next) {
  if (prev == null && next == null) return true;
  if (prev instanceof Date || next instanceof Date || typeof prev === "string" && /^\d{4}-/.test(String(prev))) {
    const a = prev ? new Date(prev).getTime() : null;
    const b = next ? new Date(next).getTime() : null;
    return a === b;
  }
  return String(prev) === String(next);
}

/** Transfer may only change assignee; never status, progress, or schedule fields. */
export function assertTransferPreservesTaskState(before, after) {
  const fields = [
    "progress",
    "status",
    "deadline",
    "startDate",
    "extraTimeMinutes",
    "originalDeadline",
    "completedAt",
  ];
  for (const field of fields) {
    if (!sameTransferField(before?.[field], after?.[field])) {
      return `Transfer altered ${field}, which is not allowed.`;
    }
  }
  return null;
}