import prisma from '../src/config/db.js'

const money = (n) => Math.round(Number(n) * 100) / 100
const results = []

function assert(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail })
  if (!cond) console.error('FAIL', name, detail)
  else console.log('OK', name, detail)
}

try {
  const company = await prisma.companies.findFirst({ where: { is_active: true } })
  const customer = await prisma.customers.findFirst({ where: { company_id: company.id, is_active: true } })
  const currencyId = company.currency_id
  const method = await prisma.payment_methods.findFirst({
    where: { is_active: true, gl_account_id: { not: null }, payment_type: { in: ['inbound', 'both'] }, name: { contains: 'EVC' } },
  }) || await prisma.payment_methods.findFirst({
    where: { is_active: true, gl_account_id: { not: null }, payment_type: { in: ['inbound', 'both'] } },
  })
  const advanceAcct = await prisma.chart_of_accounts.findFirst({ where: { company_id: company.id, code: '2140' } })
  const arAcct = await prisma.chart_of_accounts.findFirst({ where: { company_id: company.id, code: '1200' } })
  const saleJournal = await prisma.journals.findFirst({ where: { company_id: company.id, journal_type: 'sale', is_active: true } })
  const revenue = await prisma.chart_of_accounts.findFirst({
    where: { company_id: company.id, is_active: true, allow_manual_entry: true, account_types: { internal_group: 'income' }, other_chart_of_accounts: { none: {} } },
    orderBy: { code: 'asc' },
  })
  const fiscalPeriod = await prisma.fiscal_periods.findFirst({
    where: { state: 'open', fiscal_years: { company_id: company.id, state: 'open' } },
  })

  assert('setup: customer', !!customer, customer?.name)
  assert('setup: method', !!method, method?.name)
  assert('setup: 2140', !!advanceAcct, String(advanceAcct?.id))
  assert('setup: AR', !!arAcct)
  assert('setup: fiscal', !!fiscalPeriod)

  async function makeDraftInvoice(total = 525, ref = null) {
    const journal = saleJournal
    const updated = await prisma.journals.update({ where: { id: journal.id }, data: { next_sequence: { increment: 1 } }, select: { next_sequence: true, sequence_prefix: true } })
    const invNum = `${updated.sequence_prefix || 'SAL'}${String(updated.next_sequence - 1).padStart(4, '0')}-T${Date.now().toString().slice(-4)}`
    const invoice = await prisma.customer_invoices.create({
      data: {
        company_id: company.id,
        document_type: 'invoice',
        invoice_number: invNum,
        customer_id: customer.id,
        journal_id: journal.id,
        fiscal_period_id: fiscalPeriod.id,
        invoice_date: new Date(),
        due_date: new Date(),
        currency_id: currencyId,
        exchange_rate: 1,
        receivable_account_id: arAcct.id,
        customer_reference: ref,
        state: 'draft',
        payment_state: 'not_paid',
        amount_untaxed: total,
        amount_tax: 0,
        amount_total: total,
        paid_amount: 0,
        amount_due: total,
        customer_invoice_lines: {
          create: [{ sequence: 10, description: 'Test service', quantity: 1, unit_price: total, discount_percent: 0, income_account_id: revenue.id, subtotal: total }],
        },
      },
    })
    const entry = await prisma.journal_entries.create({
      data: {
        company_id: company.id,
        journal_id: journal.id,
        entry_number: invNum,
        entry_date: new Date(),
        fiscal_period_id: fiscalPeriod.id,
        narration: `Draft ${invNum}`,
        state: 'draft',
        source_type: 'customer_invoice',
        source_id: invoice.id,
        journal_items: {
          create: [
            { sequence: 10, account_id: arAcct.id, label: 'AR', partner_type: 'customer', partner_id: customer.id, debit: total, credit: 0, currency_id: currencyId, amount_currency: total },
            { sequence: 20, account_id: revenue.id, label: 'Revenue', debit: 0, credit: total, currency_id: currencyId, amount_currency: -total },
          ],
        },
      },
    })
    await prisma.customer_invoices.update({ where: { id: invoice.id }, data: { journal_entry_id: entry.id } })
    return invoice
  }

  async function makeAdvanceReceipt(amount, memo = 'Customer advance payment') {
    const { create, post } = await import('../src/modules/accounting/receivables/customerReceipts/customerReceipt.controller.js')
    const mockRes = () => {
      const r = { statusCode: 200, body: null }
      return {
        status(c) { r.statusCode = c; return this },
        json(b) { r.body = b; return r },
        _r: r,
      }
    }
    const reqCreate = { body: { customer_id: customer.id, payment_method_id: method.id, receipt_date: new Date().toISOString(), amount, reference: `ADV-TEST-${Date.now()}`, memo, allocations: [] }, user: { id: 1 } }
    const resCreate = mockRes()
    await create(reqCreate, resCreate)
    if (!resCreate._r.body?.success) throw new Error('advance create failed: ' + JSON.stringify(resCreate._r.body))
    const receiptId = resCreate._r.body.data.id
    const resPost = mockRes()
    await post({ params: { id: String(receiptId) }, user: { id: 1 } }, resPost)
    if (!resPost._r.body?.success) throw new Error('advance post failed: ' + JSON.stringify(resPost._r.body))
    return resPost._r.body.data
  }

  async function postInvoice(invoiceId) {
    const { post } = await import('../src/modules/accounting/receivables/customerInvoices/customerInvoice.controller.js')
    const mockRes = () => {
      const r = { statusCode: 200, body: null }
      return { status(c) { r.statusCode = c; return this }, json(b) { r.body = b; return r }, _r: r }
    }
    const res = mockRes()
    await post({ params: { id: String(invoiceId) }, user: { id: 1 }, body: {} }, res)
    if (!res._r.body?.success) throw new Error('invoice post failed: ' + JSON.stringify(res._r.body))
    return res._r.body.data
  }

  // TEST 1
  {
    const inv = await makeDraftInvoice(525)
    const posted = await postInvoice(inv.id)
    assert('TEST1 total', money(posted.amount_total) === 525, posted.amount_total)
    assert('TEST1 paid', money(posted.paid_amount) === 0, posted.paid_amount)
    assert('TEST1 due', money(posted.amount_due) === 525, posted.amount_due)
    assert('TEST1 status', posted.payment_state === 'not_paid', posted.payment_state)
    const allocs = await prisma.receipt_allocations.count({ where: { invoice_id: inv.id } })
    assert('TEST1 no receipt alloc', allocs === 0, allocs)
  }

  let test2Invoice = null

  // TEST 2
  {
    const adv = await makeAdvanceReceipt(125, 'Advance for Q-TEST2')
    assert('TEST2 advance unalloc', money(adv.unallocated_amount) === 125, adv.unallocated_amount)
    const je = await prisma.journal_entries.findFirst({
      where: { source_type: 'customer_receipt', source_id: adv.id, state: 'posted' },
      include: { journal_items: true },
    })
    const cr2140 = je?.journal_items?.some((i) => i.account_id === advanceAcct.id && Number(i.credit) === 125)
    const drCash = je?.journal_items?.some((i) => Number(i.debit) === 125)
    assert('TEST2 advance JE', cr2140 && drCash, JSON.stringify(je?.journal_items?.map((i) => ({ a: i.account_id, d: i.debit, c: i.credit }))))

    const inv = await makeDraftInvoice(525, 'Q-TEST2')
    const beforeReceiptCount = await prisma.customer_receipts.count({ where: { customer_id: customer.id, state: 'posted' } })
    const posted = await postInvoice(inv.id)
    const afterReceiptCount = await prisma.customer_receipts.count({ where: { customer_id: customer.id, state: 'posted' } })
    assert('TEST2 total', money(posted.amount_total) === 525, posted.amount_total)
    assert('TEST2 paid', money(posted.paid_amount) === 125, posted.paid_amount)
    assert('TEST2 due', money(posted.amount_due) === 400, posted.amount_due)
    assert('TEST2 status', posted.payment_state === 'partial', posted.payment_state)
    assert('TEST2 no new receipt', afterReceiptCount === beforeReceiptCount, `${beforeReceiptCount}->${afterReceiptCount}`)

    const applyJe = await prisma.journal_entries.findFirst({
      where: { narration: { contains: `applied to ${posted.invoice_number}` }, state: 'posted' },
      include: { journal_items: true },
    })
    const drAdv = applyJe?.journal_items?.some((i) => i.account_id === advanceAcct.id && Number(i.debit) === 125)
    const crAr = applyJe?.journal_items?.some((i) => i.account_id === arAcct.id && Number(i.credit) === 125)
    assert('TEST2 apply JE', drAdv && crAr, applyJe?.narration)
    test2Invoice = posted
  }

  let test3Invoice = null

  // TEST 3
  {
    const inv = test2Invoice
    const { create, post: postReceipt } = await import('../src/modules/accounting/receivables/customerReceipts/customerReceipt.controller.js')
    const mockRes = () => {
      const r = { statusCode: 200, body: null }
      return { status(c) { r.statusCode = c; return this }, json(b) { r.body = b; return r }, _r: r }
    }
    const resC = mockRes()
    await create({
      body: {
        customer_id: customer.id,
        payment_method_id: method.id,
        receipt_date: new Date().toISOString(),
        amount: 200,
        reference: `PAY-200-${Date.now()}`,
        memo: `Payment for ${inv.invoice_number}`,
        allocations: [{ invoice_id: inv.id, allocated_amount: 200 }],
      },
      user: { id: 1 },
    }, resC)
    assert('TEST3 create', resC._r.body?.success, JSON.stringify(resC._r.body))
    const resP = mockRes()
    await postReceipt({ params: { id: String(resC._r.body.data.id) }, user: { id: 1 } }, resP)
    assert('TEST3 post', resP._r.body?.success, JSON.stringify(resP._r.body))
    const updated = await prisma.customer_invoices.findUnique({ where: { id: inv.id } })
    assert('TEST3 paid', money(updated.paid_amount) === 325, updated.paid_amount)
    assert('TEST3 due', money(updated.amount_due) === 200, updated.amount_due)
    const payJe = await prisma.journal_entries.findFirst({
      where: { source_type: 'customer_receipt', source_id: resC._r.body.data.id, state: 'posted' },
      include: { journal_items: true },
    })
    const drPay = payJe?.journal_items?.some((i) => i.account_id === method.gl_account_id && Number(i.debit) === 200)
    const crAr = payJe?.journal_items?.some((i) => i.account_id === arAcct.id && Number(i.credit) === 200)
    const noRev = !payJe?.journal_items?.some((i) => i.account_id === revenue.id)
    assert('TEST3 JE Dr payment Cr AR', drPay && crAr && noRev, JSON.stringify(payJe?.journal_items?.map((i) => ({ a: i.account_id, d: +i.debit, c: +i.credit }))))
    test3Invoice = updated
  }

  // TEST 4
  {
    const inv = test3Invoice
    const { create, post: postReceipt } = await import('../src/modules/accounting/receivables/customerReceipts/customerReceipt.controller.js')
    const mockRes = () => {
      const r = { statusCode: 200, body: null }
      return { status(c) { r.statusCode = c; return this }, json(b) { r.body = b; return r }, _r: r }
    }
    const resC = mockRes()
    await create({
      body: {
        customer_id: customer.id,
        payment_method_id: method.id,
        receipt_date: new Date().toISOString(),
        amount: 200,
        reference: `PAY-400-final-${Date.now()}`,
        memo: `Final payment for ${inv.invoice_number}`,
        allocations: [{ invoice_id: inv.id, allocated_amount: 200 }],
      },
      user: { id: 1 },
    }, resC)
    const resP = mockRes()
    await postReceipt({ params: { id: String(resC._r.body.data.id) }, user: { id: 1 } }, resP)
    const updated = await prisma.customer_invoices.findUnique({ where: { id: inv.id } })
    assert('TEST4 paid', money(updated.paid_amount) === 525, updated.paid_amount)
    assert('TEST4 due', money(updated.amount_due) === 0, updated.amount_due)
    assert('TEST4 status', updated.payment_state === 'paid', updated.payment_state)
  }

  // TEST 5
  {
    const inv = await makeDraftInvoice(525)
    const posted = await postInvoice(inv.id)
    assert('TEST5 paid', money(posted.paid_amount) === 0, posted.paid_amount)
    assert('TEST5 due', money(posted.amount_due) === 525, posted.amount_due)
    assert('TEST5 status', posted.payment_state === 'not_paid', posted.payment_state)
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n==== SUMMARY ====')
  console.log(`passed=${results.filter((r) => r.ok).length} failed=${failed.length}`)
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail))
    process.exitCode = 1
  }
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
