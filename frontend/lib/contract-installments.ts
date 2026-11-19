import type { ContractDuration } from "@/lib/client-types";
import {
  computeInstallmentScheduleStatus,
  type InstallmentScheduleStatus,
} from "@/lib/installment-schedule-status";

const DURATION_MONTHS: Record<string, number> = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
  TWELVE_MONTHS: 12,
};

export const PAYMENT_INTERVAL_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
};

const PAYMENT_TERM_MIN_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
};

export const ONE_TIME_PAYMENT_TERMS = ["ADVANCE_70_30", "ADVANCE_50_50", "FULL_ON_COMPLETION"];
export const MONTHLY_PAYMENT_TERMS = ["MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "ANNUALLY", "CUSTOM", "FULL_PAYMENT"];
export const BILLING_PERIOD_OPTIONS = [3, 6, 12];

export const PAYMENT_MILESTONES = [
  { value: "CONTRACT_START", label: "Contract Start" },
  { value: "AFTER_1_MONTH", label: "After 1 Month" },
  { value: "AFTER_3_MONTHS", label: "After 3 Months" },
  { value: "AFTER_6_MONTHS", label: "After 6 Months" },
  { value: "AFTER_12_MONTHS", label: "After 12 Months" },
  { value: "CONTRACT_COMPLETION", label: "Contract Completion" },
  { value: "CUSTOM_DATE", label: "Custom date" },
] as const;

const ONE_TIME_SPLITS: Record<string, Array<{ percentage: number; milestone: string }>> = {
  ADVANCE_70_30: [
    { percentage: 70, milestone: "CONTRACT_START" },
    { percentage: 30, milestone: "CONTRACT_COMPLETION" },
  ],
  ADVANCE_50_50: [
    { percentage: 50, milestone: "CONTRACT_START" },
    { percentage: 50, milestone: "CONTRACT_COMPLETION" },
  ],
  FULL_ON_COMPLETION: [
    { percentage: 0, milestone: "CONTRACT_START" },
    { percentage: 100, milestone: "CONTRACT_COMPLETION" },
  ],
};

const MILESTONE_MONTHS: Record<string, number> = {
  AFTER_1_MONTH: 1,
  AFTER_3_MONTHS: 3,
  AFTER_6_MONTHS: 6,
  AFTER_12_MONTHS: 12,
};

export type CustomInstallmentInput = {
  percentage: number;
  milestone: string;
  dueDate?: string;
  dueTime?: string;
};

export type InstallmentPreviewRow = {
  installmentNumber: number;
  dueDate: string;
  dueAmount: number;
  percentage: number;
  dueMilestone: string;
  dueTime?: string;
  status: InstallmentScheduleStatus;
};

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function amountsFromWeights(total: number, weights: number[]) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return roundMoney(total - allocated);
    const amount = Math.floor(((total * weight) / weightSum) * 100) / 100;
    allocated = roundMoney(allocated + amount);
    return amount;
  });
}

function percentagesFromWeights(weights: number[]) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return roundMoney(100 - allocated);
    const percentage = Math.floor(((weight / weightSum) * 100) * 100) / 100;
    allocated = roundMoney(allocated + percentage);
    return percentage;
  });
}

function parseDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addMonths(date: Date, monthsToAdd: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + monthsToAdd);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  next.setHours(12, 0, 0, 0);
  return next;
}

function milestoneDate(milestone: string, start: Date, end: Date | null) {
  if (milestone === "CONTRACT_START") return start;
  if (milestone === "CONTRACT_COMPLETION") return end;
  const months = MILESTONE_MONTHS[milestone];
  if (!months) return null;
  return addMonths(start, months);
}

function scheduleStatus(dueDate: string, dueAmount: number): InstallmentScheduleStatus {
  return computeInstallmentScheduleStatus({
    dueAmount,
    paidAmount: 0,
    dueDate,
  });
}

export function getValidPaymentTermsForDuration(duration: string, contractType = "MONTHLY") {
  if (contractType === "ONE_TIME") return [...ONE_TIME_PAYMENT_TERMS];
  if (!duration) return [];
  const months = duration === "ENDLESS" ? 12 : DURATION_MONTHS[duration];
  if (!months) return [];
  return MONTHLY_PAYMENT_TERMS.filter((term) => {
    const minimum = PAYMENT_TERM_MIN_MONTHS[term];
    return !minimum || months >= minimum;
  });
}

export function buildInstallmentPreview(input: {
  contractType?: "ONE_TIME" | "MONTHLY" | string;
  duration?: ContractDuration | string | null;
  totalAmount: number;
  paymentTerms: string;
  startDate: string;
  endDate?: string | null;
  billingPeriodMonths?: number | null;
  installments?: CustomInstallmentInput[];
}): {
  installments: InstallmentPreviewRow[];
  count: number;
  installmentAmount: number;
  totalAmount: number;
  error?: string;
} {
  const totalAmount = Number(input.totalAmount);
  const fail = (error: string) => ({
    installments: [] as InstallmentPreviewRow[],
    count: 0,
    installmentAmount: 0,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    error,
  });

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return fail("Enter a valid contract amount");
  if (!input.paymentTerms || !input.startDate) {
    return { installments: [], count: 0, installmentAmount: 0, totalAmount };
  }

  const type = input.contractType === "ONE_TIME" || ONE_TIME_PAYMENT_TERMS.includes(input.paymentTerms)
    ? "ONE_TIME"
    : "MONTHLY";
  const start = parseDate(input.startDate);
  if (!start) return fail("Invalid start date");
  const end = input.endDate ? parseDate(input.endDate) : null;

  let rows: Array<{ due: Date; amount: number; percentage: number; milestone: string; dueTime?: string }> = [];

  if (type === "ONE_TIME") {
    if (!end || end < start) return fail("Completion date must not be earlier than the start date");
    const parts = ONE_TIME_SPLITS[input.paymentTerms];
    if (!parts) return fail("Payment terms are not available for this contract type");
    const amounts = amountsFromWeights(totalAmount, parts.map((part) => part.percentage || 0.000001));
    rows = parts.map((part, index) => ({
      due: part.milestone === "CONTRACT_START" ? start : end,
      amount: part.percentage === 0 ? 0 : amounts[index],
      percentage: part.percentage,
      milestone: part.milestone,
    }));
    const paid = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
    if (paid !== roundMoney(totalAmount)) {
      rows[rows.length - 1].amount = roundMoney(rows[rows.length - 1].amount + (totalAmount - paid));
    }
  } else if (input.paymentTerms === "CUSTOM") {
    const custom = input.installments ?? [];
    if (!custom.length) return fail("Add at least one payment installment");
    if (input.duration !== "ENDLESS" && !end) return fail("End date is required");
    const seenMilestones = new Set<string>();
    const seenDates = new Set<string>();
    let percentageTotal = 0;
    const prepared: Array<{ due: Date; percentage: number; milestone: string; dueTime?: string }> = [];
    for (const row of custom) {
      const percentage = Number(row.percentage);
      if (!Number.isFinite(percentage) || percentage <= 0) return fail("Payment percentages must be greater than zero");
      if (!row.milestone) return fail("Each payment needs a due milestone");
      if (row.milestone !== "CUSTOM_DATE") {
        if (seenMilestones.has(row.milestone)) return fail("Payment milestones cannot be duplicated");
        seenMilestones.add(row.milestone);
      }
      if (input.duration === "ENDLESS" && row.milestone === "CONTRACT_COMPLETION") {
        return fail("Endless contracts have no completion date. Choose a custom date.");
      }
      const due = row.milestone === "CUSTOM_DATE" && row.dueDate
        ? parseDate(row.dueDate)
        : milestoneDate(row.milestone, start, end);
      if (!due) return fail("Each payment needs a valid due date");
      if (due < start || (end && due > end)) return fail("Payment due dates must follow the contract timeline");
      const key = dateKey(due);
      if (seenDates.has(key)) return fail("Payment due dates cannot be duplicated");
      seenDates.add(key);
      percentageTotal = roundMoney(percentageTotal + percentage);
      prepared.push({
        due,
        percentage,
        milestone: row.milestone,
        dueTime: /^\d{2}:\d{2}$/.test(String(row.dueTime || "")) ? String(row.dueTime) : "00:00",
      });
    }
    if (percentageTotal !== 100) return fail("Payment percentages must total exactly 100%");
    prepared.sort((a, b) => a.due.getTime() - b.due.getTime());
    const amounts = amountsFromWeights(totalAmount, prepared.map((row) => row.percentage));
    rows = prepared.map((row, index) => ({
      due: row.due,
      amount: amounts[index],
      percentage: row.percentage,
      milestone: row.milestone,
      dueTime: row.dueTime,
    }));
  } else if (input.paymentTerms === "FULL_PAYMENT") {
    rows = [{ due: start, amount: roundMoney(totalAmount), percentage: 100, milestone: "CONTRACT_START" }];
  } else {
    const months = input.duration === "ENDLESS" ? Number(input.billingPeriodMonths) : DURATION_MONTHS[String(input.duration || "")];
    if (input.duration === "ENDLESS" && !BILLING_PERIOD_OPTIONS.includes(Number(input.billingPeriodMonths))) {
      return fail("Endless contracts need a billing period or a custom payment arrangement");
    }
    if (!months) return fail("Contract duration is required");
    const minimumMonths = PAYMENT_TERM_MIN_MONTHS[input.paymentTerms];
    if (input.duration === "ENDLESS" && minimumMonths && months < minimumMonths) {
      return fail("The billing period is shorter than this payment term");
    }
    const allowed = getValidPaymentTermsForDuration(String(input.duration || ""), "MONTHLY");
    if (!allowed.includes(input.paymentTerms)) {
      return fail("This payment term is not available for the selected contract duration");
    }
    const interval = PAYMENT_INTERVAL_MONTHS[input.paymentTerms];
    if (!interval) return fail("Payment terms are not available for this contract duration");
    const dueDates: Date[] = [];
    for (let offset = 0; offset < months; offset += interval) {
      dueDates.push(addMonths(start, offset));
    }
    if (!dueDates.length) return fail("Could not build a payment schedule");
    const weights = dueDates.map(() => 1);
    const percentages = percentagesFromWeights(weights);
    const amounts = amountsFromWeights(totalAmount, weights);
    rows = dueDates.map((due, index) => ({
      due,
      amount: amounts[index],
      percentage: percentages[index],
      milestone: input.paymentTerms,
    }));
  }

  if (rows.some((row) => row.amount < 0)) return fail("Payment amounts cannot be negative");
  const installments = rows.map((row, index) => {
    const dueDate = dateKey(row.due);
    return {
      installmentNumber: index + 1,
      dueDate,
      dueAmount: row.amount,
      percentage: row.percentage,
      dueMilestone: row.milestone,
      dueTime: "dueTime" in row ? row.dueTime : undefined,
      status: scheduleStatus(dueDate, row.amount),
    };
  });
  return {
    installments,
    count: installments.length,
    installmentAmount: installments[0]?.dueAmount ?? 0,
    totalAmount,
  };
}
