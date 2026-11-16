function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function addMonths(iso, months) {
  const [year, month, day] = iso.split("-").map(Number);
  const index = month - 1 + months;
  const nextYear = year + Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Consecutive monthly windows from the contract start through the contract end. */
export function buildMonthlyCycles(startDate, endDate) {
  const start = isoDate(startDate);
  const end = isoDate(endDate);
  if (!start || !end || start > end) return [];
  const cycles = [];
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

export function firstMonthlyCycle(startDate) {
  const start = isoDate(startDate);
  if (!start) return [];
  return [{ label: "Month 1", startDate: start, endDate: addDays(addMonths(start, 1), -1) }];
}

export function contractProjectType(contract) {
  if (!contract) return "";
  if (contract.contractType === "ONE_TIME") return "ONE_TIME";
  if (["ADVANCE_70_30", "ADVANCE_50_50", "FULL_ON_COMPLETION"].includes(String(contract.paymentTerms || ""))) {
    return "ONE_TIME";
  }
  return "MONTHLY";
}

export { isoDate, addDays, addMonths };
