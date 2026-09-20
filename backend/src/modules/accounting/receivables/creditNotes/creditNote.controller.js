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

function parseCreditNotesMeta(notes) {
  if (!notes) return { reason_text: '', line_meta: [], settlement: null }
  try {
    const parsed = JSON.parse(String(notes))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        reason_text: String(parsed.reason_text || parsed.notes_text || ''),
        line_meta: Array.isArray(parsed.line_meta) ? parsed.line_meta : [],
        settlement: parsed.settlement || null,
      }
    }
  } catch {
    // plain text notes
  }
  return { reason_text: String(notes), line_meta: [], settlement: null }
}

function buildCreditNotes(reasonText, lineMeta, settlement = null) {
  return JSON.stringify({
    reason_text: String(reasonText || '').trim() || null,
    line_meta: lineMeta || [],
    settlement: settlement || null,
  })
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

/**
 * Sum posted credit quantities per original invoice line id.
 */
async function getCreditedQuantities(originalId, excludeCreditId = null) {
  const credits = await prisma.customer_invoices.findMany({
    where: {
      document_type: 'credit_note',
      reversed_invoice_id: originalId,
      state: 'posted',
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
      state: 'posted',
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

  return {
    original,
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
      notes: buildCreditNotes(reasonText, lineMeta),
    },
    lines: preparedLines,
    debitLines,
    lineMeta,
  }
}

function journalItems(prepared, { appliedToAr, customerCredit, advanceAccountId } = {}) {
  const rate = Number(prepared.header.exchange_rate || 1)
  const grouped = new Map()
  for (const row of prepared.debitLines) {
    grouped.set(row.account_id, (grouped.get(row.account_id) || 0) + row.amount)
  }
  const items = [...grouped.entries()].map(([accountId, amount], index) => ({
    sequence: (index + 1) * 10,
    account_id: accountId,
    label: 'Customer credit note',
    debit: money2(amount * rate),
    credit: 0,
    currency_id: prepared.header.currency_id,
    amount_currency: money2(amount),
  }))

  const arAmount = money2(appliedToAr ?? prepared.header.amount_total)
  const advanceAmount = money2(customerCredit ?? 0)
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
  if (advanceAmount > 0.005) {
    if (!advanceAccountId) throw inputError('Customer Advances account (2140) was not found for customer credit')
    items.push({
      sequence,
      account_id: advanceAccountId,
      label: 'Customer Credit / Advances',
      partner_type: 'customer',
      partner_id: prepared.header.customer_id,
      debit: 0,
      credit: money2(advanceAmount * rate),
      currency_id: prepared.header.currency_id,
      amount_currency: -advanceAmount,
    })
  }

  const debit = items.reduce((sum, row) => sum + Number(row.debit), 0)
  const credit = items.reduce((sum, row) => sum + Number(row.credit), 0)
  if (Math.abs(debit - credit) > 0.005 && items.length >= 2) {
    const lastCredit = items[items.length - 1]
    lastCredit.credit = money2(Number(lastCredit.credit) + (debit - credit))
  }
  return items
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
  return {
    ...note,
    reason: meta.reason_text,
    line_meta: meta.line_meta,
    settlement: meta.settlement,
    customer_credit: money2(meta.settlement?.customer_credit || 0),
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
    // Draft JE always credits AR for the full amount; post() rewrites settlement split if needed.
    const creditId = await prisma.$transaction(async (tx) => {
      const number = await allocateNumber(tx, prepared.original.journals)
      const credit = await tx.customer_invoices.create({
        data: {
          ...prepared.header,
          invoice_number: number,
          customer_invoice_lines: { create: prepared.lines },
        },
      })
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
          journal_items: { create: journalItems(prepared) },
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
          journal_items: { create: journalItems(prepared) },
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

      // Re-validate remaining quantities at post time.
      const creditedQty = await getCreditedQuantities(original.id, creditId)
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
      const customerCredit = money2(Math.max(0, amount - appliedToAr))

      const advanceAccount = customerCredit > 0.005
        ? await ensureCustomerAdvanceAccount(tx, credit.company_id)
        : null
      if (customerCredit > 0.005 && !advanceAccount) {
        throw inputError('Customer Advances account (2140) was not found for customer credit on a paid invoice')
      }

      // Rebuild JE items with AR vs Customer Credit split before posting.
      const debitLines = []
      for (const line of credit.customer_invoice_lines) {
        debitLines.push({ account_id: line.income_account_id, amount: money2(line.subtotal), label: line.description })
      }
      // Reconstruct tax debits from amount_tax grouped onto tax accounts from lines.
      const taxByAccount = new Map()
      for (const line of credit.customer_invoice_lines) {
        if (!line.tax_id || !line.taxes?.tax_account_id) continue
        const qty = Number(line.quantity)
        const price = Number(line.unit_price)
        const disc = Number(line.discount_percent || 0)
        const discounted = qty * price * (1 - disc / 100)
        const rate = Number(line.taxes.rate_percent || 0) / 100
        const untaxed = line.taxes.price_includes_tax && rate ? discounted / (1 + rate) : discounted
        const taxAmount = line.taxes.price_includes_tax ? discounted - untaxed : untaxed * rate
        const accountId = line.taxes.tax_account_id
        taxByAccount.set(accountId, (taxByAccount.get(accountId) || 0) + money2(taxAmount))
      }
      for (const [accountId, taxAmount] of taxByAccount.entries()) {
        if (taxAmount > 0.005) debitLines.push({ account_id: accountId, amount: money2(taxAmount), label: 'Tax' })
      }

      const preparedForJe = {
        header: {
          amount_total: amount,
          exchange_rate: credit.exchange_rate,
          currency_id: credit.currency_id,
          receivable_account_id: credit.receivable_account_id,
          customer_id: credit.customer_id,
        },
        debitLines,
      }
      await tx.journal_items.deleteMany({ where: { entry_id: credit.journal_entries.id } })
      const rebuiltItems = journalItems(preparedForJe, {
        appliedToAr,
        customerCredit,
        advanceAccountId: advanceAccount?.id,
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
      const claimed = await tx.customer_invoices.updateMany({
        where: { id: creditId, document_type: 'credit_note', state: 'draft' },
        data: {
          state: 'posted',
          posted_at: postedAt,
          amount_due: customerCredit,
          paid_amount: appliedToAr,
          payment_state: customerCredit > 0.005 ? 'partial' : 'reversed',
          notes: buildCreditNotes(meta.reason_text, meta.line_meta, {
            applied_to_ar: appliedToAr,
            customer_credit: customerCredit,
            original_outstanding_before: outstanding,
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

      const remainingDue = money2(Math.max(0, outstanding - appliedToAr))
      const fullyCredited = Math.abs(Number(credited._sum.amount_total || 0) - Number(original.amount_total)) <= 0.005
      // Never invent outstanding on a fully paid invoice. Only reduce existing amount_due.
      let nextPaymentState = currentOriginal.payment_state
      if (fullyCredited) nextPaymentState = 'reversed'
      else if (remainingDue <= 0.005 && Number(currentOriginal.paid_amount || 0) > 0.005) nextPaymentState = 'paid'
      else if (remainingDue > 0.005 && Number(currentOriginal.paid_amount || 0) > 0.005) nextPaymentState = 'partial'
      else if (remainingDue > 0.005) nextPaymentState = 'not_paid'
      else nextPaymentState = currentOriginal.payment_state

      await tx.customer_invoices.update({
        where: { id: original.id },
        data: {
          amount_due: remainingDue,
          payment_state: nextPaymentState,
          updated_at: postedAt,
        },
      })

      // Persist customer credit as an unallocated posted receipt-style advance marker is not used;
      // settlement lives on CN notes + JE credit to 2140. Optionally bump a synthetic unallocated
      // is avoided to prevent duplicate cash documents.

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
            customerCredit > 0.005
              ? `Credit note ${credit.invoice_number} for ${original.invoice_number} (AR ${appliedToAr.toFixed(2)} + customer credit ${customerCredit.toFixed(2)})`
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
