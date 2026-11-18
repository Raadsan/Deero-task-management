import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'

const transactionOptions = { maxWait: 10000, timeout: 30000 }
const include = {
  customers: { select: { id: true, name: true, phone: true } },
  companies: { select: { id: true, name: true } },
  currencies: { select: { id: true, code: true, symbol: true } },
  journals: { select: { id: true, name: true, code: true } },
  customer_invoices: {
    select: {
      id: true,
      invoice_number: true,
      invoice_date: true,
      amount_total: true,
      amount_due: true,
      paid_amount: true,
      payment_state: true,
      state: true,
    },
  },
  customer_invoice_lines: {
    orderBy: { sequence: 'asc' },
    include: {
      products: { select: { id: true, name: true, sku: true } },
      taxes: { select: { id: true, name: true, rate_percent: true, price_includes_tax: true, tax_account_id: true } },
      chart_of_accounts: { select: { id: true, code: true, name: true } },
    },
  },
  fiscal_periods: { select: { id: true, name: true, state: true } },
  journal_entries: { select: { id: true, entry_number: true, state: true } },
}

const asId = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
const asDate = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const money2 = (value) => Math.round(Number(value || 0) * 100) / 100
const inputError = (message) => Object.assign(new Error(message), { status: 400 })
const fail = (res, error, fallback) => {
  console.error(fallback, error)
  return res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message || fallback })
}

const SETTLEMENT_METHODS = new Set(['customer_credit', 'cash_refund'])

function parseCreditNotesMeta(notes) {
  const empty = {
    reason_text: '',
    line_meta: [],
    settlement: null,
    settlement_method: 'customer_credit',
    refund_status: 'not_refunded',
    refund_payments: [],
    credit_applications: [],
  }
  if (!notes) return empty
  try {
    const parsed = JSON.parse(String(notes))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const method = String(parsed.settlement_method || 'customer_credit').toLowerCase()
      return {
        reason_text: String(parsed.reason_text || parsed.notes_text || ''),
        line_meta: Array.isArray(parsed.line_meta) ? parsed.line_meta : [],
        settlement: parsed.settlement || null,
        settlement_method: SETTLEMENT_METHODS.has(method) ? method : 'customer_credit',
        refund_status: String(parsed.refund_status || 'not_refunded'),
        refund_payments: Array.isArray(parsed.refund_payments) ? parsed.refund_payments : [],
        credit_applications: Array.isArray(parsed.credit_applications) ? parsed.credit_applications : [],
      }
    }
  } catch {
    // plain text notes
  }
  return { ...empty, reason_text: String(notes) }
}

function buildCreditNotes(reasonText, lineMeta, settlement = null, extra = {}) {
  const method = String(extra.settlement_method || 'customer_credit').toLowerCase()
  return JSON.stringify({
    reason_text: String(reasonText || '').trim() || null,
    line_meta: lineMeta || [],
    settlement: settlement || null,
    settlement_method: SETTLEMENT_METHODS.has(method) ? method : 'customer_credit',
    refund_status: extra.refund_status || 'not_refunded',
    refund_payments: extra.refund_payments || [],
    credit_applications: extra.credit_applications || [],
  })
}

function refundStatusFromAmounts(payable, paid) {
  const remaining = money2(payable)
  const refunded = money2(paid)
  if (remaining <= 0.005) return refunded > 0.005 ? 'refunded' : 'not_refunded'
  if (refunded > 0.005) return 'partially_refunded'
  return 'not_refunded'
}

function customerCreditStatus(available, originalLiability) {
  const avail = money2(available)
  const original = money2(originalLiability)
  if (avail <= 0.005) return original > 0.005 ? 'fully_applied' : 'available'
  if (avail + 0.05 < original) return 'partially_applied'
  return 'available'
}

async function ensureCustomerAdvanceAccount(db, companyId) {
  let account = await db.chart_of_accounts.findFirst({
    where: { company_id: companyId, code: '2140', is_active: true, allow_manual_entry: true },
  })
  if (account) return account
  return db.chart_of_accounts.findFirst({
    where: {
      company_id: companyId,
      is_active: true,
      allow_manual_entry: true,
      name: { contains: 'Customer Advance' },
      account_types: { internal_group: 'liability' },
      other_chart_of_accounts: { none: {} },
    },
    orderBy: { code: 'asc' },
  })
}

async function ensureCustomerRefundPayableAccount(db, companyId) {
  let account = await db.chart_of_accounts.findFirst({
    where: { company_id: companyId, code: '2150', is_active: true, allow_manual_entry: true },
  })
  if (account) return account
  return db.chart_of_accounts.findFirst({
    where: {
      company_id: companyId,
      is_active: true,
      allow_manual_entry: true,
      name: { contains: 'Refund Payable' },
      account_types: { internal_group: 'liability' },
      other_chart_of_accounts: { none: {} },
    },
    orderBy: { code: 'asc' },
  })
}

async function defaultInboundPaymentMethod(db) {
  return db.payment_methods.findFirst({
    where: {
      is_active: true,
      payment_type: { in: ['inbound', 'both'] },
      gl_account_id: { not: null },
    },
    orderBy: { id: 'asc' },
  })
}

async function resolveOutboundPaymentAccount({ companyId, method, currencyId }) {
  if (!method?.is_active || !['outbound', 'both'].includes(method.payment_type)) {
    throw inputError('Select an active outbound cash or bank payment method')
  }
  if (!method.gl_account_id) throw inputError('Payment method must be linked to a GL account')
  const account = await prisma.chart_of_accounts.findFirst({
    where: {
      id: method.gl_account_id,
      company_id: companyId,
      is_active: true,
      allow_manual_entry: true,
      account_types: { internal_group: 'asset' },
      other_chart_of_accounts: { none: {} },
      OR: [{ currency_id: null }, { currency_id: currencyId }],
    },
  })
  if (!account) throw inputError('The payment method GL account is inactive or incompatible')
  const channel = String(`${method.code || ''} ${method.name || ''}`).toLowerCase().includes('cash') ? 'cash' : 'bank'
  const journalType = channel === 'cash' ? 'cash' : 'bank'
  const journal =
    (await prisma.journals.findFirst({
      where: { company_id: companyId, journal_type: journalType, is_active: true, code: { in: channel === 'cash' ? ['CSH', 'CASH'] : ['BNK', 'BANK'] } },
      orderBy: { code: 'asc' },
    })) ||
    (await prisma.journals.findFirst({
      where: { company_id: companyId, journal_type: journalType, is_active: true },
      orderBy: { code: 'asc' },
    }))
  if (!journal) throw inputError('Configure an active Cash or Bank journal for refunds')
  return { account, journal }
}

function parseCreditNoteReceiptMemo(memo) {
  if (!memo) return null
  try {
    const parsed = JSON.parse(String(memo))
    if (parsed?.credit_note_id) return parsed
  } catch {
    // ignore
  }
  return null
}

export async function syncCreditNoteFromAdvanceReceipt(tx, receiptId, appliedAmount, postedAt = new Date()) {
  const receipt = await tx.customer_receipts.findUnique({ where: { id: receiptId }, select: { memo: true } })
  const meta = parseCreditNoteReceiptMemo(receipt?.memo)
  if (!meta?.credit_note_id) return
  const credit = await tx.customer_invoices.findUnique({ where: { id: asId(meta.credit_note_id) } })
  if (!credit || credit.document_type !== 'credit_note' || credit.state !== 'posted') return
  const cnMeta = parseCreditNotesMeta(credit.notes)
  if (cnMeta.settlement_method !== 'customer_credit') return
  const applied = money2(appliedAmount)
  const nextDue = money2(Math.max(0, Number(credit.amount_due || 0) - applied))
  const originalLiability = money2(cnMeta.settlement?.customer_credit || 0)
  const applications = [...(cnMeta.credit_applications || [])]
  applications.push({ amount: applied, receipt_id: receiptId, at: postedAt.toISOString() })
  await tx.customer_invoices.update({
    where: { id: credit.id },
    data: {
      amount_due: nextDue,
      notes: buildCreditNotes(cnMeta.reason_text, cnMeta.line_meta, cnMeta.settlement, {
        settlement_method: cnMeta.settlement_method,
        refund_status: cnMeta.refund_status,
        refund_payments: cnMeta.refund_payments,
        credit_applications: applications,
      }),
      updated_at: postedAt,
    },
  })
}

/**
 * Sum posted credit quantities per original invoice line id.
 */
async function getCreditedQuantities(originalId, excludeCreditId = null, { states = ['posted', 'draft'] } = {}, db = prisma) {
  const credits = await db.customer_invoices.findMany({
    where: {
      document_type: 'credit_note',
      reversed_invoice_id: originalId,
      state: { in: states },
      ...(excludeCreditId ? { id: { not: excludeCreditId } } : {}),
    },
    select: { notes: true, customer_invoice_lines: true },
  })
  const byLineId = new Map()
  for (const credit of credits) {
    const meta = parseCreditNotesMeta(credit.notes)
    if (meta.line_meta.length) {
      for (const row of meta.line_meta) {
        const lineId = asId(row.original_line_id)
        const qty = Number(row.quantity || 0)
        if (!lineId || qty <= 0) continue
        byLineId.set(lineId, (byLineId.get(lineId) || 0) + qty)
      }
      continue
    }
    // Fallback for legacy credit notes without line_meta: match by description+price.
    for (const line of credit.customer_invoice_lines || []) {
      const key = `${String(line.description || '').trim().toLowerCase()}|${Number(line.unit_price)}`
      byLineId.set(key, (byLineId.get(key) || 0) + Number(line.quantity || 0))
    }
  }
  return byLineId
}

async function prepare(input, { excludeCreditId = null } = {}) {
  const originalId = asId(input.reversed_invoice_id)
  const creditDate = asDate(input.invoice_date)
  const rawLines = Array.isArray(input.lines) ? input.lines : []
  if (!originalId || !creditDate) throw inputError('Original invoice and credit note date are required')
  if (!rawLines.length) throw inputError('Add at least one credit note line')

  const original = await prisma.customer_invoices.findUnique({
    where: { id: originalId },
    include: {
      customers: true,
      companies: true,
      journals: true,
      customer_invoice_lines: {
        orderBy: { sequence: 'asc' },
        include: { taxes: true, products: true },
      },
    },
  })
  if (!original || original.document_type !== 'invoice' || original.state !== 'posted') {
    throw inputError('Select a posted customer invoice')
  }
  if (!original.customers?.is_active || !original.companies?.is_active) {
    throw inputError('Customer or company is inactive')
  }
  if (!original.journals?.is_active || original.journals.journal_type !== 'sale') {
    throw inputError('The invoice sales journal is inactive')
  }

  const fiscalPeriod = await prisma.fiscal_periods.findFirst({
    where: {
      state: 'open',
      start_date: { lte: creditDate },
      end_date: { gte: creditDate },
      fiscal_years: { company_id: original.company_id, state: 'open' },
    },
  })
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the credit note date')

  const creditedQty = await getCreditedQuantities(original.id, excludeCreditId)
  const originalById = new Map(original.customer_invoice_lines.map((row) => [row.id, row]))
  const debitLines = []
  const preparedLines = []
  const lineMeta = []
  let amountUntaxed = 0
  let amountTax = 0
  let sequence = 10

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index]
    const quantity = Number(line.quantity)
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw inputError(`Line ${index + 1}: quantity cannot be negative`)
    }

    const originalLineId = asId(line.original_line_id)
    let originalLine = originalLineId ? originalById.get(originalLineId) : null
    if (!originalLine) {
      const desc = String(line.description || '').trim().toLowerCase()
      const price = Number(line.unit_price)
      originalLine = original.customer_invoice_lines.find(
        (row) =>
          String(row.description || '').trim().toLowerCase() === desc &&
          Math.abs(Number(row.unit_price) - price) < 0.0001
      ) || null
    }
    if (!originalLine) {
      throw inputError(`Line ${index + 1}: must match an original invoice line`)
    }

    const already = Number(
      creditedQty.get(originalLine.id) ||
      creditedQty.get(`${String(originalLine.description || '').trim().toLowerCase()}|${Number(originalLine.unit_price)}`) ||
      0
    )
    const remaining = Math.max(0, money2(Number(originalLine.quantity) - already))
    if (quantity > remaining + 0.0001) {
      throw inputError(
        `Line ${index + 1}: quantity ${quantity} exceeds remaining creditable quantity ${remaining}`
      )
    }

    // Always keep meta so drafts reopen with qty 0 lines restored.
    lineMeta.push({
      original_line_id: originalLine.id,
      quantity,
      description: originalLine.description,
      unit_price: Number(originalLine.unit_price),
      discount_percent: Number(originalLine.discount_percent || 0),
      tax_id: originalLine.tax_id,
      income_account_id: originalLine.income_account_id,
    })

    if (quantity <= 0.0001) continue

    const unitPrice = Number(originalLine.unit_price)
    const discount = Number(originalLine.discount_percent || 0)
    const tax = originalLine.taxes || null
    const accountId = originalLine.income_account_id
    const description = String(originalLine.description || originalLine.products?.name || '').trim()
    const discounted = quantity * unitPrice * (1 - discount / 100)
    const rate = tax ? Number(tax.rate_percent) / 100 : 0
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0
    const roundedUntaxed = money2(untaxed)
    const roundedTax = money2(taxAmount)
    amountUntaxed += roundedUntaxed
    amountTax += roundedTax
    debitLines.push({ account_id: accountId, amount: roundedUntaxed, label: description })
    if (roundedTax > 0.005) {
      if (!tax?.tax_account_id) throw inputError(`Line ${index + 1}: selected tax has no tax account`)
      debitLines.push({ account_id: tax.tax_account_id, amount: roundedTax, label: tax.name })
    }
    preparedLines.push({
      sequence,
      product_id: originalLine.product_id,
      description,
      quantity,
      unit_price: unitPrice,
      discount_percent: discount,
      tax_id: originalLine.tax_id,
      income_account_id: accountId,
      subtotal: roundedUntaxed,
    })
    sequence += 10
  }

  amountUntaxed = money2(amountUntaxed)
  amountTax = money2(amountTax)
  const amountTotal = money2(amountUntaxed + amountTax)
  if (amountTotal <= 0 || !preparedLines.length) {
    throw inputError('Credit note total must be greater than zero — set at least one quantity to credit')
  }

  const creditedAmount = await prisma.customer_invoices.aggregate({
    where: {
      document_type: 'credit_note',
      reversed_invoice_id: original.id,
      state: { in: ['posted', 'draft'] },
      ...(excludeCreditId ? { id: { not: excludeCreditId } } : {}),
    },
    _sum: { amount_total: true },
  })
  const creditableAmount = money2(Number(original.amount_total) - Number(creditedAmount._sum.amount_total || 0))
  if (amountTotal > creditableAmount + 0.005) {
    throw inputError(`Credit note total cannot exceed the remaining creditable amount of ${creditableAmount.toFixed(2)}`)
  }

  const reasonText =
    typeof input.notes === 'string' && input.notes.trim().startsWith('{')
      ? parseCreditNotesMeta(input.notes).reason_text
      : String(input.notes || input.reason || '').trim()
  const settlementMethod = String(input.settlement_method || 'customer_credit').toLowerCase()
  if (!SETTLEMENT_METHODS.has(settlementMethod)) {
    throw inputError('Credit settlement method must be customer_credit or cash_refund')
  }

  return {
    original,
    settlementMethod,
    header: {
      company_id: original.company_id,
      document_type: 'credit_note',
      customer_id: original.customer_id,
      journal_id: original.journal_id,
      fiscal_period_id: fiscalPeriod.id,
      invoice_date: creditDate,
      due_date: creditDate,
      payment_term_id: null,
      currency_id: original.currency_id,
      exchange_rate: original.exchange_rate,
      receivable_account_id: original.receivable_account_id,
      reversed_invoice_id: original.id,
      customer_reference: String(input.customer_reference || '').trim() || null,
      state: 'draft',
      payment_state: 'not_paid',
      amount_untaxed: amountUntaxed,
      amount_tax: amountTax,
      amount_total: amountTotal,
      paid_amount: 0,
      amount_due: amountTotal,
      notes: buildCreditNotes(reasonText, lineMeta, null, { settlement_method: settlementMethod }),
    },
    lines: preparedLines,
    debitLines,
    lineMeta,
  }
}

function journalItems(prepared, { appliedToAr, customerLiability, settlementMethod, advanceAccountId, refundPayableAccountId } = {}) {
  const rate = Number(prepared.header.exchange_rate || 1)
  const grouped = new Map()
  for (const row of prepared.debitLines) {
    grouped.set(row.account_id, (grouped.get(row.account_id) || 0) + row.amount)
  }
  const items = [...grouped.entries()].map(([accountId, amount], index) => ({
    sequence: (index + 1) * 10,
    account_id: accountId,
    label: 'Sales return',
    debit: money2(amount * rate),
    credit: 0,
    currency_id: prepared.header.currency_id,
    amount_currency: money2(amount),
  }))

  const arAmount = money2(appliedToAr ?? prepared.header.amount_total)
  const liabilityAmount = money2(customerLiability ?? 0)
  let sequence = (items.length + 1) * 10

  if (arAmount > 0.005) {
    items.push({
      sequence,
      account_id: prepared.header.receivable_account_id,
      label: 'Accounts Receivable',
      partner_type: 'customer',
      partner_id: prepared.header.customer_id,
      debit: 0,
      credit: money2(arAmount * rate),
      currency_id: prepared.header.currency_id,
      amount_currency: -arAmount,
    })
    sequence += 10
  }
  if (liabilityAmount > 0.005) {
    const method = settlementMethod === 'cash_refund' ? 'cash_refund' : 'customer_credit'
    if (method === 'cash_refund') {
      if (!refundPayableAccountId) throw inputError('Customer Refund Payable account (2150) was not found')
      items.push({
        sequence,
        account_id: refundPayableAccountId,
        label: 'Customer Refund Payable',
        partner_type: 'customer',
        partner_id: prepared.header.customer_id,
        debit: 0,
        credit: money2(liabilityAmount * rate),
        currency_id: prepared.header.currency_id,
        amount_currency: -liabilityAmount,
      })
    } else {
      if (!advanceAccountId) throw inputError('Customer Advances account (2140) was not found for customer credit')
      items.push({
        sequence,
        account_id: advanceAccountId,
        label: 'Customer Credit / Advances',
        partner_type: 'customer',
        partner_id: prepared.header.customer_id,
        debit: 0,
        credit: money2(liabilityAmount * rate),
        currency_id: prepared.header.currency_id,
        amount_currency: -liabilityAmount,
      })
    }
  }

  const debit = items.reduce((sum, row) => sum + Number(row.debit), 0)
  const credit = items.reduce((sum, row) => sum + Number(row.credit), 0)
  if (Math.abs(debit - credit) > 0.005 && items.length >= 2) {
    const lastCredit = items[items.length - 1]
    lastCredit.credit = money2(Number(lastCredit.credit) + (debit - credit))
  }
  return items
}

function settlementSplit(originalOutstanding, creditTotal) {
  const total = money2(creditTotal)
  const outstanding = money2(originalOutstanding)
  const appliedToAr = money2(Math.min(total, outstanding))
  const customerCredit = money2(Math.max(0, total - appliedToAr))
  return { appliedToAr, customerCredit }
}

function buildDebitLinesFromCredit(credit) {
  const debitLines = []
  for (const line of credit.customer_invoice_lines || []) {
    debitLines.push({ account_id: line.income_account_id, amount: money2(line.subtotal), label: line.description })
  }
  const taxByAccount = new Map()
  for (const line of credit.customer_invoice_lines || []) {
    if (!line.tax_id) continue
    const tax = line.taxes
    if (!tax?.tax_account_id) continue
    const qty = Number(line.quantity)
    const price = Number(line.unit_price)
    const disc = Number(line.discount_percent || 0)
    const discounted = qty * price * (1 - disc / 100)
    const rate = Number(tax.rate_percent || 0) / 100
    const untaxed = tax.price_includes_tax && rate ? discounted / (1 + rate) : discounted
    const taxAmount = tax.price_includes_tax ? discounted - untaxed : untaxed * rate
    taxByAccount.set(tax.tax_account_id, (taxByAccount.get(tax.tax_account_id) || 0) + money2(taxAmount))
  }
  const taxSum = money2([...taxByAccount.values()].reduce((sum, value) => sum + value, 0))
  if (taxSum <= 0.005 && money2(credit.amount_tax) > 0.005 && debitLines.length) {
    const firstTaxLine = (credit.customer_invoice_lines || []).find((line) => line.taxes?.tax_account_id)
    if (firstTaxLine?.taxes?.tax_account_id) {
      taxByAccount.set(firstTaxLine.taxes.tax_account_id, money2(credit.amount_tax))
    }
  }
  for (const [accountId, taxAmount] of taxByAccount.entries()) {
    if (taxAmount > 0.005) debitLines.push({ account_id: accountId, amount: money2(taxAmount), label: 'Tax' })
  }
  return debitLines
}

async function journalItemsForPrepared(tx, prepared) {
  const outstanding = money2(prepared.original.amount_due)
  const { appliedToAr, customerCredit: customerLiability } = settlementSplit(outstanding, prepared.header.amount_total)
  const method = prepared.settlementMethod || 'customer_credit'
  const advanceAccount =
    method === 'customer_credit' && customerLiability > 0.005
      ? await ensureCustomerAdvanceAccount(tx, prepared.original.company_id)
      : null
  const refundPayableAccount =
    method === 'cash_refund' && customerLiability > 0.005
      ? await ensureCustomerRefundPayableAccount(tx, prepared.original.company_id)
      : null
  if (method === 'customer_credit' && customerLiability > 0.005 && !advanceAccount) {
    throw inputError('Customer Advances account (2140) was not found for customer credit preview')
  }
  if (method === 'cash_refund' && customerLiability > 0.005 && !refundPayableAccount) {
    throw inputError('Customer Refund Payable account (2150) was not found for cash refund preview')
  }
  return journalItems(prepared, {
    appliedToAr,
    customerLiability,
    settlementMethod: method,
    advanceAccountId: advanceAccount?.id,
    refundPayableAccountId: refundPayableAccount?.id,
  })
}

async function allocateNumber(tx, journal) {
  for (;;) {
    const updated = await tx.journals.update({
      where: { id: journal.id },
      data: { next_sequence: { increment: 1 } },
      select: { next_sequence: true },
    })
    const number = `CN${String(updated.next_sequence - 1).padStart(4, '0')}`
    const exists = await tx.customer_invoices.findFirst({
      where: { company_id: journal.company_id, invoice_number: number },
      select: { id: true },
    })
    if (!exists) return number
  }
}

function enrichCreditNote(note) {
  if (!note) return note
  const meta = parseCreditNotesMeta(note.notes)
  const appliedToAr = money2(meta.settlement?.applied_to_ar || note.paid_amount || 0)
  const settlementMethod = meta.settlement_method || 'customer_credit'
  const liabilityPosted = money2(meta.settlement?.customer_credit ?? meta.settlement?.refund_payable ?? 0)
  const remainingBalance = money2(note.amount_due ?? 0)
  const refundPaid = money2(
    (meta.refund_payments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  )
  const refundPayableRemaining = settlementMethod === 'cash_refund' ? remainingBalance : 0
  const customerCreditAvailable = settlementMethod === 'customer_credit' ? remainingBalance : 0
  return {
    ...note,
    reason: meta.reason_text,
    line_meta: meta.line_meta,
    settlement: meta.settlement,
    settlement_method: settlementMethod,
    refund_status:
      settlementMethod === 'cash_refund'
        ? refundStatusFromAmounts(liabilityPosted, refundPaid)
        : meta.refund_status || 'not_refunded',
    refund_payments: meta.refund_payments || [],
    refund_payable: refundPayableRemaining,
    refund_paid: refundPaid,
    customer_credit: customerCreditAvailable,
    customer_credit_status:
      settlementMethod === 'customer_credit'
        ? customerCreditStatus(customerCreditAvailable, liabilityPosted)
        : null,
    applied_to_ar: appliedToAr,
    state: note.state === 'cancelled' ? note.state : note.state,
    display_state: note.state === 'cancelled' ? 'void' : note.state,
  }
}

export const getCreditableInvoice = async (req, res) => {
  const invoiceId = asId(req.params.invoiceId)
  const excludeCreditId = asId(req.query.exclude_credit_id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const original = await prisma.customer_invoices.findUnique({
      where: { id: invoiceId },
      include: {
        customers: { select: { id: true, name: true } },
        currencies: { select: { id: true, code: true, symbol: true } },
        customer_invoice_lines: {
          orderBy: { sequence: 'asc' },
          include: { taxes: { select: { id: true, name: true, rate_percent: true, price_includes_tax: true } }, products: true },
        },
      },
    })
    if (!original || original.document_type !== 'invoice' || original.state !== 'posted') {
      return res.status(400).json({ success: false, message: 'Select a posted customer invoice' })
    }
    const creditedQty = await getCreditedQuantities(original.id, excludeCreditId)
    const creditedAmount = await prisma.customer_invoices.aggregate({
      where: {
        document_type: 'credit_note',
        reversed_invoice_id: original.id,
        state: { in: ['posted', 'draft'] },
        ...(excludeCreditId ? { id: { not: excludeCreditId } } : {}),
      },
      _sum: { amount_total: true },
    })
    const creditedTotal = money2(creditedAmount._sum.amount_total || 0)
    const creditableAmount = money2(Math.max(0, Number(original.amount_total) - creditedTotal))
    const lines = original.customer_invoice_lines.map((line) => {
      const already = Number(
        creditedQty.get(line.id) ||
        creditedQty.get(`${String(line.description || '').trim().toLowerCase()}|${Number(line.unit_price)}`) ||
        0
      )
      const remainingQty = money2(Math.max(0, Number(line.quantity) - already))
      return {
        original_line_id: line.id,
        product_id: line.product_id,
        description: line.description,
        quantity: Number(line.quantity),
        credited_quantity: already,
        remaining_quantity: remainingQty,
        unit_price: Number(line.unit_price),
        discount_percent: Number(line.discount_percent || 0),
        tax_id: line.tax_id,
        income_account_id: line.income_account_id,
        tax_rate: line.taxes ? Number(line.taxes.rate_percent) : 0,
        price_includes_tax: Boolean(line.taxes?.price_includes_tax),
      }
    })
    res.json({
      success: true,
      data: {
        invoice: {
          id: original.id,
          invoice_number: original.invoice_number,
          invoice_date: original.invoice_date,
          amount_total: Number(original.amount_total),
          amount_due: Number(original.amount_due),
          paid_amount: Number(original.paid_amount),
          payment_state: original.payment_state,
          customer_id: original.customer_id,
          customers: original.customers,
          currencies: original.currencies,
        },
        creditable_amount: creditableAmount,
        credited_amount: creditedTotal,
        lines,
      },
    })
  } catch (error) {
    fail(res, error, 'Failed to load creditable invoice')
  }
}

export const getAll = async (req, res) => {
  try {
    const data = await prisma.customer_invoices.findMany({
      where: { document_type: 'credit_note' },
      include,
      orderBy: { created_at: 'desc' },
    })
    res.json({ success: true, data: data.map(enrichCreditNote) })
  } catch (error) {
    fail(res, error, 'Failed to fetch credit notes')
  }
}

export const getById = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    const data = await prisma.customer_invoices.findFirst({
      where: { id: creditId, document_type: 'credit_note' },
      include,
    })
    if (!data) return res.status(404).json({ success: false, message: 'Credit note not found' })
    res.json({ success: true, data: enrichCreditNote(data) })
  } catch (error) {
    fail(res, error, 'Failed to fetch credit note')
  }
}

export const create = async (req, res) => {
  try {
    const prepared = await prepare(req.body)
    const creditId = await prisma.$transaction(async (tx) => {
      const number = await allocateNumber(tx, prepared.original.journals)
      const credit = await tx.customer_invoices.create({
        data: {
          ...prepared.header,
          invoice_number: number,
          customer_invoice_lines: { create: prepared.lines },
        },
      })
      const jeItems = await journalItemsForPrepared(tx, prepared)
      const entry = await tx.journal_entries.create({
        data: {
          company_id: prepared.header.company_id,
          journal_id: prepared.header.journal_id,
          entry_number: number,
          entry_date: prepared.header.invoice_date,
          fiscal_period_id: prepared.header.fiscal_period_id,
          reference: prepared.original.invoice_number,
          narration: `Draft credit note ${number} for ${prepared.original.invoice_number}`,
          state: 'draft',
          source_type: 'customer_invoice',
          source_id: credit.id,
          journal_items: { create: jeItems },
        },
      })
      await tx.customer_invoices.update({ where: { id: credit.id }, data: { journal_entry_id: entry.id } })
      return credit.id
    }, transactionOptions)
    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    await logAudit({
      userId: req.user?.id,
      action: 'Created',
      entity: 'CreditNote',
      entityId: creditId,
      description: `Created draft credit note "${data.invoice_number}"`,
    })
    res.status(201).json({ success: true, message: 'Draft credit note created successfully', data: enrichCreditNote(data) })
  } catch (error) {
    fail(res, error, 'Failed to create credit note')
  }
}

export const update = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    const existing = await prisma.customer_invoices.findFirst({
      where: { id: creditId, document_type: 'credit_note' },
    })
    if (!existing) return res.status(404).json({ success: false, message: 'Credit note not found' })
    if (existing.state !== 'draft') throw inputError('Only draft credit notes can be edited')
    const prepared = await prepare(req.body, { excludeCreditId: creditId })
    await prisma.$transaction(async (tx) => {
      await tx.customer_invoice_lines.deleteMany({ where: { invoice_id: creditId } })
      await tx.customer_invoices.update({
        where: { id: creditId },
        data: {
          ...prepared.header,
          invoice_number: existing.invoice_number,
          customer_invoice_lines: { create: prepared.lines },
          updated_at: new Date(),
        },
      })
      if (!existing.journal_entry_id) throw inputError('Linked draft journal entry is missing')
      const entry = await tx.journal_entries.findUnique({ where: { id: existing.journal_entry_id } })
      if (!entry || entry.state !== 'draft') throw inputError('Linked journal entry is not editable')
      const jeItems = await journalItemsForPrepared(tx, prepared)
      await tx.journal_items.deleteMany({ where: { entry_id: entry.id } })
      await tx.journal_entries.update({
        where: { id: entry.id },
        data: {
          company_id: prepared.header.company_id,
          journal_id: prepared.header.journal_id,
          entry_date: prepared.header.invoice_date,
          fiscal_period_id: prepared.header.fiscal_period_id,
          reference: prepared.original.invoice_number,
          narration: `Draft credit note ${existing.invoice_number} for ${prepared.original.invoice_number}`,
          source_id: creditId,
          journal_items: { create: jeItems },
        },
      })
    }, transactionOptions)
    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    res.json({ success: true, message: 'Draft credit note updated successfully', data: enrichCreditNote(data) })
  } catch (error) {
    fail(res, error, 'Failed to update credit note')
  }
}

export const remove = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    const existing = await prisma.customer_invoices.findFirst({
      where: { id: creditId, document_type: 'credit_note' },
    })
    if (!existing) return res.status(404).json({ success: false, message: 'Credit note not found' })
    if (existing.state !== 'draft') throw inputError('Only draft credit notes can be deleted')
    await prisma.$transaction(async (tx) => {
      await tx.customer_invoices.delete({ where: { id: creditId } })
      if (existing.journal_entry_id) {
        await tx.journal_entries.deleteMany({ where: { id: existing.journal_entry_id, state: 'draft' } })
      }
    }, transactionOptions)
    res.json({ success: true, message: 'Draft credit note deleted successfully' })
  } catch (error) {
    fail(res, error, 'Failed to delete credit note')
  }
}

export const post = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    await prisma.$transaction(async (tx) => {
      const credit = await tx.customer_invoices.findUnique({
        where: { id: creditId },
        include: {
          journal_entries: { include: { journal_items: true } },
          fiscal_periods: { include: { fiscal_years: true } },
          customer_invoices: true,
          customer_invoice_lines: { include: { taxes: true } },
        },
      })
      if (!credit || credit.document_type !== 'credit_note') throw inputError('Credit note not found')
      if (credit.state !== 'draft') throw inputError('Only draft credit notes can be posted')
      if (!credit.journal_entries || credit.journal_entries.state !== 'draft') {
        throw inputError('Linked draft journal entry is invalid')
      }
      if (
        !credit.fiscal_periods ||
        credit.fiscal_periods.state !== 'open' ||
        credit.fiscal_periods.fiscal_years.state !== 'open'
      ) {
        throw inputError('Credit note fiscal period is closed')
      }

      const amount = money2(credit.amount_total)
      const original = credit.customer_invoices
      if (!original || original.state !== 'posted' || original.document_type !== 'invoice') {
        throw inputError('Original invoice is no longer eligible')
      }

      const creditedAgg = await tx.customer_invoices.aggregate({
        where: {
          document_type: 'credit_note',
          reversed_invoice_id: original.id,
          state: 'posted',
          id: { not: creditId },
        },
        _sum: { amount_total: true },
      })
      const creditableAtPost = money2(Number(original.amount_total) - Number(creditedAgg._sum.amount_total || 0))
      if (amount > creditableAtPost + 0.005) {
        throw inputError(`Credit note total cannot exceed the remaining creditable amount of ${creditableAtPost.toFixed(2)}`)
      }

      // Re-validate remaining quantities at post time.
      const creditedQty = await getCreditedQuantities(original.id, creditId, { states: ['posted'] }, tx)
      const originalLines = await tx.customer_invoice_lines.findMany({ where: { invoice_id: original.id } })
      const originalById = new Map(originalLines.map((row) => [row.id, row]))
      const meta = parseCreditNotesMeta(credit.notes)
      for (const row of meta.line_meta || []) {
        const qty = Number(row.quantity || 0)
        if (qty <= 0) continue
        const originalLine = originalById.get(asId(row.original_line_id))
        if (!originalLine) throw inputError('Credit note line no longer matches the original invoice')
        const already = Number(creditedQty.get(originalLine.id) || 0)
        const remaining = Math.max(0, Number(originalLine.quantity) - already)
        if (qty > remaining + 0.0001) {
          throw inputError(`Quantity for "${originalLine.description}" exceeds remaining creditable quantity ${remaining}`)
        }
      }

      await tx.$queryRawUnsafe('SELECT id FROM customer_invoices WHERE id = ? FOR UPDATE', original.id)
      const currentOriginal = await tx.customer_invoices.findUnique({ where: { id: original.id } })
      const outstanding = money2(currentOriginal.amount_due)
      const appliedToAr = money2(Math.min(amount, outstanding))
      const customerLiability = money2(Math.max(0, amount - appliedToAr))
      const settlementMethod = meta.settlement_method || 'customer_credit'

      const advanceAccount =
        settlementMethod === 'customer_credit' && customerLiability > 0.005
          ? await ensureCustomerAdvanceAccount(tx, credit.company_id)
          : null
      const refundPayableAccount =
        settlementMethod === 'cash_refund' && customerLiability > 0.005
          ? await ensureCustomerRefundPayableAccount(tx, credit.company_id)
          : null
      if (settlementMethod === 'customer_credit' && customerLiability > 0.005 && !advanceAccount) {
        throw inputError('Customer Advances account (2140) was not found for customer credit')
      }
      if (settlementMethod === 'cash_refund' && customerLiability > 0.005 && !refundPayableAccount) {
        throw inputError('Customer Refund Payable account (2150) was not found for cash refund')
      }

      const preparedForJe = {
        header: {
          amount_total: amount,
          exchange_rate: credit.exchange_rate,
          currency_id: credit.currency_id,
          receivable_account_id: credit.receivable_account_id,
          customer_id: credit.customer_id,
        },
        debitLines: buildDebitLinesFromCredit(credit),
      }
      await tx.journal_items.deleteMany({ where: { entry_id: credit.journal_entries.id } })
      const rebuiltItems = journalItems(preparedForJe, {
        appliedToAr,
        customerLiability,
        settlementMethod,
        advanceAccountId: advanceAccount?.id,
        refundPayableAccountId: refundPayableAccount?.id,
      })
      await tx.journal_entries.update({
        where: { id: credit.journal_entries.id },
        data: { journal_items: { create: rebuiltItems } },
      })

      const jeItems = await tx.journal_items.findMany({ where: { entry_id: credit.journal_entries.id } })
      const debit = jeItems.reduce((sum, row) => sum + Number(row.debit), 0)
      const journalCredit = jeItems.reduce((sum, row) => sum + Number(row.credit), 0)
      if (debit <= 0 || Math.abs(debit - journalCredit) > 0.005) {
        throw inputError('Credit note journal entry is unbalanced')
      }

      const postedAt = new Date()
      const settlementPayload = {
        applied_to_ar: appliedToAr,
        original_outstanding_before: outstanding,
        settlement_method: settlementMethod,
      }
      if (settlementMethod === 'cash_refund') {
        settlementPayload.refund_payable = customerLiability
        settlementPayload.customer_credit = 0
      } else {
        settlementPayload.customer_credit = customerLiability
        settlementPayload.refund_payable = 0
      }

      const claimed = await tx.customer_invoices.updateMany({
        where: { id: creditId, document_type: 'credit_note', state: 'draft' },
        data: {
          state: 'posted',
          posted_at: postedAt,
          amount_due: customerLiability,
          paid_amount: appliedToAr,
          payment_state:
            settlementMethod === 'cash_refund'
              ? customerLiability > 0.005
                ? 'partial'
                : 'paid'
              : customerLiability > 0.005
                ? 'partial'
                : 'reversed',
          notes: buildCreditNotes(meta.reason_text, meta.line_meta, settlementPayload, {
            settlement_method: settlementMethod,
            refund_status: settlementMethod === 'cash_refund' && customerLiability > 0.005 ? 'not_refunded' : 'not_refunded',
            refund_payments: meta.refund_payments || [],
            credit_applications: meta.credit_applications || [],
          }),
          updated_at: postedAt,
        },
      })
      if (claimed.count !== 1) throw inputError('Credit note was already posted by another request')

      const credited = await tx.customer_invoices.aggregate({
        where: { document_type: 'credit_note', reversed_invoice_id: original.id, state: 'posted' },
        _sum: { amount_total: true },
      })
      if (Number(credited._sum.amount_total || 0) > Number(original.amount_total) + 0.005) {
        throw inputError('Credit notes exceed the original invoice total')
      }

      if (appliedToAr > 0.005) {
        const remainingDue = money2(Math.max(0, outstanding - appliedToAr))
        let nextPaymentState = currentOriginal.payment_state
        if (remainingDue <= 0.005 && Number(currentOriginal.paid_amount || 0) > 0.005) nextPaymentState = 'paid'
        else if (remainingDue > 0.005 && Number(currentOriginal.paid_amount || 0) > 0.005) nextPaymentState = 'partial'
        else if (remainingDue > 0.005) nextPaymentState = 'not_paid'
        await tx.customer_invoices.update({
          where: { id: original.id },
          data: {
            amount_due: remainingDue,
            payment_state: nextPaymentState,
            updated_at: postedAt,
          },
        })
      }

      if (settlementMethod === 'customer_credit' && customerLiability > 0.005) {
        const paymentMethod = await defaultInboundPaymentMethod(tx)
        if (!paymentMethod) throw inputError('Configure an inbound payment method before posting customer credit')
        await tx.customer_receipts.create({
          data: {
            company_id: credit.company_id,
            customer_id: credit.customer_id,
            journal_id: credit.journal_id,
            payment_method_id: paymentMethod.id,
            fiscal_period_id: credit.fiscal_period_id,
            receipt_number: `${credit.invoice_number}-ADV`,
            receipt_date: credit.invoice_date,
            currency_id: credit.currency_id,
            exchange_rate: credit.exchange_rate,
            amount: customerLiability,
            unallocated_amount: customerLiability,
            reference: credit.invoice_number,
            memo: JSON.stringify({ credit_note_id: creditId, source: 'credit_note_customer_credit' }),
            state: 'posted',
            posted_at: postedAt,
          },
        })
      }

      const liabilityLabel =
        settlementMethod === 'cash_refund'
          ? `refund payable ${customerLiability.toFixed(2)}`
          : `customer credit ${customerLiability.toFixed(2)}`

      const claimedEntry = await tx.journal_entries.updateMany({
        where: {
          id: credit.journal_entries.id,
          state: 'draft',
          source_type: 'customer_invoice',
          source_id: creditId,
        },
        data: {
          state: 'posted',
          posted_at: postedAt,
          narration:
            customerLiability > 0.005 || appliedToAr > 0.005
              ? `Credit note ${credit.invoice_number} for ${original.invoice_number} (AR ${appliedToAr.toFixed(2)} + ${liabilityLabel})`
              : `Credit note ${credit.invoice_number} for ${original.invoice_number}`,
        },
      })
      if (claimedEntry.count !== 1) throw inputError('Credit note journal entry has already been posted')
    }, transactionOptions)

    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    await logAudit({
      userId: req.user?.id,
      action: 'Posted',
      entity: 'CreditNote',
      entityId: creditId,
      description: `Posted credit note "${data.invoice_number}"`,
    })
    res.json({ success: true, message: 'Credit note posted successfully', data: enrichCreditNote(data) })
  } catch (error) {
    fail(res, error, 'Failed to post credit note')
  }
}

export const cancel = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    await prisma.$transaction(async (tx) => {
      const credit = await tx.customer_invoices.findUnique({
        where: { id: creditId },
        include: {
          journal_entries: { include: { journal_items: true, journals: true } },
          customer_invoices: true,
        },
      })
      if (!credit || credit.document_type !== 'credit_note') throw inputError('Credit note not found')
      if (credit.state !== 'posted') throw inputError('Only posted credit notes can be cancelled')
      if (!credit.journal_entries || credit.journal_entries.state !== 'posted') {
        throw inputError('Posted journal entry is missing')
      }
      const meta = parseCreditNotesMeta(credit.notes)
      const settlement = meta.settlement || {}
      const appliedToAr = money2(settlement.applied_to_ar || credit.paid_amount || 0)
      if (meta.settlement_method === 'cash_refund' && (meta.refund_payments || []).length) {
        throw inputError('Cash refunds were recorded against this credit note and it cannot be voided')
      }
      const liabilityPosted = money2(
        meta.settlement_method === 'cash_refund'
          ? settlement.refund_payable || credit.amount_due || 0
          : settlement.customer_credit || credit.amount_due || 0
      )
      if (
        meta.settlement_method === 'customer_credit' &&
        liabilityPosted > 0.005 &&
        Number(credit.amount_due || 0) + 0.05 < liabilityPosted
      ) {
        throw inputError('This customer credit has already been applied and cannot be voided')
      }
      if (meta.settlement_method === 'cash_refund' && liabilityPosted > 0.005 && Number(credit.amount_due || 0) + 0.05 < liabilityPosted) {
        throw inputError('Refund payable balance does not match the original posting and cannot be voided')
      }

      const existingReversal = await tx.journal_entries.findFirst({
        where: { reversed_entry_id: credit.journal_entries.id },
        select: { id: true },
      })
      if (existingReversal) throw inputError('Credit note has already been reversed')

      const original = credit.customer_invoices
      if (!original) throw inputError('Original invoice link is missing')

      const reversalItems = credit.journal_entries.journal_items.map((line, index) => ({
        sequence: (index + 1) * 10,
        account_id: line.account_id,
        label: 'Credit note cancellation',
        partner_type: line.partner_type,
        partner_id: line.partner_id,
        debit: line.credit,
        credit: line.debit,
        currency_id: line.currency_id,
        amount_currency: line.amount_currency != null ? Number(line.amount_currency) * -1 : null,
      }))
      await tx.journal_entries.create({
        data: {
          company_id: credit.journal_entries.company_id,
          journal_id: credit.journal_entries.journal_id,
          entry_number: `${credit.invoice_number}-REV`.slice(0, 32),
          entry_date: new Date(),
          fiscal_period_id: credit.journal_entries.fiscal_period_id,
          reference: `CN-CANCEL-${credit.id}`.slice(0, 64),
          narration: `Cancellation of credit note ${credit.invoice_number}`,
          state: 'posted',
          source_type: 'customer_invoice',
          source_id: credit.id,
          reversed_entry_id: credit.journal_entries.id,
          posted_at: new Date(),
          journal_items: { create: reversalItems },
        },
      })

      if (appliedToAr > 0.005) {
        const currentOriginal = await tx.customer_invoices.findUnique({ where: { id: original.id } })
        const nextDue = money2(Number(currentOriginal.amount_due || 0) + appliedToAr)
        await tx.customer_invoices.update({
          where: { id: original.id },
          data: {
            amount_due: nextDue,
            payment_state: nextDue <= 0.005 ? 'paid' : Number(currentOriginal.paid_amount || 0) > 0.005 ? 'partial' : 'not_paid',
            updated_at: new Date(),
          },
        })
      }

      await tx.customer_invoices.update({
        where: { id: creditId },
        data: {
          state: 'cancelled',
          amount_due: 0,
          payment_state: 'cancelled',
          updated_at: new Date(),
        },
      })
    }, transactionOptions)

    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    await logAudit({
      userId: req.user?.id,
      action: 'Cancelled',
      entity: 'CreditNote',
      entityId: creditId,
      description: `Cancelled posted credit note "${data.invoice_number}"`,
    })
    res.json({ success: true, message: 'Credit note voided successfully', data: enrichCreditNote(data) })
  } catch (error) {
    fail(res, error, 'Failed to void credit note')
  }
}

export const recordRefund = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  const paymentMethodId = asId(req.body.payment_method_id)
  const refundDate = asDate(req.body.payment_date || req.body.refund_date)
  const amount = money2(req.body.amount)
  if (!paymentMethodId || !refundDate) return res.status(400).json({ success: false, message: 'Payment method and refund date are required' })
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Refund amount must be greater than zero' })
  const reference = String(req.body.reference || '').trim() || null
  const refundNotes = String(req.body.notes || req.body.memo || '').trim() || null
  try {
    await prisma.$transaction(async (tx) => {
      const credit = await tx.customer_invoices.findUnique({ where: { id: creditId } })
      if (!credit || credit.document_type !== 'credit_note' || credit.state !== 'posted') {
        throw inputError('Posted credit note not found')
      }
      const meta = parseCreditNotesMeta(credit.notes)
      if (meta.settlement_method !== 'cash_refund') {
        throw inputError('Cash refunds can only be recorded on credit notes posted for cash refund settlement')
      }
      const remaining = money2(credit.amount_due)
      if (amount > remaining + 0.005) {
        throw inputError(`Refund amount cannot exceed the remaining refund payable of ${remaining.toFixed(2)}`)
      }
      const duplicate = await tx.journal_entries.findFirst({
        where: {
          source_type: 'customer_receipt',
          reference: reference || undefined,
          state: 'posted',
          narration: { contains: credit.invoice_number },
        },
      })
      if (reference && duplicate) throw inputError('A refund with this reference was already recorded')

      const method = await tx.payment_methods.findUnique({ where: { id: paymentMethodId } })
      const { account: paymentAccount, journal } = await resolveOutboundPaymentAccount({
        companyId: credit.company_id,
        method,
        currencyId: credit.currency_id,
      })
      if (method.requires_reference && !reference) throw inputError('Reference number is required for this payment method')
      const refundPayable = await ensureCustomerRefundPayableAccount(tx, credit.company_id)
      if (!refundPayable) throw inputError('Customer Refund Payable account (2150) was not found')

      const fiscalPeriod = await tx.fiscal_periods.findFirst({
        where: {
          state: 'open',
          start_date: { lte: refundDate },
          end_date: { gte: refundDate },
          fiscal_years: { company_id: credit.company_id, state: 'open' },
        },
      })
      if (!fiscalPeriod) throw inputError('No open fiscal period covers the refund date')

      const rate = Number(credit.exchange_rate || 1)
      const baseAmount = money2(amount * rate)
      const receiptNumber = `${credit.invoice_number}-RF${String((meta.refund_payments?.length || 0) + 1).padStart(2, '0')}`
      const postedAt = new Date()
      const receipt = await tx.customer_receipts.create({
        data: {
          company_id: credit.company_id,
          customer_id: credit.customer_id,
          journal_id: journal.id,
          payment_method_id: paymentMethodId,
          fiscal_period_id: fiscalPeriod.id,
          receipt_number: receiptNumber,
          receipt_date: refundDate,
          currency_id: credit.currency_id,
          exchange_rate: credit.exchange_rate,
          amount,
          unallocated_amount: 0,
          reference,
          memo: JSON.stringify({
            type: 'customer_refund',
            credit_note_id: creditId,
            notes: refundNotes,
          }),
          state: 'posted',
          posted_at: postedAt,
        },
      })

      const entry = await tx.journal_entries.create({
        data: {
          company_id: credit.company_id,
          journal_id: journal.id,
          entry_number: receiptNumber,
          entry_date: refundDate,
          fiscal_period_id: fiscalPeriod.id,
          reference: reference || receiptNumber,
          narration: `Customer refund for credit note ${credit.invoice_number}`,
          state: 'posted',
          source_type: 'customer_receipt',
          source_id: receipt.id,
          posted_at: postedAt,
          journal_items: {
            create: [
              {
                sequence: 10,
                account_id: refundPayable.id,
                label: 'Customer Refund Payable',
                partner_type: 'customer',
                partner_id: credit.customer_id,
                debit: baseAmount,
                credit: 0,
                currency_id: credit.currency_id,
                amount_currency: amount,
              },
              {
                sequence: 20,
                account_id: paymentAccount.id,
                label: 'Customer refund payment',
                partner_type: 'customer',
                partner_id: credit.customer_id,
                debit: 0,
                credit: baseAmount,
                currency_id: credit.currency_id,
                amount_currency: -amount,
              },
            ],
          },
        },
      })
      await tx.customer_receipts.update({ where: { id: receipt.id }, data: { journal_entry_id: entry.id } })

      const refundPayments = [...(meta.refund_payments || [])]
      refundPayments.push({
        id: receipt.id,
        amount,
        payment_date: refundDate,
        reference,
        notes: refundNotes,
        journal_entry_id: entry.id,
        payment_method_id: paymentMethodId,
      })
      const newDue = money2(remaining - amount)
      const totalRefunded = money2(refundPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0))
      const originalPayable = money2(meta.settlement?.refund_payable || meta.settlement?.customer_credit || 0)
      const refundStatus = refundStatusFromAmounts(originalPayable, totalRefunded)

      await tx.customer_invoices.update({
        where: { id: creditId },
        data: {
          amount_due: newDue,
          payment_state: newDue <= 0.005 ? 'paid' : 'partial',
          notes: buildCreditNotes(meta.reason_text, meta.line_meta, meta.settlement, {
            settlement_method: meta.settlement_method,
            refund_status: refundStatus,
            refund_payments: refundPayments,
            credit_applications: meta.credit_applications || [],
          }),
          updated_at: postedAt,
        },
      })
    }, transactionOptions)

    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    await logAudit({
      userId: req.user?.id,
      action: 'Refunded',
      entity: 'CreditNote',
      entityId: creditId,
      description: `Recorded customer refund against "${data.invoice_number}"`,
    })
    res.json({ success: true, message: 'Customer refund recorded successfully', data: enrichCreditNote(data) })
  } catch (error) {
    fail(res, error, 'Failed to record customer refund')
  }
}
