import prisma from '../src/config/db.js'

const TARGET = { code: '2150', name: 'Customer Refund Payable', parentCode: '2100' }

async function main() {
  const companies = await prisma.companies.findMany({ where: { is_active: true }, select: { id: true, name: true } })
  let created = 0
  for (const company of companies) {
    const exists = await prisma.chart_of_accounts.findFirst({
      where: { company_id: company.id, code: TARGET.code },
    })
    if (exists) continue
    const parent = await prisma.chart_of_accounts.findFirst({
      where: { company_id: company.id, code: TARGET.parentCode },
    })
  const liabilityType = await prisma.account_types.findFirst({ where: { internal_group: 'liability' } })
    if (!parent || !liabilityType) {
      console.log(`Skip ${company.name}: missing parent or liability type`)
      continue
    }
    await prisma.chart_of_accounts.create({
      data: {
        company_id: company.id,
        account_type_id: liabilityType.id,
        code: TARGET.code,
        name: TARGET.name,
        is_active: true,
        allow_manual_entry: true,
        is_reconcilable: true,
        parent_id: parent.id,
      },
    })
    created += 1
    console.log(`Created ${TARGET.code} for ${company.name}`)
  }
  console.log(created ? `Done. Created ${created} account(s).` : 'All companies already have Customer Refund Payable (2150).')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})