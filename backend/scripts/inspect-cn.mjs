import prisma from '../src/config/db.js'

const number = process.argv[2] || 'CN0025'
const cn = await prisma.customer_invoices.findFirst({
  where: { invoice_number: number },
  include: {
    journal_entries: {
      include: {
        journal_items: {
          include: { chart_of_accounts: { select: { code: true, name: true } } },
        },
      },
    },
  },
})
if (!cn) {
  console.log('Not found')
  process.exit(1)
}
console.log('settlement notes:', cn.notes)
console.log(
  'JE lines:',
  cn.journal_entries?.journal_items.map((i) => ({
    code: i.chart_of_accounts?.code,
    debit: Number(i.debit),
    credit: Number(i.credit),
    label: i.label,
  }))
)
await prisma.$disconnect()