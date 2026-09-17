import prisma from '../../../../config/db.js'

const include = {
    chart_of_accounts: {
        select: {
            id: true,
            code: true,
            name: true,
            company_id: true,
            is_active: true,
            allow_manual_entry: true,
            other_chart_of_accounts: { select: { id: true } },
        },
    },
}

const inputError = (message) => Object.assign(new Error(message), { status: 400 })
const fail = (res, error) => res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message })

const toId = (value) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN
}

const toBool = (value, fallback = false) => {
    if (value === undefined) return fallback
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === 1 || value === '1') return true
    if (value === 'false' || value === 0 || value === '0') return false
    return Boolean(value)
}

/** Active leaf posting money accounts (cash / bank / mobile) — never parents. */
export const eligibleGlAccountWhere = (companyId = null) => ({
    ...(companyId ? { company_id: companyId } : {}),
    is_active: true,
    allow_manual_entry: true,
    other_chart_of_accounts: { none: {} },
    account_types: { internal_group: 'asset' },
    OR: [
        { code: { startsWith: '111' } }, // Cash
        { code: { startsWith: '112' } }, // Bank accounts
        { code: { startsWith: '113' } }, // Mobile money
    ],
})

function sanitize(body = {}) {
    const name = String(body.name || '').trim()
    const code = String(body.code || '').trim().toUpperCase()
    const payment_type = String(body.payment_type || 'both').trim().toLowerCase()
    const gl_account_id = toId(body.gl_account_id)

    if (!name) throw inputError('Payment method name is required')
    if (!code) throw inputError('Payment method code is required')
    if (name.length > 64) throw inputError('Name must be 64 characters or fewer')
    if (code.length > 16) throw inputError('Code must be 16 characters or fewer')
    if (!['inbound', 'outbound', 'both'].includes(payment_type)) {
        throw inputError('Payment type must be inbound, outbound, or both')
    }
    if (!Number.isFinite(gl_account_id)) throw inputError('GL Account is required')

    return {
        name,
        code,
        payment_type,
        gl_account_id,
        allow_multiple_accounts: toBool(body.allow_multiple_accounts, false),
        requires_reference: toBool(body.requires_reference, false),
        is_active: toBool(body.is_active, true),
    }
}

async function assertUniqueCode(code, excludeId = null) {
    const existing = await prisma.payment_methods.findFirst({
        where: {
            code,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, name: true },
    })
    if (existing) {
        throw inputError(`Payment method code ${code} already exists (${existing.name})`)
    }
}

async function assertUniqueName(name, excludeId = null) {
    const existing = await prisma.payment_methods.findFirst({
        where: {
            name,
            is_active: true,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, code: true },
    })
    if (existing) {
        throw inputError(`An active payment method named "${name}" already exists (${existing.code})`)
    }
}

async function validateGlAccount(glAccountId, expectedCompanyId = null) {
    if (!glAccountId) throw inputError('GL Account is required')
    const account = await prisma.chart_of_accounts.findFirst({
        where: { id: glAccountId, ...eligibleGlAccountWhere(expectedCompanyId) },
        select: {
            id: true,
            code: true,
            name: true,
            company_id: true,
            allow_manual_entry: true,
            other_chart_of_accounts: { select: { id: true } },
        },
    })
    if (!account) {
        throw inputError('Linked GL account must be an active posting Cash, Bank, or Mobile Money account (parent accounts are not allowed)')
    }
    if (expectedCompanyId && account.company_id !== expectedCompanyId) {
        throw inputError('GL account must belong to the same company as the payment method context')
    }
    return account
}

export const getEligibleGlAccounts = async (req, res) => {
    try {
        const companyId = toId(req.query.company_id)
        const data = await prisma.chart_of_accounts.findMany({
            where: eligibleGlAccountWhere(Number.isFinite(companyId) ? companyId : null),
            select: { id: true, code: true, name: true, company_id: true, is_active: true },
            orderBy: [{ company_id: 'asc' }, { code: 'asc' }],
        })
        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const getAll = async (req, res) => {
    try {
        const activeOnly = String(req.query.active_only || '') === 'true' || String(req.query.active_only || '') === '1'
        const paymentType = String(req.query.payment_type || '').trim().toLowerCase()
        const companyId = toId(req.query.company_id)

        const data = await prisma.payment_methods.findMany({
            where: {
                ...(activeOnly ? { is_active: true } : {}),
                ...(paymentType === 'inbound' ? { payment_type: { in: ['inbound', 'both'] } } : {}),
                ...(paymentType === 'outbound' ? { payment_type: { in: ['outbound', 'both'] } } : {}),
                ...(Number.isFinite(companyId)
                    ? { chart_of_accounts: { company_id: companyId } }
                    : {}),
            },
            include,
            orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
        })
        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const getById = async (req, res) => {
    try {
        const data = await prisma.payment_methods.findUnique({
            where: { id: parseInt(req.params.id, 10) },
            include,
        })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const create = async (req, res) => {
    try {
        const payload = sanitize(req.body)
        await assertUniqueCode(payload.code)
        await assertUniqueName(payload.name)
        await validateGlAccount(payload.gl_account_id)
        const data = await prisma.payment_methods.create({ data: payload, include })
        res.status(201).json({ success: true, data })
    } catch (error) {
        if (error.code === 'P2002') return fail(res, inputError('Payment method code already exists'))
        fail(res, error)
    }
}

export const update = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)
        const existing = await prisma.payment_methods.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' })

        const payload = sanitize({ ...existing, ...req.body })
        await assertUniqueCode(payload.code, id)
        await assertUniqueName(payload.name, id)
        await validateGlAccount(payload.gl_account_id)

        const data = await prisma.payment_methods.update({ where: { id }, data: payload, include })
        res.status(200).json({ success: true, data })
    } catch (error) {
        if (error.code === 'P2002') return fail(res, inputError('Payment method code already exists'))
        fail(res, error)
    }
}

export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)
        const existing = await prisma.payment_methods.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' })

        const [receipts, payments, banks] = await Promise.all([
            prisma.customer_receipts.count({ where: { payment_method_id: id } }),
            prisma.vendor_payments.count({ where: { payment_method_id: id } }),
            prisma.bank_accounts.count({ where: { payment_method_id: id } }),
        ])

        if (receipts > 0 || payments > 0 || banks > 0) {
            await prisma.payment_methods.update({
                where: { id },
                data: { is_active: false },
            })
            return res.status(200).json({
                success: true,
                message: 'Payment method is linked to transactions, so it was set to Inactive to preserve history.',
            })
        }

        await prisma.payment_methods.delete({ where: { id } })
        return res.status(200).json({ success: true, message: 'Payment method deleted successfully' })
    } catch (error) {
        if (error.code === 'P2003') {
            try {
                await prisma.payment_methods.update({
                    where: { id: parseInt(req.params.id, 10) },
                    data: { is_active: false },
                })
                return res.status(200).json({
                    success: true,
                    message: 'Payment method is linked in the system, so it was set to Inactive.',
                })
            } catch {
                return fail(res, inputError('This payment method cannot be deleted because it is linked to other records.'))
            }
        }
        fail(res, error)
    }
}
