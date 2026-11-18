import prisma from "../config/db.js";
import { decorateContractInstallments } from "./contract-invoice-scheduler.js";

const MILESTONE_LABELS = {
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

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

function isoDay(value) {
  if (!value) return null;
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function parseInvoiceNotes(notes) {
  if (!notes) return {};
  try {
    const value = JSON.parse(notes);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function milestoneLabel(code) {
  if (!code) return "—";
  return MILESTONE_LABELS[code] || String(code).replace(/_/g, " ");
}

function formatStatus(status) {
  if (!status) return "PENDING";
  return String(status).replace(/_/g, " ").toUpperCase();
}

function unavailable(message = "Payment Structure Not Available") {
  return { available: false, message, installments: [] };
}

/**
 * Build contract payment schedule for receipt voucher (from invoice-linked contract only).
 */
export async function attachReceiptContractPaymentSchedule(receipt) {
  const allocations = receipt?.receipt_allocations || [];
  if (!allocations.length) return unavailable();

  const primary = allocations.reduce((best, row) => (
    !best || round2(row.allocated_amount) > round2(best.allocated_amount) ? row : best
  ), null);
  const invoiceId = Number(primary?.invoice_id);
  if (!invoiceId) return unavailable();

  const invoice = await prisma.customer_invoices.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      notes: true,
      customer_reference: true,
    },
  });
  if (!invoice) return unavailable();

  const linkRows = await prisma.$queryRawUnsafe(
    "SELECT installment_id AS installmentId FROM customer_invoices WHERE id = ? LIMIT 1",
    invoiceId,
  );
  const installmentId = linkRows[0]?.installmentId ? String(linkRows[0].installmentId) : null;

  const meta = parseInvoiceNotes(invoice.notes);
  let contractId = meta.contract_id ? String(meta.contract_id) : null;
  if (!contractId && invoice.customer_reference) {
    const byNumber = await prisma.contract.findFirst({
      where: { contractNumber: String(invoice.customer_reference) },
      select: { id: true },
    });
    contractId = byNumber?.id || null;
  }
  if (!contractId) return unavailable();

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractNumber: true,
      paymentTerms: true,
      totalAmount: true,
    },
  });
  if (!contract) return unavailable();

  const installments = await prisma.clientInstallment.findMany({
    where: { contractId: contract.id },
    orderBy: [{ installmentNumber: "asc" }, { dueDate: "asc" }],
  });
  if (!installments.length) return unavailable();

  const decorated = { ...contract, installments: [...installments] };
  await decorateContractInstallments(decorated);

  const highlightKey = installmentId || meta.installment_id || null;
  const highlightNumber = Number(meta.installment_number || 0) || null;

  const rows = decorated.installments.map((row) => {
    const isCurrent = Boolean(
      (highlightKey && row.sourceKey === highlightKey)
      || (highlightNumber && Number(row.installmentNumber) === highlightNumber),
    );
    return {
      installment_number: Number(row.installmentNumber || 0),
      milestone: row.dueMilestone || null,
      milestone_label: milestoneLabel(row.dueMilestone),
      percentage: row.percentage != null ? round2(row.percentage) : null,
      amount: round2(row.dueAmount),
      due_date: isoDay(row.dueDate),
      status: formatStatus(row.status),
      is_current: isCurrent,
    };
  });

  return {
    available: true,
    contract_id: contract.id,
    contract_number: contract.contractNumber,
    payment_terms: contract.paymentTerms,
    contract_amount: round2(contract.totalAmount),
    highlighted_installment_number: rows.find((row) => row.is_current)?.installment_number
      ?? highlightNumber
      ?? null,
    linked_invoice_id: invoiceId,
    installments: rows,
  };
}