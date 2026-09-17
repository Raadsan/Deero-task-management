import prisma from '../../../../config/db.js'

const JOURNAL_TYPES = [
    'sale',
    'purchase',
    'cash',
    'bank',
    'general',
    'opening_balance',
    'adjustment',
    'closing',
]

const PRIMARY_TYPES = new Set(['sale', 'purchase', 'cash', 'bank', 'general'])

const include = {
    companies: { select: { id: true, name: true } },
    currencies: { select: { id: true, code: true, name: true, symbol: true } },
    chart_of_accounts_journals_default_debit_account_idTochart_of_accounts: {
        select: { id: true, code: true, name: true },
    },
    chart_of_accounts_journals_default_credit_account_idTochart_of_accounts: {
        select: { id: true, code: true, name: true },
    },
    _count: { select: { journal_entries: true } },
}

const inputError = (message) => Object.assign(new Error(message), { status: 400 })
const fail = (res, error) => res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message })

const toId = (value) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN
}

const toBool = (value, fallback) => {
    if (value === undefined) return fallback
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === 1 || value === '1') return true
    if (value === 'false' || value === 0 || value === '0') return false
    return Boolean(value)
}

function sanitize(body = {}) {
    const company_id = toId(body.company_id)
    const name = String(body.name || '').trim()
    const code = String(body.code || '').trim().toUpperCase()
    const journal_type = String(body.journal_type || '').trim()
    const currency_id = toId(body.currency_id)
    const default_debit_account_id = toId(body.default_debit_account_id)
    const default_credit_account_id = toId(body.default_credit_account_id)
    const next_sequence = Number(body.next_sequence)

    if (!Number.isFinite(company_id)) throw inputError('Company is required')
    if (!name) throw inputError('Journal name is required')
    if (!code) throw inputError('Journal code is required')
    if (code.length > 8) throw inputError('Journal code must be 8 characters or fewer')
    if (name.length > 128) throw inputError('Journal name must be 128 characters or fewer')
    if (!JOURNAL_TYPES.includes(journal_type)) throw inputError('Journal type is invalid')
    if (!Number.isInteger(next_sequence) || next_sequence < 1) throw inputError('Next sequence must be a positive integer')
    if (currency_id !== null && !Number.isFinite(currency_id)) throw inputError('Currency is invalid')
    if (default_debit_account_id !== null && !Number.isFinite(default_debit_account_id)) throw inputError('Default debit account is invalid')
    if (default_credit_account_id !== null && !Number.isFinite(default_credit_account_id)) throw inputError('Default credit account is invalid')

    const sequence_prefix = String(body.sequence_prefix ?? '').trim()
    if (sequence_prefix.length > 16) throw inputError('Sequence prefix must be 16 characters or fewer')

    return {
        company_id,
        name,
        code,
        journal_type,
        currency_id: Number.isFinite(currency_id) ? currency_id : null,
        default_debit_account_id: Number.isFinite(default_debit_account_id) ? default_debit_account_id : null,
        default_credit_account_id: Number.isFinite(default_credit_account_id) ? default_credit_account_id : null,
        sequence_prefix,
        next_sequence,
        is_active: toBool(body.is_active, true),
        allow_manual_entries: toBool(body.allow_manual_entries, journal_type === 'general' || journal_type === 'cash' || journal_type === 'bank' || journal_type === 'adjustment'),
    }
}

async function assertUniqueCode(companyId, code, excludeId = null) {
    const existing = await prisma.journals.findFirst({
        where: {
            company_id: companyId,
            code,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, name: true },
    })
    if (existing) throw inputError(`Journal code ${code} already exists for this company (${existing.name})`)
}

async function assertAccount(companyId, accountId, label) {
    if (!accountId) return null
    const account = await prisma.chart_of_accounts.findFirst({
        where: {
            id: accountId,
            company_id: companyId,
            is_active: true,
            allow_manual_entry: true,
            other_chart_of_accounts: { none: {} },
        },
        select: { id: true, code: true, name: true },
    })
    if (!account) {
        throw inputError(`${label} must be an active posting GL account in the same company (parent accounts are not allowed)`)
    }
    return account
}

async function assertCompany(companyId) {
    const company = await prisma.companies.findUnique({
        where: { id: companyId },
        select: { id: true, is_active: true, currency_id: true },
    })
    if (!company?.is_active) throw inputError('Company not found or inactive')
    return company
}

function shape(row) {
    return {
        ...row,
        entry_count: row._count?.journal_entries ?? 0,
        default_debit_account: row.chart_of_accounts_journals_default_debit_account_idTochart_of_accounts || null,
        default_credit_account: row.chart_of_accounts_journals_default_credit_account_idTochart_of_accounts || null,
        is_primary: PRIMARY_TYPES.has(row.journal_type),
    }
}

export const getAll = async (req, res) => {
    try {
        const companyId = toId(req.query.company_id)
        const activeOnly = String(req.query.active_only || '') === 'true' || String(req.query.active_only || '') === '1'
        const journalType = String(req.query.journal_type || '').trim()

        const rows = await prisma.journals.findMany({
            where: {
                ...(Number.isFinite(companyId) ? { company_id: companyId } : {}),
                ...(activeOnly ? { is_active: true } : {}),
                ...(JOURNAL_TYPES.includes(journalType) ? { journal_type: journalType } : {}),
            },
            include,
            orderBy: [{ company_id: 'asc' }, { code: 'asc' }],
        })
        res.status(200).json({ success: true, data: rows.map(shape) })
    } catch (error) {
        fail(res, error)
    }
}

export const getById = async (req, res) => {
    try {
        const data = await prisma.journals.findUnique({
            where: { id: parseInt(req.params.id, 10) },
            include,
        })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data: shape(data) })
    } catch (error) {
        fail(res, error)
    }
}

export const create = async (req, res) => {
    try {
        const payload = sanitize(req.body)
        await assertCompany(payload.company_id)
        await assertUniqueCode(payload.company_id, payload.code)
        await assertAccount(payload.company_id, payload.default_debit_account_id, 'Default debit account')
        await assertAccount(payload.company_id, payload.default_credit_account_id, 'Default credit account')

        if (payload.currency_id) {
            const currency = await prisma.currencies.findUnique({ where: { id: payload.currency_id } })
            if (!currency?.is_active) throw inputError('Currency is inactive or missing')
        }

        const data = await prisma.journals.create({ data: payload, include })
        res.status(201).json({ success: true, data: shape(data) })
    } catch (error) {
        if (error.code === 'P2002') return fail(res, inputError('Journal code already exists for this company'))
        fail(res, error)
    }
}

export const update = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)
        const existing = await prisma.journals.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' })

        const payload = sanitize({ ...existing, ...req.body, company_id: existing.company_id })
        // Never allow moving a journal to another company (breaks history).
        payload.company_id = existing.company_id

        // Do not allow lowering next_sequence below current (protects numbering continuity).
        if (payload.next_sequence < existing.next_sequence) {
            throw inputError(`Next sequence cannot be lower than the current value (${existing.next_sequence})`)
        }

        await assertUniqueCode(payload.company_id, payload.code, id)
        await assertAccount(payload.company_id, payload.default_debit_account_id, 'Default debit account')
        await assertAccount(payload.company_id, payload.default_credit_account_id, 'Default credit account')

        if (payload.currency_id) {
            const currency = await prisma.currencies.findUnique({ where: { id: payload.currency_id } })
            if (!currency?.is_active) throw inputError('Currency is inactive or missing')
        }

        const data = await prisma.journals.update({ where: { id }, data: payload, include })
        res.status(200).json({ success: true, data: shape(data) })
    } catch (error) {
        if (error.code === 'P2002') return fail(res, inputError('Journal code already exists for this company'))
        fail(res, error)
    }
}

export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)
        const existing = await prisma.journals.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' })

        const [entries, receipts, payments, invoices, bills, banks] = await Promise.all([
            prisma.journal_entries.count({ where: { journal_id: id } }),
            prisma.customer_receipts.count({ where: { journal_id: id } }),
            prisma.vendor_payments.count({ where: { journal_id: id } }),
            prisma.customer_invoices.count({ where: { journal_id: id } }),
            prisma.vendor_bills.count({ where: { journal_id: id } }),
            prisma.bank_accounts.count({ where: { journal_id: id } }),
        ])

        if (entries > 0 || receipts > 0 || payments > 0 || invoices > 0 || bills > 0 || banks > 0) {
            await prisma.journals.update({ where: { id }, data: { is_active: false } })
            return res.status(200).json({
                success: true,
                message: 'Journal is linked to historical transactions, so it was set to Inactive to preserve data.',
            })
        }

        await prisma.journals.delete({ where: { id } })
        return res.status(200).json({ success: true, message: 'Journal deleted successfully' })
    } catch (error) {
        if (error.code === 'P2003') {
            try {
                await prisma.journals.update({
                    where: { id: parseInt(req.params.id, 10) },
                    data: { is_active: false },
                })
                return res.status(200).json({
                    success: true,
                    message: 'Journal is linked in the system, so it was set to Inactive.',
                })
            } catch {
                return fail(res, inputError('This journal cannot be deleted because it is linked to other records.'))
            }
        }
        fail(res, error)
    }
}
