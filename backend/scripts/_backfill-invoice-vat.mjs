/**
 * Backfill draft/posted invoices that stored vat_percent in notes
 * but persisted amount_tax = 0 because the taxes table was empty.
 */
import prisma from '../src/config/db.js'

function money2(value) {
  return Math.round(Number(value || 0) * 100) / 100
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

async function ensureSaleVatTax(ratePercent, companyId) {
  const rate = money2(ratePercent)
  if (!(rate > 0)) return null
  const candidates = await prisma.taxes.findMany({
    where: { is_active: true, tax_scope: { in: ['sale', 'both'] } },
    orderBy: { id: 'asc' },
  })
  let tax = candidates.find((row) => Math.abs(Number(row.rate_percent) - rate) < 0.0001) || null
  const taxAccount = await findTaxPayableAccount(companyId)
  if (!taxAccount) throw new Error('Taxes Payable 2120 missing')
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
  return prisma.taxes.create({
    data: {
      name: existingName ? `Sales VAT ${rate}%` : preferredName,
      tax_scope: 'both',
      rate_percent: rate,
      tax_account_id: taxAccount.id,
      price_includes_tax: false,
      is_active: true,
    },
  })
}

const invoices = await prisma.customer_invoices.findMany({
  where: { state: 'draft', amount_tax: 0, notes: { not: null } },
  include: { customer_invoice_lines: true, journal_entries: { include: { journal_items: true } } },
  orderBy: { id: 'asc' },
})

let fixed = 0
for (const invoice of invoices) {
  let meta = null
  try { meta = JSON.parse(String(invoice.notes)) } catch { continue }
  const vatPercent = Number(meta?.vat_percent || 0)
  if (!(vatPercent > 0)) continue

  const untaxed = money2(invoice.amount_untaxed)
  const taxAmount = money2(untaxed * (vatPercent / 100))
  if (taxAmount <= 0) continue
  const total = money2(untaxed + taxAmount)
  const paid = money2(invoice.paid_amount)
  const amountDue = Math.max(0, money2(total - paid))
  const tax = await ensureSaleVatTax(vatPercent, invoice.company_id)

  meta.vat_percent = vatPercent
  meta.tax_id = tax?.id || meta.tax_id || null
  meta.amount_untaxed = untaxed
  meta.amount_tax = taxAmount
  meta.amount_total = total

  await prisma.$transaction(async (tx) => {
    await tx.customer_invoices.update({
      where: { id: invoice.id },
      data: {
        amount_tax: taxAmount,
        amount_total: total,
        amount_due: amountDue,
        payment_state: amountDue <= 0.005 ? 'paid' : paid > 0.005 ? 'partial' : 'not_paid',
        notes: JSON.stringify(meta),
        updated_at: new Date(),
      },
    })
    if (tax?.id) {
      await tx.customer_invoice_lines.updateMany({
        where: { invoice_id: invoice.id, tax_id: null },
        data: { tax_id: tax.id },
      })
    }

    // Rebuild draft journal so AR / tax credits match persisted totals.
    if (invoice.state === 'draft' && invoice.journal_entries?.state === 'draft') {
      const entry = invoice.journal_entries
      await tx.journal_items.deleteMany({ where: { entry_id: entry.id } })
      const rate = Number(invoice.exchange_rate || 1)
      const taxAccId = tax.tax_account_id
      const items = [
        {
          sequence: 10,
          account_id: invoice.receivable_account_id,
          label: 'Accounts Receivable',
          partner_type: 'customer',
          partner_id: invoice.customer_id,
          debit: money2(total * rate),
          credit: 0,
          currency_id: invoice.currency_id,
          amount_currency: total,
        },
      ]
      let seq = 20
      for (const line of invoice.customer_invoice_lines) {
        items.push({
          sequence: seq,
          account_id: line.income_account_id,
          label: line.description,
          debit: 0,
          credit: money2(Number(line.subtotal) * rate),
          currency_id: invoice.currency_id,
          amount_currency: -Number(line.subtotal),
        })
        seq += 10
      }
      items.push({
        sequence: seq,
        account_id: taxAccId,
        label: tax.name,
        debit: 0,
        credit: money2(taxAmount * rate),
        currency_id: invoice.currency_id,
        amount_currency: -taxAmount,
      })
      await tx.journal_items.createMany({ data: items.map((row) => ({ ...row, entry_id: entry.id })) })
    }
  })

  fixed += 1
  console.log(`Fixed ${invoice.invoice_number}: untaxed=${untaxed} tax=${taxAmount} total=${total}`)
}

console.log(`Done. fixed=${fixed}`)
await prisma.$disconnect()
