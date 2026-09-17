/**
 * Non-destructive Chart of Accounts hierarchy restructure.
 *
 * - Preserves account IDs (and therefore journal_items / FK links)
 * - Never deletes accounts that have journal history
 * - Never truncates or resets the database
 * - Uses temporary codes to avoid unique (company_id, code) collisions during remaps
 *
 * Usage: node scripts/restructure-chart-of-accounts.mjs
 */
import prisma from '../src/config/db.js'

const PARENT = false
const POSTING = true

/** Desired hierarchy. parentCode null = root. */
const TARGET = [
  // Assets
  { code: '1000', name: 'Assets', type: 'Assets', parentCode: null, posting: PARENT, reconcilable: false },
  { code: '1100', name: 'Current Assets', type: 'Assets', parentCode: '1000', posting: PARENT, reconcilable: false },
  { code: '1110', name: 'Cash and Cash Equivalents', type: 'Assets', parentCode: '1100', posting: POSTING, reconcilable: true },
  { code: '1120', name: 'Bank Accounts', type: 'Assets', parentCode: '1100', posting: PARENT, reconcilable: false },
  { code: '1121', name: 'SomBank', type: 'Assets', parentCode: '1120', posting: POSTING, reconcilable: true },
  { code: '1122', name: 'Premier Bank', type: 'Assets', parentCode: '1120', posting: POSTING, reconcilable: true },
  { code: '1123', name: 'Salaam Bank', type: 'Assets', parentCode: '1120', posting: POSTING, reconcilable: true },
  { code: '1124', name: 'IBS Bank', type: 'Assets', parentCode: '1120', posting: POSTING, reconcilable: true },
  { code: '1130', name: 'Mobile Money', type: 'Assets', parentCode: '1100', posting: PARENT, reconcilable: false },
  { code: '1131', name: 'EVC-Plus', type: 'Assets', parentCode: '1130', posting: POSTING, reconcilable: true },
  { code: '1132', name: 'E-Dahab', type: 'Assets', parentCode: '1130', posting: POSTING, reconcilable: true },
  { code: '1200', name: 'Accounts Receivable', type: 'Assets', parentCode: '1100', posting: POSTING, reconcilable: true },
  { code: '1300', name: 'Inventory', type: 'Assets', parentCode: '1100', posting: POSTING, reconcilable: false },
  { code: '1400', name: 'Vendor Advances', type: 'Assets', parentCode: '1100', posting: POSTING, reconcilable: true },

  // Liabilities
  { code: '2000', name: 'Liabilities', type: 'Liabilities', parentCode: null, posting: PARENT, reconcilable: false },
  { code: '2100', name: 'Current Liabilities', type: 'Liabilities', parentCode: '2000', posting: PARENT, reconcilable: false },
  { code: '2110', name: 'Accounts Payable', type: 'Liabilities', parentCode: '2100', posting: POSTING, reconcilable: true },
  { code: '2120', name: 'Taxes Payable', type: 'Liabilities', parentCode: '2100', posting: POSTING, reconcilable: false },
  { code: '2130', name: 'Accrued Expenses', type: 'Liabilities', parentCode: '2100', posting: POSTING, reconcilable: false },

  // Equity
  { code: '3000', name: 'Equity', type: 'Equity', parentCode: null, posting: PARENT, reconcilable: false },
  { code: '3100', name: "Owner's Equity", type: 'Equity', parentCode: '3000', posting: POSTING, reconcilable: false },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', parentCode: '3000', posting: POSTING, reconcilable: false },

  // Revenue (account type name remains Income in this schema)
  { code: '4000', name: 'Revenue', type: 'Income', parentCode: null, posting: PARENT, reconcilable: false },
  { code: '4100', name: 'Sales Revenue', type: 'Income', parentCode: '4000', posting: POSTING, reconcilable: false },
  { code: '4200', name: 'Service Revenue', type: 'Income', parentCode: '4000', posting: POSTING, reconcilable: false },
  { code: '4300', name: 'Other Revenue', type: 'Income', parentCode: '4000', posting: POSTING, reconcilable: false },

  // Expenses
  { code: '5000', name: 'Expenses', type: 'Expenses', parentCode: null, posting: PARENT, reconcilable: false },
  { code: '5050', name: 'Cost of Sales', type: 'Expenses', parentCode: '5000', posting: POSTING, reconcilable: false },
  { code: '5100', name: 'Operating Expenses', type: 'Expenses', parentCode: '5000', posting: PARENT, reconcilable: false },
  { code: '5110', name: 'Internet Expense', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5120', name: 'Electricity Expense', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5130', name: 'Rent Expense', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5140', name: 'Office Supplies', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5150', name: 'Salaries and Wages', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5160', name: 'Transportation Expense', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5170', name: 'Advertising Expense', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5180', name: 'Other Operating Expenses', type: 'Expenses', parentCode: '5100', posting: POSTING, reconcilable: false },
  { code: '5200', name: 'Bank Charges', type: 'Expenses', parentCode: '5000', posting: POSTING, reconcilable: false },
]

/**
 * Map existing accounts onto target codes by stable identity.
 * Never bind a NEW parent header to an existing posting leaf just because codes collide.
 */
function resolveExistingId(existingByCode, existingById, def) {
  const nameEq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  const byExactName = [...existingById.values()].find((a) => nameEq(a.name, def.name))
  if (byExactName) return byExactName.id

  // Semantic remaps from the previous flat CoA (posting leaves only)
  const semantic = {
    '1110': () => {
      const cash = existingByCode.get('1000')
      return cash && /cash/i.test(cash.name) ? cash : null
    },
    '1121': () => [...existingById.values()].find((a) => /sombank/i.test(a.name)),
    '1122': () => [...existingById.values()].find((a) => /premier/i.test(a.name)),
    '1123': () => [...existingById.values()].find((a) => /salaam/i.test(a.name)),
    '1124': () => [...existingById.values()].find((a) => /\bibs\b/i.test(a.name) && /bank/i.test(a.name)),
    '1131': () => [...existingById.values()].find((a) => /evc/i.test(a.name)),
    '1132': () => [...existingById.values()].find((a) => /dahab/i.test(a.name)),
    '1200': () => existingByCode.get('1200'),
    '1300': () => existingByCode.get('1300'),
    '1400': () => existingByCode.get('1400'),
    '2110': () => {
      const ap = existingByCode.get('2000')
      return ap && /payable/i.test(ap.name) ? ap : null
    },
    '2120': () => {
      const tax = existingByCode.get('2100')
      return tax && /tax/i.test(tax.name) ? tax : null
    },
    '3100': () => {
      const eq = existingByCode.get('3000')
      return eq && (/owner/i.test(eq.name) || /equity/i.test(eq.name)) ? eq : null
    },
    '3200': () => {
      const re = existingByCode.get('3100')
      return re && /retained/i.test(re.name) ? re : null
    },
    '4100': () => {
      const sales = existingByCode.get('4000')
      return sales && /sales/i.test(sales.name) ? sales : null
    },
    '4200': () => {
      const svc = existingByCode.get('4100')
      return svc && /service/i.test(svc.name) ? svc : null
    },
    '5050': () => {
      const cos = existingByCode.get('5000')
      return cos && /cost/i.test(cos.name) ? cos : null
    },
    '5100': () => {
      const op = existingByCode.get('5100')
      return op && /operating/i.test(op.name) ? op : null
    },
    '5110': () => [...existingById.values()].find((a) => /internet/i.test(a.name)),
    '5120': () => [...existingById.values()].find((a) => /electric/i.test(a.name)),
    '5130': () => [...existingById.values()].find((a) => /rent/i.test(a.name)),
    '5140': () => [...existingById.values()].find((a) => /supplies/i.test(a.name)),
    '5150': () => [...existingById.values()].find((a) => /salar/i.test(a.name)),
    '5200': () => existingByCode.get('5200'),
  }

  const matcher = semantic[def.code]
  if (matcher) {
    const hit = matcher()
    if (hit) return hit.id
  }

  // Never reuse a same-code row when the name clearly belongs to a different role
  // (e.g. SomBank @1110 must not become "Cash and Cash Equivalents").
  if (def.posting) {
    const byCode = existingByCode.get(def.code)
    if (byCode) {
      const codeName = String(byCode.name || '').toLowerCase()
      const targetName = String(def.name || '').toLowerCase()
      const sharesToken = targetName.split(/\s+/).filter((t) => t.length > 3).some((t) => codeName.includes(t))
      if (sharesToken || codeName === targetName) return byCode.id
    }
  }

  return null
}

async function restructureCompany(company, typeByName) {
  const existing = await prisma.chart_of_accounts.findMany({ where: { company_id: company.id } })
  const existingByCode = new Map(existing.map((a) => [a.code, a]))
  const existingById = new Map(existing.map((a) => [a.id, a]))

  /** @type {Map<string, number>} targetCode -> accountId */
  const codeToId = new Map()
  /** accounts we intentionally remapped (id -> target code) */
  const claimedIds = new Set()

  // Phase 0: decide which existing account owns each target code
  for (const def of TARGET) {
    let id = resolveExistingId(existingByCode, existingById, def)
    if (id && claimedIds.has(id)) id = null
    if (id) {
      claimedIds.add(id)
      codeToId.set(def.code, id)
    }
  }

  // Special case: legacy flat "Bank" (old 1100) if not claimed — park under Bank Accounts as clearing
  const legacyBank = existingByCode.get('1100')
  const legacyBankIsFlatBank = legacyBank && /^(bank|bank account)$/i.test(legacyBank.name.trim())
  let legacyBankId = null
  if (legacyBankIsFlatBank && !claimedIds.has(legacyBank.id)) {
    legacyBankId = legacyBank.id
    claimedIds.add(legacyBank.id)
  }

  console.log(`\nCompany ${company.id} — ${company.name}`)
  console.log('Planned remaps:')
  for (const def of TARGET) {
    const id = codeToId.get(def.code)
    const prev = id ? existingById.get(id) : null
    console.log(
      `  ${def.code} ${def.name}  ←  ${prev ? `id=${prev.id} was ${prev.code} "${prev.name}"` : 'CREATE NEW'}`,
    )
  }
  if (legacyBankId) {
    console.log(`  1129 Bank Clearing (Legacy)  ←  id=${legacyBankId} was ${legacyBank.code} "${legacyBank.name}"`)
  }

  await prisma.$transaction(async (tx) => {
    // Phase 1: move ALL remapped / conflicting accounts to temporary codes
    const idsToTemp = new Set([...claimedIds])
    if (legacyBankId) idsToTemp.add(legacyBankId)

    // Also temp any account currently occupying a target code that will be overwritten by a different id or new create
    for (const def of TARGET) {
      const occupant = existingByCode.get(def.code)
      if (!occupant) continue
      const plannedId = codeToId.get(def.code)
      if (plannedId !== occupant.id) idsToTemp.add(occupant.id)
    }

    for (const id of idsToTemp) {
      await tx.chart_of_accounts.update({
        where: { id },
        data: { code: `T${id}`, parent_id: null },
      })
    }

    // Phase 2: upsert each target account (update existing id or create)
    for (const def of TARGET) {
      const type = typeByName.get(def.type)
      if (!type) throw new Error(`Missing account type: ${def.type}`)

      const existingId = codeToId.get(def.code)
      if (existingId) {
        await tx.chart_of_accounts.update({
          where: { id: existingId },
          data: {
            code: def.code,
            name: def.name,
            account_type_id: type.id,
            parent_id: null, // set in phase 3
            currency_id: company.currency_id,
            is_reconcilable: def.reconcilable,
            allow_manual_entry: def.posting,
            is_active: true,
            notes: def.posting
              ? null
              : 'Parent / grouping account — do not post journal entries here.',
          },
        })
      } else {
        const created = await tx.chart_of_accounts.create({
          data: {
            company_id: company.id,
            code: def.code,
            name: def.name,
            account_type_id: type.id,
            parent_id: null,
            currency_id: company.currency_id,
            is_reconcilable: def.reconcilable,
            allow_manual_entry: def.posting,
            is_active: true,
            notes: def.posting
              ? null
              : 'Parent / grouping account — do not post journal entries here.',
          },
        })
        codeToId.set(def.code, created.id)
      }
    }

    if (legacyBankId) {
      const assetType = typeByName.get('Assets')
      await tx.chart_of_accounts.update({
        where: { id: legacyBankId },
        data: {
          code: '1129',
          name: 'Bank Clearing (Legacy)',
          account_type_id: assetType.id,
          parent_id: null,
          is_reconcilable: true,
          allow_manual_entry: true,
          is_active: true,
          notes: 'Legacy generic bank GL kept for existing payment-method links. Prefer specific bank accounts (1121–1124).',
        },
      })
    }

    // Phase 3: wire parent relationships
    for (const def of TARGET) {
      const id = codeToId.get(def.code)
      const parentId = def.parentCode ? codeToId.get(def.parentCode) : null
      if (def.parentCode && !parentId) throw new Error(`Missing parent ${def.parentCode} for ${def.code}`)
      await tx.chart_of_accounts.update({
        where: { id },
        data: { parent_id: parentId },
      })
    }
    if (legacyBankId) {
      await tx.chart_of_accounts.update({
        where: { id: legacyBankId },
        data: { parent_id: codeToId.get('1120') },
      })
    }

    // Phase 4: force parent posting flags off for any account that now has children
    const withChildren = await tx.chart_of_accounts.findMany({
      where: { company_id: company.id, other_chart_of_accounts: { some: {} } },
      select: { id: true },
    })
    if (withChildren.length) {
      await tx.chart_of_accounts.updateMany({
        where: { id: { in: withChildren.map((r) => r.id) } },
        data: { allow_manual_entry: false },
      })
    }
  }, { maxWait: 20000, timeout: 120000 })

  return { codeToId, legacyBankId }
}

async function verify(companyId) {
  const accounts = await prisma.chart_of_accounts.findMany({
    where: { company_id: companyId },
    include: {
      account_types: { select: { name: true, internal_group: true } },
      other_chart_of_accounts: { select: { id: true } },
      _count: { select: { journal_items: true } },
    },
    orderBy: { code: 'asc' },
  })
  const byCode = new Map(accounts.map((a) => [a.code, a]))
  const issues = []

  // Duplicate codes
  const codes = accounts.map((a) => a.code)
  if (new Set(codes).size !== codes.length) issues.push('Duplicate account codes detected')

  // Circular / parent company checks already enforced by FK; verify parent links for targets
  for (const def of TARGET) {
    const row = byCode.get(def.code)
    if (!row) {
      issues.push(`Missing target account ${def.code}`)
      continue
    }
    if (row.account_types.name !== def.type) issues.push(`${def.code} has type ${row.account_types.name}, expected ${def.type}`)
    const parent = def.parentCode ? byCode.get(def.parentCode) : null
    if (def.parentCode && row.parent_id !== parent?.id) issues.push(`${def.code} parent mismatch`)
    const hasChildren = row.other_chart_of_accounts.length > 0
    if (!def.posting && row.allow_manual_entry) issues.push(`${def.code} parent still allows posting`)
    if (def.posting && hasChildren) issues.push(`${def.code} posting account has children`)
    if (!def.posting && !hasChildren && !['2130', '4300', '5160', '5170', '5180'].includes(def.code)) {
      // parents should eventually have children; leaf parents without children are ok briefly
    }
  }

  // Journal integrity: every journal item still points at an existing account id
  const dangling = await prisma.$queryRaw`
    SELECT COUNT(*) AS cnt
    FROM journal_items ji
    LEFT JOIN chart_of_accounts coa ON coa.id = ji.account_id
    WHERE coa.id IS NULL
  `
  const orphanItems = Number(dangling?.[0]?.cnt || 0)

  console.log('\nVerification:')
  for (const a of accounts) {
    const depthHint = a.parent_id ? '  ' : ''
    console.log(
      `${depthHint}${a.code} ${a.name} | ${a.account_types.name} | parent=${a.parent_id || '-'} | posting=${a.allow_manual_entry} | children=${a.other_chart_of_accounts.length} | journals=${a._count.journal_items}`,
    )
  }
  if (issues.length) {
    console.log('\nISSUES:')
    issues.forEach((i) => console.log(' -', i))
  } else {
    console.log('\nAll hierarchy checks passed.')
  }
  if (orphanItems) console.log('Warning: orphan journal items count =', orphanItems)
  return issues
}

async function main() {
  const types = await prisma.account_types.findMany()
  const typeByName = new Map(types.map((t) => [t.name, t]))
  for (const required of ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses']) {
    if (!typeByName.has(required)) throw new Error(`Required account type missing: ${required}`)
  }

  const companies = await prisma.companies.findMany({ where: { is_active: true } })
  if (!companies.length) throw new Error('No active companies found')

  for (const company of companies) {
    // Idempotent: if core parents already exist with children, still reconcile targets
    await restructureCompany(company, typeByName)
    const issues = await verify(company.id)
    if (issues.length) throw new Error(`Verification failed for company ${company.id}`)
  }

  console.log('\nDone. Account IDs preserved; journal history intact.')
}

main()
  .catch((error) => {
    console.error('\nRestructure failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
