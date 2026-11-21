/** JavaScript `Date#getDay()` index. Company policy: Friday is always off. */
export const FRIDAY_DAY_INDEX = 5;

export const DEFAULT_COMPANY_WORKING_DAYS = [0, 1, 2, 3, 4, 6];

export const FRIDAY_NON_WORKING_DAY_MESSAGE =
  "Friday is a non-working day. Please select another working day.";

export function isFridayDayIndex(day) {
  return Number(day) === FRIDAY_DAY_INDEX;
}

function parseIso(value) {
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isFridayIsoDate(value) {
  const parsed = parseIso(value);
  if (!parsed) return false;
  return isFridayDayIndex(parsed.getDay());
}

export function normalizeCompanyWorkingDays(workingDays) {
  const source = Array.isArray(workingDays) && workingDays.length ? workingDays : DEFAULT_COMPANY_WORKING_DAYS;
  const unique = new Set();
  for (const entry of source) {
    const day = Number(entry);
    if (!Number.isFinite(day) || isFridayDayIndex(day)) continue;
    if (day >= 0 && day <= 6) unique.add(day);
  }
  if (!unique.size) return [...DEFAULT_COMPANY_WORKING_DAYS];
  return [...unique].sort((a, b) => a - b);
}

export function resolveCompanyWorkingDays(workingDays) {
  return normalizeCompanyWorkingDays(workingDays);
}

export function workingDatesFromRange(start, end, workingDays) {
  const days = new Set(resolveCompanyWorkingDays(workingDays));
  const dates = [];
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const last = new Date(end);
  last.setHours(12, 0, 0, 0);
  while (cursor <= last && dates.length < 400) {
    if (days.has(cursor.getDay())) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length ? dates : [new Date(start)];
}

export function fridayScheduleErrorForTask(task, savedSchedules, scheduleSignature) {
  const date = String(task?.scheduledDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isFridayIsoDate(date)) return "";
  if (task?.id && savedSchedules.get(String(task.id)) === scheduleSignature(task)) return "";
  return FRIDAY_NON_WORKING_DAY_MESSAGE;
}

export function fridayScheduleErrorForReschedule(before, after) {
  const next = String(after?.scheduledDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || !isFridayIsoDate(next)) return "";
  const prev = String(before?.scheduledDate || "").slice(0, 10);
  if (prev === next) return "";
  return FRIDAY_NON_WORKING_DAY_MESSAGE;
}