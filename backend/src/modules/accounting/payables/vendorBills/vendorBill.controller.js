import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'
const include = {
  vendors: { select: { id: true, name: true, phone: true, email: true, vendor_code: true, company_id: true } },
  currencies: { select: { id: true, code: true, symbol: true } },
  payment_terms: { select: { id: true, name: true } },
  fiscal_periods: { select: { id: true, name: true, start_date: true, end_date: true, state: true } },
  journal_entries: { select: { id: true, entry_number: true, state: true } },
  vendor_bill_lines: {
    orderBy: { sequence: 'asc' },
    include: {
      products: { select: { id: true, name: true, sku: true } },
      taxes: { select: { id: true, name: true, rate_percent: true, price_includes_tax: true } },
      chart_of_accounts: { select: { id: true, code: true, name: true } },
    },
  },
}

const money2 = (value) => Math.round(Number(value || 0) * 100) / 100

function parseNotesMeta(notes) {
  if (!notes) return { notes_text: '', pending_payment: null }
  try {
    const parsed = JSON.parse(String(notes))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        notes_text: String(parsed.notes_text || ''),
        pending_payment: parsed.pending_payment || null,
      }
    }
  } catch {
    // plain text
  }
  return { notes_text: String(notes), pending_payment: null }
}

function buildBillNotes(notesText, pendingPayment = null) {
  return JSON.stringify({
    notes_text: String(notesText || '').trim() || null,
    pending_payment: pendingPayment || null,
  })
}

function paymentTermDueDays(paymentTerm) {
  if (paymentTerm?.payment_term_lines?.length) {
    return Math.max(...paymentTerm.payment_term_lines.map((line) => Number(line.due_days || 0)))
  }
  const name = String(paymentTerm?.name || '')
  const netMatch = name.match(/net\s*(\d+)/i)
  if (netMatch) return Number(netMatch[1])
  if (/immediate|receipt|due on receipt|net\s*0/i.test(name)) return 0
  return 0
}

function dateOnlyKey(value, { utc = false } = {}) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const y = utc ? d.getUTCFullYear() : d.getFullYear()
  const m = String((utc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0')
  const day = String(utc ? d.getUTCDate() : d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Overdue only when calendar today is strictly after the due date (due-date itself is still unpaid/partial). */
function isVendorBillOverdue(bill, now = new Date()) {
  if (!bill || bill.state !== 'posted' || bill.document_type === 'refund') return false
  if (Number(bill.amount_due || 0) <= 0.005) return false
  if (!bill.due_date) return false
  const dueKey = dateOnlyKey(bill.due_date, { utc: true })
  const todayKey = dateOnlyKey(now, { utc: false })
  return Boolean(dueKey && todayKey && todayKey > dueKey)
}

function vendorBillDisplayStatus(bill, now = new Date()) {
  if (!bill) return 'draft'
  if (bill.state === 'cancelled') return 'cancelled'
  if (bill.state === 'draft') return 'draft'
  if (bill.document_type === 'refund') return 'posted'
  if (Number(bill.amount_due || 0) <= 0.005 || bill.payment_state === 'paid') return 'paid'
  if (isVendorBillOverdue(bill, now)) return 'overdue'
  if (bill.payment_state === 'partial' || Number(bill.amount_paid || 0) > 0.005) return 'partial'
  return 'unpaid'
}

function enrichVendorBill(bill) {
  if (!bill) return bill
  const meta = parseNotesMeta(bill.notes)
  const total = money2(bill.amount_total)
  const base = {
    ...bill,
    bill_number: bill.bill_number,
    vendorBillNo: bill.bill_number,
    notes_text: meta.notes_text,
  }
  let enriched
  if (bill.state === 'draft' && meta.pending_payment?.enabled && Number(meta.pending_payment.amount || 0) > 0.005) {
    const paid = money2(Math.min(Number(meta.pending_payment.amount || 0), total))
    const due = money2(Math.max(0, total - paid))
    enriched = {
      ...base,
      pending_payment: meta.pending_payment,
      amount_paid: paid,
      amount_due: due,
      payment_state: paid >= total - 0.005 ? 'paid' : paid > 0.005 ? 'partial' : 'not_paid',
    }
  } else {
    enriched = {
      ...base,
      pending_payment: bill.state === 'draft' ? meta.pending_payment : null,
      amount_paid: money2(bill.amount_paid),
      amount_due: money2(bill.amount_due),
    }
  }
  return {
    ...enriched,
    display_status: vendorBillDisplayStatus(enriched),
  }
}

const parseId = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
const parseDate = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const inputError = (message) => Object.assign(new Error(message), { status: 400 })
const fail = (res, error, fallback) => {
  console.error(fallback, error)
  return res.status(error.status || (error.code === 'P2025' ? 404 : 500))
    .json({ success: false, message: error.message || fallback })
}

function resolvePendingPaymentInput(input, amountTotal) {
  const fromNotes = input?.pending_payment && typeof input.pending_payment === 'object' ? input.pending_payment : null
  const enabled = Boolean(input?.pay_vendor_now) || Boolean(fromNotes?.enabled)
  if (!enabled) return null
  const amount = money2(input?.amount_paid ?? fromNotes?.amount)
  const methodId = parseId(input?.payment_method_id ?? fromNotes?.payment_method_id)
  if (!methodId || !Number.isFinite(amount) || amount <= 0) {
    throw inputError('Pay Vendor Now requires a payment method and a positive amount paid')
  }
  if (amount > amountTotal + 0.005) throw inputError('Amount paid cannot exceed the vendor bill total')
  return {
    enabled: true,
    payment_method_id: methodId,
    bank_account_id: parseId(input?.bank_account_id ?? fromNotes?.bank_account_id),
    amount,
    payment_reference: String(input?.payment_reference ?? fromNotes?.payment_reference ?? '').trim() || null,
    advance_amount: money2(input?.advance_amount ?? fromNotes?.advance_amount ?? 0),
  }
}

let vendorBillTermsEnsured = false
async function ensureVendorBillPaymentTerms() {
  if (vendorBillTermsEnsured) return
  const defaults = [
    ['Due on Receipt', 0],
    ['Immediate', 0],
    ['Net 0', 0],
    ['Net 7', 7],
    ['Net 15', 15],
    ['Net 30', 30],
    ['Net 60', 60],
  ]
  for (const [name, dueDays] of defaults) {
    const term = await prisma.payment_terms.upsert({
      where: { name },
      update: { is_active: true },
      create: {
        name,
        description: dueDays ? `Payment due in ${dueDays} days` : 'Payment due immediately',
        is_active: true,
      },
      include: { payment_term_lines: true },
    })
    if (!term.payment_term_lines.length) {
      await prisma.payment_term_lines.create({
        data: { payment_term_id: term.id, sequence: 10, value_type: 'balance', value_amount: 0, due_days: dueDays },
      })
    } else if (Number(term.payment_term_lines[0].due_days) !== dueDays) {
      await prisma.payment_term_lines.update({
        where: { id: term.payment_term_lines[0].id },
        data: { due_days: dueDays },
      })
    }
  }
  vendorBillTermsEnsured = true
}

// Vendor bills affect the P&L only through posted journal entries.  Keep the
// entry alongside the bill so a bill can be reviewed as a draft before it is
// posted, just like customer invoices.
function journalItems(prepared) {
  const rate = Number(prepared.header.exchange_rate)
  const debits = new Map()
  for (const line of prepared.lines) {
    debits.set(line.expense_account_id, (debits.get(line.expense_account_id) || 0) + Number(line.subtotal))
  }
  // A purchase tax is included in the expense unless a separate input-tax
  // account is configured. This guarantees a balanced entry for every bill.
  if (Number(prepared.header.amount_tax) > 0) {
    const firstExpenseAccount = prepared.lines[0]?.expense_account_id
    debits.set(firstExpenseAccount, (debits.get(firstExpenseAccount) || 0) + Number(prepared.header.amount_tax))
  }
  const items = [...debits.entries()].map(([accountId, amount], index) => ({
    sequence: (index + 1) * 10,
    account_id: accountId,
    label: 'Vendor bill expense',
    partner_type: 'vendor',
    partner_id: prepared.header.vendor_id,
    debit: Math.round(amount * rate * 100) / 100,
    credit: 0,
    currency_id: prepared.header.currency_id,
    amount_currency: amount,
  }))
  const debit = items.reduce((sum, item) => sum + Number(item.debit), 0)
  items.push({
    sequence: (items.length + 1) * 10,
    account_id: prepared.header.payable_account_id,
    label: 'Accounts Payable',
    partner_type: 'vendor',
    partner_id: prepared.header.vendor_id,
    debit: 0,
    credit: debit,
    currency_id: prepared.header.currency_id,
    amount_currency: -Number(prepared.header.amount_total),
  })
  return items
}

function entryData(prepared, billNumber, billId, state = 'draft', postedAt = null) {
  return {
    company_id: prepared.header.company_id,
    journal_id: prepared.header.journal_id,
    entry_number: billNumber,
    entry_date: prepared.header.bill_date,
    fiscal_period_id: prepared.header.fiscal_period_id,
    reference: billNumber,
    narration: `${state === 'posted' ? 'Posted' : 'Draft'} vendor bill ${billNumber}`,
    state,
    source_type: 'vendor_bill',
    source_id: billId,
    posted_at: postedAt,
    journal_items: { create: journalItems(prepared) },
  }
}

async function prepareBill(input, documentType = 'bill', options = {}) {
  await ensureVendorBillPaymentTerms()
  const vendorId = parseId(input.vendor_id)
  const billDate = parseDate(input.bill_date)
  const lines = Array.isArray(input.lines) ? input.lines : []
  if (!vendorId || !billDate) throw inputError('Vendor and bill date are required')
  if (!lines.length) throw inputError('Add at least one bill line')
  const reversedBillId = documentType === 'refund' ? parseId(input.reversed_bill_id) : null
  // Optional vendor-provided reference only — never used as the system document number.
  // Client-supplied bill_number / vendorBillNo are ignored; numbers are allocated on create.
  const vendorReference = String(input.vendor_reference || '').trim() || null

  const vendor = await prisma.vendors.findUnique({ where: { id: vendorId } })
  if (!vendor || !vendor.is_active) throw inputError('Active vendor not found')
  if (vendorReference) {
    const duplicate = await prisma.vendor_bills.findFirst({
      where: {
        vendor_id: vendorId,
        vendor_reference: vendorReference,
        document_type: documentType,
        ...(options.excludeBillId ? { id: { not: options.excludeBillId } } : {}),
      },
      select: { id: true, bill_number: true },
    })
    if (duplicate) {
      throw inputError(`Vendor Reference No. "${vendorReference}" already exists for this vendor${duplicate.bill_number ? ` (${duplicate.bill_number})` : ''}`)
    }
  }
  const [company, journal, paymentTerm, fiscalPeriod] = await Promise.all([
    prisma.companies.findUnique({ where: { id: vendor.company_id } }),
    prisma.journals.findFirst({
      where: {
        company_id: vendor.company_id,
        is_active: true,
        OR: [
          { code: 'BILL' },
          { code: 'PUR' },
          { journal_type: 'purchase' },
        ],
      },
      orderBy: { id: 'asc' },
    }),
    parseId(input.payment_term_id) ? prisma.payment_terms.findUnique({ where: { id: parseId(input.payment_term_id) }, include: { payment_term_lines: true } }) : null,
    prisma.fiscal_periods.findFirst({
      where: { state: 'open', fiscal_years: { company_id: vendor.company_id, state: 'open' }, start_date: { lte: billDate }, end_date: { gte: billDate } },
      orderBy: { period_number: 'asc' },
    }),
  ])
  if (!company?.is_active) throw inputError('Vendor company is inactive or missing')
  if (!journal || journal.journal_type !== 'purchase') throw inputError('Active Purchase / Vendor Bills journal was not found')
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the bill date')

  const currencyId = parseId(input.currency_id) || company.currency_id
  const [currency, payableAccount, defaultExpenseAccount] = await Promise.all([
    prisma.currencies.findUnique({ where: { id: currencyId } }),
    prisma.chart_of_accounts.findFirst({
      where: {
        company_id: vendor.company_id, code: '2110', is_active: true,
        allow_manual_entry: true, account_types: { internal_group: 'liability' },
        other_chart_of_accounts: { none: {} },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.chart_of_accounts.findFirst({
      where: {
        company_id: vendor.company_id, is_active: true,
        allow_manual_entry: true, account_types: { internal_group: 'expense' },
        other_chart_of_accounts: { none: {} },
        OR: [
          { code: '5180' },
          { code: '5100' },
          { code: '5000' },
        ],
      },
      orderBy: { code: 'asc' },
    }),
  ])
  if (!currency?.is_active) throw inputError('Bill currency is inactive or missing')
  if (!payableAccount) throw inputError('Accounts Payable account 2110 was not found')
  if (reversedBillId) {
    const original = await prisma.vendor_bills.findFirst({ where: { id: reversedBillId, document_type: 'bill', vendor_id: vendorId, state: 'posted', company_id: vendor.company_id } })
    if (!original) throw inputError('Original posted vendor bill was not found for this vendor')
  }

  const productIds = [...new Set(lines.filter((line) => line.line_type !== 'expense').map((line) => parseId(line.product_id)).filter(Boolean))]
  const expenseAccountIds = [...new Set(lines.filter((line) => line.line_type === 'expense').map((line) => parseId(line.expense_account_id)).filter(Boolean))]
  const taxIds = [...new Set(lines.map((line) => parseId(line.tax_id)).filter(Boolean))]
  const [products, taxes, expenseAccounts] = await Promise.all([
    prisma.products.findMany({ where: { id: { in: productIds } } }),
    prisma.taxes.findMany({ where: { id: { in: taxIds } } }),
    prisma.chart_of_accounts.findMany({
      where: {
        id: { in: expenseAccountIds },
        company_id: vendor.company_id,
        is_active: true,
        allow_manual_entry: true,
        other_chart_of_accounts: { none: {} },
        OR: [
          { account_types: { internal_group: 'expense' } },
          { code: { startsWith: '13' } },
        ],
      },
    }),
  ])
  const productMap = new Map(products.map((row) => [row.id, row]))
  const taxMap = new Map(taxes.map((row) => [row.id, row]))
  const expenseAccountMap = new Map(expenseAccounts.map((row) => [row.id, row]))
  let amountUntaxed = 0
  let amountTax = 0
  const preparedLines = lines.map((line, index) => {
    const isExpense = line.line_type === 'expense'
    if (line.line_type && !['product', 'expense'].includes(line.line_type)) throw inputError(`Line ${index + 1}: line type must be Product or Expense`)
    const productId = parseId(line.product_id)
    const product = productId ? productMap.get(productId) : null
    const taxId = parseId(line.tax_id)
    const tax = taxId ? taxMap.get(taxId) : null
    const quantity = Number(line.quantity ?? 1)
    const unitPrice = isExpense ? Number(line.amount ?? line.unit_price) : Number(line.unit_price)
    const discount = Number(line.discount_percent || 0)
    const description = String(line.description || product?.name || '').trim()
    if (isExpense && productId) throw inputError(`Line ${index + 1}: expense lines cannot include a product`)
    if (!isExpense && line.line_type === 'product' && !productId) throw inputError(`Line ${index + 1}: product is required`)
    if (!isExpense && productId && (!product || !product.is_active || !product.can_be_purchased)) throw inputError(`Line ${index + 1}: product is not active and purchasable`)
    const selectedExpenseAccountId = isExpense ? parseId(line.expense_account_id) : product?.expense_account_id || defaultExpenseAccount?.id
    if (!selectedExpenseAccountId || (isExpense && !expenseAccountMap.has(selectedExpenseAccountId))) throw inputError(`Line ${index + 1}: select a valid posting expense or inventory account`)
    if (!description) throw inputError(`Line ${index + 1}: description is required`)
    if (!Number.isFinite(quantity) || quantity <= 0) throw inputError(`Line ${index + 1}: quantity must be greater than zero`)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw inputError(`Line ${index + 1}: unit price cannot be negative`)
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw inputError(`Line ${index + 1}: discount must be between 0 and 100`)
    if (taxId && !tax) throw inputError(`Line ${index + 1}: tax not found`)
    const discounted = quantity * unitPrice * (1 - discount / 100)
    const rate = tax ? Number(tax.rate_percent) / 100 : 0
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0
    amountUntaxed += Math.round(untaxed * 100) / 100
    amountTax += Math.round(taxAmount * 100) / 100
    return { sequence: (index + 1) * 10, product_id: isExpense ? null : productId, description, quantity, unit_price: unitPrice, discount_percent: discount, tax_id: taxId, expense_account_id: selectedExpenseAccountId, subtotal: Math.round(untaxed * 100) / 100 }
  })
  amountUntaxed = Math.round(amountUntaxed * 100) / 100
  amountTax = Math.round(amountTax * 100) / 100
  const amountTotal = Math.round((amountUntaxed + amountTax) * 100) / 100
  if (amountTotal <= 0) throw inputError('Vendor bill total must be greater than zero')
  const dueDays = paymentTermDueDays(paymentTerm)
  const dueDate = new Date(billDate)
  dueDate.setUTCDate(dueDate.getUTCDate() + dueDays)
  const exchangeRate = currencyId === company.currency_id ? 1 : Number(input.exchange_rate)
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw inputError('A positive exchange rate is required')

  const notesText = documentType === 'refund'
    ? String(input.notes || '').trim() || null
    : (parseNotesMeta(input.notes).notes_text || String(input.notes_text || input.notes || '').trim() || null)
  const pendingPayment = documentType === 'bill' ? resolvePendingPaymentInput(input, amountTotal) : null
  if (pendingPayment?.payment_method_id) {
    const method = await prisma.payment_methods.findUnique({ where: { id: pendingPayment.payment_method_id } })
    if (!method?.is_active || !['outbound', 'both'].includes(method.payment_type)) {
      throw inputError('Select an active outbound payment method')
    }
    if (method.requires_reference && !pendingPayment.payment_reference) {
      throw inputError('Reference number is required for this payment method.')
    }
  }

  return {
    header: {
      company_id: vendor.company_id, document_type: documentType, vendor_id: vendorId,
      vendor_reference: vendorReference, journal_id: journal.id,
      fiscal_period_id: fiscalPeriod.id, bill_date: billDate, received_date: parseDate(input.received_date) || billDate,
      due_date: dueDate, payment_term_id: paymentTerm?.id || null, currency_id: currencyId,
      exchange_rate: exchangeRate, payable_account_id: payableAccount.id, reversed_bill_id: reversedBillId, state: 'draft',
      payment_state: 'not_paid', amount_untaxed: amountUntaxed, amount_tax: amountTax,
      amount_total: amountTotal, amount_paid: 0, amount_due: amountTotal,
      notes: documentType === 'bill' ? buildBillNotes(notesText, pendingPayment) : notesText,
    },
    lines: preparedLines,
  }
}

async function allocateNumber(tx, journal, { prefix = 'VB-', pad = 6 } = {}) {
  for (;;) {
    const updated = await tx.journals.update({
      where: { id: journal.id },
      data: { next_sequence: { increment: 1 } },
      select: { next_sequence: true, company_id: true },
    })
    const number = `${prefix}${String(updated.next_sequence - 1).padStart(pad, '0')}`
    const exists = await tx.vendor_bills.findFirst({
      where: { company_id: updated.company_id, bill_number: number },
      select: { id: true },
    })
    if (!exists) return number
  }
}

function paymentChannel(method, account) {
  const identity = `${method.code || ''} ${method.name || ''} ${account.code || ''} ${account.name || ''}`.toLowerCase()
  if (String(account.code || '').startsWith('111') || /\bcash\b/.test(identity)) {
    return { code: 'CSH', name: 'Cash Journal', type: 'cash', label: 'Cash Payment' }
  }
  const label = /edahab|e-dahab/.test(identity) ? 'E-Dahab Payment'
    : /evc/.test(identity) ? 'EVC-Plus Payment'
      : /\bibs\b/.test(identity) ? 'IBS Bank Payment'
        : /salaam/.test(identity) ? 'Salaam Bank Payment'
          : /premier/.test(identity) ? 'Premier Bank Payment'
            : /sombank/.test(identity) ? 'SomBank Payment'
              : `${method.name || 'Bank'} Payment`
  return { code: 'BNK', name: 'Bank Journal', type: 'bank', label }
}

async function postImmediatePayment(tx, bill, input, postedAt) {
  if (!input?.pay_vendor_now) return 0
  const amount = Math.round(Number(input.amount_paid) * 100) / 100
  const methodId = parseId(input.payment_method_id)
  const bankId = parseId(input.bank_account_id)
  if (!methodId || !Number.isFinite(amount) || amount <= 0) throw inputError('Payment method and a positive amount paid are required')
  if (amount > Number(bill.amount_total) + 0.005) throw inputError('Amount paid cannot exceed the vendor bill total')
  const marker = `Immediate payment for ${bill.bill_number}`
  const existingAllocation = await tx.payment_allocations.findFirst({
    where: { bill_id: bill.id, vendor_payments: { state: 'posted', memo: { contains: marker } } },
    select: { allocated_amount: true },
  })
  if (existingAllocation) return money2(existingAllocation.allocated_amount)
  const method = await tx.payment_methods.findUnique({ where: { id: methodId } })
  if (!method?.is_active || !['outbound', 'both'].includes(method.payment_type)) throw inputError('Select an active outbound payment method')
  const paymentReference = String(input.payment_reference || '').trim()
  if (method.requires_reference && !paymentReference) {
    throw inputError('Reference number is required for this payment method.')
  }
  let bank = bankId ? await tx.bank_accounts.findUnique({ where: { id: bankId } }) : null
  if (method.allow_multiple_accounts && !bank) {
    const matches = await tx.bank_accounts.findMany({ where: { company_id: bill.company_id, currency_id: bill.currency_id, is_active: true, gl_account_id: { not: null }, journal_id: { not: null } } })
    if (matches.length !== 1) throw inputError('Select a bank account for this payment method')
    bank = matches[0]
  }
  if (bank && (!bank.is_active || bank.company_id !== bill.company_id || bank.currency_id !== bill.currency_id || !bank.gl_account_id)) throw inputError('Select an active vendor-company bank account in the bill currency')
  const paymentAccountId = method.allow_multiple_accounts ? bank?.gl_account_id : method.gl_account_id || bank?.gl_account_id
  if (!paymentAccountId) throw inputError('Link this payment method to a GL account before posting')
  const paymentAccount = await tx.chart_of_accounts.findFirst({ where: { id: paymentAccountId, company_id: bill.company_id, is_active: true, allow_manual_entry: true, account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} } } })
  if (!paymentAccount) throw inputError('The payment method GL account is not an active cash, bank, or wallet posting account')
  const channel = paymentChannel(method, paymentAccount)
  let journal = bank?.journal_id
    ? await tx.journals.findFirst({ where: { id: bank.journal_id, company_id: bill.company_id, is_active: true, journal_type: channel.type } })
    : null
  if (!journal) {
    journal = await tx.journals.findFirst({
      where: { company_id: bill.company_id, code: channel.code, journal_type: channel.type, is_active: true },
    })
  }
  if (!journal) {
    const preferred = channel.type === 'cash' ? ['CSH', 'CASH'] : ['BNK', 'BANK']
    journal = await tx.journals.findFirst({
      where: { company_id: bill.company_id, code: { in: preferred }, journal_type: channel.type, is_active: true },
      orderBy: { code: 'asc' },
    })
  }
  if (!journal) {
    journal = await tx.journals.findFirst({
      where: { company_id: bill.company_id, journal_type: channel.type, is_active: true, NOT: { code: 'WALLET' } },
      orderBy: { code: 'asc' },
    })
  }
  if (!journal?.is_active || journal.company_id !== bill.company_id) throw inputError('Configure an active Cash or Bank journal for the selected payment method')
  const existing = await tx.vendor_payments.findMany({ where: { company_id: bill.company_id, payment_number: { startsWith: 'PAY' } }, select: { payment_number: true } })
  let sequence = Math.max(Number(journal.next_sequence || 1), ...existing.map((row) => Number(String(row.payment_number).slice(3)) + 1).filter(Number.isFinite))
  let paymentNumber = `PAY${String(sequence).padStart(4, '0')}`
  while (await tx.vendor_payments.findFirst({ where: { company_id: bill.company_id, payment_number: paymentNumber }, select: { id: true } })) paymentNumber = `PAY${String(++sequence).padStart(4, '0')}`
  await tx.journals.update({ where: { id: journal.id }, data: { next_sequence: sequence + 1 } })
  const payment = await tx.vendor_payments.create({ data: {
    company_id: bill.company_id, payment_number: paymentNumber, vendor_id: bill.vendor_id, journal_id: journal.id,
    payment_method_id: method.id, bank_account_id: bank?.id || null, fiscal_period_id: bill.fiscal_period_id,
    payment_date: bill.bill_date, currency_id: bill.currency_id, exchange_rate: bill.exchange_rate, amount,
    unallocated_amount: 0, reference: paymentReference || null,
    memo: marker, state: 'posted', posted_at: postedAt,
    payment_allocations: { create: [{ bill_id: bill.id, allocated_amount: amount }] },
  } })
  const baseAmount = Math.round(amount * Number(bill.exchange_rate) * 100) / 100
  const entry = await tx.journal_entries.create({ data: {
    company_id: bill.company_id, journal_id: journal.id, entry_number: paymentNumber, entry_date: bill.bill_date,
    fiscal_period_id: bill.fiscal_period_id, reference: paymentNumber,
    narration: `Vendor payment ${paymentNumber} to ${bill.vendorName || `vendor #${bill.vendor_id}`}`,
    state: 'posted', source_type: 'vendor_payment', source_id: payment.id, posted_at: postedAt,
    journal_items: { create: [
      { sequence: 10, account_id: bill.payable_account_id, label: 'Accounts Payable', partner_type: 'vendor', partner_id: bill.vendor_id, debit: baseAmount, credit: 0, currency_id: bill.currency_id, amount_currency: amount },
      { sequence: 20, account_id: paymentAccount.id, label: channel.label, partner_type: 'vendor', partner_id: bill.vendor_id, debit: 0, credit: baseAmount, currency_id: bill.currency_id, amount_currency: -amount },
    ] },
  } })
  await tx.vendor_payments.update({ where: { id: payment.id }, data: { journal_entry_id: entry.id } })
  return amount
}

export const getAll = async (_req, res) => {
  try {
    const rows = await prisma.vendor_bills.findMany({ where: { document_type: 'bill' }, include, orderBy: { created_at: 'desc' } })
    res.json({ success: true, data: rows.map(enrichVendorBill) })
  } catch (error) { fail(res, error, 'Failed to fetch vendor bills') }
}
export const getById = async (req, res) => {
  const billId = parseId(req.params.id)
  if (!billId) return res.status(400).json({ success: false, message: 'Invalid bill id' })
  try {
    const data = await prisma.vendor_bills.findUnique({ where: { id: billId }, include })
    if (!data) return res.status(404).json({ success: false, message: 'Vendor bill not found' })
    res.json({ success: true, data: enrichVendorBill(data) })
  } catch (error) { fail(res, error, 'Failed to fetch vendor bill') }
}
export const create = async (req, res) => {
  try {
    const prepared = await prepareBill(req.body)
    const data = await prisma.$transaction(async (tx) => {
      const journal = await tx.journals.findUnique({ where: { id: prepared.header.journal_id } })
      const billNumber = await allocateNumber(tx, journal, { prefix: 'VB-', pad: 6 })
      const bill = await tx.vendor_bills.create({ data: { ...prepared.header, bill_number: billNumber, vendor_bill_lines: { create: prepared.lines } } })
      const entry = await tx.journal_entries.create({ data: entryData(prepared, billNumber, bill.id) })
      return tx.vendor_bills.update({ where: { id: bill.id }, data: { journal_entry_id: entry.id }, include })
    }, { maxWait: 10000, timeout: 30000 })
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'VendorBill', entityId: data.id, description: `Prepared draft vendor bill "${data.bill_number}"` })
    res.status(201).json({ success: true, message: 'Draft vendor bill prepared successfully', data: enrichVendorBill(data) })
  } catch (error) { fail(res, error, 'Failed to prepare vendor bill') }
}
export const update = async (req, res) => {
  const billId = parseId(req.params.id)
  if (!billId) return res.status(400).json({ success: false, message: 'Invalid bill id' })
  try {
    const existing = await prisma.vendor_bills.findUnique({ where: { id: billId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Vendor bill not found' })
    if (existing.state !== 'draft') throw inputError('Only draft vendor bills can be edited')
    const prepared = await prepareBill(req.body, 'bill', { excludeBillId: billId })
    const data = await prisma.$transaction(async (tx) => {
      await tx.vendor_bill_lines.deleteMany({ where: { bill_id: billId } })
      const bill = await tx.vendor_bills.update({ where: { id: billId }, data: { ...prepared.header, bill_number: existing.bill_number, vendor_bill_lines: { create: prepared.lines }, updated_at: new Date() } })
      if (existing.journal_entry_id) {
        await tx.journal_items.deleteMany({ where: { entry_id: existing.journal_entry_id } })
        await tx.journal_entries.update({ where: { id: existing.journal_entry_id }, data: { ...entryData(prepared, existing.bill_number, billId), journal_items: { create: journalItems(prepared) } } })
      } else {
        const entry = await tx.journal_entries.create({ data: entryData(prepared, existing.bill_number, billId) })
        await tx.vendor_bills.update({ where: { id: billId }, data: { journal_entry_id: entry.id } })
      }
      return tx.vendor_bills.findUnique({ where: { id: bill.id }, include })
    }, { maxWait: 10000, timeout: 30000 })
    await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'VendorBill', entityId: data.id, description: `Updated draft vendor bill "${data.bill_number}"` })
    res.json({ success: true, message: 'Draft vendor bill updated successfully', data: enrichVendorBill(data) })
  } catch (error) { fail(res, error, 'Failed to update vendor bill') }
}
export const remove = async (req, res) => {
  const billId = parseId(req.params.id)
  if (!billId) return res.status(400).json({ success: false, message: 'Invalid bill id' })
  try {
    const existing = await prisma.vendor_bills.findUnique({ where: { id: billId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Vendor bill not found' })
    if (existing.state !== 'draft') throw inputError('Only draft vendor bills can be deleted')
    await prisma.$transaction(async (tx) => {
      await tx.vendor_bills.delete({ where: { id: billId } })
      if (existing.journal_entry_id) await tx.journal_entries.deleteMany({ where: { id: existing.journal_entry_id, state: 'draft', source_type: 'vendor_bill' } })
    })
    await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'VendorBill', entityId: billId, description: `Deleted draft vendor bill "${existing.bill_number}"` })
    res.json({ success: true, message: 'Draft vendor bill deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete vendor bill') }
}

export const post = async (req, res) => {
  const billId = parseId(req.params.id)
  if (!billId) return res.status(400).json({ success: false, message: 'Invalid bill id' })
  try {
    const data = await prisma.$transaction(async (tx) => {
      const bill = await tx.vendor_bills.findUnique({ where: { id: billId }, include: { fiscal_periods: { include: { fiscal_years: true } }, journal_entries: true, vendors: { select: { name: true } }, vendor_bill_lines: true } })
      if (!bill) throw inputError('Vendor bill not found')
      if (bill.state !== 'draft') throw inputError('Only draft vendor bills can be posted')
      if (!bill.bill_number) throw inputError('Vendor Bill Number is missing')
      if (!bill.vendor_bill_lines?.length) throw inputError('Add at least one bill line before posting')
      if (Number(bill.amount_total) <= 0) throw inputError('Vendor bill total must be greater than zero')
      if (!bill.fiscal_periods || bill.fiscal_periods.state !== 'open' || bill.fiscal_periods.fiscal_years.state !== 'open') throw inputError('Bill fiscal period is closed or invalid')
      const postedAt = new Date()
      if (!bill.journal_entry_id || !bill.journal_entries || bill.journal_entries.state !== 'draft') throw inputError('Linked draft journal entry is missing or invalid')
      const claimedEntry = await tx.journal_entries.updateMany({
        where: { id: bill.journal_entry_id, state: 'draft', source_type: 'vendor_bill', source_id: billId },
        data: { state: 'posted', posted_at: postedAt, narration: `Posted vendor bill ${bill.bill_number}` },
      })
      if (claimedEntry.count !== 1) throw inputError('Vendor bill journal entry has already been posted')

      const notesMeta = parseNotesMeta(bill.notes)
      const pending = notesMeta.pending_payment
      const bodyHasPayment = Boolean(req.body?.pay_vendor_now)
      const paymentInput = bodyHasPayment
        ? {
            pay_vendor_now: true,
            payment_method_id: req.body.payment_method_id,
            bank_account_id: req.body.bank_account_id,
            amount_paid: req.body.amount_paid,
            payment_reference: req.body.payment_reference,
          }
        : pending?.enabled
          ? {
              pay_vendor_now: true,
              payment_method_id: pending.payment_method_id,
              bank_account_id: pending.bank_account_id,
              amount_paid: pending.amount,
              payment_reference: pending.payment_reference,
            }
          : {}

      const advanceFromBody = req.body?.advance_amount
      const requestedAdvance = Math.max(0, money2(
        advanceFromBody !== undefined && advanceFromBody !== null && advanceFromBody !== ''
          ? advanceFromBody
          : (pending?.advance_amount || 0),
      ))
      const advances = requestedAdvance > 0 ? await tx.vendor_advances.findMany({ where: { vendor_id: bill.vendor_id, currency_id: bill.currency_id, state: { in: ['open', 'partial'] }, remaining_amount: { gt: 0 } }, orderBy: { created_at: 'asc' } }) : []
      const availableAdvance = advances.reduce((sum, advance) => sum + Number(advance.remaining_amount), 0)
      if (requestedAdvance > availableAdvance + 0.005) throw inputError('Requested Vendor Advance exceeds the available balance')
      let advanceRemaining = Math.min(requestedAdvance, Number(bill.amount_total))
      for (const advance of advances) {
        if (advanceRemaining <= 0.005) break
        const applied = Math.min(advanceRemaining, Number(advance.remaining_amount))
        const application = await tx.vendor_advance_applications.create({ data: { advance_id: advance.id, bill_id: bill.id, amount: applied } })
        const baseAmount = Math.round(applied * Number(bill.exchange_rate) * 100) / 100
        await tx.journal_entries.create({ data: {
          company_id: bill.company_id, journal_id: bill.journal_id, entry_number: `VA${String(application.id).padStart(6, '0')}`,
          entry_date: bill.bill_date, fiscal_period_id: bill.fiscal_period_id, reference: bill.bill_number,
          narration: `Vendor Advance applied to ${bill.bill_number}`, state: 'posted', source_type: 'vendor_advance', source_id: application.id, posted_at: postedAt,
          journal_items: { create: [
            { sequence: 10, account_id: bill.payable_account_id, label: 'Accounts Payable', partner_type: 'vendor', partner_id: bill.vendor_id, debit: baseAmount, credit: 0, currency_id: bill.currency_id, amount_currency: applied },
            { sequence: 20, account_id: advance.advance_account_id, label: 'Vendor Advance applied', partner_type: 'vendor', partner_id: bill.vendor_id, debit: 0, credit: baseAmount, currency_id: bill.currency_id, amount_currency: -applied },
          ] },
        } })
        const nextAdvanceBalance = Math.max(0, Number(advance.remaining_amount) - applied)
        await tx.vendor_advances.update({ where: { id: advance.id }, data: { remaining_amount: nextAdvanceBalance, state: nextAdvanceBalance <= 0.005 ? 'used' : 'partial', updated_at: postedAt } })
        advanceRemaining -= applied
      }
      const appliedAdvance = requestedAdvance - advanceRemaining
      const immediatePaid = await postImmediatePayment(tx, { ...bill, vendorName: bill.vendors?.name }, paymentInput, postedAt)
      if (appliedAdvance + immediatePaid > Number(bill.amount_total) + 0.005) throw inputError('Immediate payment plus vendor advance cannot exceed the bill total')
      const paidAmount = Math.round((appliedAdvance + immediatePaid) * 100) / 100
      const amountDue = Math.max(0, Math.round((Number(bill.amount_total) - paidAmount) * 100) / 100)
      const claimedBill = await tx.vendor_bills.updateMany({
        where: { id: billId, state: 'draft' },
        data: {
          state: 'posted',
          payment_state: amountDue <= 0.005 ? 'paid' : paidAmount > 0.005 ? 'partial' : 'not_paid',
          amount_paid: paidAmount,
          amount_due: amountDue,
          posted_at: postedAt,
          updated_at: postedAt,
          notes: buildBillNotes(notesMeta.notes_text, null),
        },
      })
      if (claimedBill.count !== 1) throw inputError('Only draft vendor bills can be posted')
      return tx.vendor_bills.findUnique({ where: { id: billId }, include })
    }, { maxWait: 10000, timeout: 30000 })
    await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'VendorBill', entityId: billId, description: `Posted vendor bill "${data.bill_number}"` })
    res.json({ success: true, message: 'Vendor bill posted successfully', data: enrichVendorBill(data) })
  } catch (error) { fail(res, error, 'Failed to post vendor bill') }
}

function parseRefundNotes(notes) {
  const meta = parseNotesMeta(notes)
  let refundType = null
  let refundReason = ''
  let receivePayment = null
  let notesText = meta.notes_text
  try {
    const parsed = JSON.parse(String(notes || ''))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      refundType = parsed.refund_type === 'partial' ? 'partial' : parsed.refund_type === 'full' ? 'full' : null
      refundReason = String(parsed.refund_reason || '')
      receivePayment = parsed.receive_payment || null
      notesText = String(parsed.notes_text || meta.notes_text || '')
    }
  } catch {
    // legacy plain text: "Refund reason: ...\nnotes"
    const plain = String(notes || '')
    const reasonMatch = plain.match(/^Refund reason:\s*(.*)$/im)
    if (reasonMatch) refundReason = reasonMatch[1].trim()
    notesText = plain.replace(/^Refund reason:.*$/im, '').trim()
  }
  return { notes_text: notesText, refund_type: refundType, refund_reason: refundReason, receive_payment: receivePayment }
}

function buildRefundNotes({ notesText, refundType, refundReason, receivePayment }) {
  return JSON.stringify({
    notes_text: String(notesText || '').trim() || null,
    refund_type: refundType,
    refund_reason: String(refundReason || '').trim() || null,
    receive_payment: receivePayment || null,
    pending_payment: null,
  })
}

async function computeBillRefundable(billId, { excludeRefundId = null, tx = prisma } = {}) {
  const bill = await tx.vendor_bills.findFirst({
    where: { id: billId, document_type: 'bill', state: 'posted' },
    include: { vendor_bill_lines: { orderBy: { sequence: 'asc' } } },
  })
  if (!bill) throw inputError('Original posted vendor bill was not found')
  const paid = money2(bill.amount_paid)
  const priorRefunds = await tx.vendor_bills.findMany({
    where: {
      document_type: 'refund',
      reversed_bill_id: billId,
      state: 'posted',
      ...(excludeRefundId ? { id: { not: excludeRefundId } } : {}),
    },
    select: { id: true, amount_total: true },
  })
  const previouslyRefunded = money2(priorRefunds.reduce((sum, row) => sum + Number(row.amount_total || 0), 0))
  const maxRefundable = money2(Math.max(0, paid - previouslyRefunded))
  return {
    bill,
    paid,
    previouslyRefunded,
    maxRefundable,
    originalTotal: money2(bill.amount_total),
  }
}

async function prepareRefund(input, options = {}) {
  const vendorId = parseId(input.vendor_id)
  const refundDate = parseDate(input.bill_date || input.refund_date)
  const reversedBillId = parseId(input.reversed_bill_id)
  if (!vendorId || !refundDate) throw inputError('Vendor and refund date are required')
  if (!reversedBillId) throw inputError('Original vendor bill is required')

  const vendor = await prisma.vendors.findUnique({ where: { id: vendorId } })
  if (!vendor?.is_active) throw inputError('Active vendor not found')

  const refundInfo = await computeBillRefundable(reversedBillId, { excludeRefundId: options.excludeRefundId })
  if (refundInfo.bill.vendor_id !== vendorId) throw inputError('Original bill does not belong to the selected vendor')
  if (refundInfo.bill.company_id !== vendor.company_id) throw inputError('Original bill does not belong to this company')

  const refundType = String(input.refund_type || 'full').toLowerCase() === 'partial' ? 'partial' : 'full'
  const refundReason = String(input.refund_reason || '').trim()
  if (!refundReason) throw inputError('Refund reason is required')

  let refundAmount = refundType === 'full'
    ? refundInfo.maxRefundable
    : money2(input.refund_amount ?? input.amount_total)
  if (!(refundAmount > 0)) throw inputError('Refund amount must be greater than zero')
  if (refundAmount > refundInfo.maxRefundable + 0.005) {
    throw inputError(`Refund amount cannot exceed the maximum refundable of ${refundInfo.maxRefundable.toFixed(2)}`)
  }
  refundAmount = money2(Math.min(refundAmount, refundInfo.maxRefundable))
  if (refundInfo.maxRefundable <= 0.005) throw inputError('This vendor bill has no remaining refundable amount')

  const methodId = parseId(input.payment_method_id ?? input.receive_payment?.payment_method_id)
  let method = methodId
    ? await prisma.payment_methods.findUnique({ where: { id: methodId } })
    : await prisma.payment_methods.findFirst({
      where: {
        is_active: true,
        payment_type: { in: ['inbound', 'both'] },
        OR: [{ code: 'CASH' }, { name: 'Cash' }],
      },
      orderBy: { id: 'asc' },
    })
  if (!method?.is_active || !['inbound', 'both'].includes(method.payment_type)) {
    method = await prisma.payment_methods.findFirst({
      where: { is_active: true, payment_type: { in: ['inbound', 'both'] } },
      orderBy: { id: 'asc' },
    })
  }
  if (!method) throw inputError('No active payment method found to receive the vendor refund')

  const paymentReference = String(input.payment_reference ?? input.receive_payment?.payment_reference ?? '').trim()
  const bankId = parseId(input.bank_account_id ?? input.receive_payment?.bank_account_id)
  let bank = bankId ? await prisma.bank_accounts.findUnique({ where: { id: bankId } }) : null
  if (method.allow_multiple_accounts && !bank) {
    const matches = await prisma.bank_accounts.findMany({
      where: {
        company_id: vendor.company_id,
        currency_id: refundInfo.bill.currency_id,
        is_active: true,
        gl_account_id: { not: null },
        journal_id: { not: null },
      },
    })
    if (matches.length === 1) bank = matches[0]
  }
  if (bank && (!bank.is_active || bank.company_id !== vendor.company_id || bank.currency_id !== refundInfo.bill.currency_id || !bank.gl_account_id)) {
    bank = null
  }
  let receiveAccountId = method.allow_multiple_accounts ? bank?.gl_account_id : method.gl_account_id || bank?.gl_account_id
  if (!receiveAccountId) {
    const cashAccount = await prisma.chart_of_accounts.findFirst({
      where: {
        company_id: vendor.company_id,
        code: '1110',
        is_active: true,
        allow_manual_entry: true,
        account_types: { internal_group: 'asset' },
        other_chart_of_accounts: { none: {} },
      },
    })
    receiveAccountId = cashAccount?.id || null
  }
  if (!receiveAccountId) throw inputError('Cash account 1110 was not found to receive the vendor refund')
  const receiveAccount = await prisma.chart_of_accounts.findFirst({
    where: {
      id: receiveAccountId,
      company_id: vendor.company_id,
      is_active: true,
      allow_manual_entry: true,
      account_types: { internal_group: 'asset' },
      other_chart_of_accounts: { none: {} },
    },
  })
  if (!receiveAccount) throw inputError('The refund receiving GL account is not an active cash, bank, or wallet posting account')

  const [company, purchaseJournal, payableAccount, fiscalPeriod] = await Promise.all([
    prisma.companies.findUnique({ where: { id: vendor.company_id } }),
    prisma.journals.findFirst({
      where: {
        company_id: vendor.company_id,
        is_active: true,
        OR: [{ code: 'PUR' }, { code: 'BILL' }, { journal_type: 'purchase' }],
      },
      orderBy: { id: 'asc' },
    }),
    prisma.chart_of_accounts.findFirst({
      where: {
        company_id: vendor.company_id,
        code: '2110',
        is_active: true,
        allow_manual_entry: true,
        account_types: { internal_group: 'liability' },
        other_chart_of_accounts: { none: {} },
      },
    }),
    prisma.fiscal_periods.findFirst({
      where: {
        state: 'open',
        fiscal_years: { company_id: vendor.company_id, state: 'open' },
        start_date: { lte: refundDate },
        end_date: { gte: refundDate },
      },
      orderBy: { period_number: 'asc' },
    }),
  ])
  if (!company?.is_active) throw inputError('Vendor company is inactive or missing')
  if (!purchaseJournal) throw inputError('Active Purchase journal was not found')
  if (!payableAccount) throw inputError('Accounts Payable account 2110 was not found')
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the refund date')

  const originalLine = refundInfo.bill.vendor_bill_lines?.[0]
  const expenseAccountId = originalLine?.expense_account_id
    || (await prisma.chart_of_accounts.findFirst({
      where: {
        company_id: vendor.company_id,
        is_active: true,
        allow_manual_entry: true,
        account_types: { internal_group: 'expense' },
        other_chart_of_accounts: { none: {} },
      },
      orderBy: { code: 'asc' },
    }))?.id
  if (!expenseAccountId) throw inputError('No expense account available for refund line reference')

  const receivePayment = {
    enabled: true,
    payment_method_id: method.id,
    bank_account_id: bank?.id || null,
    payment_reference: paymentReference || null,
    receive_account_id: receiveAccount.id,
  }
  const notesText = String(input.notes_text || input.notes || '').trim() || null

  return {
    header: {
      company_id: vendor.company_id,
      document_type: 'refund',
      vendor_id: vendorId,
      vendor_reference: null,
      journal_id: purchaseJournal.id,
      fiscal_period_id: fiscalPeriod.id,
      bill_date: refundDate,
      received_date: refundDate,
      due_date: refundDate,
      payment_term_id: null,
      currency_id: refundInfo.bill.currency_id,
      exchange_rate: Number(refundInfo.bill.exchange_rate) || 1,
      payable_account_id: payableAccount.id,
      reversed_bill_id: reversedBillId,
      state: 'draft',
      payment_state: 'not_paid',
      amount_untaxed: refundAmount,
      amount_tax: 0,
      amount_total: refundAmount,
      amount_paid: 0,
      amount_due: refundAmount,
      notes: buildRefundNotes({
        notesText,
        refundType,
        refundReason,
        receivePayment,
      }),
    },
    lines: [{
      sequence: 10,
      product_id: null,
      description: `Vendor refund: ${refundReason}`.slice(0, 255),
      quantity: 1,
      unit_price: refundAmount,
      discount_percent: 0,
      tax_id: null,
      expense_account_id: expenseAccountId,
      subtotal: refundAmount,
    }],
    meta: {
      ...refundInfo,
      refundType,
      refundAmount,
      receivePayment,
      receiveAccount,
      method,
      bank,
      payableAccount,
    },
  }
}

function enrichVendorRefund(refund) {
  if (!refund) return refund
  const meta = parseRefundNotes(refund.notes)
  return {
    ...refund,
    bill_number: refund.bill_number,
    vendorBillNo: refund.bill_number,
    notes_text: meta.notes_text,
    refund_type: meta.refund_type,
    refund_reason: meta.refund_reason,
    receive_payment: meta.receive_payment,
    amount_paid: money2(refund.amount_paid),
    amount_due: money2(refund.amount_due),
  }
}

export const getRefunds = async (_req, res) => {
  try {
    const rows = await prisma.vendor_bills.findMany({ where: { document_type: 'refund' }, include, orderBy: { created_at: 'desc' } })
    res.json({ success: true, data: rows.map(enrichVendorRefund) })
  } catch (error) { fail(res, error, 'Failed to fetch vendor refunds') }
}

export const getRefundable = async (req, res) => {
  const billId = parseId(req.params.billId)
  if (!billId) return res.status(400).json({ success: false, message: 'Invalid bill id' })
  try {
    const excludeRefundId = parseId(req.query.exclude_refund_id)
    const info = await computeBillRefundable(billId, { excludeRefundId })
    res.json({
      success: true,
      data: {
        bill_id: info.bill.id,
        bill_number: info.bill.bill_number,
        original_total: info.originalTotal,
        amount_paid: info.paid,
        previously_refunded: info.previouslyRefunded,
        max_refundable: info.maxRefundable,
      },
    })
  } catch (error) { fail(res, error, 'Failed to compute refundable amount') }
}

export const createRefund = async (req, res) => {
  try {
    const prepared = await prepareRefund(req.body)
    const data = await prisma.$transaction(async (tx) => {
      const journal = await tx.journals.findUnique({ where: { id: prepared.header.journal_id } })
      const billNumber = await allocateNumber(tx, journal, { prefix: 'VBR-', pad: 6 })
      return tx.vendor_bills.create({
        data: { ...prepared.header, bill_number: billNumber, vendor_bill_lines: { create: prepared.lines } },
        include,
      })
    }, { maxWait: 10000, timeout: 30000 })
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'VendorRefund', entityId: data.id, description: `Prepared vendor refund "${data.bill_number}"` })
    res.status(201).json({ success: true, message: 'Draft vendor refund prepared successfully', data: enrichVendorRefund(data) })
  } catch (error) { fail(res, error, 'Failed to prepare vendor refund') }
}

export const updateRefund = async (req, res) => {
  const refundId = parseId(req.params.id)
  if (!refundId) return res.status(400).json({ success: false, message: 'Invalid refund id' })
  try {
    const existing = await prisma.vendor_bills.findFirst({ where: { id: refundId, document_type: 'refund' } })
    if (!existing) return res.status(404).json({ success: false, message: 'Vendor refund not found' })
    if (existing.state !== 'draft') throw inputError('Only draft refunds can be edited')
    const prepared = await prepareRefund(req.body, { excludeRefundId: refundId })
    const data = await prisma.$transaction(async (tx) => {
      await tx.vendor_bill_lines.deleteMany({ where: { bill_id: refundId } })
      return tx.vendor_bills.update({
        where: { id: refundId },
        data: {
          ...prepared.header,
          bill_number: existing.bill_number,
          vendor_bill_lines: { create: prepared.lines },
          updated_at: new Date(),
        },
        include,
      })
    }, { maxWait: 10000, timeout: 30000 })
    await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'VendorRefund', entityId: data.id, description: `Updated draft vendor refund "${data.bill_number}"` })
    res.json({ success: true, message: 'Draft vendor refund updated successfully', data: enrichVendorRefund(data) })
  } catch (error) { fail(res, error, 'Failed to update vendor refund') }
}

export const removeRefund = async (req, res) => {
  const refundId = parseId(req.params.id)
  if (!refundId) return res.status(400).json({ success: false, message: 'Invalid refund id' })
  try {
    const refund = await prisma.vendor_bills.findFirst({ where: { id: refundId, document_type: 'refund' } })
    if (!refund) return res.status(404).json({ success: false, message: 'Vendor refund not found' })
    if (refund.state !== 'draft') throw inputError('Only draft refunds can be deleted')
    await prisma.vendor_bills.delete({ where: { id: refundId } })
    await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'VendorRefund', entityId: refundId, description: `Deleted draft vendor refund "${refund.bill_number}"` })
    res.json({ success: true, message: 'Draft vendor refund deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete vendor refund') }
}

export const postRefund = async (req, res) => {
  const refundId = parseId(req.params.id)
  if (!refundId) return res.status(400).json({ success: false, message: 'Invalid refund id' })
  try {
    const data = await prisma.$transaction(async (tx) => {
      const refund = await tx.vendor_bills.findFirst({
        where: { id: refundId, document_type: 'refund' },
        include: { vendors: { select: { name: true } }, fiscal_periods: true },
      })
      if (!refund) throw inputError('Vendor refund not found')
      if (refund.state !== 'draft') throw inputError('Only draft vendor refunds can be posted')
      if (!refund.reversed_bill_id) throw inputError('Original vendor bill is required')
      if (!(Number(refund.amount_total) > 0)) throw inputError('Refund amount must be greater than zero')

      const notesMeta = parseRefundNotes(refund.notes)
      let receive = notesMeta.receive_payment
      if (!receive?.receive_account_id) {
        const cashMethod = await tx.payment_methods.findFirst({
          where: {
            is_active: true,
            payment_type: { in: ['inbound', 'both'] },
            OR: [{ code: 'CASH' }, { name: 'Cash' }],
          },
          orderBy: { id: 'asc' },
        })
        const cashAccount = await tx.chart_of_accounts.findFirst({
          where: {
            company_id: refund.company_id,
            code: '1110',
            is_active: true,
            allow_manual_entry: true,
            account_types: { internal_group: 'asset' },
            other_chart_of_accounts: { none: {} },
          },
        })
        if (!cashAccount) throw inputError('Cash account 1110 was not found to receive the vendor refund')
        receive = {
          enabled: true,
          payment_method_id: cashMethod?.id || null,
          bank_account_id: null,
          payment_reference: null,
          receive_account_id: cashAccount.id,
        }
      }

      const refundInfo = await computeBillRefundable(refund.reversed_bill_id, { excludeRefundId: refundId, tx })
      if (Number(refund.amount_total) > refundInfo.maxRefundable + 0.005) {
        throw inputError(`Refund amount exceeds the maximum refundable of ${refundInfo.maxRefundable.toFixed(2)}`)
      }
      if (refundInfo.bill.company_id !== refund.company_id || refundInfo.bill.vendor_id !== refund.vendor_id) {
        throw inputError('Original bill does not match this refund')
      }
      if (!refund.fiscal_periods || refund.fiscal_periods.state !== 'open') {
        throw inputError('Refund fiscal period is closed or invalid')
      }

      const existingJe = await tx.journal_entries.findFirst({
        where: { source_type: 'vendor_refund', source_id: refundId, state: 'posted' },
        select: { id: true },
      })
      if (existingJe) throw inputError('This vendor refund has already been posted')

      const claimed = await tx.vendor_bills.updateMany({
        where: { id: refundId, state: 'draft', document_type: 'refund' },
        data: { state: 'posted', payment_state: 'reversed', amount_due: 0, amount_paid: Number(refund.amount_total), posted_at: new Date(), updated_at: new Date() },
      })
      if (claimed.count !== 1) throw inputError('Only draft vendor refunds can be posted')

      const receiveAccount = await tx.chart_of_accounts.findFirst({
        where: {
          id: receive.receive_account_id,
          company_id: refund.company_id,
          is_active: true,
          allow_manual_entry: true,
          account_types: { internal_group: 'asset' },
          other_chart_of_accounts: { none: {} },
        },
      })
      if (!receiveAccount) throw inputError('Refund receiving GL account is invalid')

      const method = receive.payment_method_id
        ? await tx.payment_methods.findUnique({ where: { id: receive.payment_method_id } })
        : null
      const channel = paymentChannel(method || { name: 'Cash', code: 'CASH' }, receiveAccount)
      let journal = await tx.journals.findFirst({
        where: { company_id: refund.company_id, code: channel.code, journal_type: channel.type, is_active: true },
      })
      if (!journal) {
        journal = await tx.journals.findFirst({
          where: { company_id: refund.company_id, journal_type: channel.type, is_active: true },
          orderBy: { code: 'asc' },
        })
      }
      if (!journal) throw inputError('Configure an active Cash or Bank journal for refund receipts')

      const postedAt = new Date()
      const amount = money2(refund.amount_total)
      const baseAmount = money2(amount * Number(refund.exchange_rate || 1))
      const entryNumber = refund.bill_number

      const entry = await tx.journal_entries.create({
        data: {
          company_id: refund.company_id,
          journal_id: journal.id,
          entry_number: entryNumber,
          entry_date: refund.bill_date,
          fiscal_period_id: refund.fiscal_period_id,
          reference: entryNumber,
          narration: `Vendor refund ${entryNumber} from ${refund.vendors?.name || `vendor #${refund.vendor_id}`}`,
          state: 'posted',
          source_type: 'vendor_refund',
          source_id: refundId,
          posted_at: postedAt,
          journal_items: {
            create: [
              {
                sequence: 10,
                account_id: receiveAccount.id,
                label: `${channel.label} received`,
                partner_type: 'vendor',
                partner_id: refund.vendor_id,
                debit: baseAmount,
                credit: 0,
                currency_id: refund.currency_id,
                amount_currency: amount,
              },
              {
                sequence: 20,
                account_id: refund.payable_account_id,
                label: 'Accounts Payable / Vendor Credit',
                partner_type: 'vendor',
                partner_id: refund.vendor_id,
                debit: 0,
                credit: baseAmount,
                currency_id: refund.currency_id,
                amount_currency: -amount,
              },
            ],
          },
        },
      })

      await tx.vendor_bills.update({
        where: { id: refundId },
        data: {
          journal_entry_id: entry.id,
          notes: buildRefundNotes({
            notesText: notesMeta.notes_text,
            refundType: notesMeta.refund_type || 'partial',
            refundReason: notesMeta.refund_reason,
            receivePayment: null,
          }),
          updated_at: postedAt,
        },
      })

      // Original bill totals stay historical. Do not rewrite amount_total / lines.
      return tx.vendor_bills.findUnique({ where: { id: refundId }, include })
    }, { maxWait: 10000, timeout: 30000 })

    await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'VendorRefund', entityId: refundId, description: `Posted vendor refund "${data.bill_number}"` })
    res.json({ success: true, message: 'Vendor refund posted successfully', data: enrichVendorRefund(data) })
  } catch (error) { fail(res, error, 'Failed to post vendor refund') }
}
