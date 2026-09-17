import prisma from '../../../config/db.js'
import { generateCustomId } from '../../../lib/id-generator.js'

let posCache = { data: null, at: 0 }
const POS_TTL = 5 * 60 * 1000

export const clearCustomerCache = () => { posCache = { data: null, at: 0 } }

const defaultCompany = async () => {
  const company = await prisma.companies.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, currency_id: true },
  })
  if (!company) {
    const error = new Error('A company must exist before creating customers')
    error.status = 400
    throw error
  }
  return company
}

const defaultCompanyId = async () => (await defaultCompany()).id

/** Outstanding AR from posted invoices only (receipts/credit notes already reduce amount_due). */
const outstandingFromInvoices = (invoices = []) => (invoices || [])
  .filter((invoice) => invoice.state === 'posted' && invoice.document_type === 'invoice')
  .reduce((sum, invoice) => sum + Number(invoice.amount_due || 0), 0)

/**
 * Official customer balance:
 * Opening Balance + Posted Invoice outstanding (amount_due already nets receipts & credit notes).
 * Draft documents never affect this.
 */
export const computeCustomerBalance = (record) => {
  const opening = Math.round(Number(record?.opening_balance || 0) * 100) / 100
  const outstanding = Math.round(outstandingFromInvoices(record?.customer_invoices) * 100) / 100
  return Math.round((opening + outstanding) * 100) / 100
}

const balanceInclude = {
  currencies: { select: { code: true } },
  customer_invoices: {
    where: { document_type: 'invoice', state: 'posted' },
    select: { amount_due: true, state: true, document_type: true, amount_total: true },
  },
  client: { select: { id: true, institution: true, contactPerson: true, phone: true, email: true } },
}

const present = (record) => {
  if (!record) return record
  const opening = Math.round(Number(record.opening_balance || 0) * 100) / 100
  const receivable_balance = computeCustomerBalance(record)
  return {
    ...record,
    opening_balance: opening,
    openingBalance: opening,
    currentBalance: receivable_balance,
    contact_person: record.client?.contactPerson || record.name,
    currency: record.currencies?.code || null,
    receivable_balance,
    fullName: record.name,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

const syncClientsToCustomers = async () => {
  const company = await defaultCompany()
  const clients = await prisma.client.findMany({ where: { isDraft: false } })
  for (const client of clients) {
    const name = client.institution || client.companyName || client.contactPerson || client.email
    const data = {
      company_id: company.id,
      name,
      email: client.email || null,
      phone: client.phone || null,
      address: client.address || null,
      notes: client.notes || null,
      is_active: client.isActive !== false,
      updated_at: new Date(),
    }
    let customer = await prisma.customers.findUnique({ where: { clientId: client.id } })
    if (!customer && client.email) customer = await prisma.customers.findFirst({ where: { email: client.email } })
    if (!customer && client.phone) customer = await prisma.customers.findFirst({ where: { phone: client.phone } })
    if (customer) {
      await prisma.customers.update({ where: { id: customer.id }, data: { ...data, clientId: client.id } })
    } else {
      await prisma.customers.create({
        data: {
          ...data,
          clientId: client.id,
          currency_id: company.currency_id || null,
        },
      })
    }
  }
  if (clients.length) clearCustomerCache()
}

/** Opening balance is a live DB column; read via SQL until Prisma client is regenerated. */
async function loadOpeningBalances(ids) {
  if (!ids.length) return new Map()
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, opening_balance FROM customers WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  )
  return new Map(rows.map((row) => [Number(row.id), Number(row.opening_balance || 0)]))
}

const attachOpening = async (records) => {
  const list = Array.isArray(records) ? records : (records ? [records] : [])
  const openings = await loadOpeningBalances(list.map((row) => row.id))
  for (const row of list) row.opening_balance = openings.get(Number(row.id)) || 0
  return records
}

export const listCustomers = async ({ lightweight = false } = {}) => {
  await syncClientsToCustomers()
  if (lightweight && posCache.data && Date.now() - posCache.at < POS_TTL) return posCache.data
  const records = await prisma.customers.findMany({
    ...(lightweight ? {
      select: { id: true, name: true, phone: true, email: true, created_at: true, updated_at: true },
      take: 1000,
    } : {
      include: balanceInclude,
    }),
    orderBy: lightweight ? { name: 'asc' } : { created_at: 'desc' },
  })
  if (!lightweight) await attachOpening(records)
  const result = records.map((record) => present(record))
  if (lightweight) posCache = { data: result, at: Date.now() }
  return result
}

export const findCustomer = async (id) => {
  const record = await prisma.customers.findUnique({ where: { id }, include: balanceInclude })
  if (!record) return null
  await attachOpening(record)
  return present(record)
}

export const findCustomerByPhone = async (phone) => {
  const record = await prisma.customers.findFirst({ where: { phone }, include: balanceInclude })
  if (!record) return null
  await attachOpening(record)
  return present(record)
}

export const createCustomerRecord = async (data) => {
  const company = await defaultCompany()
  const company_id = data.company_id || company.id
  if (data.phone && await prisma.customers.findFirst({ where: { phone: data.phone } })) {
    const error = new Error('Customer with this phone number already exists')
    error.status = 409
    throw error
  }

  const opening = data.opening_balance !== undefined ? Number(data.opening_balance) : 0
  if (!Number.isFinite(opening) || opening < 0) {
    const error = new Error('Opening balance must be a non-negative number')
    error.status = 400
    throw error
  }

  const record = await prisma.$transaction(async (tx) => {
    let client = null
    if (data.email) client = await tx.client.findFirst({ where: { email: data.email } })
    if (!client && data.phone) client = await tx.client.findFirst({ where: { phone: data.phone } })

    if (!client) {
      const clientId = await generateCustomId({ entityTybe: 'clients', prisma: tx })
      client = await tx.client.create({
        data: {
          id: clientId,
          institution: data.name,
          companyName: data.name,
          address: data.address || null,
          email: data.email || `customer-${clientId}@deero.internal`,
          phone: data.phone || `NO_PHONE_${clientId}`,
          source: 'Accounting',
          notes: data.notes || null,
          isActive: data.is_active !== false,
          isDraft: false,
        },
      })
    }

    const { opening_balance: _ignored, ...rest } = data
    const created = await tx.customers.create({
      data: {
        ...rest,
        company_id,
        clientId: client.id,
        currency_id: data.currency_id || company.currency_id || null,
      },
      include: balanceInclude,
    })
    await tx.$executeRawUnsafe(
      'UPDATE customers SET opening_balance = ? WHERE id = ?',
      Math.round(opening * 100) / 100,
      created.id,
    )
    created.opening_balance = Math.round(opening * 100) / 100
    return created
  })
  clearCustomerCache()
  return present(record)
}

export const upsertCustomerByPhone = async ({ name, phone }) => {
  const existing = await prisma.customers.findFirst({ where: { phone }, include: balanceInclude })
  if (existing) {
    const updated = await prisma.customers.update({
      where: { id: existing.id },
      data: { name, updated_at: new Date() },
      include: balanceInclude,
    })
    await attachOpening(updated)
    return present(updated)
  }
  return createCustomerRecord({ name, phone })
}

export const updateCustomerRecord = async (id, data) => {
  if (data.phone) {
    const duplicate = await prisma.customers.findFirst({ where: { phone: data.phone, NOT: { id } } })
    if (duplicate) {
      const error = new Error('Another customer with this phone number already exists')
      error.status = 409
      throw error
    }
  }
  let openingToSet = undefined
  if (data.opening_balance !== undefined) {
    const opening = Number(data.opening_balance)
    if (!Number.isFinite(opening) || opening < 0) {
      const error = new Error('Opening balance must be a non-negative number')
      error.status = 400
      throw error
    }
    openingToSet = Math.round(opening * 100) / 100
    delete data.opening_balance
  }
  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.customers.findUnique({ where: { id } })
    if (!existing) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    const updated = await tx.customers.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
      include: balanceInclude,
    })
    if (openingToSet !== undefined) {
      await tx.$executeRawUnsafe('UPDATE customers SET opening_balance = ? WHERE id = ?', openingToSet, id)
      updated.opening_balance = openingToSet
    }
    if (existing.clientId) {
      const clientData = {
        ...(data.name !== undefined ? { institution: data.name, companyName: data.name } : {}),
        ...(data.address !== undefined ? { address: data.address || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.is_active !== undefined ? { isActive: data.is_active !== false } : {}),
      }
      if (data.email) clientData.email = data.email
      if (data.phone) clientData.phone = data.phone
      await tx.client.update({ where: { id: existing.clientId }, data: clientData })
    }
    return updated
  })
  if (record.opening_balance === undefined) await attachOpening(record)
  clearCustomerCache()
  return present(record)
}

export const deleteCustomerRecord = async (id) => {
  const record = await prisma.customers.findUnique({
    where: { id },
    include: {
      customer_invoices: { select: { id: true }, take: 1 },
      customer_receipts: { select: { id: true }, take: 1 },
      quotations: { select: { id: true }, take: 1 },
    },
  })
  if (!record) return false
  await attachOpening(record)

  const hasHistory = Boolean(
    record.customer_invoices.length
    || record.customer_receipts.length
    || record.quotations.length
    || Number(record.opening_balance || 0) > 0,
  )

  // Preserve accounting history: deactivate instead of hard-delete when linked.
  if (hasHistory) {
    const deactivated = await prisma.customers.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
      include: balanceInclude,
    })
    deactivated.opening_balance = record.opening_balance
    clearCustomerCache()
    const presented = present(deactivated)
    presented._deactivated = true
    return presented
  }

  await prisma.customers.delete({ where: { id } })
  clearCustomerCache()
  return record
}
