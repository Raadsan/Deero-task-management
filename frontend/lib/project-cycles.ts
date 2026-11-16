function addMonths(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const index = month - 1 + months;
  const nextYear = year + Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type ProjectCycleRange = { label: string; startDate: string; endDate: string };

/** Consecutive monthly windows from the contract start through the contract end. */
export function buildMonthlyCycles(startDate: string, endDate: string): ProjectCycleRange[] {
  const start = String(startDate || "").slice(0, 10);
  const end = String(endDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return [];
  const cycles: ProjectCycleRange[] = [];
  let cursor = start;
  let number = 1;
  while (cursor <= end && number <= 120) {
    const nextStart = addMonths(cursor, 1);
    let cycleEnd = addDays(nextStart, -1);
    if (cycleEnd > end) cycleEnd = end;
    cycles.push({ label: `Month ${number}`, startDate: cursor, endDate: cycleEnd });
    if (cycleEnd >= end) break;
    cursor = addDays(cycleEnd, 1);
    number += 1;
  }
  return cycles;
}

export function contractProjectType(contract?: { contractType?: string | null; paymentTerms?: string | null } | null) {
  if (!contract) return "";
  if (contract.contractType === "ONE_TIME") return "ONE_TIME";
  if (["ADVANCE_70_30", "ADVANCE_50_50", "FULL_ON_COMPLETION"].includes(String(contract.paymentTerms || ""))) {
    return "ONE_TIME";
  }
  return "MONTHLY";
}

export function openingCycle(startDate: string): ProjectCycleRange[] {
  const start = String(startDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  return [{ label: "Month 1", startDate: start, endDate: addDays(addMonths(start, 1), -1) }];
}

export function contractDate(value?: string | null) {
  if (!value) return "";
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}
