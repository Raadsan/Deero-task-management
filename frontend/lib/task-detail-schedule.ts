import { zonedInstant } from "@/lib/scheduled-task-window";
import { Task } from "@/lib/types";

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

function isScheduledTask(task: {
  projectId?: string | null;
  features?: unknown;
}) {
  const features = objectFeatures(task.features);
  return Boolean(
    task.projectId ||
      features?.projectTask === true ||
      (features?.scheduledDate && String(features.scheduledDate).slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/)),
  );
}

export function formatTaskDetailDateTime(value: Date | string | null | undefined): string {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Combine persisted date + time from features without shifting hold (already stored on endDate/endTime). */
function formatStoredZonedEnd(dateStr: string, timeStr: string, extraMinutes = 0): string {
  const date = String(dateStr || "").slice(0, 10);
  const time = String(timeStr || "").slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "N/A";
  const instant = zonedInstant(date, time);
  if (!instant) return "N/A";
  const withExtra =
    extraMinutes > 0
      ? new Date(instant.getTime() + extraMinutes * 60_000)
      : instant;
  return formatTaskDetailDateTime(withExtra);
}

function formatExtraTimeMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return "0 minutes";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m (${total} minutes)`;
  if (hours > 0) return `${hours}h (${total} minutes)`;
  return `${total} minute${total === 1 ? "" : "s"}`;
}

type ReasonCandidate = { at: number; text: string };

function parseTime(value: unknown): number {
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function taskDetailLatestReason(task: Task): string {
  const features = objectFeatures(task.features) || {};
  const candidates: ReasonCandidate[] = [];

  const reviewHistory = Array.isArray(features.reviewHistory) ? features.reviewHistory : [];
  for (const row of reviewHistory) {
    const text = String((row as { comments?: string }).comments || "").trim();
    if (text) {
      candidates.push({ at: parseTime((row as { at?: string }).at), text });
    }
  }

  const reviewSubmissions = Array.isArray(features.reviewSubmissions) ? features.reviewSubmissions : [];
  for (const row of reviewSubmissions) {
    const rejected = String((row as { decision?: string }).decision || "").toLowerCase() === "rejected";
    const text = String((row as { reviewComments?: string }).reviewComments || "").trim();
    if (rejected && text) {
      candidates.push({
        at: parseTime((row as { reviewedAt?: string }).reviewedAt),
        text,
      });
    }
  }

  const scheduleAdjustments = Array.isArray(features.scheduleAdjustments) ? features.scheduleAdjustments : [];
  for (const row of scheduleAdjustments) {
    const entry = row as { grantedAt?: string; minutes?: number; reason?: string; type?: string };
    const text = String(entry.reason || "").trim() || (
      entry.type === "extra_time_granted" && Number(entry.minutes) > 0
        ? `Additional time granted (${entry.minutes} minutes).`
        : ""
    );
    if (text) candidates.push({ at: parseTime(entry.grantedAt), text });
  }

  const statusHistory = Array.isArray(features.statusHistory) ? features.statusHistory : [];
  for (const row of statusHistory) {
    const entry = row as { at?: string; reason?: string; reviewDecision?: string };
    const text = String(entry.reason || "").trim();
    if (text && entry.reviewDecision && entry.reviewDecision !== "submitted") {
      candidates.push({ at: parseTime(entry.at), text });
    }
  }

  const holdHistory = Array.isArray(features.holdHistory) ? features.holdHistory : [];
  for (const row of holdHistory) {
    const entry = row as { action?: string; reason?: string; holdStart?: string };
    if (String(entry.action || "").toUpperCase() === "PUT_ON_HOLD") {
      const text = String(entry.reason || "").trim();
      if (text) candidates.push({ at: parseTime(entry.holdStart), text });
    }
  }

  if (String(features.holdReason || "").trim() && features.holdActive) {
    candidates.push({
      at: parseTime(features.holdStartedAt),
      text: String(features.holdReason),
    });
  }

  if (!candidates.length) return "N/A";
  candidates.sort((a, b) => b.at - a.at);
  return candidates[0].text;
}

export type TaskDetailScheduleDisplay = {
  originalDueDate: string;
  updatedEndingDueDate: string;
  extraTimeAdded: string;
  reason: string;
};

export function getTaskDetailScheduleDisplay(task: Task): TaskDetailScheduleDisplay {
  const extraMinutes = Math.max(0, Number(task.extraTimeMinutes ?? 0));
  const reason = taskDetailLatestReason(task);

  if (isScheduledTask(task)) {
    const features = objectFeatures(task.features) || {};
    const scheduledDate = String(features.scheduledDate || "").slice(0, 10);
    const originalEndDate = String(features.originalEndDate || scheduledDate).slice(0, 10);
    const originalEndTime = String(features.originalEndTime || features.endTime || "").slice(0, 5);
    const endDate = String(features.endDate || scheduledDate).slice(0, 10);
    const endTime = String(features.endTime || "").slice(0, 5);

    return {
      originalDueDate: formatStoredZonedEnd(originalEndDate, originalEndTime, 0),
      updatedEndingDueDate: formatStoredZonedEnd(endDate, endTime, extraMinutes),
      extraTimeAdded: formatExtraTimeMinutes(extraMinutes),
      reason,
    };
  }

  const originalSource = task.originalDeadline ?? task.deadline;
  const originalDueDate = formatTaskDetailDateTime(originalSource);

  let updatedEndingDueDate = "N/A";
  if (task.deadline) {
    const baseMs = new Date(task.deadline).getTime();
    if (!Number.isNaN(baseMs)) {
      const updated = new Date(baseMs + extraMinutes * 60_000);
      updatedEndingDueDate = formatTaskDetailDateTime(updated);
    }
  }

  return {
    originalDueDate,
    updatedEndingDueDate,
    extraTimeAdded: formatExtraTimeMinutes(extraMinutes),
    reason,
  };
}