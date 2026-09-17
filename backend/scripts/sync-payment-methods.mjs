/**
 * Non-destructive Payment Methods sync.
 * Preserves IDs; remaps GL accounts to existing CoA posting accounts; deactivates extras.
 *
 * Usage: node scripts/sync-payment-methods.mjs
 */
import prisma from '../src/config/db.js'

const TARGETS = [
  { code: 'CASH', name: 'Cash', glCode: '1110', requires_reference: false },
  { code: 'SOMBANK', name: 'SomBank', glCode: '1121', requires_reference: true },
  { code: 'PREMIER', name: 'Premier Bank', glCode: '1122', requires_reference: true },
  { code: 'SALAAM', name: 'Salaam Bank', glCode: '1123', requires_reference: true },
  { code: 'IBS', name: 'IBS Bank', glCode: '1124', requires_reference: true },
  { code: 'EVC', name: 'EVC-Plus', glCode: '1131', requires_reference: true },
  { code: 'EDAHAB', name: 'E-Dahab', glCode: '1132', requires_reference: true },
]

async function main() {
  const company = await prisma.companies.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } })
  if (!company) throw new Error('No active company found')

  const glByCode = new Map(
    (await prisma.chart_of_accounts.findMany({
      where: {
        company_id: company.id,
        code: { in: TARGETS.map((t) => t.glCode) },
        is_active: true,
        allow_manual_entry: true,
        other_chart_of_accounts: { none: {} },
      },
      select: { id: true, code: true, name: true },
    })).map((a) => [a.code, a]),
  )

  for (const target of TARGETS) {
    if (!glByCode.has(target.glCode)) {
      throw new Error(`Missing posting GL account ${target.glCode} for ${target.code}`)
    }
  }

  for (const target of TARGETS) {
    const gl = glByCode.get(target.glCode)
    const existing = await prisma.payment_methods.findUnique({ where: { code: target.code } })
    const payload = {
      name: target.name,
      code: target.code,
      payment_type: 'both',
      gl_account_id: gl.id,
      allow_multiple_accounts: false,
      requires_reference: target.requires_reference,
      is_active: true,
    }
    if (existing) {
      await prisma.payment_methods.update({ where: { id: existing.id }, data: payload })
      console.log(`Updated ${target.code} id=${existing.id} → ${gl.code} ${gl.name}`)
    } else {
      const created = await prisma.payment_methods.create({ data: payload })
      console.log(`Created ${target.code} id=${created.id} → ${gl.code} ${gl.name}`)
    }
  }

  // Deactivate payment methods not in the required set (preserve IDs / history)
  const keep = new Set(TARGETS.map((t) => t.code))
  const extras = await prisma.payment_methods.findMany({
    where: { code: { notIn: [...keep] }, is_active: true },
  })
  for (const extra of extras) {
    await prisma.payment_methods.update({
      where: { id: extra.id },
      data: { is_active: false },
    })
    console.log(`Deactivated extra method ${extra.code} id=${extra.id}`)
  }

  console.log('\nFinal payment methods:')
  const rows = await prisma.payment_methods.findMany({
    include: { chart_of_accounts: { select: { code: true, name: true } } },
    orderBy: { id: 'asc' },
  })
  for (const row of rows) {
    console.log(
      `${row.is_active ? '✓' : '·'} ${row.code.padEnd(8)} ${row.name.padEnd(16)} type=${row.payment_type} ref=${row.requires_reference} multi=${row.allow_multiple_accounts} gl=${row.chart_of_accounts ? `${row.chart_of_accounts.code} ${row.chart_of_accounts.name}` : 'NONE'}`,
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
