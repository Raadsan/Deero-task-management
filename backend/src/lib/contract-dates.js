import { buildInstallmentSchedule, ONE_TIME_PAYMENT_TERMS } from "./contract-installments.js";

export const CONTRACT_DURATION_MONTHS = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
  TWELVE_MONTHS: 12,
};

/** End date = start + N months − 1 day (inclusive period). Endless → null. */
export function calculateContractEndDate(startDateInput, duration) {
  if (!startDateInput || duration === "ENDLESS") return null;
  const months = CONTRACT_DURATION_MONTHS[duration];
  if (!months) return null;

  const start = new Date(startDateInput);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  return end;
}

export function validateContractRegistration(data, { isUpdate = false } = {}) {
  const errors = [];
  const contractType = ONE_TIME_PAYMENT_TERMS.includes(String(data.paymentTerms || ""))
    || data.contractType === "ONE_TIME"
    ? "ONE_TIME"
    : "MONTHLY";

  if (!isUpdate || data.clientId !== undefined) {
    if (!data.clientId) errors.push("Client is required");
  }
  if (!isUpdate || data.title !== undefined) {
    if (!String(data.title ?? "").trim()) errors.push("Contract title is required");
  }
  if (contractType === "MONTHLY" && (!isUpdate || data.duration !== undefined)) {
    const duration = String(data.duration ?? "");
    if (!duration) errors.push("Duration is required");
    else if (duration !== "ENDLESS" && !CONTRACT_DURATION_MONTHS[duration]) {
      errors.push("Invalid duration");
    }
  }
  if (!isUpdate || data.startDate !== undefined) {
    if (!data.startDate) errors.push("Start date is required");
  }
  if (!isUpdate || data.totalAmount !== undefined) {
    const amount = Number(data.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push("Contract amount must be greater than zero");
    }
  }
  if (!isUpdate || data.paymentTerms !== undefined) {
    if (!String(data.paymentTerms ?? "").trim()) errors.push("Payment terms is required");
  }
  if (!isUpdate || data.status !== undefined) {
    if (!String(data.status ?? "").trim()) errors.push("Status is required");
  }

  const duration = contractType === "ONE_TIME" ? "" : String(data.duration ?? "");
  const startDate = data.startDate ? new Date(data.startDate) : null;
  let endDate = null;

  if (contractType === "ONE_TIME") {
    if (!data.endDate) errors.push("Completion date is required");
    else if (startDate) {
      const completion = new Date(data.endDate);
      if (Number.isNaN(completion.getTime()) || completion < startDate) {
        errors.push("Completion date must not be earlier than the start date");
      } else {
        endDate = completion;
      }
    }
  } else if (duration === "ENDLESS") {
    endDate = null;
    if (data.endDate) {
      errors.push("Endless contracts must not have an end date");
    }
  } else if (startDate && !Number.isNaN(startDate.getTime()) && CONTRACT_DURATION_MONTHS[duration]) {
    endDate = calculateContractEndDate(startDate, duration);
    if (data.endDate) {
      const manual = new Date(data.endDate);
      if (!Number.isNaN(manual.getTime())) {
        if (manual < startDate) {
          errors.push("End date must not be earlier than start date");
        }
        endDate = manual;
      }
    }
  }

  if (!errors.length && data.paymentTerms && data.startDate && data.totalAmount) {
    const schedule = buildInstallmentSchedule({
      contractType,
      duration: contractType === "ONE_TIME" ? null : duration,
      totalAmount: data.totalAmount,
      paymentTerms: data.paymentTerms,
      startDate: data.startDate,
      endDate,
      billingPeriodMonths: data.billingPeriodMonths,
      installments: data.installments,
    });
    if (schedule.error) errors.push(schedule.error);
  }

  return { errors, endDate, contractType };
}
