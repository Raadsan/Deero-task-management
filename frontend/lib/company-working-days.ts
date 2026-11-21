/** JavaScript `Date#getDay()` index. Company policy: Friday is always off. */
export const FRIDAY_DAY_INDEX = 5;

/** Sun–Thu and Sat (default company working week). */
export const DEFAULT_COMPANY_WORKING_DAYS = [0, 1, 2, 3, 4, 6] as const;

/** Days users may toggle in schedule settings (Friday is fixed off). */
export const SELECTABLE_WORKING_DAY_INDICES = [0, 1, 2, 3, 4, 6] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const FRIDAY_NON_WORKING_DAY_MESSAGE =
  "Friday is a non-working day. Please select another working day.";

export const FRIDAY_LEGACY_SCHEDULE_WARNING =
  "This task is scheduled on Friday (non-working day). A manager should reschedule it to a working day.";

export function isFridayDayIndex(day: number) {
  return day === FRIDAY_DAY_INDEX;
}

export function parseCompanyIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").slice(0, 10));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function dayIndexFromIsoDate(value: string) {
  const parsed = parseCompanyIsoDate(value);
  if (!parsed) return null;
  return parsed.getDay();
}

export function isFridayIsoDate(value: string) {
  const day = dayIndexFromIsoDate(value);
  return day != null && isFridayDayIndex(day);
}

export function normalizeCompanyWorkingDays(workingDays?: number[] | null) {
  const source = Array.isArray(workingDays) && workingDays.length ? workingDays : [...DEFAULT_COMPANY_WORKING_DAYS];
  const unique = new Set<number>();
  for (const entry of source) {
    const day = Number(entry);
    if (!Number.isFinite(day) || isFridayDayIndex(day)) continue;
    if (day >= 0 && day <= 6) unique.add(day);
  }
  if (!unique.size) return [...DEFAULT_COMPANY_WORKING_DAYS];
  return [...unique].sort((a, b) => a - b);
}

export function resolveCompanyWorkingDays(workingDays?: number[] | null) {
  return normalizeCompanyWorkingDays(workingDays);
}

export function isCompanyWorkingDayIndex(day: number, workingDays?: number[] | null) {
  if (isFridayDayIndex(day)) return false;
  const allowed = new Set(resolveCompanyWorkingDays(workingDays));
  return allowed.has(day);
}

export function isCompanyWorkingIsoDate(value: string, workingDays?: number[] | null) {
  const day = dayIndexFromIsoDate(value);
  if (day == null) return false;
  return isCompanyWorkingDayIndex(day, workingDays);
}

/** Block newly scheduling or moving a task onto Friday. */
export function fridayScheduleErrorForChange(
  task: { id?: string; scheduledDate?: string; startTime?: string; endTime?: string },
  originalSchedules: Record<string, string>,
  signature: (task: { scheduledDate?: string; startTime?: string; endTime?: string }) => string,
) {
  const date = String(task.scheduledDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isFridayIsoDate(date)) return "";
  if (task.id && originalSchedules[task.id] === signature(task)) return "";
  return FRIDAY_NON_WORKING_DAY_MESSAGE;
}

/** Reschedule via task features: same Friday date is allowed (legacy); new Friday is not. */
export function fridayScheduleErrorForReschedule(
  before: { scheduledDate?: string | null } | null | undefined,
  after: { scheduledDate?: string | null } | null | undefined,
) {
  const next = String(after?.scheduledDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || !isFridayIsoDate(next)) return "";
  const prev = String(before?.scheduledDate || "").slice(0, 10);
  if (prev === next) return "";
  return FRIDAY_NON_WORKING_DAY_MESSAGE;
}

export function fridayLegacyScheduleWarning(task: { scheduledDate?: string }) {
  const date = String(task.scheduledDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isFridayIsoDate(date)) return "";
  return FRIDAY_LEGACY_SCHEDULE_WARNING;
}