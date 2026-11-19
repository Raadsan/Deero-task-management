import { zonedInstant } from "./scheduled-task-window.js";
import {
  presentInstallmentScheduleStatus,
  storedInstallmentStatus,
} from "./contract-installment-status.js";

const CONTRACT_DURATION_MONTHS = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
  TWELVE_MONTHS: 12,
};

export const PAYMENT_INTERVAL_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
};

const PAYMENT_TERM_MIN_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
};

export const ONE_TIME_PAYMENT_TERMS = ["ADVANCE_70_30", "ADVANCE_50_50", "FULL_ON_COMPLETION"];
export const MONTHLY_PAYMENT_TERMS = ["MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "ANNUALLY", "CUSTOM", "FULL_PAYMENT"];
export const BILLING_PERIOD_OPTIONS = [3, 6, 12];

const ONE_TIME_SPLITS = {
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

const MILESTONE_MONTHS = {
  AFTER_1_MONTH: 1,
  AFTER_3_MONTHS: 3,
  AFTER_6_MONTHS: 6,
  AFTER_12_MONTHS: 12,
};

export function durationMonths(duration) {
  if (duration === "ENDLESS") return null;
  return CONTRACT_DURATION_MONTHS[duration] ?? null;
}

export function getValidPaymentTermsForDuration(duration, contractType = "MONTHLY") {
  if (contractType === "ONE_TIME") return [...ONE_TIME_PAYMENT_TERMS];
  if (!duration) return [];
  const months = duration === "ENDLESS" ? 12 : durationMonths(duration);
  if (!months) return [];
  return MONTHLY_PAYMENT_TERMS.filter((term) => {
    const minimum = PAYMENT_TERM_MIN_MONTHS[term];
    return !minimum || months >= minimum;
  });
}

export function paymentTermsNeedReview(contract) {
  if (!contract?.paymentTerms || contract.contractType === "ONE_TIME") return false;
  if (ONE_TIME_PAYMENT_TERMS.includes(contract.paymentTerms)) return false;
  return !getValidPaymentTermsForDuration(contract.duration, "MONTHLY").includes(contract.paymentTerms);
}

function paymentTermsDurationError(duration, paymentTerms) {
  const minimum = PAYMENT_TERM_MIN_MONTHS[paymentTerms];
  const months = duration === "ENDLESS" ? 12 : durationMonths(duration);
  if (minimum && months && months < minimum) {
    return `This payment term needs a contract of at least ${minimum} months`;
  }
  return "Payment terms are not available for this contract duration";
}

function advanceDueDates(start, months, interval) {
  const dueDates = [];
  for (let offset = 0; offset < months; offset += interval) {
    dueDates.push(atNoon(addMonths(start, offset)));
  }
  return dueDates;
}

export function countInstallments(duration, paymentTerms, billingPeriodMonths) {
  if (paymentTerms === "FULL_PAYMENT" || ONE_TIME_PAYMENT_TERMS.includes(paymentTerms)) return 1;
  const interval = PAYMENT_INTERVAL_MONTHS[paymentTerms];
  if (!interval) return 0;
  const months = duration === "ENDLESS" ? Number(billingPeriodMonths) : durationMonths(duration);
  if (!months || months < 1) return 0;
  return Math.max(1, Math.ceil(months / interval));
}

function addMonths(date, monthsToAdd) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + monthsToAdd);
  return next;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function amountsFromWeights(total, weights) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return roundMoney(total - allocated);
    const amount = Math.floor(((total * weight) / weightSum) * 100) / 100;
    allocated = roundMoney(allocated + amount);
    return amount;
  });
}

function percentagesFromWeights(weights) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return roundMoney(100 - allocated);
    const percentage = Math.floor(((weight / weightSum) * 100) * 100) / 100;
    allocated = roundMoney(allocated + percentage);
    return percentage;
  });
}

function dayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stampDueTime(due, time) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time || "").trim());
  if (!match) return due;
  return zonedInstant(dayKey(due), `${match[1]}:${match[2]}`) || due;
}

function atNoon(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function milestoneDate(milestone, start, endDate) {
  if (milestone === "CONTRACT_START") return atNoon(start);
  if (milestone === "CONTRACT_COMPLETION") return endDate ? atNoon(endDate) : null;
  const months = MILESTONE_MONTHS[milestone];
  if (!months) return null;
  return atNoon(addMonths(start, months));
}

function scheduleSpanMonths(duration, billingPeriodMonths) {
  if (duration === "ENDLESS") {
    const months = Number(billingPeriodMonths);
    return BILLING_PERIOD_OPTIONS.includes(months) ? months : null;
  }
  return durationMonths(duration);
}

/**
 * @returns {{ installments: Array<{ installmentNumber: number, dueDate: Date, dueAmount: number, percentage: number, dueMilestone: string }>, count: number, installmentAmount: number, error?: string }}
 */
export function buildInstallmentSchedule({
  contractType = "MONTHLY",
  duration,
  totalAmount,
  paymentTerms,
  startDate,
  endDate,
  billingPeriodMonths,
  installments: customInstallments,
}) {
  const amount = Number(totalAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Invalid contract amount" };
  }
  if (!paymentTerms) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Payment terms required" };
  }
  if (!startDate) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Start date required" };
  }

  const type = contractType === "ONE_TIME" || ONE_TIME_PAYMENT_TERMS.includes(paymentTerms)
    ? "ONE_TIME"
    : "MONTHLY";
  const validTerms = getValidPaymentTermsForDuration(duration, type);
  if (!validTerms.includes(paymentTerms)) {
    return {
      installments: [],
      count: 0,
      installmentAmount: 0,
      error: paymentTermsDurationError(duration, paymentTerms),
    };
  }

  const start = atNoon(startDate);
  if (Number.isNaN(start.getTime())) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Invalid start date" };
  }

  if (type === "ONE_TIME") {
    if (!endDate) {
      return { installments: [], count: 0, installmentAmount: 0, error: "Completion date is required" };
    }
    const completion = atNoon(endDate);
    if (Number.isNaN(completion.getTime()) || completion < start) {
      return { installments: [], count: 0, installmentAmount: 0, error: "Completion date must not be earlier than the start date" };
    }
    const parts = ONE_TIME_SPLITS[paymentTerms];
    const amounts = amountsFromWeights(amount, parts.map((part) => part.percentage || 0.000001));
    const installments = parts.map((part, index) => ({
      installmentNumber: index + 1,
      dueDate: part.milestone === "CONTRACT_START" ? start : completion,
      dueAmount: part.percentage === 0 ? 0 : amounts[index],
      percentage: part.percentage,
      dueMilestone: part.milestone,
    }));
    const paidTotal = roundMoney(installments.reduce((sum, row) => sum + row.dueAmount, 0));
    if (paidTotal !== roundMoney(amount)) {
      installments[installments.length - 1].dueAmount = roundMoney(
        installments[installments.length - 1].dueAmount + (amount - paidTotal),
      );
    }
    return { installments, count: installments.length, installmentAmount: installments[0].dueAmount };
  }

  if (paymentTerms === "CUSTOM") {
    return buildCustomSchedule({ amount, start, endDate, duration, customInstallments });
  }

  if (duration === "ENDLESS" && !scheduleSpanMonths(duration, billingPeriodMonths)) {
    return {
      installments: [],
      count: 0,
      installmentAmount: 0,
      error: "Endless contracts need a billing period or a custom payment arrangement",
    };
  }

  const months = scheduleSpanMonths(duration, billingPeriodMonths);
  if (!months) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Contract duration is required" };
  }
  if (duration === "ENDLESS") {
    const minimum = PAYMENT_TERM_MIN_MONTHS[paymentTerms];
    if (minimum && months < minimum) {
      return { installments: [], count: 0, installmentAmount: 0, error: "The billing period is shorter than this payment term" };
    }
  }

  if (paymentTerms === "FULL_PAYMENT") {
    return {
      installments: [{
        installmentNumber: 1,
        dueDate: start,
        dueAmount: roundMoney(amount),
        percentage: 100,
        dueMilestone: "CONTRACT_START",
      }],
      count: 1,
      installmentAmount: roundMoney(amount),
    };
  }

  const interval = PAYMENT_INTERVAL_MONTHS[paymentTerms];
  if (!interval) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Payment terms are not available for this contract duration" };
  }
  const dueDates = advanceDueDates(start, months, interval);
  if (!dueDates.length) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Could not build a payment schedule" };
  }
  const weights = dueDates.map(() => 1);
  const percentages = percentagesFromWeights(weights);
  const amounts = amountsFromWeights(amount, weights);
  const installments = dueDates.map((dueDate, index) => ({
    installmentNumber: index + 1,
    dueDate,
    dueAmount: amounts[index],
    percentage: percentages[index],
    dueMilestone: paymentTerms,
  }));

  return {
    installments,
    count: installments.length,
    installmentAmount: installments[0]?.dueAmount ?? 0,
  };
}

function buildCustomSchedule({ amount, start, endDate, duration, customInstallments }) {
  const rows = Array.isArray(customInstallments) ? customInstallments : [];
  if (!rows.length) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Add at least one payment installment" };
  }
  const completion = endDate ? atNoon(endDate) : null;
  if (duration !== "ENDLESS" && !completion) {
    return { installments: [], count: 0, installmentAmount: 0, error: "End date is required" };
  }

  const seenMilestones = new Set();
  const seenDates = new Set();
  let percentageTotal = 0;
  const prepared = [];

  for (const row of rows) {
    const percentage = Number(row.percentage);
    if (!Number.isFinite(percentage) || percentage <= 0) {
      return { installments: [], count: 0, installmentAmount: 0, error: "Payment percentages must be greater than zero" };
    }
    const milestone = String(row.milestone || row.dueMilestone || "");
    if (!milestone) {
      return { installments: [], count: 0, installmentAmount: 0, error: "Each payment needs a due milestone" };
    }
    if (milestone !== "CUSTOM_DATE") {
      if (seenMilestones.has(milestone)) {
        return { installments: [], count: 0, installmentAmount: 0, error: "Payment milestones cannot be duplicated" };
      }
      seenMilestones.add(milestone);
    }
    if (duration === "ENDLESS" && milestone === "CONTRACT_COMPLETION") {
      return { installments: [], count: 0, installmentAmount: 0, error: "Endless contracts have no completion date. Choose a custom date." };
    }

    let due = milestone === "CUSTOM_DATE" && row.dueDate ? atNoon(row.dueDate) : milestoneDate(milestone, start, completion);
    if (!due || Number.isNaN(due.getTime())) {
      return { installments: [], count: 0, installmentAmount: 0, error: "Each payment needs a valid due date" };
    }
    const dueKey = dayKey(due);
    if (dueKey < dayKey(start) || (completion && dueKey > dayKey(completion))) {
      return { installments: [], count: 0, installmentAmount: 0, error: "Payment due dates must follow the contract timeline" };
    }
    due = stampDueTime(due, row.dueTime || row.due_time);
    const dateKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    if (seenDates.has(dateKey)) {
      return { installments: [], count: 0, installmentAmount: 0, error: "Payment due dates cannot be duplicated" };
    }
    seenDates.add(dateKey);
    percentageTotal = roundMoney(percentageTotal + percentage);
    prepared.push({ percentage, milestone, dueDate: due });
  }

  if (percentageTotal !== 100) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Payment percentages must total exactly 100%" };
  }

  prepared.sort((a, b) => a.dueDate - b.dueDate);
  const amounts = amountsFromWeights(amount, prepared.map((row) => row.percentage));
  const installments = prepared.map((row, index) => ({
    installmentNumber: index + 1,
    dueDate: row.dueDate,
    dueAmount: amounts[index],
    percentage: row.percentage,
    dueMilestone: row.milestone,
  }));
  if (installments.some((row) => row.dueAmount < 0)) {
    return { installments: [], count: 0, installmentAmount: 0, error: "Payment amounts cannot be negative" };
  }
  return { installments, count: installments.length, installmentAmount: installments[0].dueAmount };
}

export async function syncContractInstallments(tx, contract, customInstallments) {
  if (!contract?.id || !contract.paymentTerms || !contract.startDate) return;

  const { installments, error } = buildInstallmentSchedule({
    contractType: contract.contractType,
    duration: contract.duration,
    totalAmount: contract.totalAmount,
    paymentTerms: contract.paymentTerms,
    startDate: contract.startDate,
    endDate: contract.endDate,
    billingPeriodMonths: contract.billingPeriodMonths,
    installments: customInstallments,
  });
  if (error || !installments.length) {
    throw new Error(error || "Payment schedule could not be created");
  }

  const existing = await tx.clientInstallment.findMany({
    where: { contractId: contract.id },
  });

  const protectedRows = existing.filter(
    (row) =>
      row.paidAmount > 0 || row.status === "PAID" || row.status === "PARTIAL",
  );
  const protectedIds = protectedRows.map((row) => row.id);
  const protectedNumbers = new Set(
    protectedRows.map((row) => row.installmentNumber).filter((n) => n != null),
  );

  await tx.clientInstallment.deleteMany({
    where: {
      contractId: contract.id,
      status: "PENDING",
      paidAmount: 0,
      ...(protectedIds.length ? { id: { notIn: protectedIds } } : {}),
    },
  });

  for (const item of installments) {
    if (protectedNumbers.has(item.installmentNumber)) continue;

    const due = item.dueDate;
    const now = new Date();
    const initialStatus = storedInstallmentStatus(
      presentInstallmentScheduleStatus(
        { dueAmount: item.dueAmount, paidAmount: 0, dueDate: due },
        null,
        now,
      ),
    );
    const sourceKey = `contract:${contract.id}:i:${item.installmentNumber}`;
    const periodYear = due.getFullYear();
    const periodMonth = due.getMonth() + 1;

    const conflict = await tx.clientInstallment.findUnique({
      where: {
        sourceKey_periodYear_periodMonth: {
          sourceKey,
          periodYear,
          periodMonth,
        },
      },
    });

    if (conflict) {
      if (conflict.paidAmount > 0 || conflict.status === "PAID" || conflict.status === "PARTIAL") {
        continue;
      }
      await tx.clientInstallment.update({
        where: { id: conflict.id },
        data: {
          dueDate: due,
          dueAmount: item.dueAmount,
          installmentNumber: item.installmentNumber,
          percentage: item.percentage ?? null,
          dueMilestone: item.dueMilestone ?? null,
          status: initialStatus,
        },
      });
      continue;
    }

    await tx.clientInstallment.create({
      data: {
        sourceKey,
        periodYear,
        periodMonth,
        dueDate: due,
        dueAmount: item.dueAmount,
        paidAmount: 0,
        status: initialStatus,
        percentage: item.percentage ?? null,
        dueMilestone: item.dueMilestone ?? null,
        clientId: contract.clientId,
        contractId: contract.id,
        installmentNumber: item.installmentNumber,
      },
    });
  }
}
