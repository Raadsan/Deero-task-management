import prisma from '../../../config/db.js'

const ACCOUNT_TYPES = [
  { name: 'Assets', internal_group: 'asset', normal_balance: 'debit', report_type: 'balance_sheet', sequence: 10 },
  { name: 'Liabilities', internal_group: 'liability', normal_balance: 'credit', report_type: 'balance_sheet', sequence: 20 },
  { name: 'Equity', internal_group: 'equity', normal_balance: 'credit', report_type: 'balance_sheet', sequence: 30 },
  { name: 'Income', internal_group: 'income', normal_balance: 'credit', report_type: 'profit_loss', sequence: 40 },
  { name: 'Expenses', internal_group: 'expense', normal_balance: 'debit', report_type: 'profit_loss', sequence: 50 },
]

const ACCOUNTS = [
  { code: '1000', name: 'Cash and Cash Equivalents', type: 'Assets', reconcilable: true },
  { code: '1100', name: 'Bank', type: 'Assets', reconcilable: true },
  { code: '1200', name: 'Accounts Receivable', type: 'Assets', reconcilable: true },
  { code: '1300', name: 'Inventory', type: 'Assets' },
  { code: '1400', name: 'Vendor Advances', type: 'Assets', reconcilable: true },
  { code: '2000', name: 'Accounts Payable', type: 'Liabilities', reconcilable: true },
  { code: '2100', name: 'Taxes Payable', type: 'Liabilities' },
  { code: '3000', name: 'Owner Equity', type: 'Equity' },
  { code: '3100', name: 'Retained Earnings', type: 'Equity' },
  { code: '4000', name: 'Sales Revenue', type: 'Income' },
  { code: '4100', name: 'Service Revenue', type: 'Income' },
  { code: '5000', name: 'Cost of Sales', type: 'Expenses' },
  { code: '5100', name: 'Operating Expenses', type: 'Expenses' },
  { code: '5200', name: 'Bank Charges', type: 'Expenses' },
]

const JOURNALS = [
  { name: 'Sales Journal', code: 'SAL', journal_type: 'sale', sequence_prefix: 'INV-', allow_manual_entries: false },
  { name: 'Purchase Journal', code: 'PUR', journal_type: 'purchase', sequence_prefix: 'BILL-', allow_manual_entries: false },
  { name: 'Cash Journal', code: 'CSH', journal_type: 'cash', sequence_prefix: 'CSH-', allow_manual_entries: true },
  { name: 'Bank Journal', code: 'BNK', journal_type: 'bank', sequence_prefix: 'BNK-', allow_manual_entries: true },
  { name: 'General Journal', code: 'GEN', journal_type: 'general', sequence_prefix: 'JE-', allow_manual_entries: true },
]

let initialization

const dateUtc = (year, month, day) => new Date(Date.UTC(year, month, day))

async function findOrCreate(model, where, data) {
  const existing = await model.findFirst({ where })
  return existing || model.create({ data })
}

async function initialize() {
  const currency = await prisma.currencies.upsert({
    where: { code: 'USD' },
    update: { is_active: true },
    create: { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_active: true },
  })

  const company = await findOrCreate(prisma.companies, { name: 'Deero Advertising Agency' }, {
    name: 'Deero Advertising Agency', legal_name: 'Deero Advertising Agency', currency_id: currency.id,
    country: 'Somalia', is_active: true,
  })

  const typeByName = new Map()
  for (const definition of ACCOUNT_TYPES) {
    const accountType = await prisma.account_types.upsert({
      where: { name: definition.name }, update: definition, create: definition,
    })
    typeByName.set(definition.name, accountType)
  }

  const accountByCode = new Map()
  for (const definition of ACCOUNTS) {
    const account = await findOrCreate(prisma.chart_of_accounts, {
      company_id: company.id, code: definition.code,
    }, {
      company_id: company.id, code: definition.code, name: definition.name,
      account_type_id: typeByName.get(definition.type).id, currency_id: currency.id,
      is_reconcilable: Boolean(definition.reconcilable), allow_manual_entry: true, is_active: true,
    })
    accountByCode.set(definition.code, account)
  }

  const year = new Date().getUTCFullYear()
  const fiscalYear = await findOrCreate(prisma.fiscal_years, {
    company_id: company.id, name: `FY ${year}`,
  }, {
    company_id: company.id, name: `FY ${year}`, start_date: dateUtc(year, 0, 1),
    end_date: dateUtc(year, 11, 31), state: 'open',
  })

  for (let month = 0; month < 12; month += 1) {
    const start = dateUtc(year, month, 1)
    const end = dateUtc(year, month + 1, 0)
    await findOrCreate(prisma.fiscal_periods, {
      fiscal_year_id: fiscalYear.id, period_number: month + 1,
    }, {
      fiscal_year_id: fiscalYear.id, name: start.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      period_number: month + 1, start_date: start, end_date: end, state: 'open', is_closing_period: false,
    })
  }

  for (const definition of JOURNALS) {
    await findOrCreate(prisma.journals, { company_id: company.id, code: definition.code }, {
      ...definition, company_id: company.id, currency_id: currency.id, next_sequence: 1, is_active: true,
    })
  }

  await prisma.payment_terms.upsert({
    where: { name: 'Due on Receipt' }, update: { is_active: true },
    create: { name: 'Due on Receipt', description: 'Payment is due immediately', is_active: true },
  })
  await prisma.payment_terms.upsert({
    where: { name: 'Net 30' }, update: { is_active: true },
    create: { name: 'Net 30', description: 'Payment is due within 30 days', is_active: true },
  })

  const methods = [
    { name: 'Cash', code: 'CASH', payment_type: 'both', gl_account_id: accountByCode.get('1000').id },
    { name: 'Bank Transfer', code: 'BANK', payment_type: 'both', gl_account_id: accountByCode.get('1100').id, requires_reference: true },
  ]
  for (const method of methods) {
    await prisma.payment_methods.upsert({
      where: { code: method.code }, update: { ...method, is_active: true },
      create: { ...method, allow_multiple_accounts: false, is_active: true },
    })
  }

  return { company, currency, fiscalYear }
}

export function ensureAccountingDefaults() {
  if (!initialization) initialization = initialize().catch((error) => { initialization = undefined; throw error })
  return initialization
}