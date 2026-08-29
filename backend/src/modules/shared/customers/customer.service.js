import prisma from '../../../config/db.js'
import { generateCustomId } from '../../../lib/id-generator.js'

let posCache = { data: null, at: 0 }
const POS_TTL = 5 * 60 * 1000

export const clearCustomerCache = () => { posCache = { data: null, at: 0 } }

const defaultCompanyId = async () => {
  const company = await prisma.companies.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
  if (!company) {
    const error = new Error('A company must exist before creating customers')
    error.status = 400
    throw error
  }
  return company.id
}

const present = (record) => record && ({
  ...record,
  currency: record.currencies?.code || null,
  receivable_balance: (record.customer_invoices || []).filter((invoice) => invoice.state === 'posted' && invoice.document_type === 'invoice').reduce((sum, invoice) => sum + Number(invoice.amount_due || 0), 0),
  fullName: record.name,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

const syncClientsToCustomers = async () => {
  const company_id = await defaultCompanyId()
  const clients = await prisma.client.findMany({ where: { isDraft: false } })
  for (const client of clients) {
    const name = client.institution || client.companyName || client.contactPerson || client.email
    const data = {
      company_id,
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
      await prisma.customers.create({ data: { ...data, clientId: client.id } })
    }
  }
  if (clients.length) clearCustomerCache()
}

export const listCustomers = async ({ lightweight = false } = {}) => {
  await syncClientsToCustomers()
  if (lightweight && posCache.data && Date.now() - posCache.at < POS_TTL) return posCache.data
  const records = await prisma.customers.findMany({
    ...(lightweight ? {
      select: { id: true, name: true, phone: true, email: true, created_at: true, updated_at: true },
      take: 1000,
    } : {
      include: {
        currencies: { select: { code: true } },
        customer_invoices: { select: { amount_due: true, state: true, document_type: true } },
      },
    }),
    orderBy: lightweight ? { name: 'asc' } : { created_at: 'desc' },
  })
  const result = records.map((record) => present(record))
  if (lightweight) posCache = { data: result, at: Date.now() }
  return result
}

export const findCustomer = async (id) => present(await prisma.customers.findUnique({ where: { id } }))

export const findCustomerByPhone = async (phone) => present(await prisma.customers.findFirst({ where: { phone } }))

export const createCustomerRecord = async (data) => {
  const company_id = data.company_id || await defaultCompanyId()
  if (data.phone && await prisma.customers.findFirst({ where: { phone: data.phone } })) {
    const error = new Error('Customer with this phone number already exists')
    error.status = 409
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

    return tx.customers.create({ data: { ...data, company_id, clientId: client.id } })
  })
  clearCustomerCache()
  return present(record)
}

export const upsertCustomerByPhone = async ({ name, phone }) => {
  const existing = await prisma.customers.findFirst({ where: { phone } })
  if (existing) return present(await prisma.customers.update({
    where: { id: existing.id },
    data: { name, updated_at: new Date() },
  }))
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
  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.customers.findUnique({ where: { id } })
    if (!existing) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    const updated = await tx.customers.update({ where: { id }, data: { ...data, updated_at: new Date() } })
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
  clearCustomerCache()
  return present(record)
}

export const deleteCustomerRecord = async (id) => {
  const record = await prisma.customers.findUnique({
    where: { id },
    include: { customer_invoices: { select: { id: true }, take: 1 }, customer_receipts: { select: { id: true }, take: 1 } },
  })
  if (!record) return false
  if (record.customer_invoices.length || record.customer_receipts.length) {
    const error = new Error('Cannot delete a customer with existing orders or accounting transactions')
    error.status = 400
    throw error
  }
  await prisma.customers.delete({ where: { id } })
  clearCustomerCache()
  return record
}
