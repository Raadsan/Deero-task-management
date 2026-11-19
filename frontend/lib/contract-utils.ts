import type { ContractDuration } from "@/lib/client-types";

const DURATION_MONTHS: Record<string, number> = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
  TWELVE_MONTHS: 12,
};

export function calculateContractEndDate(
  startDate: string,
  duration: ContractDuration | string,
): string | null {
  if (!startDate || duration === "ENDLESS") return null;
  const months = DURATION_MONTHS[duration];
  if (!months) return null;

  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);

  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function contractDurationLabel(duration?: string | null) {
  const map: Record<string, string> = {
    ONE_MONTH: "1 Month",
    THREE_MONTHS: "3 Months",
    SIX_MONTHS: "6 Months",
    TWELVE_MONTHS: "12 Months",
    ENDLESS: "Endless",
  };
  return duration ? map[duration] ?? duration : "—";
}

export function contractTypeLabel(value?: string | null) {
  if (value === "ONE_TIME") return "One-time";
  if (value === "MONTHLY") return "Monthly";
  return "Monthly";
}

export function contractPaymentTermsLabel(value?: string | null) {
  const map: Record<string, string> = {
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    SEMI_ANNUALLY: "Semi-Annual",
    ANNUALLY: "Annual",
    FULL_PAYMENT: "Full Payment",
    CUSTOM: "Custom percentage",
    ADVANCE_70_30: "70% Advance / 30% Completion",
    ADVANCE_50_50: "50% Advance / 50% Completion",
    FULL_ON_COMPLETION: "Full Payment on Completion",
  };
  return value ? map[value] ?? value : "—";
}

export function paymentMilestoneLabel(value?: string | null) {
  const map: Record<string, string> = {
    CONTRACT_START: "Contract Start",
    AFTER_1_MONTH: "After 1 Month",
    AFTER_3_MONTHS: "After 3 Months",
    AFTER_6_MONTHS: "After 6 Months",
    AFTER_12_MONTHS: "After 12 Months",
    CONTRACT_COMPLETION: "Contract Completion",
    CUSTOM_DATE: "Custom date",
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    SEMI_ANNUALLY: "Semi-Annual",
    ANNUALLY: "Annual",
  };
  return value ? map[value] ?? value : "—";
}

export function paymentStatusLabel(value?: string | null) {
  const map: Record<string, string> = {
    PENDING: "Pending",
    UNPAID: "Unpaid",
    PAID: "Paid",
    PARTIAL: "Unpaid",
    PARTIALLY_PAID: "Unpaid",
    OVERDUE: "Unpaid",
  };
  const key = String(value || "PENDING").toUpperCase();
  return map[key] ?? "Pending";
}
