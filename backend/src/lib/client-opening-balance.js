import { normalizeRoleName } from "./portfolio-scope.js";

const TYPES = new Set(["CUSTOMER_OWES", "WE_OWE"]);

export class OpeningBalanceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function canEditOpeningBalance(role) {
  const name = normalizeRoleName(role);
  return name === "admin" || name === "superadmin" || name.includes("account");
}

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const ACCOUNT_CODES = {
  receivable: "1200",
  customerAdvance: "2140",
  openingBalanceEquity: "3100",
};

function assertBalancedLines(lines) {
  const totals = lines.reduce(
    (sum, line) => ({
      debit: round2(sum.debit + Number(line.debit || 0)),
      credit: round2(sum.credit + Number(line.credit || 0)),
    }),
    { debit: 0, credit: 0 },
  );
  if (Math.abs(totals.debit - totals.credit) > 0.005 || totals.debit <= 0) {
    throw new OpeningBalanceError(400, "Opening balance journal entry is not balanced.");
  }
  for (const line of lines) {
    if (Number(line.debit || 0) > 0.005 && Number(line.credit || 0) > 0.005) {
      throw new OpeningBalanceError(400, "A journal line cannot have both debit and credit amounts.");
    }
  }
}

async function assertAccountGroup(tx, account, expectedGroup, label) {
  if (!account) {
    throw new OpeningBalanceError(400, `${label} was not found in the chart of accounts.`);
  }
  const row = await tx.chart_of_accounts.findUnique({
    where: { id: account.id },
    include: { account_types: { select: { internal_group: true, name: true } } },
  });
  const group = String(row?.account_types?.internal_group || "").toLowerCase();
  const typeName = String(row?.account_types?.name || "").toLowerCase();
  if (group !== expectedGroup) {
    throw new OpeningBalanceError(400, `${label} (${account.code}) must be a ${expectedGroup} account, not ${group || "unknown"}.`);
  }
  if (typeName.includes("income") || typeName.includes("expense")) {
    throw new OpeningBalanceError(400, `${label} cannot use an income or expense account.`);
  }
}

async function resolveOpeningBalanceAccounts(tx, companyId, customerOwes) {
  const [receivable, equity, advance] = await Promise.all([
    tx.chart_of_accounts.findFirst({
      where: { company_id: companyId, code: ACCOUNT_CODES.receivable, is_active: true },
    }),
    tx.chart_of_accounts.findFirst({
      where: {
        company_id: companyId,
        is_active: true,
        OR: [
          { code: ACCOUNT_CODES.openingBalanceEquity },
          { name: { contains: "Opening Balance Equity" } },
          { name: { contains: "Owner's Equity" } },
        ],
      },
      orderBy: { code: "asc" },
    }),
    customerOwes
      ? null
      : tx.chart_of_accounts.findFirst({
        where: {
          company_id: companyId,
          is_active: true,
          OR: [
            { code: ACCOUNT_CODES.customerAdvance },
            { name: { contains: "Customer Advance" } },
            { name: { contains: "Unearned Revenue" } },
          ],
        },
        orderBy: { code: "asc" },
      }),
  ]);
  await assertAccountGroup(tx, receivable, "asset", "Accounts Receivable");
  await assertAccountGroup(tx, equity, "equity", "Opening Balance Equity");
  if (!customerOwes) {
    await assertAccountGroup(tx, advance, "liability", "Customer Advances / Unearned Revenue");
  }
  return { receivable, equity, advance };
}

function isoDay(value) {
  if (!value) return null;
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseOpening(body) {
  const provided = ["openingBalanceAmount", "openingBalanceType", "openingBalanceDate", "openingBalanceNotes"]
    .some((key) => body?.[key] !== undefined);
  if (!provided) return null;

  const amount = round2(body.openingBalanceAmount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new OpeningBalanceError(400, "Opening balance amount cannot be negative.");
  }
  if (amount === 0) {
    return { amount: 0, type: null, date: null, notes: null };
  }

  const type = String(body.openingBalanceType || "").trim();
  if (!TYPES.has(type)) {
    throw new OpeningBalanceError(400, "Balance type is required when the opening balance is greater than zero.");
  }
  const date = isoDay(body.openingBalanceDate);
  if (!date) {
    throw new OpeningBalanceError(400, "Opening balance date is required when the amount is greater than zero.");
  }
  const notes = String(body.openingBalanceNotes || "").trim();
  if (notes.length > 2000) {
    throw new OpeningBalanceError(400, "Opening balance notes are too long.");
  }
  return { amount, type, date, notes: notes || null };
}

function sameOpening(current, next) {
  return round2(current.amount) === next.amount
    && (current.type || null) === (next.type || null)
    && isoDay(current.date) === next.date
    && String(current.notes || "") === String(next.notes || "");
}

let schemaReady;
export function ensureClientOpeningSchema(prisma) {
  if (!schemaReady) schemaReady = migrateOpeningSchema(prisma);
  return schemaReady;
}

async function migrateOpeningSchema(prisma) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'
       AND COLUMN_NAME IN ('openingBalanceAmount','openingBalanceType','openingBalanceDate','openingBalanceNotes','openingJournalEntryId','openingBalanceApplied')`,
  );
  const present = new Set(existing.map((column) => column.name || column.COLUMN_NAME || column.column_name));
  const statements = [
    ["openingBalanceAmount", "ALTER TABLE `clients` ADD COLUMN `openingBalanceAmount` DECIMAL(15,2) NOT NULL DEFAULT 0.00"],
    ["openingBalanceType", "ALTER TABLE `clients` ADD COLUMN `openingBalanceType` VARCHAR(32) NULL"],
    ["openingBalanceDate", "ALTER TABLE `clients` ADD COLUMN `openingBalanceDate` DATE NULL"],
    ["openingBalanceNotes", "ALTER TABLE `clients` ADD COLUMN `openingBalanceNotes` TEXT NULL"],
    ["openingJournalEntryId", "ALTER TABLE `clients` ADD COLUMN `openingJournalEntryId` INT UNSIGNED NULL"],
    ["openingBalanceApplied", "ALTER TABLE `clients` ADD COLUMN `openingBalanceApplied` DECIMAL(15,2) NOT NULL DEFAULT 0.00"],
  ];
  for (const [name, sql] of statements) {
    if (!present.has(name)) await prisma.$executeRawUnsafe(sql);
  }
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS client_opening_balance_history (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      clientId VARCHAR(191) NOT NULL,
      previousAmount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      previousType VARCHAR(32) NULL,
      previousDate DATE NULL,
      previousNotes TEXT NULL,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      balanceType VARCHAR(32) NULL,
      balanceDate DATE NULL,
      notes TEXT NULL,
      journalEntryId INT UNSIGNED NULL,
      action VARCHAR(16) NOT NULL,
      changedById VARCHAR(191) NULL,
      changedByName VARCHAR(128) NULL,
      changedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_obh_client (clientId)
    )`,
  );
}

async function readCurrent(tx, clientId) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT openingBalanceAmount AS amount, openingBalanceType AS type,
            DATE_FORMAT(openingBalanceDate, '%Y-%m-%d') AS date,
            openingBalanceNotes AS notes, openingJournalEntryId AS journalEntryId,
            openingBalanceApplied AS applied
     FROM clients WHERE id = ? LIMIT 1`,
    clientId,
  );
  const row = rows[0] || {};
  return {
    amount: round2(row.amount),
    type: row.type || null,
    date: row.date || null,
    notes: row.notes || null,
    journalEntryId: row.journalEntryId ? Number(row.journalEntryId) : null,
    applied: round2(row.applied),
  };
}

async function allocateEntryNumber(tx, journal) {
  for (;;) {
    const updated = await tx.journals.update({
      where: { id: journal.id },
      data: { next_sequence: { increment: 1 } },
      select: { next_sequence: true },
    });
    const prefix = journal.sequence_prefix || journal.code || "JE-";
    const entryNumber = `${prefix}${String(updated.next_sequence - 1).padStart(6, "0")}`;
    const exists = await tx.journal_entries.findFirst({
      where: { company_id: journal.company_id, entry_number: entryNumber },
      select: { id: true },
    });
    if (!exists) return entryNumber;
  }
}

async function postBalancedEntry(tx, {
  company,
  journal,
  fiscalPeriod,
  entryDate,
  reference,
  narration,
  lines,
  reversesId,
  sourceType = "manual",
  sourceId = null,
}) {
  assertBalancedLines(lines);
  const entryNumber = await allocateEntryNumber(tx, journal);
  return tx.journal_entries.create({
    data: {
      company_id: company.id,
      journal_id: journal.id,
      entry_number: entryNumber,
      entry_date: entryDate,
      fiscal_period_id: fiscalPeriod.id,
      reference: reference.slice(0, 64),
      narration: narration.slice(0, 255),
      state: "posted",
      source_type: sourceType,
      source_id: sourceId,
      reversed_entry_id: reversesId || null,
      posted_at: new Date(),
      journal_items: { create: lines },
    },
    select: { id: true },
  });
}

async function reverseOpeningEntry(tx, entryId, actorName) {
  if (!entryId) return;
  const existing = await tx.journal_entries.findUnique({
    where: { id: entryId },
    include: { journal_items: true, journals: true },
  });
  if (!existing || existing.state !== "posted") return;
  const alreadyReversed = await tx.journal_entries.findFirst({
    where: { reversed_entry_id: existing.id },
    select: { id: true },
  });
  if (alreadyReversed) return;

  const entryDate = existing.entry_date;
  const fiscalPeriod = existing.fiscal_period_id
    ? await tx.fiscal_periods.findUnique({ where: { id: existing.fiscal_period_id } })
    : null;
  const company = await tx.companies.findUnique({ where: { id: existing.company_id } });
  if (!company || !fiscalPeriod || !existing.journals) {
    throw new OpeningBalanceError(400, "The previous opening balance entry could not be reversed.");
  }
  await postBalancedEntry(tx, {
    company,
    journal: existing.journals,
    fiscalPeriod,
    entryDate,
    reference: `OB-REV-${existing.id}`,
    narration: `Reversal of opening balance ${existing.entry_number || existing.id}`,
    reversesId: existing.id,
    lines: existing.journal_items.map((line, index) => ({
      sequence: (index + 1) * 10,
      account_id: line.account_id,
      label: "Opening balance reversal",
      partner_type: line.partner_type,
      partner_id: line.partner_id,
      debit: line.credit,
      credit: line.debit,
      currency_id: line.currency_id,
      amount_currency: line.amount_currency != null ? Number(line.amount_currency) * -1 : null,
    })),
  });
  void actorName;
}

async function ensureCustomer(tx, clientId) {
  const existing = await tx.customers.findUnique({ where: { clientId } });
  if (existing) return existing;
  const client = await tx.client.findUnique({ where: { id: clientId } });
  if (!client) throw new OpeningBalanceError(400, "Client not found");
  const company = await tx.companies.findFirst({ where: { is_active: true }, orderBy: { id: "asc" } });
  if (!company) throw new OpeningBalanceError(400, "A company must exist before recording an opening balance.");
  return tx.customers.create({
    data: {
      company_id: company.id,
      clientId: client.id,
      name: client.companyName || client.institution || client.contactPerson || "Client",
      email: client.email || null,
      phone: client.phone || null,
      address: client.address || null,
      is_active: client.isActive !== false,
      currency_id: company.currency_id || null,
      updated_at: new Date(),
    },
  });
}

async function postOpeningEntry(tx, { customer, opening, clientName }) {
  const company = await tx.companies.findUnique({ where: { id: customer.company_id } });
  if (!company?.is_active) throw new OpeningBalanceError(400, "The company for this client is inactive or missing.");

  const entryDate = new Date(`${opening.date}T00:00:00.000Z`);
  const customerOwes = opening.type === "CUSTOMER_OWES";
  const [journal, { receivable, equity, advance }, fiscalPeriod] = await Promise.all([
    tx.journals.findFirst({
      where: { company_id: company.id, journal_type: "general", is_active: true },
      orderBy: { id: "asc" },
    }),
    resolveOpeningBalanceAccounts(tx, company.id, customerOwes),
    tx.fiscal_periods.findFirst({
      where: {
        state: "open",
        fiscal_years: { company_id: company.id, state: "open" },
        start_date: { lte: entryDate },
        end_date: { gte: entryDate },
      },
      orderBy: { period_number: "asc" },
    }),
  ]);
  if (!journal) throw new OpeningBalanceError(400, "The general journal was not found.");
  if (!fiscalPeriod) {
    throw new OpeningBalanceError(400, "No open fiscal period covers the opening balance date.");
  }

  const clientRef = customer.clientId || String(customer.id);
  const reference = `OB-${clientRef}`;
  const activeDuplicate = await tx.$queryRawUnsafe(
    `SELECT je.id FROM journal_entries je
     WHERE je.company_id = ? AND je.reference = ? AND je.state = 'posted'
       AND NOT EXISTS (SELECT 1 FROM journal_entries r WHERE r.reversed_entry_id = je.id LIMIT 1)
     LIMIT 1`,
    company.id,
    reference,
  );
  if (activeDuplicate[0]) {
    throw new OpeningBalanceError(409, "An opening balance journal entry already exists for this customer.");
  }

  const amount = round2(opening.amount);
  const equityLabel = "Opening Balance Equity";
  const customerLabel = customerOwes ? "Accounts Receivable — customer opening debt" : "Customer Advances — opening credit";
  const currencyId = customer.currency_id || company.currency_id || null;
  const customerLine = customerOwes
    ? {
        sequence: 10,
        account_id: receivable.id,
        label: customerLabel,
        partner_type: "customer",
        partner_id: customer.id,
        debit: amount,
        credit: 0,
        currency_id: currencyId,
        amount_currency: amount,
      }
    : {
        sequence: 20,
        account_id: advance.id,
        label: customerLabel,
        partner_type: "customer",
        partner_id: customer.id,
        debit: 0,
        credit: amount,
        currency_id: currencyId,
        amount_currency: -amount,
      };
  const equityLine = {
    sequence: customerOwes ? 20 : 10,
    account_id: equity.id,
    label: equityLabel,
    debit: customerOwes ? 0 : amount,
    credit: customerOwes ? amount : 0,
    currency_id: currencyId,
    amount_currency: customerOwes ? -amount : amount,
  };
  const lines = customerOwes ? [customerLine, equityLine] : [equityLine, customerLine];

  const created = await postBalancedEntry(tx, {
    company,
    journal,
    fiscalPeriod,
    entryDate,
    reference,
    narration: `Customer opening balance (${opening.type}) for ${clientName || customer.name} — Customer #${customer.id}`,
    lines,
    sourceType: "manual",
    sourceId: null,
  });
  return created.id;
}

async function openingEntryCreditsReceivable(tx, entryId) {
  if (!entryId) return false;
  const lines = await tx.journal_items.findMany({
    where: { entry_id: Number(entryId), credit: { gt: 0 } },
    include: { chart_of_accounts: { select: { code: true } } },
  });
  return lines.some((line) => line.chart_of_accounts?.code === ACCOUNT_CODES.receivable);
}

async function postMissingOpeningAdvanceApplication(tx, customerId, clientId) {
  const current = await readCurrent(tx, clientId);
  if (current.type !== "WE_OWE" || round2(current.applied) <= 0.005) return;
  const customer = await tx.customers.findUnique({ where: { id: Number(customerId) } });
  if (!customer) return;
  const invoices = await tx.customer_invoices.findMany({
    where: { customer_id: customer.id, state: "posted", document_type: "invoice" },
    select: {
      id: true,
      invoice_number: true,
      invoice_date: true,
      fiscal_period_id: true,
      journal_id: true,
      receivable_account_id: true,
      company_id: true,
      currency_id: true,
      notes: true,
    },
  });
  const advance = await advanceAccount(tx, customer.company_id);
  if (!advance) return;
  const postedAt = new Date();
  for (const invoice of invoices) {
    const meta = parseOpeningInvoiceNotes(invoice.notes);
    const applied = round2(meta.advance_credit_applied || 0);
    if (applied <= 0.005 || Number(meta.installment_number || 0) !== 1) continue;
    const marker = `OB-APPLY-${invoice.id}`;
    const exists = await tx.journal_entries.findFirst({ where: { reference: marker }, select: { id: true } });
    if (exists) continue;
    if (!invoice.receivable_account_id || !invoice.journal_id) continue;
    await postBalancedEntry(tx, {
      company: await tx.companies.findUnique({ where: { id: invoice.company_id } }),
      journal: await tx.journals.findUnique({ where: { id: invoice.journal_id } }),
      fiscalPeriod: await tx.fiscal_periods.findUnique({ where: { id: invoice.fiscal_period_id } }),
      entryDate: invoice.invoice_date,
      reference: marker.slice(0, 64),
      narration: `Opening advance applied to ${invoice.invoice_number || invoice.id}`,
      sourceType: "manual",
      sourceId: invoice.id,
      lines: [
        {
          sequence: 10,
          account_id: advance.id,
          label: "Opening advance applied",
          partner_type: "customer",
          partner_id: customer.id,
          debit: applied,
          credit: 0,
          currency_id: invoice.currency_id,
          amount_currency: applied,
        },
        {
          sequence: 20,
          account_id: invoice.receivable_account_id,
          label: "Accounts Receivable",
          partner_type: "customer",
          partner_id: customer.id,
          debit: 0,
          credit: applied,
          currency_id: invoice.currency_id,
          amount_currency: -applied,
        },
      ],
    });
    void postedAt;
  }
}

/** Reversal + correct re-post when a WE_OWE opening balance was credited to AR instead of Customer Advances. */
async function openingEntryCreditsAdvance(tx, entryId) {
  if (!entryId) return false;
  const lines = await tx.journal_items.findMany({
    where: { entry_id: Number(entryId), credit: { gt: 0 } },
    include: { chart_of_accounts: { select: { code: true } } },
  });
  return lines.some((line) => line.chart_of_accounts?.code === ACCOUNT_CODES.customerAdvance);
}

export async function repairMisPostedWeOweOpening(tx, clientId) {
  const current = await readCurrent(tx, clientId);
  if (current.type !== "WE_OWE" || current.amount <= 0.005 || !current.journalEntryId) return false;

  const client = await tx.client.findUnique({ where: { id: clientId }, select: { institution: true, companyName: true } });
  const customer = await ensureCustomer(tx, clientId);
  let repaired = false;

  if (await openingEntryCreditsReceivable(tx, current.journalEntryId)) {
    await reverseOpeningEntry(tx, current.journalEntryId, "system");
    const opening = {
      amount: current.amount,
      type: current.type,
      date: current.date,
      notes: current.notes,
    };
    const journalEntryId = await postOpeningEntry(tx, {
      customer,
      opening,
      clientName: client?.companyName || client?.institution,
    });
    await tx.$executeRawUnsafe(
      "UPDATE clients SET openingJournalEntryId = ? WHERE id = ?",
      journalEntryId,
      clientId,
    );
    repaired = true;
  } else if (!(await openingEntryCreditsAdvance(tx, current.journalEntryId))) {
    return false;
  }

  await postMissingOpeningAdvanceApplication(tx, customer.id, clientId);
  return repaired || round2(current.applied) > 0.005;
}

async function writeOpening(tx, clientId, opening, journalEntryId) {
  await tx.$executeRawUnsafe(
    `UPDATE clients
     SET openingBalanceAmount = ?, openingBalanceType = ?, openingBalanceDate = ?, openingBalanceNotes = ?, openingJournalEntryId = ?
     WHERE id = ?`,
    opening.amount,
    opening.type,
    opening.date,
    opening.notes,
    journalEntryId,
    clientId,
  );
}

async function writeHistory(tx, { clientId, previous, next, journalEntryId, action, actor }) {
  await tx.$executeRawUnsafe(
    `INSERT INTO client_opening_balance_history
      (clientId, previousAmount, previousType, previousDate, previousNotes, amount, balanceType, balanceDate, notes, journalEntryId, action, changedById, changedByName)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    clientId,
    previous.amount,
    previous.type,
    previous.date,
    previous.notes,
    next.amount,
    next.type,
    next.date,
    next.notes,
    journalEntryId,
    action,
    actor?.id || null,
    actor?.name || null,
  );
}

export async function applyClientOpeningBalance(tx, { clientId, clientName, body, actor, isDraft }) {
  if (isDraft) return;
  const next = parseOpening(body);
  if (!next) return;

  const current = await readCurrent(tx, clientId);
  if (sameOpening(current, next)) return;
  if (round2(current.applied) > 0) {
    const appliedTo = current.type === "WE_OWE" ? "advance credit" : "outstanding debt";
    throw new OpeningBalanceError(400, `This opening ${appliedTo} has already been applied to an invoice and cannot be changed.`);
  }
  if (!canEditOpeningBalance(actor?.role)) {
    throw new OpeningBalanceError(403, "Only accounting or admin users can edit the opening balance.");
  }

  if (next.amount === 0) {
    await reverseOpeningEntry(tx, current.journalEntryId, actor?.name);
    await writeOpening(tx, clientId, next, null);
    await tx.$executeRawUnsafe("UPDATE customers SET opening_balance = 0 WHERE clientId = ?", clientId);
    await writeHistory(tx, {
      clientId,
      previous: current,
      next,
      journalEntryId: null,
      action: "cleared",
      actor,
    });
    return;
  }

  await reverseOpeningEntry(tx, current.journalEntryId, actor?.name);
  const customer = await ensureCustomer(tx, clientId);
  const journalEntryId = await postOpeningEntry(tx, { customer, opening: next, clientName });
  const signed = next.type === "WE_OWE" ? 0 : next.amount;
  await tx.$executeRawUnsafe("UPDATE customers SET opening_balance = ? WHERE id = ?", signed, customer.id);
  await tx.$executeRawUnsafe("UPDATE clients SET openingBalanceApplied = 0 WHERE id = ?", clientId);
  await writeOpening(tx, clientId, next, journalEntryId);
  await writeHistory(tx, {
    clientId,
    previous: current,
    next,
    journalEntryId,
    action: current.amount > 0 ? "updated" : "created",
    actor,
  });
}

async function advanceAccount(tx, companyId) {
  return tx.chart_of_accounts.findFirst({
    where: { company_id: companyId, code: "2140", is_active: true },
  });
}

function mergeNotes(notes, patch) {
  let parsed = {};
  if (notes) {
    try {
      const value = JSON.parse(notes);
      if (value && typeof value === "object") parsed = value;
      else parsed = { note: notes };
    } catch {
      parsed = { note: notes };
    }
  }
  return JSON.stringify({ ...parsed, ...patch });
}

function parseOpeningInvoiceNotes(notes) {
  if (!notes) return {};
  try {
    const value = JSON.parse(notes);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

async function readOpeningState(tx, clientId) {
  if (!clientId) return null;
  const rows = await tx.$queryRawUnsafe(
    `SELECT openingBalanceAmount AS amount, openingBalanceType AS type,
            openingBalanceApplied AS applied, openingJournalEntryId AS journalEntryId
     FROM clients WHERE id = ? LIMIT 1`,
    clientId,
  );
  const opening = rows[0];
  if (!opening) return null;
  const amount = round2(opening.amount);
  if (amount <= 0 || !opening.type) return null;
  const applied = round2(opening.applied);
  const remaining = Math.max(0, round2(amount - applied));
  return { ...opening, amount, applied, remaining };
}

/**
 * Add "Customer Owes Us" opening debt to the first contract installment invoice only.
 */
export async function applyOpeningDebtToInvoice(tx, invoice, installmentNumber, postedAt = new Date()) {
  if (!invoice?.id || Number(installmentNumber) !== 1) return 0;
  let clientId = invoice.client_id || null;
  if (!clientId && invoice.customer_id) {
    const customer = await tx.customers.findUnique({
      where: { id: invoice.customer_id },
      select: { clientId: true },
    });
    clientId = customer?.clientId || null;
  }
  if (!clientId) return 0;

  const opening = await readOpeningState(tx, clientId);
  if (!opening || opening.type !== "CUSTOMER_OWES" || opening.remaining <= 0.005) return 0;

  const marker = `OB-DEBT-${invoice.id}`;
  const existing = await tx.journal_entries.findFirst({ where: { reference: marker }, select: { id: true } });
  if (existing) return 0;

  const debt = round2(opening.remaining);
  const reserved = await tx.$executeRawUnsafe(
    `UPDATE clients
     SET openingBalanceApplied = openingBalanceApplied + ?
     WHERE id = ? AND openingBalanceType = 'CUSTOMER_OWES'
       AND openingBalanceApplied + ? <= openingBalanceAmount + 0.001`,
    debt,
    clientId,
    debt,
  );
  if (!Number(reserved)) return 0;

  const meta = parseOpeningInvoiceNotes(invoice.notes);
  const installmentAmount = round2(meta.contract_installment_amount || invoice.amount_total);
  const paid = round2(invoice.paid_amount || 0);
  // Invoice total includes prior AR for collection; GL stays at installment revenue only (opening was posted separately).
  const newTotal = round2(installmentAmount + debt);
  const newDue = round2(Math.max(0, newTotal - paid));

  await tx.customer_invoices.update({
    where: { id: invoice.id },
    data: {
      amount_total: newTotal,
      amount_due: newDue,
      payment_state: newDue <= 0.005 && newTotal > 0.005 ? "paid" : paid > 0.005 ? "partial" : "not_paid",
      notes: mergeNotes(invoice.notes, {
        previous_outstanding_balance: debt,
        contract_installment_amount: installmentAmount,
      }),
      updated_at: postedAt,
    },
  });
  await tx.$executeRawUnsafe(
    "UPDATE customers SET opening_balance = 0 WHERE clientId = ? AND opening_balance > 0",
    clientId,
  );
  return debt;
}

/**
 * Apply a "We Owe Customer" opening credit to the first contract installment invoice only.
 * Does not create a receipt and does not touch "Customer Owes Us" debt.
 * Returns the amount applied.
 */
export async function applyOpeningCreditToInvoice(tx, invoice, postedAt = new Date()) {
  if (!invoice?.id) return 0;
  const meta = parseOpeningInvoiceNotes(invoice.notes);
  if (Number(meta.installment_number || 0) !== 1) return 0;
  let clientId = invoice.client_id || null;
  if (!clientId && invoice.customer_id) {
    const customer = await tx.customers.findUnique({
      where: { id: invoice.customer_id },
      select: { clientId: true },
    });
    clientId = customer?.clientId || null;
  }
  if (!clientId) return 0;

  const opening = await readOpeningState(tx, clientId);
  if (!opening || opening.type !== "WE_OWE" || opening.remaining <= 0.005) return 0;
  const installmentBase = round2(meta.contract_installment_amount || invoice.amount_total);
  const invoiceDue = round2(invoice.amount_due ?? invoice.amount_total);
  const applied = round2(Math.min(opening.remaining, installmentBase, invoiceDue));
  if (applied <= 0.005) return 0;

  const marker = `OB-APPLY-${invoice.id}`;
  const existing = await tx.journal_entries.findFirst({
    where: { reference: marker },
    select: { id: true },
  });
  if (existing) return 0;

  const advance = await advanceAccount(tx, invoice.company_id);
  if (!advance || !invoice.receivable_account_id || !invoice.journal_id) {
    return 0;
  }
  if (opening.journalEntryId && (await openingEntryCreditsReceivable(tx, opening.journalEntryId))) {
    return 0;
  }

  const reserved = await tx.$executeRawUnsafe(
    `UPDATE clients
     SET openingBalanceApplied = openingBalanceApplied + ?
     WHERE id = ? AND openingBalanceType = 'WE_OWE'
       AND openingBalanceApplied + ? <= openingBalanceAmount + 0.001`,
    applied,
    clientId,
    applied,
  );
  if (!Number(reserved)) return 0;

  await postBalancedEntry(tx, {
    company: await tx.companies.findUnique({ where: { id: invoice.company_id } }),
    journal: await tx.journals.findUnique({ where: { id: invoice.journal_id } }),
    fiscalPeriod: await tx.fiscal_periods.findUnique({ where: { id: invoice.fiscal_period_id } }),
    entryDate: invoice.invoice_date,
    reference: marker.slice(0, 64),
    narration: `Opening advance applied to ${invoice.invoice_number || invoice.id}`,
    sourceType: "manual",
    sourceId: invoice.id,
    lines: [
      {
        sequence: 10,
        account_id: advance.id,
        label: "Opening advance applied",
        partner_type: "customer",
        partner_id: invoice.customer_id,
        debit: applied,
        credit: 0,
        currency_id: invoice.currency_id,
        amount_currency: applied,
      },
      {
        sequence: 20,
        account_id: invoice.receivable_account_id,
        label: "Accounts Receivable",
        partner_type: "customer",
        partner_id: invoice.customer_id,
        debit: 0,
        credit: applied,
        currency_id: invoice.currency_id,
        amount_currency: -applied,
      },
    ],
  });

  await tx.$executeRawUnsafe(
    "UPDATE customers SET opening_balance = 0 WHERE clientId = ? AND opening_balance < 0",
    clientId,
  );
  await tx.customer_invoices.update({
    where: { id: invoice.id },
    data: {
      notes: mergeNotes(invoice.notes, {
        advance_credit_applied: applied,
        contract_installment_amount: installmentBase,
      }),
      updated_at: postedAt,
    },
  });
  return applied;
}

export async function attachClientOpeningBalances(prisma, clients) {
  const list = Array.isArray(clients) ? clients : clients ? [clients] : [];
  if (!list.length) return clients;
  await ensureClientOpeningSchema(prisma);
  for (const client of list) {
    if (!client?.id) continue;
    try {
      await prisma.$transaction((tx) => repairMisPostedWeOweOpening(tx, client.id), {
        maxWait: 10000,
        timeout: 60000,
      });
    } catch (error) {
      console.error(`[opening-balance] Journal repair skipped for ${client.id}:`, error?.message || error);
    }
  }
  const ids = list.map((client) => client.id).filter(Boolean);
  if (!ids.length) return clients;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       c.id AS clientId,
       c.openingBalanceAmount AS amount,
       c.openingBalanceType AS balanceType,
       DATE_FORMAT(c.openingBalanceDate, '%Y-%m-%d') AS balanceDate,
       c.openingBalanceNotes AS notes,
       c.openingBalanceApplied AS applied,
       cu.opening_balance AS customerOpening,
       COALESCE(SUM(CASE WHEN i.document_type = 'invoice' AND i.state = 'posted' THEN i.amount_total ELSE 0 END), 0) AS invoiceTotal,
       COALESCE(SUM(CASE WHEN i.document_type = 'invoice' AND i.state = 'posted' THEN i.amount_due ELSE 0 END), 0) AS invoiceDue,
       COALESCE(SUM(CASE WHEN i.document_type = 'credit_note' AND i.state = 'posted' THEN i.amount_due ELSE 0 END), 0) AS creditDue,
       (SELECT COALESCE(SUM(r.amount), 0) FROM customer_receipts r WHERE r.customer_id = cu.id AND r.state = 'posted') AS paymentsReceived
     FROM clients c
     LEFT JOIN customers cu ON cu.clientId = c.id
     LEFT JOIN customer_invoices i ON i.customer_id = cu.id
     WHERE c.id IN (${ids.map(() => "?").join(",")})
     GROUP BY c.id, c.openingBalanceAmount, c.openingBalanceType, DATE_FORMAT(c.openingBalanceDate, '%Y-%m-%d'), c.openingBalanceNotes, c.openingBalanceApplied, cu.id, cu.opening_balance`,
    ...ids,
  );

  const byId = new Map(rows.map((row) => [row.clientId, row]));
  for (const client of list) {
    const row = byId.get(client.id);
    const storedAmount = round2(row?.amount);
    const legacy = round2(row?.customerOpening);
    const useStored = storedAmount > 0;
    const balanceType = useStored
      ? row?.balanceType || null
      : legacy < 0
        ? "WE_OWE"
        : legacy > 0
          ? "CUSTOMER_OWES"
          : null;
    const amount = useStored ? storedAmount : Math.abs(legacy);
    const applied = round2(row?.applied);
    const previousDebt = balanceType === "CUSTOMER_OWES" ? Math.max(0, round2(amount - applied)) : 0;
    const availableAdvance = balanceType === "WE_OWE" ? Math.max(0, round2(amount - applied)) : 0;
    const invoiceDue = round2(row?.invoiceDue);
    client.openingBalanceAmount = amount;
    client.openingBalanceType = balanceType;
    client.openingBalanceDate = row?.balanceDate || null;
    client.openingBalanceNotes = row?.notes || null;
    client.totalInvoices = round2(row?.invoiceTotal);
    client.totalPaymentsReceived = round2(row?.paymentsReceived);
    client.availableAdvanceCredit = availableAdvance;
    client.previousOutstandingDebt = previousDebt;
    client.totalOutstandingReceivable = round2(invoiceDue - Number(row?.creditDue || 0));
    client.totalPayableToCustomer = availableAdvance;
    client.currentOutstandingBalance = round2(previousDebt + invoiceDue - Number(row?.creditDue || 0));
  }
  return clients;
}
