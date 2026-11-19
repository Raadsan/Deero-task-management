export type InstallmentScheduleStatus = "PENDING" | "UNPAID" | "PAID";

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function startOfDay(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function computeInstallmentScheduleStatus(params: {
  dueAmount: number;
  paidAmount?: number;
  dueDate: string | Date;
  now?: Date;
}): InstallmentScheduleStatus {
  const dueAmount = roundMoney(params.dueAmount);
  const paid = roundMoney(params.paidAmount ?? 0);
  if (dueAmount > 0 && paid + 0.005 >= dueAmount) return "PAID";
  const dueDay = startOfDay(params.dueDate);
  const today = startOfDay(params.now ?? new Date());
  if (today < dueDay) return "PENDING";
  return "UNPAID";
}

export function normalizeInstallmentScheduleStatus(
  raw?: string | null,
): InstallmentScheduleStatus {
  const value = String(raw || "").toUpperCase();
  if (value === "PAID") return "PAID";
  if (value === "PENDING") return "PENDING";
  if (
    value === "UNPAID"
    || value === "PARTIAL"
    || value === "OVERDUE"
    || value === "PARTIALLY_PAID"
  ) {
    return "UNPAID";
  }
  return "PENDING";
}