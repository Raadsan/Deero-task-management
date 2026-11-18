/**
 * Smoke-verify credit note posting: journal balance + settlement fields.
 * Usage: node backend/scripts/verify-credit-notes.mjs
 */
import prisma from '../src/config/db.js'

const money2 = (v) => Math.round(Number(v || 0) * 100) / 100

async function jeBalance(entryId) {
  const items = await prisma.journal_items.findMany({ where: { entry_id: entryId } })
  const debit = items.reduce((s, r) => s + Number(r.debit), 0)
  const credit = items.reduce((s, r) => s + Number(r.credit), 0)
  return { debit: money2(debit), credit: money2(credit), balanced: Math.abs(debit - credit) <= 0.005, items }
}

async function main() {
  const credits = await prisma.customer_invoices.findMany({
    where: { document_type: 'credit_note', state: 'posted' },
    orderBy: { id: 'desc' },
    take: 20,
    include: {
      customer_invoices: { select: { invoice_number: true, amount_due: true, paid_amount: true, payment_state: true } },
      journal_entries: { select: { id: true, entry_number: true, state: true } },
    },
  })
  console.log(`Posted credit notes: ${credits.length}`)
  let issues = 0
  for (const cn of credits) {
    const je = cn.journal_entries
    if (!je || je.state !== 'posted') {
      console.log(`  CN ${cn.invoice_number}: missing posted JE`)
      issues += 1
      continue
    }
    const bal = await jeBalance(je.id)
    const reversal = await prisma.journal_entries.findFirst({ where: { reversed_entry_id: je.id } })
    console.log(
      `  CN ${cn.invoice_number} -> ${cn.customer_invoices?.invoice_number} total=${cn.amount_total} paid_amount=${cn.paid_amount} amount_due=${cn.amount_due} JE ${je.entry_number} debit=${bal.debit} credit=${bal.credit} ${bal.balanced ? 'OK' : 'UNBALANCED'}${reversal ? ' (reversed)' : ''}`
    )
    if (!bal.balanced) issues += 1
    const dupJe = await prisma.journal_entries.count({
      where: { source_type: 'customer_invoice', source_id: cn.id, state: 'posted', reversed_entry_id: null },
    })
    if (dupJe > 1) {
      console.log(`    DUPLICATE posted JEs: ${dupJe}`)
      issues += 1
    }
  }

  const scenarios = await prisma.customer_invoices.findMany({
    where: { document_type: 'invoice', state: 'posted' },
    select: { id: true, invoice_number: true, payment_state: true, amount_total: true, amount_due: true },
    take: 15,
    orderBy: { id: 'desc' },
  })
  console.log('\nSample invoices for credit scenarios:')
  for (const inv of scenarios) {
    const credited = await prisma.customer_invoices.aggregate({
      where: { document_type: 'credit_note', reversed_invoice_id: inv.id, state: 'posted' },
      _sum: { amount_total: true },
    })
    const creditable = money2(inv.amount_total - Number(credited._sum.amount_total || 0))
    console.log(
      `  ${inv.invoice_number} ${inv.payment_state} total=${inv.amount_total} due=${inv.amount_due} creditable=${creditable}`
    )
  }

  console.log(issues ? `\nFound ${issues} issue(s).` : '\nNo journal balance issues in sample.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})