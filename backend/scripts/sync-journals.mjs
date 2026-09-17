/**
 * Non-destructive Journals sync.
 * Ensures SAL/PUR/CSH/BNK/GEN exist and are active; deactivates WALLET if present.
 * Never resets sequences or deletes historical journals with entries.
 *
 * Usage: node scripts/sync-journals.mjs
 */
import prisma from '../src/config/db.js'

const TARGETS = [
  { code: 'SAL', name: 'Sales Journal', journal_type: 'sale', sequence_prefix: 'SAL-', allow_manual_entries: false },
  { code: 'PUR', name: 'Purchase Journal', journal_type: 'purchase', sequence_prefix: 'PUR-', allow_manual_entries: false },
  { code: 'CSH', name: 'Cash Journal', journal_type: 'cash', sequence_prefix: 'CSH-', allow_manual_entries: true },
  { code: 'BNK', name: 'Bank Journal', journal_type: 'bank', sequence_prefix: 'BNK-', allow_manual_entries: true },
  { code: 'GEN', name: 'General Journal', journal_type: 'general', sequence_prefix: 'JE-', allow_manual_entries: true },
]

async function main() {
  const companies = await prisma.companies.findMany({ where: { is_active: true } })
  if (!companies.length) throw new Error('No active companies')

  for (const company of companies) {
    console.log(`\nCompany ${company.id} — ${company.name}`)

    for (const target of TARGETS) {
      const existing = await prisma.journals.findFirst({
        where: { company_id: company.id, code: target.code },
      })
      if (existing) {
        // Update identity/flags only — never touch next_sequence
        await prisma.journals.update({
          where: { id: existing.id },
          data: {
            name: target.name,
            journal_type: target.journal_type,
            // Keep existing prefix if already in use with history; only set if empty
            sequence_prefix: existing.sequence_prefix || target.sequence_prefix,
            allow_manual_entries: target.allow_manual_entries,
            is_active: true,
            // Clear hard-coded money GL defaults on Bank/Cash (payment method owns GL mapping)
            ...(target.journal_type === 'bank' || target.journal_type === 'cash'
              ? { default_debit_account_id: null, default_credit_account_id: null }
              : {}),
          },
        })
        console.log(`  Updated ${target.code} id=${existing.id} next=${existing.next_sequence}`)
      } else {
        const created = await prisma.journals.create({
          data: {
            company_id: company.id,
            code: target.code,
            name: target.name,
            journal_type: target.journal_type,
            sequence_prefix: target.sequence_prefix,
            next_sequence: 1,
            allow_manual_entries: target.allow_manual_entries,
            currency_id: company.currency_id,
            is_active: true,
          },
        })
        console.log(`  Created ${target.code} id=${created.id}`)
      }
    }

    // Also normalize common alias codes if they exist as separate journals
    const aliases = [
      { code: 'CASH', prefer: 'CSH' },
      { code: 'BANK', prefer: 'BNK' },
    ]
    for (const alias of aliases) {
      const row = await prisma.journals.findFirst({ where: { company_id: company.id, code: alias.code } })
      if (!row) continue
      const entries = await prisma.journal_entries.count({ where: { journal_id: row.id } })
      if (entries > 0 || row.next_sequence > 1) {
        await prisma.journals.update({ where: { id: row.id }, data: { is_active: false } })
        console.log(`  Deactivated alias ${alias.code} id=${row.id} (has history; use ${alias.prefer})`)
      } else {
        await prisma.journals.delete({ where: { id: row.id } })
        console.log(`  Removed unused alias ${alias.code} id=${row.id}`)
      }
    }

    const wallet = await prisma.journals.findFirst({
      where: {
        company_id: company.id,
        OR: [{ code: 'WALLET' }, { name: { contains: 'Mobile Wallet' } }],
      },
    })
    if (wallet) {
      const usage = await Promise.all([
        prisma.journal_entries.count({ where: { journal_id: wallet.id } }),
        prisma.customer_receipts.count({ where: { journal_id: wallet.id } }),
        prisma.vendor_payments.count({ where: { journal_id: wallet.id } }),
        prisma.bank_accounts.count({ where: { journal_id: wallet.id } }),
      ])
      const used = usage.some((n) => n > 0) || wallet.next_sequence > 1
      if (used) {
        await prisma.journals.update({ where: { id: wallet.id }, data: { is_active: false } })
        console.log(`  Deactivated WALLET id=${wallet.id} (historical refs: entries=${usage[0]}, payments=${usage[2]})`)
      } else {
        await prisma.journals.delete({ where: { id: wallet.id } })
        console.log(`  Deleted unused WALLET id=${wallet.id}`)
      }
    }
  }

  console.log('\nFinal journals:')
  const rows = await prisma.journals.findMany({
    include: { companies: { select: { name: true } } },
    orderBy: [{ company_id: 'asc' }, { code: 'asc' }],
  })
  for (const row of rows) {
    console.log(
      `${row.is_active ? '✓' : '·'} ${row.code.padEnd(8)} ${row.name.padEnd(18)} type=${row.journal_type.padEnd(10)} next=${String(row.sequence_prefix)}${String(row.next_sequence).padStart(4, '0')} company=${row.companies?.name}`,
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
