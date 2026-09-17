import prisma from '../../../config/db.js'

const ACCOUNT_TYPES = [
  { name: 'Assets', internal_group: 'asset', normal_balance: 'debit', report_type: 'balance_sheet', sequence: 10 },
  { name: 'Liabilities', internal_group: 'liability', normal_balance: 'credit', report_type: 'balance_sheet', sequence: 20 },
  { name: 'Equity', internal_group: 'equity', normal_balance: 'credit', report_type: 'balance_sheet', sequence: 30 },
  { name: 'Income', internal_group: 'income', normal_balance: 'credit', report_type: 'profit_loss', sequence: 40 },
  { name: 'Expenses', internal_group: 'expense', normal_balance: 'debit', report_type: 'profit_loss', sequence: 50 },
]

/** Hierarchical default CoA. parentCode null = root. posting=false ⇒ parent/header. */
const ACCOUNTS = [
  { code: '1000', name: 'Assets', type: 'Assets', parentCode: null, posting: false },
  { code: '1100', name: 'Current Assets', type: 'Assets', parentCode: '1000', posting: false },
  { code: '1110', name: 'Cash and Cash Equivalents', type: 'Assets', parentCode: '1100', posting: true, reconcilable: true },
  { code: '1120', name: 'Bank Accounts', type: 'Assets', parentCode: '1100', posting: false },
  { code: '1121', name: 'SomBank', type: 'Assets', parentCode: '1120', posting: true, reconcilable: true },
  { code: '1122', name: 'Premier Bank', type: 'Assets', parentCode: '1120', posting: true, reconcilable: true },
  { code: '1123', name: 'Salaam Bank', type: 'Assets', parentCode: '1120', posting: true, reconcilable: true },
  { code: '1124', name: 'IBS Bank', type: 'Assets', parentCode: '1120', posting: true, reconcilable: true },
  { code: '1130', name: 'Mobile Money', type: 'Assets', parentCode: '1100', posting: false },
  { code: '1131', name: 'EVC-Plus', type: 'Assets', parentCode: '1130', posting: true, reconcilable: true },
  { code: '1132', name: 'E-Dahab', type: 'Assets', parentCode: '1130', posting: true, reconcilable: true },
  { code: '1200', name: 'Accounts Receivable', type: 'Assets', parentCode: '1100', posting: true, reconcilable: true },
  { code: '1300', name: 'Inventory', type: 'Assets', parentCode: '1100', posting: true },
  { code: '1400', name: 'Vendor Advances', type: 'Assets', parentCode: '1100', posting: true, reconcilable: true },

  { code: '2000', name: 'Liabilities', type: 'Liabilities', parentCode: null, posting: false },
  { code: '2100', name: 'Current Liabilities', type: 'Liabilities', parentCode: '2000', posting: false },
  { code: '2110', name: 'Accounts Payable', type: 'Liabilities', parentCode: '2100', posting: true, reconcilable: true },
  { code: '2120', name: 'Taxes Payable', type: 'Liabilities', parentCode: '2100', posting: true },
  { code: '2130', name: 'Accrued Expenses', type: 'Liabilities', parentCode: '2100', posting: true },
  { code: '2140', name: 'Customer Advances', type: 'Liabilities', parentCode: '2100', posting: true, reconcilable: true },

  { code: '3000', name: 'Equity', type: 'Equity', parentCode: null, posting: false },
  { code: '3100', name: "Owner's Equity", type: 'Equity', parentCode: '3000', posting: true },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', parentCode: '3000', posting: true },

  { code: '4000', name: 'Revenue', type: 'Income', parentCode: null, posting: false },
  { code: '4100', name: 'Sales Revenue', type: 'Income', parentCode: '4000', posting: true },
  { code: '4200', name: 'Service Revenue', type: 'Income', parentCode: '4000', posting: true },
  { code: '4300', name: 'Other Revenue', type: 'Income', parentCode: '4000', posting: true },

  { code: '5000', name: 'Expenses', type: 'Expenses', parentCode: null, posting: false },
  { code: '5050', name: 'Cost of Sales', type: 'Expenses', parentCode: '5000', posting: true },
  { code: '5100', name: 'Operating Expenses', type: 'Expenses', parentCode: '5000', posting: false },
  { code: '5110', name: 'Internet Expense', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5120', name: 'Electricity Expense', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5130', name: 'Rent Expense', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5140', name: 'Office Supplies', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5150', name: 'Salaries and Wages', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5160', name: 'Transportation Expense', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5170', name: 'Advertising Expense', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5180', name: 'Other Operating Expenses', type: 'Expenses', parentCode: '5100', posting: true },
  { code: '5200', name: 'Bank Charges', type: 'Expenses', parentCode: '5000', posting: true },
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
    const parentId = definition.parentCode ? accountByCode.get(definition.parentCode)?.id : null
    const existing = await prisma.chart_of_accounts.findFirst({
      where: { company_id: company.id, code: definition.code },
    })
    let account
    if (existing) {
      // Never rename/repurpose an existing coded account (may hold journal history).
      // Only fill missing parent links and enforce parent non-posting flags.
      const patch = {}
      if (existing.parent_id == null && parentId) patch.parent_id = parentId
      if (definition.posting === false && existing.allow_manual_entry) patch.allow_manual_entry = false
      account = Object.keys(patch).length
        ? await prisma.chart_of_accounts.update({ where: { id: existing.id }, data: patch })
        : existing
    } else {
      account = await prisma.chart_of_accounts.create({
        data: {
          company_id: company.id,
          code: definition.code,
          name: definition.name,
          account_type_id: typeByName.get(definition.type).id,
          parent_id: parentId || null,
          currency_id: currency.id,
          is_reconcilable: Boolean(definition.reconcilable),
          allow_manual_entry: definition.posting !== false,
          is_active: true,
          notes: definition.posting === false
            ? 'Parent / grouping account — do not post journal entries here.'
            : null,
        },
      })
    }
    accountByCode.set(definition.code, account)
  }

  // Ensure parents with children cannot post
  const parents = await prisma.chart_of_accounts.findMany({
    where: { company_id: company.id, other_chart_of_accounts: { some: {} } },
    select: { id: true },
  })
  if (parents.length) {
    await prisma.chart_of_accounts.updateMany({
      where: { id: { in: parents.map((p) => p.id) } },
      data: { allow_manual_entry: false },
    })
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

  // Seed default payment methods for new installs only (never overwrite existing mappings).
  const methods = [
    { name: 'Cash', code: 'CASH', payment_type: 'both', glCode: '1110', requires_reference: false },
    { name: 'SomBank', code: 'SOMBANK', payment_type: 'both', glCode: '1121', requires_reference: true },
    { name: 'Premier Bank', code: 'PREMIER', payment_type: 'both', glCode: '1122', requires_reference: true },
    { name: 'Salaam Bank', code: 'SALAAM', payment_type: 'both', glCode: '1123', requires_reference: true },
    { name: 'IBS Bank', code: 'IBS', payment_type: 'both', glCode: '1124', requires_reference: true },
    { name: 'EVC-Plus', code: 'EVC', payment_type: 'both', glCode: '1131', requires_reference: true },
    { name: 'E-Dahab', code: 'EDAHAB', payment_type: 'both', glCode: '1132', requires_reference: true },
  ]
  for (const method of methods) {
    const gl = accountByCode.get(method.glCode)
    const existingMethod = await prisma.payment_methods.findUnique({ where: { code: method.code } })
    if (existingMethod) {
      if (!existingMethod.gl_account_id && gl) {
        await prisma.payment_methods.update({
          where: { id: existingMethod.id },
          data: { gl_account_id: gl.id, is_active: true },
        })
      }
      continue
    }
    if (!gl) continue
    await prisma.payment_methods.create({
      data: {
        name: method.name,
        code: method.code,
        payment_type: method.payment_type,
        gl_account_id: gl.id,
        requires_reference: Boolean(method.requires_reference),
        allow_multiple_accounts: false,
        is_active: true,
      },
    })
  }

  return { company, currency, fiscalYear }
}

export function ensureAccountingDefaults() {
  if (!initialization) initialization = initialize().catch((error) => { initialization = undefined; throw error })
  return initialization
}
