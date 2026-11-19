/** Contract payment schedule statuses: PENDING | UNPAID | PAID (display). */

export function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * @param {{ dueAmount: number, paidAmount?: number, dueDate: Date|string }} installment
 * @param {{ paid_amount?: number, state?: string }|null} [invoice]
 */
export function presentInstallmentScheduleStatus(installment, invoice = null, now = new Date()) {
  const dueAmount = roundMoney(installment.dueAmount);
  const paid = roundMoney(
    invoice && invoice.state !== "cancelled"
      ? invoice.paid_amount
      : installment.paidAmount,
  );
  if (dueAmount > 0 && paid + 0.005 >= dueAmount) return "PAID";
  const dueDay = startOfDay(installment.dueDate);
  const today = startOfDay(now);
  if (today < dueDay) return "PENDING";
  return "UNPAID";
}

/** Map display status to persisted InstallmentStatus enum value. */
export function storedInstallmentStatus(displayStatus) {
  if (displayStatus === "PAID") return "PAID";
  if (displayStatus === "UNPAID") return "PARTIAL";
  return "PENDING";
}

/** Normalize legacy DB values to display status. Recompute when installment context is available. */
export function normalizeStoredInstallmentStatus(storedStatus) {
  const raw = String(storedStatus || "").toUpperCase();
  if (raw === "PAID") return "PAID";
  if (raw === "PENDING") return "PENDING";
  if (raw === "UNPAID" || raw === "PARTIAL" || raw === "OVERDUE" || raw === "PARTIALLY_PAID") {
    return "UNPAID";
  }
  return "PENDING";
}

export function installmentScheduleDisplayLabel(status) {
  const key = normalizeStoredInstallmentStatus(status);
  const map = { PENDING: "Pending", UNPAID: "Unpaid", PAID: "Paid" };
  return map[key] || "Pending";
}

/** @deprecated Use presentInstallmentScheduleStatus */
export function presentInstallmentStatus(installment, invoice, now = new Date()) {
  return presentInstallmentScheduleStatus(installment, invoice, now);
}

/** @deprecated Use storedInstallmentStatus */
export function storedStatus(display) {
  return storedInstallmentStatus(display);
}