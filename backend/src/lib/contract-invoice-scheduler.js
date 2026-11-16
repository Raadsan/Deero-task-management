import prisma from "../config/db.js";
import { zonedNowParts } from "./scheduled-task-window.js";
import {
  allocateInvoiceNumber,
  applyCustomerAdvances,
  journalItems,
  prepareInvoice,
} from "../modules/accounting/receivables/customerInvoices/customerInvoice.controller.js";
import {
  applyOpeningCreditToInvoice,
  applyOpeningDebtToInvoice,
  ensureClientOpeningSchema,
} from "./client-opening-balance.js";

const INVOICEABLE_CONTRACT_STATUSES = new Set(["ACTIVE", "EXPIRED", "RENEWED"]);
const invoiceTransactionOptions = { maxWait: 10000, timeout: 30000 };

let schemaReady;
function ensureInstallmentLink() {
  if (!schemaReady) schemaReady = migrateInstallmentLink();
  return schemaReady;
}

async function migrateInstallmentLink() {
  const columns = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_invoices' AND COLUMN_NAME = 'installment_id'`,
  );
  const present = columns.some((column) => (column.name || column.COLUMN_NAME || column.column_name) === "installment_id");
  if (!present) {
    await prisma.$executeRawUnsafe("ALTER TABLE customer_invoices ADD COLUMN installment_id VARCHAR(64) NULL");
  }
  const indexes = await prisma.$queryRawUnsafe(
    `SELECT INDEX_NAME AS name FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_invoices' AND INDEX_NAME = 'uq_customer_invoices_installment'`,
  );
  if (!indexes.length) {
    await prisma.$executeRawUnsafe(
      "CREATE UNIQUE INDEX uq_customer_invoices_installment ON customer_invoices (installment_id)",
    );
  }
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isoDay(value) {
  if (!value) return null;
  return zonedNowParts(value instanceof Date ? value : new Date(value)).date;
}

export function presentInstallmentStatus(installment, invoice, now = new Date()) {
  const dueAmount = money(installment.dueAmount);
  const paid = money(invoice ? invoice.paid_amount : installment.paidAmount);
  if (dueAmount > 0 && paid + 0.005 >= dueAmount) return "PAID";
  if (paid > 0.005) return "PARTIALLY_PAID";
  if (!invoice || invoice.state === "cancelled") return "PENDING";
  const dueAt = new Date(installment.dueDate).getTime();
  if (!Number.isNaN(dueAt) && now.getTime() > dueAt) return "OVERDUE";
  return "UNPAID";
}

function storedStatus(display) {
  if (display === "PAID") return "PAID";
  if (display === "PARTIALLY_PAID") return "PARTIAL";
  if (display === "OVERDUE") return "OVERDUE";
  return "PENDING";
}

async function loadInvoiceMap(sourceKeys) {
  if (!sourceKeys.length) return new Map();
  await ensureInstallmentLink();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, installment_id, state, paid_amount, amount_total, amount_due
     FROM customer_invoices
     WHERE installment_id IN (${sourceKeys.map(() => "?").join(",")})
       AND document_type = 'invoice'
       AND state <> 'cancelled'`,
    ...sourceKeys,
  );
  return new Map(rows.map((row) => [row.installment_id, row]));
}

export async function decorateContractInstallments(contracts) {
  const list = Array.isArray(contracts) ? contracts : contracts ? [contracts] : [];
  const installments = list.flatMap((contract) => contract?.installments || []);
  if (!installments.length) return contracts;
  const invoices = await loadInvoiceMap(installments.map((row) => row.sourceKey).filter(Boolean));
  const now = new Date();
  for (const installment of installments) {
    const invoice = invoices.get(installment.sourceKey) || null;
    installment.invoiceId = invoice ? Number(invoice.id) : null;
    installment.status = presentInstallmentStatus(installment, invoice, now);
  }
  return contracts;
}

async function completionReached(contract) {
  const projects = await prisma.project.findMany({
    where: {
      archived: false,
      isDraft: false,
      OR: [
        { contractId: contract.id },
        ...(contract.projectId ? [{ id: contract.projectId }] : []),
      ],
    },
    select: { status: true, lifecycleStatus: true },
  });
  return projects.some((project) => (
    project.status === "COMPLETED" || String(project.lifecycleStatus || "").toUpperCase() === "COMPLETED"
  ));
}

function triggerReached(installment, completed, now) {
  if (money(installment.dueAmount) <= 0) return false;
  if (installment.dueMilestone === "CONTRACT_START") return true;
  const dueAt = new Date(installment.dueDate).getTime();
  if (Number.isNaN(dueAt) || now.getTime() < dueAt) return false;
  if (installment.dueMilestone === "CONTRACT_COMPLETION") return completed;
  return true;
}

async function findLinkedInvoice(sourceKey) {
  if (!sourceKey) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, state FROM customer_invoices
     WHERE installment_id = ? AND document_type = 'invoice' AND state <> 'cancelled'
     ORDER BY id ASC LIMIT 1`,
    sourceKey,
  );
  return rows[0] || null;
}

async function createPostedInstallmentInvoice(installment, contract) {
  const dueDay = isoDay(installment.dueDate);
  const today = zonedNowParts(new Date()).date;
  const invoiceDay = dueDay && dueDay < today ? dueDay : today;
  const number = String(installment.installmentNumber || 1).padStart(2, "0");
  const percentage = installment.percentage != null ? `${installment.percentage}% · ` : "";
  const description = `Contract ${contract.contractNumber} · Payment ${number} · ${percentage}${installment.dueMilestone || "Scheduled payment"}`;
  const prepared = await prepareInvoice({
    client_id: contract.clientId,
    contract_id: contract.id,
    invoice_date: invoiceDay,
    due_date: dueDay || invoiceDay,
    customer_reference: contract.contractNumber,
    notes: JSON.stringify({
      contract_id: contract.id,
      contract_number: contract.contractNumber,
      installment_id: installment.sourceKey,
      installment_number: installment.installmentNumber,
      due_milestone: installment.dueMilestone,
      contract_installment_amount: money(installment.dueAmount),
    }),
    lines: [{
      description,
      quantity: 1,
      unit_price: money(installment.dueAmount),
      discount_percent: 0,
    }],
  });

  const postedAt = new Date();
  await ensureClientOpeningSchema(prisma);
  const invoice = await prisma.$transaction(async (tx) => {
    const already = await tx.$queryRawUnsafe(
      `SELECT id, state FROM customer_invoices
       WHERE installment_id = ? AND document_type = 'invoice' AND state <> 'cancelled'
       LIMIT 1`,
      installment.sourceKey,
    );
    if (already[0]) return already[0];

    const journal = await tx.journals.findUnique({ where: { id: prepared.header.journal_id } });
    const invoiceNumber = await allocateInvoiceNumber(tx, journal);
    const created = await tx.customer_invoices.create({
      data: {
        ...prepared.header,
        invoice_number: invoiceNumber,
        state: "posted",
        payment_state: "not_paid",
        paid_amount: 0,
        amount_due: prepared.header.amount_total,
        posted_at: postedAt,
        customer_invoice_lines: { create: prepared.lines },
      },
    });
    await tx.$executeRawUnsafe(
      "UPDATE customer_invoices SET installment_id = ? WHERE id = ? AND installment_id IS NULL",
      installment.sourceKey,
      created.id,
    );
    const entry = await tx.journal_entries.create({
      data: {
        company_id: prepared.header.company_id,
        journal_id: prepared.header.journal_id,
        entry_number: invoiceNumber,
        entry_date: prepared.header.invoice_date,
        fiscal_period_id: prepared.header.fiscal_period_id,
        reference: invoiceNumber,
        narration: `Posted contract installment invoice ${invoiceNumber}`,
        state: "posted",
        source_type: "customer_invoice",
        source_id: created.id,
        posted_at: postedAt,
        journal_items: { create: journalItems(prepared) },
      },
    });
    await tx.customer_invoices.update({
      where: { id: created.id },
      data: { journal_entry_id: entry.id },
    });
    const debtApplied = await applyOpeningDebtToInvoice(
      tx,
      { ...created, journal_id: prepared.header.journal_id, receivable_account_id: prepared.header.receivable_account_id },
      installment.installmentNumber,
      postedAt,
    );
    const refreshed = debtApplied > 0.005
      ? await tx.customer_invoices.findUnique({ where: { id: created.id } })
      : created;
    const invoiceTotal = money(Number(refreshed.amount_total ?? created.amount_total));
    const invoiceForCredit = {
      ...refreshed,
      journal_id: prepared.header.journal_id,
      receivable_account_id: prepared.header.receivable_account_id,
      state: "posted",
      payment_state: refreshed.payment_state || "not_paid",
      paid_amount: Number(refreshed.paid_amount || 0),
      amount_due: Number(refreshed.amount_due ?? refreshed.amount_total),
    };
    const fromReceipts = await applyCustomerAdvances(tx, invoiceForCredit, postedAt);
    const fromOpening = await applyOpeningCreditToInvoice(tx, {
      ...invoiceForCredit,
      amount_due: money(invoiceTotal - Number(fromReceipts || 0)),
    }, postedAt);
    const applied = money(Number(fromReceipts || 0) + Number(fromOpening || 0));
    if (applied > 0.005) {
      const paidAmount = money(applied);
      const amountDue = Math.max(0, money(invoiceTotal - paidAmount));
      await tx.customer_invoices.update({
        where: { id: created.id },
        data: {
          paid_amount: paidAmount,
          amount_due: amountDue,
          payment_state: amountDue <= 0.005 ? "paid" : "partial",
          updated_at: postedAt,
        },
      });
    }
    return { id: created.id, state: "posted" };
  }, invoiceTransactionOptions);

  await syncInstallmentPayments([Number(invoice.id)]);
  return invoice;
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

/** Apply unallocated CUSTOMER_OWES / WE_OWE opening balance to an existing payment-01 invoice once. */
async function ensureOpeningBalanceOnInstallmentInvoice(installment, invoiceId) {
  if (Number(installment.installmentNumber) !== 1 || !invoiceId) return;
  const postedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.customer_invoices.findUnique({ where: { id: Number(invoiceId) } });
    if (!invoice || invoice.state !== "posted") return;
    const meta = parseInvoiceNotes(invoice.notes);
    const installmentAmount = money(
      meta.contract_installment_amount || installment.dueAmount || invoice.amount_total,
    );
    const notesWithInstallment = meta.contract_installment_amount
      ? invoice.notes
      : JSON.stringify({ ...meta, contract_installment_amount: installmentAmount });

    const debtApplied = await applyOpeningDebtToInvoice(
      tx,
      { ...invoice, notes: notesWithInstallment },
      1,
      postedAt,
    );
    const refreshed = debtApplied > 0.005
      ? await tx.customer_invoices.findUnique({ where: { id: invoice.id } })
      : { ...invoice, notes: notesWithInstallment };

    const metaAfter = parseInvoiceNotes(refreshed.notes);
    if (Number(metaAfter.advance_credit_applied || 0) > 0.005) return;

    const invoiceTotal = money(Number(refreshed.amount_total ?? invoice.amount_total));
    const invoiceForCredit = {
      ...refreshed,
      state: "posted",
      paid_amount: Number(refreshed.paid_amount || 0),
      amount_due: Number(refreshed.amount_due ?? refreshed.amount_total),
    };
    const fromReceipts = await applyCustomerAdvances(tx, invoiceForCredit, postedAt);
    const fromOpening = await applyOpeningCreditToInvoice(tx, {
      ...invoiceForCredit,
      amount_due: money(invoiceTotal - Number(fromReceipts || 0)),
    }, postedAt);
    const applied = money(Number(fromReceipts || 0) + Number(fromOpening || 0));
    if (applied <= 0.005) return;
    const priorPaid = Number(refreshed.paid_amount || 0);
    if (priorPaid >= applied - 0.005) return;
    const paidAmount = money(applied);
    const amountDue = Math.max(0, money(invoiceTotal - paidAmount));
    await tx.customer_invoices.update({
      where: { id: invoice.id },
      data: {
        paid_amount: paidAmount,
        amount_due: amountDue,
        payment_state: amountDue <= 0.005 ? "paid" : "partial",
        updated_at: postedAt,
      },
    });
  }, invoiceTransactionOptions);
}

async function issueOne(installment, contract, now, onlyContractStart) {
  if (!INVOICEABLE_CONTRACT_STATUSES.has(contract.status)) return false;
  if (onlyContractStart && installment.dueMilestone !== "CONTRACT_START") return false;
  const completed = installment.dueMilestone === "CONTRACT_COMPLETION"
    ? await completionReached(contract)
    : false;
  if (!triggerReached(installment, completed, now)) return false;

  const existing = await findLinkedInvoice(installment.sourceKey);
  if (existing?.state === "posted" || existing?.state === "draft") {
    try {
      await ensureOpeningBalanceOnInstallmentInvoice(installment, existing.id);
    } catch (error) {
      console.error(
        `[contract-invoice] Opening balance sync failed for invoice ${existing.id}:`,
        error?.message || error,
      );
    }
    await syncInstallmentPayments([Number(existing.id)]);
    return false;
  }
  await createPostedInstallmentInvoice(installment, contract);
  return true;
}

export async function generateReadyInstallmentInvoices({ contractId = null, onlyContractStart = false } = {}) {
  await ensureInstallmentLink();
  await ensureClientOpeningSchema(prisma);
  const now = new Date();
  const recentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lookback = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const installments = await prisma.clientInstallment.findMany({
    where: {
      ...(contractId ? { contractId } : {}),
      dueAmount: { gt: 0 },
      status: { not: "PAID" },
      contract: { status: { in: [...INVOICEABLE_CONTRACT_STATUSES] } },
      ...(onlyContractStart
        ? { dueMilestone: "CONTRACT_START" }
        : {
            OR: [
              { dueMilestone: "CONTRACT_START", createdAt: { gte: recentStart } },
              {
                dueDate: { lte: now, gte: lookback },
                NOT: { dueMilestone: "CONTRACT_START" },
              },
            ],
          }),
    },
    include: {
      contract: {
        select: { id: true, clientId: true, contractNumber: true, status: true, projectId: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { installmentNumber: "asc" }],
    take: 100,
  });

  let created = 0;
  for (const installment of installments) {
    if (!installment.contract) continue;
    try {
      const didCreate = await issueOne(installment, installment.contract, now, onlyContractStart);
      if (didCreate) created += 1;
    } catch (error) {
      console.error(
        `[contract-invoice] Installment ${installment.id} was not invoiced:`,
        error?.message || error,
      );
    }
  }
  return { created, checked: installments.length };
}

export async function syncInstallmentPayments(invoiceIds) {
  const ids = [...new Set(invoiceIds.map((value) => Number(value)).filter((value) => value > 0))];
  if (!ids.length) return;
  await ensureInstallmentLink();
  const invoices = await prisma.$queryRawUnsafe(
    `SELECT id, installment_id, paid_amount, amount_total, amount_due, state
     FROM customer_invoices
     WHERE id IN (${ids.map(() => "?").join(",")}) AND installment_id IS NOT NULL`,
    ...ids,
  );
  const now = new Date();
  for (const invoice of invoices) {
    const installment = await prisma.clientInstallment.findFirst({ where: { sourceKey: invoice.installment_id } });
    if (!installment) continue;
    const display = presentInstallmentStatus(installment, invoice.state === "cancelled" ? null : invoice, now);
    await prisma.clientInstallment.update({
      where: { id: installment.id },
      data: { paidAmount: money(invoice.paid_amount), status: storedStatus(display) },
    });
  }
}
