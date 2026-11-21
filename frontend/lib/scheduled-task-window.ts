/** Wall-clock schedule for project tasks. Keep in sync with backend/src/lib/scheduled-task-window.js */

import { fridayScheduleErrorForChange } from "@/lib/company-working-days";

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Africa/Mogadishu";

export type ScheduledEvaluation = {
  scheduled: boolean;
  status: "pending" | "in_progress" | "pending_review" | "completed" | "overdue" | "on_hold" | null;
  canUpdateProgress: boolean;
  reason: string;
  startAt: Date | null;
  endAt: Date | null;
  dateLabel: string;
  startLabel: string;
  endLabel: string;
  onHold?: boolean;
};

export function isScheduleManager(role?: string | null) {
  const name = String(role || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  return name === "admin" || name === "superadmin" || name.includes("superadmin") || name.includes("manager");
}

export type HoldEvent = {
  action?: string;
  reason?: string;
  holdStart?: string | null;
  resumeAt?: string | null;
  holdDurationMs?: number | null;
  totalHoldMs?: number | null;
  originalEndTime?: string | null;
  adjustedEndTime?: string | null;
  adjustedEndDate?: string | null;
  userId?: string | null;
  userName?: string | null;
};

export function holdSnapshot(features: unknown, now: number | Date = Date.now()) {
  const source = objectFeatures(features) || {};
  const history = Array.isArray(source.holdHistory) ? source.holdHistory as HoldEvent[] : [];
  const active = Boolean(source.holdActive);
  const moment = now instanceof Date ? now : new Date(now);
  const started = source.holdStartedAt ? new Date(String(source.holdStartedAt)) : null;
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
    startedAt: source.holdStartedAt ? String(source.holdStartedAt) : null,
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

/** Same whole-minute total shown on the hold card, so the clock is not left a minute short. */
export function clockHoldMs(ms: number) {
  return Math.round(Math.max(0, Number(ms) || 0) / 60000) * 60000;
}

export function shiftZonedSlot(dateStr: string, timeStr: string, deltaMs: number, timeZone = APP_TIMEZONE) {
  const start = zonedInstant(dateStr, timeStr, timeZone);
  if (!start || !Number.isFinite(deltaMs)) return null;
  const parts = zonedNowParts(new Date(start.getTime() + deltaMs), timeZone);
  return { date: parts.date, time: parts.time };
}

export function formatHoldDuration(ms: number) {
  const minutes = Math.max(0, Math.round(Number(ms) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function objectFeatures(features: unknown): Record<string, unknown> | null {
  if (typeof features === "string" && features.trim()) {
    try {
      return objectFeatures(JSON.parse(features));
    } catch {
      return null;
    }
  }
  if (!features || typeof features !== "object" || Array.isArray(features)) return null;
  return features as Record<string, unknown>;
}

export function zonedInstant(dateStr: string, timeStr: string, timeZone = APP_TIMEZONE) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const match = /^(\d{2}):(\d{2})/.exec(timeStr);
  if (!year || !month || !day || !match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  let parts: Intl.DateTimeFormatPart[];
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
    } as Intl.DateTimeFormatOptions).formatToParts(utcGuess);
  } catch {
    return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0));
  }
  const bag: Record<string, string> = {};
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

export function zonedNowParts(now: number | Date = Date.now(), timeZone = APP_TIMEZONE) {
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
    } as Intl.DateTimeFormatOptions).formatToParts(instant);
    const bag: Record<string, string> = {};
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

export function scheduleSignature(task: { scheduledDate?: string; startTime?: string; endTime?: string }) {
  return [
    String(task.scheduledDate || "").slice(0, 10),
    String(task.startTime || "").slice(0, 5),
    String(task.endTime || "").slice(0, 5),
  ].join("|");
}

/** Empty string when the slot is allowed. Unscheduled tasks are allowed. */
export function pastScheduleError(
  task: { scheduledDate?: string; startTime?: string; endTime?: string },
  now: number | Date = Date.now(),
) {
  const date = String(task.scheduledDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const start = String(task.startTime || "").slice(0, 5);
  const end = String(task.endTime || "").slice(0, 5);
  if (start && end && end <= start) return "End time must be later than the start time.";
  const current = zonedNowParts(now);
  if (date < current.date) return PAST_SCHEDULE_MESSAGE;
  if (date === current.date && (!/^\d{2}:\d{2}$/.test(start) || start <= current.time)) return PAST_SCHEDULE_MESSAGE;
  return "";
}

export function changedScheduleError(
  task: { id?: string; scheduledDate?: string; startTime?: string; endTime?: string },
  originalSchedules: Record<string, string>,
  now: number | Date = Date.now(),
) {
  if (!task.scheduledDate) return "";
  if (task.id && originalSchedules[task.id] === scheduleSignature(task)) return "";
  const friday = fridayScheduleErrorForChange(task, originalSchedules, scheduleSignature);
  if (friday) return friday;
  return pastScheduleError(task, now);
}

function clockLabel(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return "";
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateLabel(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return "No scheduled date";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function evaluateScheduledTask(
  task: { status?: string; progress?: number; features?: unknown } | null | undefined,
  now: number | Date = Date.now(),
): ScheduledEvaluation {
  const features = objectFeatures(task?.features);
  const date = String(features?.scheduledDate || "").slice(0, 10);
  const startTime = String(features?.startTime || "");
  const endTime = String(features?.endTime || "");
  const empty: ScheduledEvaluation = {
    scheduled: false,
    status: null,
    canUpdateProgress: true,
    reason: "",
    startAt: null,
    endAt: null,
    dateLabel: "",
    startLabel: "",
    endLabel: "",
  };
  const endDate = String(features?.endDate || date).slice(0, 10);
  const startAt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? zonedInstant(date, startTime) : null;
  const endAt = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? zonedInstant(endDate, endTime) : null;
  const extraMs = Math.max(0, Number((task as { extraTimeMinutes?: number })?.extraTimeMinutes || 0)) * 60_000;
  const effectiveEndAt = endAt ? new Date(endAt.getTime() + extraMs) : null;
  const dbStatus = String(task?.status || "pending").toLowerCase();

  if (features?.holdActive || dbStatus === "on_hold") {
    return {
      scheduled: true,
      status: "on_hold",
      onHold: true,
      canUpdateProgress: false,
      reason: "This task is on hold. Progress updates are locked until a manager resumes it.",
      startAt,
      endAt: effectiveEndAt,
      dateLabel: dateLabel(date),
      startLabel: clockLabel(startTime),
      endLabel: clockLabel(endTime),
    };
  }

  if (dbStatus === "pending_review") {
    return {
      scheduled: true,
      status: "pending_review",
      canUpdateProgress: false,
      reason: "This task is awaiting manager review.",
      startAt,
      endAt: effectiveEndAt,
      dateLabel: dateLabel(date),
      startLabel: clockLabel(startTime),
      endLabel: clockLabel(endTime),
    };
  }

  if (dbStatus === "completed") {
    return {
      scheduled: true,
      status: "completed",
      canUpdateProgress: false,
      reason: "This task is completed. Progress can no longer be changed.",
      startAt,
      endAt: effectiveEndAt,
      dateLabel: dateLabel(date),
      startLabel: clockLabel(startTime),
      endLabel: clockLabel(endTime),
    };
  }

  if (!startAt || !effectiveEndAt || effectiveEndAt <= startAt) return empty;

  const moment = now instanceof Date ? now : new Date(now);
  const progress = Number(task?.progress ?? 0);
  let status: ScheduledEvaluation["status"] = "in_progress";
  let canUpdateProgress = true;
  let reason = "";
  if (moment < startAt) {
    status = "pending";
    canUpdateProgress = false;
    reason = "Progress updates are locked until the scheduled start time.";
  } else if (moment >= effectiveEndAt && progress < 100) {
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
    endAt: effectiveEndAt,
    dateLabel: dateLabel(date),
    startLabel: clockLabel(startTime),
    endLabel: clockLabel(endTime),
  };
}
