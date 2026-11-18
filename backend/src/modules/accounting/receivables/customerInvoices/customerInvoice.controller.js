import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'
import { findAccountingCustomerForClient } from '../../../shared/customers/customer.service.js'

const invoiceInclude = {
  customers: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      clientId: true,
      client: {
        select: {
          id: true,
          institution: true,
          companyName: true,
          contactPerson: true,
          email: true,
          phone: true,
          address: true,
        },
      },
    },
  },
  client: {
    select: {
      id: true,
      clientCode: true,
      institution: true,
      companyName: true,
      contactPerson: true,
      email: true,
      phone: true,
      address: true,
    },
  },
  companies: { select: { id: true, name: true } },
  currencies: { select: { id: true, code: true, symbol: true } },
  journals: { select: { id: true, name: true, code: true } },
  customer_invoice_lines: {
    orderBy: { sequence: 'asc' },
    include: {
      products: { select: { id: true, name: true, sku: true } },
      taxes: { select: { id: true, name: true, rate_percent: true, price_includes_tax: true } },
      chart_of_accounts: { select: { id: true, code: true, name: true } },
    },
  },
  payment_terms: { select: { id: true, name: true } },
  fiscal_periods: { select: { id: true, name: true, start_date: true, end_date: true, state: true } },
  journal_entries: { select: { id: true, entry_number: true, state: true } },
  converted_quotations: { select: { id: true, quotation_number: true, status: true, total: true } },
}

// The database can be remote, and invoice transactions create the invoice,
// lines, journal entry, and journal items atomically. Prisma's 5-second default
// is too short for that multi-query unit of work on a higher-latency connection.
const invoiceTransactionOptions = { maxWait: 10000, timeout: 30000 }

const id = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
const date = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const fail = (res, error, fallback) => {
  console.error(fallback, error)
  return res.status(error.status || (error.code === 'P2025' ? 404 : 500))
    .json({ success: false, message: error.message || fallback })
}
const inputError = (message) => {
  const error = new Error(message)
  error.status = 400
  return error
}

function money2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function parseInvoiceNotes(notes) {
  if (!notes) return null
  try {
    return typeof notes === 'string' ? JSON.parse(notes) : notes
  } catch {
    return null
  }
}

/**
 * Draft invoices keep Receive Payment Now in notes.pending_payment until post.
 * Expose that amount as paid/outstanding/payment_state so list/detail UIs stay correct.
 */
function withClientIdentity(invoice) {
  if (!invoice) return invoice
  const client = invoice.client || invoice.customers?.client
  if (!client) return invoice
  const name = client.companyName || client.institution || invoice.customers?.name
  return {
    ...invoice,
    customers: invoice.customers
      ? { ...invoice.customers, name, phone: client.phone || invoice.customers.phone, email: client.email || invoice.customers.email }
      : invoice.customers,
  }
}

function enrichInvoicePaymentDisplay(invoice) {
  if (!invoice) return invoice
  invoice = withClientIdentity(invoice)
  const total = money2(invoice.amount_total)
  if (invoice.state === 'draft') {
    const meta = parseInvoiceNotes(invoice.notes)
    const pending = meta?.pending_payment
    if (pending?.enabled && Number(pending.amount || 0) > 0.005) {
      const paid = money2(Math.min(Number(pending.amount || 0), total))
      const due = money2(Math.max(0, total - paid))
      return {
        ...invoice,
        paid_amount: paid,
        amount_due: due,
        payment_state: paid >= total - 0.005 && total > 0.005 ? 'paid' : paid > 0.005 ? 'partial' : 'not_paid',
      }
    }
    return {
      ...invoice,
      paid_amount: 0,
      amount_due: total,
      payment_state: 'not_paid',
    }
  }
  const paid = money2(invoice.paid_amount ?? Math.max(0, total - Number(invoice.amount_due || 0)))
  const due = money2(invoice.amount_due ?? Math.max(0, total - paid))
  const meta = parseInvoiceNotes(invoice.notes)
  const advance = money2(meta?.advance_credit_applied || 0)
  const previousDebt = money2(meta?.previous_outstanding_balance || 0)
  const installmentAmount = money2(
    meta?.contract_installment_amount
    || Math.max(0, total - previousDebt),
  )
  const cashPaid = money2(Math.max(0, paid - advance))
  const netAmount = money2(Math.max(0, installmentAmount + previousDebt - advance))
  const invoiceAmount = money2(Math.max(0, total - advance))
  return {
    ...invoice,
    paid_amount: paid,
    amount_due: due,
    advance_credit_applied: advance,
    previous_outstanding_balance: previousDebt,
    contract_installment_amount: installmentAmount,
    invoice_amount: invoiceAmount,
    cash_paid: cashPaid,
    net_amount: netAmount,
    contract_number: meta?.contract_number || invoice.customer_reference || null,
    contract_id: meta?.contract_id || null,
    installment_number: meta?.installment_number || null,
    installment_id: meta?.installment_id || invoice.installment_id || null,
    payment_state:
      invoice.payment_state ||
      (due <= 0.005 && total > 0.005 ? 'paid' : paid > 0.005 ? 'partial' : 'not_paid'),
    display_status: invoiceDisplayStatus({ ...invoice, amount_due: due, paid_amount: paid, advance_credit_applied: advance }),
  }
}

const MILESTONE_LABELS = {
  CONTRACT_START: 'Advance',
  AFTER_1_MONTH: 'After 1 Month',
  AFTER_3_MONTHS: 'After 3 Months',
  AFTER_6_MONTHS: 'After 6 Months',
  AFTER_12_MONTHS: 'After 12 Months',
  CONTRACT_COMPLETION: 'Contract Completion',
  CUSTOM_DATE: 'Custom date',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUALLY: 'Semi-Annual',
  ANNUALLY: 'Annual',
}

function invoiceDisplayStatus(invoice) {
  if (invoice.state === 'cancelled') return 'CANCELLED'
  if (invoice.state !== 'posted') return 'DRAFT'
  const due = money2(invoice.amount_due)
  if (due <= 0.005) return 'PAID'
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (dueDate && !Number.isNaN(dueDate.getTime())) {
    dueDate.setHours(0, 0, 0, 0)
    if (dueDate < today) return 'OVERDUE'
  }
  const advance = money2(invoice.advance_credit_applied)
  const cash = money2(Math.max(0, Number(invoice.paid_amount || 0) - advance))
  if (advance > 0.005 || cash > 0.005) return 'PARTIALLY_PAID'
  return 'UNPAID'
}

function installmentLabel(number, percentage, milestone) {
  if (!number && !milestone) return null
  const sequence = String(number || 1).padStart(2, '0')
  const share = percentage != null && percentage !== '' ? `${Number(percentage)}% ` : ''
  const name = MILESTONE_LABELS[milestone] || milestone || 'Scheduled payment'
  return `Payment ${sequence} – ${share}${name}`.trim()
}

async function attachInvoiceContext(invoices, withPayments = false) {
  const list = (Array.isArray(invoices) ? invoices : [invoices]).filter(Boolean)
  if (!list.length) return invoices
  const contractIds = new Set()
  const contractNumbers = new Set()
  for (const invoice of list) {
    if (invoice.contract_id) contractIds.add(String(invoice.contract_id))
    if (invoice.contract_number) contractNumbers.add(String(invoice.contract_number))
    if (invoice.customer_reference) contractNumbers.add(String(invoice.customer_reference))
  }
  const or = []
  if (contractIds.size) or.push({ id: { in: [...contractIds] } })
  if (contractNumbers.size) or.push({ contractNumber: { in: [...contractNumbers] } })
  const contracts = or.length
    ? await prisma.contract.findMany({
        where: { OR: or },
        select: {
          id: true,
          contractNumber: true,
          title: true,
          duration: true,
          startDate: true,
          endDate: true,
          totalAmount: true,
          paymentTerms: true,
          projectId: true,
        },
      })
    : []
  const resolvedIds = contracts.map((contract) => contract.id)
  const projectIds = contracts.map((contract) => contract.projectId).filter(Boolean)
  const [projects, installments, allocations] = await Promise.all([
    resolvedIds.length || projectIds.length
      ? prisma.project.findMany({
          where: {
            archived: false,
            OR: [
              ...(resolvedIds.length ? [{ contractId: { in: resolvedIds } }] : []),
              ...(projectIds.length ? [{ id: { in: projectIds } }] : []),
            ],
          },
          select: { id: true, name: true, contractId: true },
        })
      : [],
    resolvedIds.length
      ? prisma.clientInstallment.findMany({
          where: { contractId: { in: resolvedIds } },
          select: {
            sourceKey: true,
            contractId: true,
            installmentNumber: true,
            percentage: true,
            dueMilestone: true,
            dueDate: true,
          },
        })
      : [],
    withPayments
      ? prisma.receipt_allocations.findMany({
          where: { invoice_id: { in: list.map((invoice) => invoice.id) }, customer_receipts: { state: 'posted' } },
          include: {
            customer_receipts: {
              select: {
                receipt_number: true,
                receipt_date: true,
                reference: true,
                state: true,
                payment_methods: { select: { name: true } },
              },
            },
          },
          orderBy: { allocated_at: 'asc' },
        })
      : [],
  ])
  const byId = new Map(contracts.map((contract) => [contract.id, contract]))
  const byNumber = new Map(contracts.map((contract) => [contract.contractNumber, contract]))
  const decorated = list.map((invoice) => {
    const contract = byId.get(invoice.contract_id) || byNumber.get(invoice.contract_number) || byNumber.get(invoice.customer_reference) || null
    const installment = installments.find((row) => (
      (invoice.installment_id && row.sourceKey === invoice.installment_id)
      || (contract && row.contractId === contract.id && Number(row.installmentNumber) === Number(invoice.installment_number))
    )) || null
    const project = contract
      ? projects.find((row) => row.id === contract.projectId) || projects.find((row) => row.contractId === contract.id) || null
      : null
    const payments = allocations
      .filter((row) => row.invoice_id === invoice.id)
      .map((row) => ({
        date: row.customer_receipts?.receipt_date || row.allocated_at,
        receipt_number: row.customer_receipts?.receipt_number || null,
        method: row.customer_receipts?.payment_methods?.name || null,
        amount: money2(row.allocated_amount),
        reference: row.customer_receipts?.reference || null,
      }))
    return {
      ...invoice,
      contract_id: contract?.id || invoice.contract_id || null,
      contract_number: contract?.contractNumber || invoice.contract_number || null,
      contract_title: contract?.title || null,
      contract_duration: contract?.duration || null,
      contract_start: contract?.startDate || null,
      contract_end: contract?.endDate || null,
      contract_amount: contract?.totalAmount ?? null,
      contract_payment_terms: contract?.paymentTerms || null,
      project_name: project?.name || null,
      installment_number: installment?.installmentNumber ?? invoice.installment_number ?? null,
      installment_percentage: installment?.percentage ?? null,
      installment_milestone: installment?.dueMilestone || null,
      installment_due_date: installment?.dueDate || null,
      installment_label: installmentLabel(
        installment?.installmentNumber ?? invoice.installment_number,
        installment?.percentage,
        installment?.dueMilestone,
      ),
      payment_history: payments,
    }
  })
  return Array.isArray(invoices) ? decorated : decorated[0]
}

async function clearPendingPaymentNotes(invoiceId, meta) {
  if (!meta || typeof meta !== 'object') return
  const next = { ...meta, pending_payment: null }
  await prisma.customer_invoices.update({
    where: { id: invoiceId },
    data: { notes: JSON.stringify(next), updated_at: new Date() },
  })
}

/**
 * After invoice post, create+post the Receive Payment Now receipt exactly once.
 */
async function settlePendingReceivePaymentNow(invoice, userId) {
  const meta = parseInvoiceNotes(invoice.notes)
  const pending = meta?.pending_payment
  if (!pending?.enabled || !pending.payment_method_id || Number(pending.amount || 0) <= 0.005) {
    return invoice
  }

  const marker = `Immediate payment for invoice ${invoice.invoice_number}`
  const existing = await prisma.customer_receipts.findFirst({
    where: {
      state: 'posted',
      memo: { contains: marker },
      receipt_allocations: { some: { invoice_id: invoice.id } },
    },
    select: { id: true },
  })
  if (existing) {
    await clearPendingPaymentNotes(invoice.id, meta)
    return prisma.customer_invoices.findUnique({ where: { id: invoice.id }, include: invoiceInclude })
  }

  const due = money2(invoice.amount_due)
  const payNow = money2(Math.min(Number(pending.amount || 0), due, Number(invoice.amount_total || 0)))
  if (payNow <= 0.005) {
    await clearPendingPaymentNotes(invoice.id, meta)
    return invoice
  }

  const { create: createReceipt, post: postReceipt } = await import('../customerReceipts/customerReceipt.controller.js')
  const mockRes = () => {
    const box = { statusCode: 200, body: null }
    return {
      status(code) { box.statusCode = code; return this },
      json(body) { box.body = body; return box },
      _box: box,
    }
  }

  const createRes = mockRes()
  await createReceipt(
    {
      user: { id: userId },
      body: {
        customer_id: invoice.customer_id,
        payment_method_id: Number(pending.payment_method_id),
        receipt_date: invoice.invoice_date || new Date().toISOString(),
        amount: payNow,
        reference: pending.reference ? String(pending.reference) : undefined,
        memo: marker,
        allocations: [{ invoice_id: invoice.id, allocated_amount: payNow }],
      },
    },
    createRes
  )
  if (!createRes._box.body?.success || !createRes._box.body?.data?.id) {
    throw inputError(createRes._box.body?.message || 'Failed to create the pending invoice payment receipt')
  }

  const postRes = mockRes()
  await postReceipt(
    { user: { id: userId }, params: { id: String(createRes._box.body.data.id) } },
    postRes
  )
  if (!postRes._box.body?.success) {
    throw inputError(postRes._box.body?.message || 'Failed to post the pending invoice payment receipt')
  }

  await clearPendingPaymentNotes(invoice.id, meta)
  return prisma.customer_invoices.findUnique({ where: { id: invoice.id }, include: invoiceInclude })
}

function parseVatPercent(input) {
  const direct = Number(input?.vat_percent)
  if (Number.isFinite(direct) && direct >= 0) return direct
  try {
    const notes = typeof input?.notes === 'string' ? JSON.parse(input.notes || '{}') : input?.notes
    const fromNotes = Number(notes?.vat_percent)
    if (Number.isFinite(fromNotes) && fromNotes >= 0) return fromNotes
  } catch {
    // ignore malformed notes
  }
  return 0
}

async function findTaxPayableAccount(companyId) {
  return (
    await prisma.chart_of_accounts.findFirst({
      where: { company_id: companyId, code: '2120', is_active: true, allow_manual_entry: true },
    })
    || await prisma.chart_of_accounts.findFirst({
      where: {
        company_id: companyId,
        is_active: true,
        allow_manual_entry: true,
        name: { contains: 'Tax' },
        account_types: { internal_group: 'liability' },
        other_chart_of_accounts: { none: {} },
      },
      orderBy: { code: 'asc' },
    })
  )
}

/** Ensure an active sales VAT tax exists for the given rate (e.g. 5). */
async function ensureSaleVatTax(ratePercent, companyId) {
  const rate = money2(ratePercent)
  if (!(rate > 0)) return null

  const candidates = await prisma.taxes.findMany({
    where: { is_active: true, tax_scope: { in: ['sale', 'both'] } },
    orderBy: { id: 'asc' },
  })
  let tax = candidates.find((row) => Math.abs(Number(row.rate_percent) - rate) < 0.0001) || null

  const taxAccount = await findTaxPayableAccount(companyId)
  if (!taxAccount) throw inputError('Taxes Payable account (2120) was not found for VAT posting')

  if (tax) {
    if (!tax.tax_account_id) {
      tax = await prisma.taxes.update({
        where: { id: tax.id },
        data: { tax_account_id: taxAccount.id, updated_at: new Date() },
      })
    }
    return tax
  }

  const preferredName = rate === 5 ? 'VAT 5%' : `VAT ${rate}%`
  const existingName = await prisma.taxes.findFirst({ where: { name: preferredName } })
  const name = existingName ? `Sales VAT ${rate}%` : preferredName

  return prisma.taxes.create({
    data: {
      name,
      tax_scope: 'both',
      rate_percent: rate,
      tax_account_id: taxAccount.id,
      price_includes_tax: false,
      is_active: true,
    },
  })
}

export async function ensureCustomerInvoiceDefaults() {
  const defaults = [
    ['Immediate', 0],
    ['Net 7', 7],
    ['Net 15', 15],
    ['Net 30', 30],
    ['Net 45', 45],
    ['Net 60', 60],
  ]
  for (const [name, dueDays] of defaults) {
    const term = await prisma.payment_terms.upsert({
      where: { name },
      update: { is_active: true },
      create: { name, description: dueDays ? `Payment due in ${dueDays} days` : 'Payment due immediately', is_active: true },
      include: { payment_term_lines: true },
    })
    if (!term.payment_term_lines.length) {
      await prisma.payment_term_lines.create({
        data: { payment_term_id: term.id, sequence: 10, value_type: 'balance', value_amount: 0, due_days: dueDays },
      })
    }
  }
}

export async function prepareInvoice(input) {
  let clientId = String(input.client_id || '').trim()
  const contractId = String(input.contract_id || '').trim()
  let contract = null
  if (contractId) {
    contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, clientId: true, contractNumber: true },
    })
    if (!contract) throw inputError('Contract not found')
    if (!contract.clientId) throw inputError('This contract has no client')
    clientId = contract.clientId
  }
  let customerId = id(input.customer_id)
  if (clientId) {
    const linked = await findAccountingCustomerForClient(clientId)
    customerId = linked.id
  }
  const invoiceDate = date(input.invoice_date)
  const lines = Array.isArray(input.lines) ? input.lines : []

  if (!customerId || !invoiceDate) throw inputError('Customer and invoice date are required')
  if (!lines.length) throw inputError('Add at least one invoice line')

  const customer = await prisma.customers.findUnique({ where: { id: customerId } })
  if (!customer) throw inputError('Customer not found')
  input._resolvedClientId = clientId || customer.clientId || null
  input._resolvedContract = contract
  let [company, journal, paymentTerm, fiscalPeriod, revenueAccount] = await Promise.all([
    prisma.companies.findUnique({ where: { id: customer.company_id } }),
    id(input.journal_id)
      ? prisma.journals.findUnique({ where: { id: id(input.journal_id) } })
      : prisma.journals.findFirst({
          where: {
            company_id: customer.company_id,
            journal_type: 'sale',
            is_active: true,
          },
          orderBy: { id: 'asc' },
        }),
    id(input.payment_term_id) ? prisma.payment_terms.findUnique({ where: { id: id(input.payment_term_id) }, include: { payment_term_lines: true } }) : null,
    prisma.fiscal_periods.findFirst({
      where: {
        state: 'open',
        fiscal_years: { company_id: customer.company_id, state: 'open' },
        start_date: { lte: invoiceDate },
        end_date: { gte: invoiceDate },
      },
      orderBy: { period_number: 'asc' },
    }),
    prisma.chart_of_accounts.findFirst({
      where: { company_id: customer.company_id, code: '4100', is_active: true },
    }),
  ])
  if (!company?.is_active) throw inputError('Customer company is inactive or missing')
  if (!journal?.is_active || journal.journal_type !== 'sale') throw inputError('Active Customer Invoices sales journal was not found')
  if (!revenueAccount) {
    revenueAccount = await prisma.chart_of_accounts.findFirst({
      where: { company_id: customer.company_id, code: '4000', is_active: true },
    }) || await prisma.chart_of_accounts.findFirst({
      where: { company_id: customer.company_id, account_types: { internal_group: 'income' }, is_active: true },
    })
  }
  if (!revenueAccount) throw inputError('Service Revenue account (4100 / 4000) was not found')
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the invoice date')

  const currencyId = id(input.currency_id) || company.currency_id
  let receivableAccount = customer.receivable_account_id
    ? await prisma.chart_of_accounts.findUnique({ where: { id: customer.receivable_account_id } })
    : null
  if (!receivableAccount) {
    receivableAccount = await prisma.chart_of_accounts.findFirst({
      where: { company_id: customer.company_id, code: '1200', is_active: true },
    }) || await prisma.chart_of_accounts.findFirst({
      where: { company_id: customer.company_id, name: { contains: 'Receivable' }, is_active: true },
    }) || await prisma.chart_of_accounts.findFirst({
      where: { company_id: customer.company_id, code: '1100', is_active: true },
    })
  }
  const currency = await prisma.currencies.findUnique({ where: { id: currencyId } })
  if (!currency?.is_active) throw inputError('Invoice currency is inactive or missing')
  if (!receivableAccount) throw inputError('Accounts Receivable account (1200) was not found')

  const dueDays = paymentTerm?.payment_term_lines?.length
    ? Math.max(...paymentTerm.payment_term_lines.map((line) => Number(line.due_days || 0)))
    : 0
  const dueDate = date(input.due_date) || new Date(invoiceDate)
  if (!date(input.due_date)) dueDate.setUTCDate(dueDate.getUTCDate() + dueDays)
  if (dueDate < invoiceDate) throw inputError('Due date cannot be before the invoice date')

  const exchangeRate = currencyId === company.currency_id ? 1 : Number(input.exchange_rate)
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw inputError('A positive exchange rate is required')

  // Invoice-level VAT from form (Apply VAT). Persist via line tax_id + amount_tax / amount_total.
  const vatPercent = parseVatPercent(input)
  const invoiceVatTax = vatPercent > 0 ? await ensureSaleVatTax(vatPercent, customer.company_id) : null
  const normalizedLines = lines.map((line) => {
    const existingTaxId = id(line.tax_id)
    if (vatPercent <= 0) return { ...line, tax_id: null }
    if (existingTaxId) return line
    return { ...line, tax_id: invoiceVatTax?.id || null }
  })

  const productIds = [...new Set(normalizedLines.map((line) => id(line.product_id)).filter(Boolean))]
  const taxIds = [...new Set(normalizedLines.map((line) => id(line.tax_id)).filter(Boolean))]
  const [products, taxes] = await Promise.all([
    prisma.products.findMany({ where: { id: { in: productIds } } }),
    prisma.taxes.findMany({ where: { id: { in: taxIds } } }),
  ])
  const productMap = new Map(products.map((item) => [item.id, item]))
  const taxMap = new Map(taxes.map((item) => [item.id, item]))

  let defaultTaxAccount = null
  if (taxIds.length > 0) {
    defaultTaxAccount = await findTaxPayableAccount(customer.company_id)
  }

  let amountUntaxed = 0
  let amountTax = 0
  let amountDiscount = 0
  const journalCredits = []
  const preparedLines = normalizedLines.map((line, index) => {
    const productId = id(line.product_id)
    const product = productId ? productMap.get(productId) : null
    const taxId = id(line.tax_id)
    const tax = taxId ? taxMap.get(taxId) : null
    const incomeAccountId = revenueAccount.id
    const quantity = Number(line.quantity)
    const unitPrice = Number(line.unit_price)
    const discount = Number(line.discount_percent || 0)
    const description = String(line.description || product?.name || '').trim()
    if (productId && (!product || !product.is_active || !product.can_be_sold)) throw inputError(`Line ${index + 1}: product is not active and sellable`)
    if (!description) throw inputError(`Line ${index + 1}: description is required`)
    if (!Number.isFinite(quantity) || quantity <= 0) throw inputError(`Line ${index + 1}: quantity must be greater than zero`)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw inputError(`Line ${index + 1}: unit price cannot be negative`)
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw inputError(`Line ${index + 1}: discount must be between 0 and 100`)
    if (taxId && !tax) throw inputError(`Line ${index + 1}: tax not found`)

    const discounted = quantity * unitPrice * (1 - discount / 100)
    amountDiscount += quantity * unitPrice - discounted
    const rate = tax ? Number(tax.rate_percent) / 100 : 0
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0
    const roundedUntaxed = money2(untaxed)
    const roundedTax = money2(taxAmount)
    amountUntaxed += roundedUntaxed
    amountTax += roundedTax
    journalCredits.push({ account_id: incomeAccountId, amount: roundedUntaxed, label: description })
    if (roundedTax) {
      const taxAccId = tax?.tax_account_id || defaultTaxAccount?.id
      if (!taxAccId) throw inputError(`Line ${index + 1}: selected tax has no tax account`)
      journalCredits.push({ account_id: taxAccId, amount: roundedTax, label: tax?.name || 'Tax' })
    }
    return {
      sequence: (index + 1) * 10,
      product_id: productId,
      description,
      quantity,
      unit_price: unitPrice,
      discount_percent: discount,
      tax_id: taxId,
      income_account_id: incomeAccountId,
      subtotal: roundedUntaxed,
    }
  })

  amountUntaxed = money2(amountUntaxed)
  amountTax = money2(amountTax)

  // Safety net: VAT requested but line taxes produced $0 — apply on subtotal.
  if (vatPercent > 0 && amountTax <= 0.005 && amountUntaxed > 0) {
    amountTax = money2(amountUntaxed * (vatPercent / 100))
    if (amountTax > 0) {
      const taxAccId = invoiceVatTax?.tax_account_id || (await findTaxPayableAccount(customer.company_id))?.id
      if (!taxAccId) throw inputError('Taxes Payable account (2120) was not found for VAT posting')
      journalCredits.push({ account_id: taxAccId, amount: amountTax, label: invoiceVatTax?.name || `VAT ${vatPercent}%` })
      if (invoiceVatTax?.id) {
        for (const line of preparedLines) {
          if (!line.tax_id) line.tax_id = invoiceVatTax.id
        }
      }
    }
  }

  const amountTotal = money2(amountUntaxed + amountTax)

  let notesValue = String(input.notes || '').trim() || null
  if (notesValue) {
    try {
      const parsed = JSON.parse(notesValue)
      if (parsed && typeof parsed === 'object') {
        parsed.vat_percent = vatPercent
        parsed.tax_id = invoiceVatTax?.id || parsed.tax_id || null
        parsed.amount_untaxed = amountUntaxed
        parsed.amount_tax = amountTax
        parsed.amount_total = amountTotal
        if (input._resolvedContract?.id) parsed.contract_id = input._resolvedContract.id
        notesValue = JSON.stringify(parsed)
      }
    } catch {
      // keep original notes string
    }
  }
  if (input._resolvedContract?.id && !String(notesValue || '').includes(input._resolvedContract.id)) {
    notesValue = JSON.stringify({ ...(notesValue ? { note: notesValue } : {}), contract_id: input._resolvedContract.id, contract_number: input._resolvedContract.contractNumber || null })
  }

  return {
    header: {
      company_id: customer.company_id,
      client_id: input._resolvedClientId || customer.clientId || null,
      document_type: 'invoice',
      customer_id: customerId,
      journal_id: journal.id,
      fiscal_period_id: fiscalPeriod.id,
      invoice_date: invoiceDate,
      due_date: dueDate,
      payment_term_id: paymentTerm?.id || null,
      currency_id: currencyId,
      exchange_rate: exchangeRate,
      receivable_account_id: receivableAccount.id,
      customer_reference: String(input.customer_reference || '').trim() || null,
      state: 'draft',
      payment_state: 'not_paid',
      amount_untaxed: amountUntaxed,
      amount_tax: amountTax,
      amount_total: amountTotal,
      paid_amount: 0,
      amount_due: amountTotal,
      notes: notesValue,
    },
    lines: preparedLines,
    amountDiscount: money2(amountDiscount),
    journalCredits,
    companyCurrencyId: company.currency_id,
    vatPercent,
  }
}

export function journalItems(prepared) {
  const rate = Number(prepared.header.exchange_rate)
  const credits = new Map()
  for (const line of prepared.journalCredits) {
    credits.set(line.account_id, (credits.get(line.account_id) || 0) + line.amount)
  }
  const totalBase = Math.round(prepared.header.amount_total * rate * 100) / 100
  const items = [
    {
      sequence: 10,
      account_id: prepared.header.receivable_account_id,
      label: 'Accounts Receivable',
      partner_type: 'customer',
      partner_id: prepared.header.customer_id,
      debit: totalBase,
      credit: 0,
      currency_id: prepared.header.currency_id,
      amount_currency: prepared.header.amount_total,
    },
    ...[...credits.entries()].map(([accountId, amount], index) => ({
      sequence: (index + 2) * 10,
      account_id: accountId,
      label: 'Customer invoice revenue',
      debit: 0,
      credit: Math.round(amount * rate * 100) / 100,
      currency_id: prepared.header.currency_id,
      amount_currency: -amount,
    })),
  ]
  const debit = items[0].debit
  const credit = items.slice(1).reduce((sum, item) => sum + item.credit, 0)
  if (items.length > 1 && Math.abs(debit - credit) > 0) {
    items[items.length - 1].credit = Math.round((items[items.length - 1].credit + debit - credit) * 100) / 100
  }
  return items
}

export async function allocateInvoiceNumber(tx, journal) {
  for (;;) {
    const updated = await tx.journals.update({
      where: { id: journal.id },
      data: { next_sequence: { increment: 1 } },
      select: { next_sequence: true },
    })
    const number = `${journal.code}${String(updated.next_sequence - 1).padStart(4, '0')}`
    const exists = await tx.customer_invoices.findFirst({ where: { company_id: journal.company_id, invoice_number: number }, select: { id: true } })
    if (!exists) return number
  }
}

export const getAll = async (req, res) => {
  try {
    const data = await prisma.customer_invoices.findMany({
      where: { document_type: 'invoice' },
      include: invoiceInclude,
      orderBy: { created_at: 'desc' },
    })
    res.json({ success: true, data: await attachInvoiceContext(data.map(enrichInvoicePaymentDisplay)) })
  } catch (error) { fail(res, error, 'Failed to fetch customer invoices') }
}


export const getById = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const data = await prisma.customer_invoices.findUnique({ where: { id: invoiceId }, include: invoiceInclude })
    if (!data) return res.status(404).json({ success: false, message: 'Customer invoice not found' })
    res.json({ success: true, data: await attachInvoiceContext(enrichInvoicePaymentDisplay(data), true) })
  } catch (error) { fail(res, error, 'Failed to fetch customer invoice') }
}

export const create = async (req, res) => {
  try {
    const prepared = await prepareInvoice(req.body)
    const quotationId = id(req.body.quotation_id)
    const data = await prisma.$transaction(async (tx) => {
      if (quotationId) {
        const quotation = await tx.quotations.findUnique({ where: { id: quotationId } })
        if (!quotation) throw inputError('Selected quotation was not found')
        if (quotation.status !== 'ACCEPTED') throw inputError('Only ACCEPTED quotations can be imported')
        if (quotation.converted_invoice_id) throw inputError('This quotation already has an invoice')
        if (quotation.company_id && quotation.company_id !== prepared.header.company_id) {
          throw inputError('Quotation belongs to a different company')
        }
        if (quotation.customer_id && quotation.customer_id !== prepared.header.customer_id) {
          throw inputError('Invoice customer must match the quotation customer')
        }
      }

      const journal = await tx.journals.findUnique({ where: { id: prepared.header.journal_id } })
      const invoiceNumber = await allocateInvoiceNumber(tx, journal)
      const header = {
        ...prepared.header,
        customer_reference: prepared.header.customer_reference
          || (quotationId ? (await tx.quotations.findUnique({ where: { id: quotationId }, select: { quotation_number: true } }))?.quotation_number : null),
      }
      const invoice = await tx.customer_invoices.create({
        data: { ...header, invoice_number: invoiceNumber, customer_invoice_lines: { create: prepared.lines } },
      })
      const entry = await tx.journal_entries.create({
        data: {
          company_id: prepared.header.company_id,
          journal_id: prepared.header.journal_id,
          entry_number: invoiceNumber,
          entry_date: prepared.header.invoice_date,
          fiscal_period_id: prepared.header.fiscal_period_id,
          reference: invoiceNumber,
          narration: quotationId
            ? `Draft customer invoice ${invoiceNumber} (Quotation ${header.customer_reference || quotationId})`
            : `Draft customer invoice ${invoiceNumber}`,
          state: 'draft',
          source_type: 'customer_invoice',
          source_id: invoice.id,
          journal_items: { create: journalItems(prepared) },
        },
      })
      await tx.customer_invoices.update({
        where: { id: invoice.id },
        data: { journal_entry_id: entry.id },
      })
      if (quotationId) {
        const linked = await tx.quotations.updateMany({
          where: { id: quotationId, status: 'ACCEPTED', converted_invoice_id: null },
          data: { converted_invoice_id: invoice.id, updated_at: new Date() },
        })
        if (linked.count !== 1) throw inputError('This quotation was already invoiced by another request')
      }
      return tx.customer_invoices.findUnique({ where: { id: invoice.id }, include: invoiceInclude })
    }, invoiceTransactionOptions)
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'CustomerInvoice', entityId: data.id, description: `Created draft invoice "${data.invoice_number}"` })
    res.status(201).json({ success: true, message: 'Draft invoice created successfully', data: enrichInvoicePaymentDisplay(data) })
  } catch (error) { fail(res, error, 'Failed to create customer invoice') }
}

export const update = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const existing = await prisma.customer_invoices.findUnique({ where: { id: invoiceId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Customer invoice not found' })
    if (existing.state !== 'draft') throw inputError('Only draft invoices can be edited')
    const prepared = await prepareInvoice(req.body)
    const data = await prisma.$transaction(async (tx) => {
      await tx.customer_invoice_lines.deleteMany({ where: { invoice_id: invoiceId } })
      const invoice = await tx.customer_invoices.update({
        where: { id: invoiceId },
        data: { ...prepared.header, invoice_number: existing.invoice_number, customer_invoice_lines: { create: prepared.lines }, updated_at: new Date() },
      })
      let entryId = existing.journal_entry_id
      if (entryId) {
        const entry = await tx.journal_entries.findUnique({ where: { id: entryId } })
        if (!entry || entry.state !== 'draft' || entry.source_type !== 'customer_invoice') throw inputError('Linked draft journal entry is invalid')
        await tx.journal_items.deleteMany({ where: { entry_id: entryId } })
        await tx.journal_entries.update({
          where: { id: entryId },
          data: {
            company_id: prepared.header.company_id,
            journal_id: prepared.header.journal_id,
            entry_date: prepared.header.invoice_date,
            fiscal_period_id: prepared.header.fiscal_period_id,
            reference: existing.invoice_number,
            narration: `Draft customer invoice ${existing.invoice_number}`,
            journal_items: { create: journalItems(prepared) },
          },
        })
      } else {
        const entry = await tx.journal_entries.create({
          data: {
            company_id: prepared.header.company_id,
            journal_id: prepared.header.journal_id,
            entry_number: existing.invoice_number,
            entry_date: prepared.header.invoice_date,
            fiscal_period_id: prepared.header.fiscal_period_id,
            reference: existing.invoice_number,
            narration: `Draft customer invoice ${existing.invoice_number}`,
            state: 'draft',
            source_type: 'customer_invoice',
            source_id: invoiceId,
            journal_items: { create: journalItems(prepared) },
          },
        })
        entryId = entry.id
      }
      return tx.customer_invoices.update({ where: { id: invoiceId }, data: { journal_entry_id: entryId }, include: invoiceInclude })
    }, invoiceTransactionOptions)
    await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'CustomerInvoice', entityId: data.id, description: `Updated draft invoice "${data.invoice_number}"` })
    res.json({ success: true, message: 'Draft invoice updated successfully', data: enrichInvoicePaymentDisplay(data) })
  } catch (error) { fail(res, error, 'Failed to update customer invoice') }
}

export const remove = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const existing = await prisma.customer_invoices.findUnique({ where: { id: invoiceId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Customer invoice not found' })
    if (existing.state !== 'draft') throw inputError('Only draft invoices can be deleted')
    await prisma.$transaction(async (tx) => {
      // Free the quotation link so it can be imported again if the draft is discarded.
      await tx.quotations.updateMany({
        where: { converted_invoice_id: invoiceId },
        data: { converted_invoice_id: null, updated_at: new Date() },
      })
      await tx.customer_invoices.delete({ where: { id: invoiceId } })
      if (existing.journal_entry_id) {
        await tx.journal_entries.deleteMany({ where: { id: existing.journal_entry_id, state: 'draft', source_type: 'customer_invoice' } })
      }
    }, invoiceTransactionOptions)
    await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'CustomerInvoice', entityId: invoiceId, description: `Deleted draft invoice "${existing.invoice_number}"` })
    res.json({ success: true, message: 'Draft invoice deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete customer invoice') }
}

export const post = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const { ensureClientOpeningSchema } = await import('../../../../lib/client-opening-balance.js')
    await ensureClientOpeningSchema(prisma)
    const data = await prisma.$transaction(async (tx) => {
      const invoice = await tx.customer_invoices.findUnique({
        where: { id: invoiceId },
        include: {
          journal_entries: { include: { journal_items: true } },
          fiscal_periods: { include: { fiscal_years: true } },
        },
      })
      if (!invoice) throw inputError('Customer invoice not found')
      if (invoice.state !== 'draft') throw inputError('Only draft invoices can be posted')
      if (!invoice.journal_entries || invoice.journal_entries.state !== 'draft' || invoice.journal_entries.source_type !== 'customer_invoice') {
        throw inputError('Linked draft journal entry is missing or invalid')
      }
      if (!invoice.fiscal_periods || invoice.fiscal_periods.state !== 'open' || invoice.fiscal_periods.fiscal_years.state !== 'open') {
        throw inputError('Invoice fiscal period is closed or invalid')
      }
      const debit = invoice.journal_entries.journal_items.reduce((sum, line) => sum + Number(line.debit), 0)
      const credit = invoice.journal_entries.journal_items.reduce((sum, line) => sum + Number(line.credit), 0)
      if (debit <= 0 || Math.abs(debit - credit) > 0.005) throw inputError('Invoice journal entry is unbalanced')
      const postedAt = new Date()
      const quotationRef = invoice.customer_reference ? ` (Quotation ${invoice.customer_reference})` : ''
      const narration = `Posted customer invoice ${invoice.invoice_number}${quotationRef}`
      const claimedEntry = await tx.journal_entries.updateMany({
        where: { id: invoice.journal_entries.id, state: 'draft', source_type: 'customer_invoice', source_id: invoiceId },
        data: { state: 'posted', posted_at: postedAt, narration },
      })
      if (claimedEntry.count !== 1) throw inputError('Invoice journal entry has already been posted')
      const claimedInvoice = await tx.customer_invoices.updateMany({
        where: { id: invoiceId, state: 'draft' },
        data: { state: 'posted', payment_state: 'not_paid', paid_amount: 0, amount_due: invoice.amount_total, posted_at: postedAt, updated_at: postedAt },
      })
      if (claimedInvoice.count !== 1) throw inputError('Only draft invoices can be posted')

      // Auto-apply real posted customer advances (unallocated receipts). Never invent advances from quotation text.
      const postedInvoice = { ...invoice, state: 'posted', payment_state: 'not_paid', paid_amount: 0, amount_due: invoice.amount_total }
      const appliedAdvance = await applyCustomerAdvances(tx, postedInvoice, postedAt)
      const { applyOpeningCreditToInvoice } = await import('../../../../lib/client-opening-balance.js')
      const appliedOpening = await applyOpeningCreditToInvoice(tx, {
        ...postedInvoice,
        amount_due: Math.max(0, Math.round((Number(invoice.amount_total) - Number(appliedAdvance || 0)) * 100) / 100),
      }, postedAt)
      const appliedCredit = Math.round((Number(appliedAdvance || 0) + Number(appliedOpening || 0)) * 100) / 100
      if (appliedCredit > 0.005) {
        const paidAmount = Math.round(appliedCredit * 100) / 100
        const amountDue = Math.max(0, Math.round((Number(invoice.amount_total) - paidAmount) * 100) / 100)
        await tx.customer_invoices.update({
          where: { id: invoiceId },
          data: {
            paid_amount: paidAmount,
            amount_due: amountDue,
            payment_state: amountDue <= 0.005 ? 'paid' : paidAmount > 0.005 ? 'partial' : 'not_paid',
            updated_at: postedAt,
          },
        })
      }

      return tx.customer_invoices.findUnique({ where: { id: invoiceId }, include: invoiceInclude })
    }, invoiceTransactionOptions)

    // Apply Receive Payment Now (notes.pending_payment) exactly once after the invoice JE is posted.
    let settled = data
    try {
      settled = await settlePendingReceivePaymentNow(data, req.user?.id)
    } catch (paymentError) {
      // Invoice is already posted — surface the payment failure so the user can register the receipt manually.
      console.error('Pending invoice payment failed after post', paymentError)
      await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'CustomerInvoice', entityId: invoiceId, description: `Posted invoice "${data.invoice_number}" (pending payment failed)` })
      return res.status(400).json({
        success: false,
        message: paymentError.message || 'Invoice posted, but the pending payment could not be applied',
        data: enrichInvoicePaymentDisplay(data),
      })
    }

    await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'CustomerInvoice', entityId: invoiceId, description: `Posted invoice "${settled.invoice_number}"` })
    res.json({ success: true, message: 'Customer invoice posted successfully', data: enrichInvoicePaymentDisplay(settled) })
  } catch (error) { fail(res, error, 'Failed to post customer invoice') }
}

async function ensureCustomerAdvanceAccount(tx, companyId) {
  let account = await tx.chart_of_accounts.findFirst({
    where: { company_id: companyId, code: '2140', is_active: true, allow_manual_entry: true },
  })
  if (account) return account
  return tx.chart_of_accounts.findFirst({
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
 * Apply posted unallocated customer receipts (real advances) to a newly posted invoice.
 * Creates receipt_allocations + Dr Customer Advance / Cr AR journal entries.
 * Does NOT create a new cash receipt.
 */
export async function applyCustomerAdvances(tx, invoice, postedAt) {
  const advances = await tx.customer_receipts.findMany({
    where: {
      customer_id: invoice.customer_id,
      company_id: invoice.company_id,
      currency_id: invoice.currency_id,
      state: 'posted',
      unallocated_amount: { gt: 0 },
    },
    orderBy: [{ receipt_date: 'asc' }, { id: 'asc' }],
  })
  if (!advances.length) return 0

  const quoteRef = String(invoice.customer_reference || '').trim().toLowerCase()
  const sorted = [...advances].sort((a, b) => {
    if (!quoteRef) return 0
    const aHay = `${a.reference || ''} ${a.memo || ''}`.toLowerCase()
    const bHay = `${b.reference || ''} ${b.memo || ''}`.toLowerCase()
    const aMatch = aHay.includes(quoteRef) ? 0 : 1
    const bMatch = bHay.includes(quoteRef) ? 0 : 1
    return aMatch - bMatch
  })

  const advanceAccount = await ensureCustomerAdvanceAccount(tx, invoice.company_id)
  if (!advanceAccount) throw inputError('Customer Advances account (2140) was not found')

  let remainingDue = Math.round(Number(invoice.amount_total) * 100) / 100
  let totalApplied = 0

  for (const receipt of sorted) {
    if (remainingDue <= 0.005) break
    const available = Math.round(Number(receipt.unallocated_amount) * 100) / 100
    if (available <= 0.005) continue
    const applied = Math.min(available, remainingDue)

    // Prevent applying the same receipt+invoice twice
    const existingAllocation = await tx.receipt_allocations.findFirst({
      where: { receipt_id: receipt.id, invoice_id: invoice.id },
    })
    if (existingAllocation) continue

    const reserved = await tx.customer_receipts.updateMany({
      where: { id: receipt.id, state: 'posted', unallocated_amount: { gte: applied } },
      data: { unallocated_amount: { decrement: applied }, updated_at: postedAt },
    })
    if (reserved.count !== 1) continue

    const allocation = await tx.receipt_allocations.create({
      data: { receipt_id: receipt.id, invoice_id: invoice.id, allocated_amount: applied },
    })
    const { syncCreditNoteFromAdvanceReceipt } = await import('../creditNotes/creditNote.controller.js')
    await syncCreditNoteFromAdvanceReceipt(tx, receipt.id, applied, postedAt)

    const baseAmount = Math.round(applied * Number(invoice.exchange_rate) * 100) / 100
    // Use a reserved source_id range so we never collide with the original receipt JE (source_id = receipt.id).
    const applicationSourceId = 2000000000 + allocation.id
    await tx.journal_entries.create({
      data: {
        company_id: invoice.company_id,
        journal_id: invoice.journal_id,
        entry_number: `CADV${String(allocation.id).padStart(6, '0')}`,
        entry_date: invoice.invoice_date,
        fiscal_period_id: invoice.fiscal_period_id,
        reference: invoice.invoice_number,
        narration: `Advance ${receipt.receipt_number} applied to ${invoice.invoice_number}`,
        state: 'posted',
        source_type: 'customer_receipt',
        source_id: applicationSourceId,
        posted_at: postedAt,
        journal_items: {
          create: [
            {
              sequence: 10,
              account_id: advanceAccount.id,
              label: 'Customer Advance applied',
              partner_type: 'customer',
              partner_id: invoice.customer_id,
              debit: baseAmount,
              credit: 0,
              currency_id: invoice.currency_id,
              amount_currency: applied,
            },
            {
              sequence: 20,
              account_id: invoice.receivable_account_id,
              label: 'Accounts Receivable',
              partner_type: 'customer',
              partner_id: invoice.customer_id,
              debit: 0,
              credit: baseAmount,
              currency_id: invoice.currency_id,
              amount_currency: -applied,
            },
          ],
        },
      },
    })

    totalApplied = Math.round((totalApplied + applied) * 100) / 100
    remainingDue = Math.round((remainingDue - applied) * 100) / 100
  }

  if (totalApplied > Number(invoice.amount_total) + 0.005) {
    throw inputError('Applied advance cannot exceed invoice total')
  }
  return totalApplied
}
