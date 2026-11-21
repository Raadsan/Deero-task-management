import { objectFeatures } from "./scheduled-task-window.js";
import { isScheduleManager } from "./scheduled-task-window.js";

/** Official persisted task statuses (snake_case in DB). */
export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "pending_review",
  "overdue",
  "on_hold",
  "completed",
];

export function normalizeDbStatus(status) {
  const raw = String(status || "pending").toLowerCase();
  return TASK_STATUSES.includes(raw) ? raw : "pending";
}

export function isTerminalStatus(status) {
  return normalizeDbStatus(status) === "completed";
}

export function isProgressLockedStatus(status) {
  const s = normalizeDbStatus(status);
  return s === "pending" || s === "pending_review" || s === "on_hold" || s === "completed" || s === "overdue";
}

export function canManageTaskLifecycle(role) {
  return isScheduleManager(role);
}

export function canReviewTask(user, task) {
  if (!user?.id) return false;
  if (canManageTaskLifecycle(user.role)) return true;
  const supervisor = String(task?.supervisor || "").trim();
  if (!supervisor) return false;
  return supervisor === user.id || supervisor === user.name;
}

export function appendStatusHistory(features, entry) {
  const base = { ...(objectFeatures(features) || {}) };
  const history = Array.isArray(base.statusHistory) ? base.statusHistory : [];
  base.statusHistory = [
    ...history,
    {
      taskId: entry.taskId ?? null,
      fromStatus: entry.fromStatus ?? null,
      toStatus: entry.toStatus ?? null,
      changedById: entry.changedById ?? null,
      changedByName: entry.changedByName ?? "",
      reason: entry.reason ?? "",
      reviewDecision: entry.reviewDecision ?? null,
      scheduleSnapshot: entry.scheduleSnapshot ?? null,
      at: entry.at || new Date().toISOString(),
    },
  ].slice(-250);
  return base;
}

function scheduleSnapshot(task) {
  const f = objectFeatures(task?.features) || {};
  return {
    startDate: task?.startDate ? new Date(task.startDate).toISOString() : null,
    deadline: task?.deadline ? new Date(task.deadline).toISOString() : null,
    extraTimeMinutes: Number(task?.extraTimeMinutes ?? 0),
    scheduledDate: f.scheduledDate || null,
    startTime: f.startTime || null,
    endTime: f.endTime || null,
    originalEndTime: f.originalEndTime || null,
    originalEndDate: f.originalEndDate || null,
  };
}

export function recordStatusTransition(features, task, { toStatus, user, reason, reviewDecision } = {}) {
  const fromStatus = normalizeDbStatus(task?.status);
  const next = toStatus ? normalizeDbStatus(toStatus) : fromStatus;
  if (fromStatus === next) return objectFeatures(features) || {};
  return appendStatusHistory(features, {
    taskId: task?.id,
    fromStatus,
    toStatus: next,
    changedById: user?.id ?? null,
    changedByName: user?.name ?? "",
    reason: reason || "",
    reviewDecision: reviewDecision || null,
    scheduleSnapshot: scheduleSnapshot(task),
  });
}

export function pendingReviewSubmission(features) {
  const base = objectFeatures(features) || {};
  const subs = Array.isArray(base.reviewSubmissions) ? base.reviewSubmissions : [];
  return subs.find((row) => String(row?.decision || "pending").toLowerCase() === "pending") || null;
}

export function appendReviewSubmission(features, submission) {
  const base = { ...(objectFeatures(features) || {}) };
  const subs = Array.isArray(base.reviewSubmissions) ? base.reviewSubmissions : [];
  if (subs.some((row) => String(row?.decision || "pending").toLowerCase() === "pending")) {
    return { error: "This task already has a submission awaiting review." };
  }
  base.reviewSubmissions = [...subs, submission].slice(-50);
  return { features: base };
}

export function settleReviewSubmission(features, { decision, reviewerId, reviewerName, comments }) {
  const base = { ...(objectFeatures(features) || {}) };
  const subs = Array.isArray(base.reviewSubmissions) ? [...base.reviewSubmissions] : [];
  const index = subs.findIndex((row) => String(row?.decision || "pending").toLowerCase() === "pending");
  if (index < 0) return { error: "No pending submission to review." };
  const row = subs[index];
  subs[index] = {
    ...row,
    decision: decision === "approved" ? "approved" : "rejected",
    reviewedAt: new Date().toISOString(),
    reviewerId: reviewerId || null,
    reviewerName: reviewerName || "",
    reviewComments: comments || "",
  };
  base.reviewSubmissions = subs;
  const reviews = Array.isArray(base.reviewHistory) ? base.reviewHistory : [];
  base.reviewHistory = [
    ...reviews,
    {
      submissionId: row.id,
      decision: decision === "approved" ? "approved" : "rejected",
      comments: comments || "",
      reviewerId: reviewerId || null,
      reviewerName: reviewerName || "",
      at: new Date().toISOString(),
    },
  ].slice(-100);
  return { features: base, submission: row };
}

export function assertEmployeeMayUpdateProgress(task, actor, { isManager }) {
  const status = normalizeDbStatus(task.status);
  if (isManager) return null;
  if (task.assgineeId !== actor?.id) {
    return "Only the assigned employee can update progress on this task.";
  }
  if (status === "pending_review") {
    return "Progress is locked while this task is pending review.";
  }
  if (status === "completed") {
    return "This task is completed and cannot be changed.";
  }
  if (status === "on_hold") {
    return "This task is on hold. Progress updates are locked until a manager resumes it.";
  }
  if (status === "overdue") {
    return "This task is overdue. A manager must grant extra time or reschedule before progress can be updated.";
  }
  return null;
}

export function assertEmployeeMaySetStatus(status, isManager) {
  if (isManager) return null;
  if (status !== undefined && status !== null && String(status).trim() !== "") {
    return "Employees cannot change task status directly.";
  }
  return null;
}