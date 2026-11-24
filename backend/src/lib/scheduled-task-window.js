/** Wall-clock schedule for project tasks. Keep in sync with frontend/lib/scheduled-task-window.ts */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "Africa/Mogadishu";

export function objectFeatures(features) {
  if (typeof features === "string" && features.trim()) {
    try {
      return objectFeatures(JSON.parse(features));
    } catch {
      return null;
    }
  }
  if (!features || typeof features !== "object" || Array.isArray(features)) return null;
  return features;
}

export function zonedInstant(dateStr, timeStr, timeZone = APP_TIMEZONE) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  const match = /^(\d{2}):(\d{2})/.exec(String(timeStr || ""));
  if (!year || !month || !day || !match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    }).formatToParts(utcGuess);
  } catch {
    return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0));
  }
  const bag = {};
  for (const part of parts) bag[part.type] = part.value;
  const hourPart = Number(bag.hour);
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    hourPart === 24 ? 0 : hourPart,
    Number(bag.minute),
    Number(bag.second),
  );
  return new Date(utcGuess.getTime() - (asUtc - utcGuess.getTime()));
}

export const PAST_SCHEDULE_MESSAGE = "You cannot schedule a task in the past. Please select a future date and time.";

export const PROJECT_REGISTRATION_SCHEDULE_OPTIONS = { allowHistoricalDates: true };

export function isHistoricalScheduledDate(dateStr, now = new Date()) {
  const date = String(dateStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date < zonedNowParts(now).date;
}

export function zonedNowParts(now = new Date(), timeZone = APP_TIMEZONE) {
  const instant = now instanceof Date ? now : new Date(now);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(instant);
    const bag = {};
    for (const part of parts) bag[part.type] = part.value;
    const hour = bag.hour === "24" ? "00" : String(bag.hour).padStart(2, "0");
    return {
      date: `${bag.year}-${bag.month}-${bag.day}`,
      time: `${hour}:${String(bag.minute).padStart(2, "0")}`,
    };
  } catch {
    const shifted = new Date(instant.getTime() + 3 * 60 * 60 * 1000);
    return { date: shifted.toISOString().slice(0, 10), time: shifted.toISOString().slice(11, 16) };
  }
}

export function scheduleSignature(task) {
  return [
    String(task?.scheduledDate || "").slice(0, 10),
    String(task?.startTime || "").slice(0, 5),
    String(task?.endTime || "").slice(0, 5),
  ].join("|");
}

/** Empty string when the slot is allowed. Unscheduled tasks are allowed. */
export function pastScheduleError(task, now = new Date(), options = {}) {
  const date = String(task?.scheduledDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const start = String(task?.startTime || "").slice(0, 5);
  const end = String(task?.endTime || "").slice(0, 5);
  if (start && end && end <= start) return "End time must be later than the start time.";
  const current = zonedNowParts(now);
  if (date < current.date) {
    if (options.allowHistoricalDates) return "";
    return PAST_SCHEDULE_MESSAGE;
  }
  if (date === current.date && (!/^\d{2}:\d{2}$/.test(start) || start <= current.time)) return PAST_SCHEDULE_MESSAGE;
  return "";
}

export function isScheduleManager(role) {
  const name = String(role || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  return name === "admin" || name === "superadmin" || name.includes("superadmin") || name.includes("manager");
}

const HOLD_FIELD_KEYS = [
  "holdActive",
  "holdReason",
  "holdStartedAt",
  "holdById",
  "holdByName",
  "originalEndTime",
  "originalEndDate",
  "totalHoldMs",
  "holdHistory",
  "endDate",
];

/** Same whole-minute total shown on the hold card, so the clock is not left a minute short. */
export function clockHoldMs(ms) {
  return Math.round(Math.max(0, Number(ms) || 0) / 60000) * 60000;
}

/** Rebuild the saved end from the original end plus completed hold time. */
export function applyStoredAdjustedEnd(features) {
  const source = { ...(objectFeatures(features) || {}) };
  const originalEndTime = String(source.originalEndTime || "").slice(0, 5);
  const originalEndDate = String(source.originalEndDate || source.scheduledDate || "").slice(0, 10);
  if (!/^\d{2}:\d{2}$/.test(originalEndTime) || !/^\d{4}-\d{2}-\d{2}$/.test(originalEndDate)) return source;
  const shifted = shiftZonedSlot(originalEndDate, originalEndTime, clockHoldMs(source.totalHoldMs));
  if (!shifted) return source;
  source.endTime = shifted.time;
  source.endDate = shifted.date;
  return source;
}

/** Generic task edits cannot change hold history or replace the original end. */
export function lockHoldFields(previousFeatures, nextFeatures) {
  const previous = objectFeatures(previousFeatures) || {};
  const next = { ...(objectFeatures(nextFeatures) || {}) };
  for (const key of HOLD_FIELD_KEYS) {
    if (previous[key] !== undefined) next[key] = previous[key];
    else delete next[key];
  }
  if (next.originalEndTime) return applyStoredAdjustedEnd(next);
  return next;
}

export function shiftZonedSlot(dateStr, timeStr, deltaMs, timeZone = APP_TIMEZONE) {
  const start = zonedInstant(dateStr, timeStr, timeZone);
  if (!start || !Number.isFinite(deltaMs)) return null;
  const parts = zonedNowParts(new Date(start.getTime() + deltaMs), timeZone);
  return { date: parts.date, time: parts.time };
}

function scheduledSlot(features) {
  const date = String(features?.scheduledDate || "").slice(0, 10);
  const stored = applyStoredAdjustedEnd(features);
  const endDate = String(stored.endDate || features?.endDate || date).slice(0, 10);
  const startTime = String(features?.startTime || "").slice(0, 5);
  const endTime = String(stored.endTime || features?.endTime || "").slice(0, 5);
  const startAt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? zonedInstant(date, startTime) : null;
  const endAt = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? zonedInstant(endDate, endTime) : null;
  return { date, endDate, startTime, endTime, startAt, endAt };
}

export function holdSnapshot(features, now = new Date()) {
  const source = objectFeatures(features) || {};
  const history = Array.isArray(source.holdHistory) ? source.holdHistory : [];
  const active = Boolean(source.holdActive);
  const moment = now instanceof Date ? now : new Date(now);
  const started = source.holdStartedAt ? new Date(source.holdStartedAt) : null;
  const openMs = active && started && !Number.isNaN(started.getTime())
    ? Math.max(0, moment.getTime() - started.getTime())
    : 0;
  const completedMs = Math.max(0, Number(source.totalHoldMs) || 0);
  const totalHoldMs = completedMs + openMs;
  const originalEndTime = String(source.originalEndTime || source.endTime || "").slice(0, 5);
  const originalEndDate = String(source.originalEndDate || source.scheduledDate || "").slice(0, 10);
  const shifted = /^\d{2}:\d{2}$/.test(originalEndTime) && /^\d{4}-\d{2}-\d{2}$/.test(originalEndDate)
    ? shiftZonedSlot(originalEndDate, originalEndTime, clockHoldMs(totalHoldMs))
    : null;
  return {
    active,
    reason: String(source.holdReason || ""),
    startedAt: source.holdStartedAt || null,
    heldByName: String(source.holdByName || ""),
    originalEndTime,
    originalEndDate,
    adjustedEndTime: shifted?.time || String(source.endTime || ""),
    adjustedEndDate: shifted?.date || String(source.endDate || source.scheduledDate || ""),
    currentHoldMs: openMs,
    totalHoldMs,
    projected: active,
    history,
  };
}

function holdEvent(action, details) {
  return {
    action,
    taskId: details.taskId || null,
    reason: details.reason || "",
    holdStart: details.holdStart || null,
    resumeAt: details.resumeAt || null,
    holdDurationMs: details.holdDurationMs ?? null,
    totalHoldMs: details.totalHoldMs ?? 0,
    originalEndTime: details.originalEndTime || null,
    adjustedEndTime: details.adjustedEndTime || null,
    adjustedEndDate: details.adjustedEndDate || null,
    userId: details.userId || null,
    userName: details.userName || "",
  };
}

export function putTaskOnHold(features, input) {
  const source = { ...(objectFeatures(features) || {}) };
  const reason = String(input.reason || "").trim();
  if (!reason) return { ok: false, status: 400, error: "A reason is required" };
  if (reason.length > 500) return { ok: false, status: 400, error: "Reason must be 500 characters or fewer" };
  if (source.holdActive) return { ok: false, status: 400, error: "This task is already on hold" };
  const inputStatus = String(input.taskStatus || "").toLowerCase();
  if (Number(input.progress ?? 0) >= 100 || inputStatus === "completed" || inputStatus === "pending_review") {
    return { ok: false, status: 400, error: "Completed or review-pending tasks cannot be put on hold" };
  }
  const slot = scheduledSlot(source);
  if (!slot.startAt || !slot.endAt || slot.endAt <= slot.startAt) {
    return { ok: false, status: 400, error: "Set a start and end time before putting this task on hold" };
  }
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const originalEndTime = String(source.originalEndTime || slot.endTime).slice(0, 5);
  const originalEndDate = String(source.originalEndDate || slot.endDate).slice(0, 10);
  const history = Array.isArray(source.holdHistory) ? source.holdHistory : [];
  const totalHoldMs = Math.max(0, Number(source.totalHoldMs) || 0);
  const next = {
    ...source,
    holdActive: true,
    holdReason: reason,
    holdStartedAt: now.toISOString(),
    holdById: input.userId || null,
    holdByName: input.userName || "",
    originalEndTime,
    originalEndDate,
    totalHoldMs,
    projectStatus: "ON_HOLD",
    holdHistory: [
      ...history,
      holdEvent("PUT_ON_HOLD", {
        taskId: input.taskId,
        reason,
        holdStart: now.toISOString(),
        totalHoldMs,
        originalEndTime,
        adjustedEndTime: slot.endTime,
        adjustedEndDate: slot.endDate,
        userId: input.userId,
        userName: input.userName,
      }),
    ],
  };
  delete next.overdueAt;
  return { ok: true, features: next };
}

export function resumeTaskHold(features, input) {
  const source = { ...(objectFeatures(features) || {}) };
  if (!source.holdActive || !source.holdStartedAt) {
    return { ok: false, status: 400, error: "This task is not on hold" };
  }
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const started = new Date(source.holdStartedAt);
  if (Number.isNaN(started.getTime()) || now.getTime() < started.getTime()) {
    return { ok: false, status: 400, error: "The hold start time is invalid" };
  }
  const holdDurationMs = now.getTime() - started.getTime();
  const totalHoldMs = Math.max(0, Number(source.totalHoldMs) || 0) + holdDurationMs;
  const originalEndTime = String(source.originalEndTime || source.endTime || "").slice(0, 5);
  const originalEndDate = String(source.originalEndDate || source.endDate || source.scheduledDate || "").slice(0, 10);
  const shifted = shiftZonedSlot(originalEndDate, originalEndTime, totalHoldMs);
  if (!shifted) return { ok: false, status: 400, error: "The original end time is missing" };
  const history = Array.isArray(source.holdHistory) ? source.holdHistory : [];
  const next = applyStoredAdjustedEnd({
    ...source,
    holdActive: false,
    totalHoldMs,
    originalEndTime,
    originalEndDate,
    holdHistory: [
      ...history,
      holdEvent("RESUME", {
        taskId: input.taskId,
        reason: String(source.holdReason || ""),
        holdStart: source.holdStartedAt,
        resumeAt: now.toISOString(),
        holdDurationMs,
        totalHoldMs,
        originalEndTime,
        adjustedEndTime: shifted.time,
        adjustedEndDate: shifted.date,
        userId: input.userId,
        userName: input.userName,
      }),
    ],
  });
  return { ok: true, features: next };
}

/**
 * Scheduled tasks follow start/end. Other tasks are left to the deadline rules.
 * Progress of 100% completes the task even before the end time.
 * A task on hold never becomes overdue.
 */
function withExtraDeadline(endAt, extraTimeMinutes) {
  if (!endAt) return null;
  const extraMs = Math.max(0, Number(extraTimeMinutes || 0)) * 60_000;
  return new Date(endAt.getTime() + extraMs);
}

export function evaluateScheduledTask(task, now = new Date()) {
  const features = objectFeatures(task?.features);
  const slot = scheduledSlot(features || {});
  const { startAt, endAt: slotEndAt } = slot;
  const endAt = withExtraDeadline(slotEndAt, task?.extraTimeMinutes);
  const dbStatus = String(task?.status || "pending").toLowerCase();

  if (features?.holdActive || dbStatus === "on_hold") {
    return {
      scheduled: true,
      status: "on_hold",
      onHold: true,
      canUpdateProgress: false,
      reason: "This task is on hold. Progress updates are locked until a manager resumes it.",
      startAt,
      endAt,
      projectStatus: "ON_HOLD",
    };
  }

  if (dbStatus === "pending_review") {
    return {
      scheduled: true,
      status: "pending_review",
      onHold: false,
      canUpdateProgress: false,
      reason: "This task is awaiting manager review.",
      startAt,
      endAt,
      projectStatus: "PENDING_REVIEW",
    };
  }

  if (dbStatus === "completed") {
    return {
      scheduled: true,
      status: "completed",
      onHold: false,
      canUpdateProgress: false,
      reason: "This task is completed. Progress can no longer be changed.",
      startAt,
      endAt,
      projectStatus: "COMPLETED",
    };
  }

  const progress = Number(task?.progress ?? 0);
  if (!startAt || !endAt || endAt <= startAt) {
    return { scheduled: false, canUpdateProgress: true, status: null, reason: "", startAt: null, endAt: null, projectStatus: null, onHold: false };
  }

  const moment = now instanceof Date ? now : new Date(now);
  let status = "in_progress";
  let canUpdateProgress = true;
  let reason = "";
  if (moment < startAt) {
    status = "pending";
    canUpdateProgress = false;
    reason = "Progress updates are locked until the scheduled start time.";
  } else if (moment >= endAt && progress < 100) {
    status = "overdue";
    canUpdateProgress = false;
    reason = "This task is overdue. A manager must reschedule or grant extra time before progress can be updated.";
  }

  return {
    scheduled: true,
    status,
    canUpdateProgress,
    reason,
    startAt,
    endAt,
    projectStatus: status.toUpperCase(),
    onHold: false,
  };
}

export function scheduleChanged(previousFeatures, nextFeatures) {
  const previous = objectFeatures(previousFeatures) || {};
  const next = objectFeatures(nextFeatures) || {};
  return ["scheduledDate", "startTime", "endTime"].some(
    (key) => String(previous[key] || "") !== String(next[key] || ""),
  );
}

/** Keep the old overdue slot when a manager assigns a new schedule. */
export function mergeScheduleChange(previousFeatures, nextFeatures, previousStatus) {
  const previous = objectFeatures(previousFeatures) || {};
  const incoming = objectFeatures(nextFeatures) || {};
  const next = { ...previous, ...incoming };
  const wasOverdue = String(previousStatus || "").toLowerCase() === "overdue" || Boolean(previous.overdueAt);
  if (scheduleChanged(previous, next) && wasOverdue) {
    const history = Array.isArray(previous.overdueHistory) ? previous.overdueHistory : [];
    next.overdueHistory = [
      ...history,
      {
        overdueAt: previous.overdueAt || null,
        scheduledDate: previous.scheduledDate || null,
        startTime: previous.startTime || null,
        endTime: previous.endTime || null,
        rescheduledAt: new Date().toISOString(),
      },
    ];
    delete next.overdueAt;
  }
  return next;
}

export function appendProgressHistory(features, entry) {
  const base = { ...(objectFeatures(features) || {}) };
  const history = Array.isArray(base.progressHistory) ? base.progressHistory : [];
  base.progressHistory = [...history, entry].slice(-100);
  return base;
}

export function applyScheduledFeatures(features, evaluation, now = new Date()) {
  const next = { ...(objectFeatures(features) || {}) };
  if (!evaluation?.scheduled) return next;
  next.projectStatus = evaluation.projectStatus;
  if (evaluation.status === "overdue") {
    if (!next.overdueAt) next.overdueAt = (now instanceof Date ? now : new Date(now)).toISOString();
  } else {
    delete next.overdueAt;
  }
  return next;
}

export async function syncScheduledTaskActivation(prisma, now = new Date()) {
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ["pending", "in_progress", "overdue", "on_hold"] },
      projectId: { not: null },
    },
    select: { id: true, status: true, progress: true, features: true, completedAt: true, startDate: true },
    take: 500,
  });

  let updated = 0;
  for (const task of tasks) {
    const evaluation = evaluateScheduledTask(task, now);
    if (evaluation.status === "on_hold") {
      const features = applyScheduledFeatures(task.features, evaluation, now);
      const previousStatus = String(objectFeatures(task.features)?.projectStatus || "");
      if (task.status === "on_hold" && previousStatus === "ON_HOLD") continue;
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "on_hold", features },
      });
      updated += 1;
      continue;
    }

    if (evaluation.status === "pending_review" || evaluation.status === "completed") continue;

    if (!evaluation.scheduled) continue;
    const features = applyScheduledFeatures(task.features, evaluation, now);
    const previousStatus = String(objectFeatures(task.features)?.projectStatus || "");
    const startChanged = evaluation.startAt && (!task.startDate || new Date(task.startDate).getTime() !== evaluation.startAt.getTime());
    if (task.status === evaluation.status && previousStatus === evaluation.projectStatus && !startChanged) continue;
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: evaluation.status,
        features,
        startDate: evaluation.startAt,
      },
    });
    updated += 1;
  }
  return updated;
}
