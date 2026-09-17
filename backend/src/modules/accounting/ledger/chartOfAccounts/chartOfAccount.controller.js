import prisma from '../../../../config/db.js'

const accountInclude = {
    account_types: { select: { id: true, name: true, internal_group: true, normal_balance: true, report_type: true } },
    chart_of_accounts: { select: { id: true, code: true, name: true } },
    other_chart_of_accounts: { select: { id: true, code: true, name: true, is_active: true } },
    companies: { select: { id: true, name: true } },
    currencies: { select: { id: true, code: true, name: true, symbol: true } },
    _count: { select: { journal_items: true, other_chart_of_accounts: true } },
}

const fail = (res, status, message) => res.status(status).json({ success: false, message })

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

function sanitizePayload(body = {}) {
    const company_id = toId(body.company_id)
    const account_type_id = toId(body.account_type_id)
    const parent_id = body.parent_id === null || body.parent_id === '' || body.parent_id === undefined
        ? null
        : toId(body.parent_id)
    const currency_id = body.currency_id === null || body.currency_id === '' || body.currency_id === undefined
        ? null
        : toId(body.currency_id)

    if (!Number.isFinite(company_id)) throw Object.assign(new Error('Company is required'), { status: 400 })
    if (!Number.isFinite(account_type_id)) throw Object.assign(new Error('Account type is required'), { status: 400 })
    if (parent_id !== null && !Number.isFinite(parent_id)) throw Object.assign(new Error('Parent account is invalid'), { status: 400 })
    if (currency_id !== null && !Number.isFinite(currency_id)) throw Object.assign(new Error('Currency is invalid'), { status: 400 })

    const code = String(body.code || '').trim()
    const name = String(body.name || '').trim()
    if (!code) throw Object.assign(new Error('Account code is required'), { status: 400 })
    if (!name) throw Object.assign(new Error('Account name is required'), { status: 400 })
    if (code.length > 16) throw Object.assign(new Error('Account code must be 16 characters or fewer'), { status: 400 })
    if (name.length > 128) throw Object.assign(new Error('Account name must be 128 characters or fewer'), { status: 400 })

    return {
        company_id,
        code,
        name,
        account_type_id,
        parent_id,
        currency_id,
        is_reconcilable: toBool(body.is_reconcilable, false),
        allow_manual_entry: toBool(body.allow_manual_entry, true),
        is_active: toBool(body.is_active, true),
        notes: body.notes == null || String(body.notes).trim() === '' ? null : String(body.notes).trim(),
    }
}

async function assertUniqueCode(companyId, code, excludeId = null) {
    const existing = await prisma.chart_of_accounts.findFirst({
        where: {
            company_id: companyId,
            code,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, name: true },
    })
    if (existing) {
        throw Object.assign(
            new Error(`Account code ${code} already exists for this company (${existing.name})`),
            { status: 400 },
        )
    }
}

async function assertValidParent({ companyId, accountTypeId, parentId, accountId = null }) {
    if (!parentId) return null
    if (accountId && parentId === accountId) {
        throw Object.assign(new Error('An account cannot be its own parent'), { status: 400 })
    }

    const parent = await prisma.chart_of_accounts.findUnique({
        where: { id: parentId },
        select: { id: true, company_id: true, account_type_id: true, is_active: true, code: true, name: true, parent_id: true },
    })
    if (!parent) throw Object.assign(new Error('Parent account not found'), { status: 400 })
    if (parent.company_id !== companyId) {
        throw Object.assign(new Error('Parent account must belong to the same company'), { status: 400 })
    }
    if (parent.account_type_id !== accountTypeId) {
        throw Object.assign(new Error('Parent account must have the same account type'), { status: 400 })
    }

    // Walk ancestors to prevent circular parent-child relationships.
    let currentId = parentId
    const visited = new Set()
    while (currentId) {
        if (accountId && currentId === accountId) {
            throw Object.assign(new Error('Circular parent-child relationship is not allowed'), { status: 400 })
        }
        if (visited.has(currentId)) {
            throw Object.assign(new Error('Circular parent-child relationship is not allowed'), { status: 400 })
        }
        visited.add(currentId)
        const node = await prisma.chart_of_accounts.findUnique({
            where: { id: currentId },
            select: { parent_id: true },
        })
        currentId = node?.parent_id || null
    }

    return parent
}

async function syncParentPostingFlags(parentId) {
    if (!parentId) return
    const childCount = await prisma.chart_of_accounts.count({ where: { parent_id: parentId } })
    if (childCount > 0) {
        await prisma.chart_of_accounts.update({
            where: { id: parentId },
            data: { allow_manual_entry: false },
        })
    }
}

function shapeAccount(row) {
    const childCount = row._count?.other_chart_of_accounts ?? row.other_chart_of_accounts?.length ?? 0
    const isParent = childCount > 0
    return {
        ...row,
        is_parent: isParent,
        has_children: isParent,
        allow_posting: Boolean(row.allow_manual_entry) && !isParent,
        child_count: childCount,
        journal_item_count: row._count?.journal_items ?? 0,
        parent: row.chart_of_accounts || null,
        children: row.other_chart_of_accounts || [],
    }
}

export const getAll = async (req, res) => {
    try {
        const companyId = toId(req.query.company_id)
        const postingOnly = String(req.query.posting_only || '') === 'true' || String(req.query.posting_only || '') === '1'
        const activeOnly = String(req.query.active_only || '') === 'true' || String(req.query.active_only || '') === '1'

        const rows = await prisma.chart_of_accounts.findMany({
            where: {
                ...(Number.isFinite(companyId) ? { company_id: companyId } : {}),
                ...(activeOnly ? { is_active: true } : {}),
            },
            include: accountInclude,
            orderBy: [{ company_id: 'asc' }, { code: 'asc' }],
        })

        let data = rows.map(shapeAccount)
        if (postingOnly) {
            data = data.filter((row) => row.allow_posting && row.is_active)
        }

        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error.status || 500, error.message)
    }
}

export const getById = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)
        const data = await prisma.chart_of_accounts.findUnique({ where: { id }, include: accountInclude })
        if (!data) return fail(res, 404, 'Not found')
        res.status(200).json({ success: true, data: shapeAccount(data) })
    } catch (error) {
        fail(res, error.status || 500, error.message)
    }
}

export const create = async (req, res) => {
    try {
        const payload = sanitizePayload(req.body)

        const [company, accountType] = await Promise.all([
            prisma.companies.findUnique({ where: { id: payload.company_id }, select: { id: true, is_active: true } }),
            prisma.account_types.findUnique({ where: { id: payload.account_type_id }, select: { id: true } }),
        ])
        if (!company?.is_active) throw Object.assign(new Error('Company not found or inactive'), { status: 400 })
        if (!accountType) throw Object.assign(new Error('Account type not found'), { status: 400 })

        await assertUniqueCode(payload.company_id, payload.code)
        await assertValidParent({
            companyId: payload.company_id,
            accountTypeId: payload.account_type_id,
            parentId: payload.parent_id,
        })

        // Parents with children must not be posting accounts.
        if (payload.parent_id && payload.allow_manual_entry) {
            // Creating a child under a parent — parent will lose posting rights after create.
        }

        const created = await prisma.chart_of_accounts.create({ data: payload, include: accountInclude })
        await syncParentPostingFlags(payload.parent_id)

        const refreshed = await prisma.chart_of_accounts.findUnique({ where: { id: created.id }, include: accountInclude })
        res.status(201).json({ success: true, data: shapeAccount(refreshed) })
    } catch (error) {
        if (error.code === 'P2002') return fail(res, 400, 'Account code already exists for this company')
        fail(res, error.status || 500, error.message)
    }
}

export const update = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)
        const existing = await prisma.chart_of_accounts.findUnique({
            where: { id },
            include: { _count: { select: { other_chart_of_accounts: true } } },
        })
        if (!existing) return fail(res, 404, 'Not found')

        const payload = sanitizePayload({ ...existing, ...req.body })
        const previousParentId = existing.parent_id

        if (payload.company_id !== existing.company_id) {
            throw Object.assign(new Error('Company cannot be changed for an existing account'), { status: 400 })
        }

        const accountType = await prisma.account_types.findUnique({
            where: { id: payload.account_type_id },
            select: { id: true },
        })
        if (!accountType) throw Object.assign(new Error('Account type not found'), { status: 400 })

        await assertUniqueCode(payload.company_id, payload.code, id)
        await assertValidParent({
            companyId: payload.company_id,
            accountTypeId: payload.account_type_id,
            parentId: payload.parent_id,
            accountId: id,
        })

        const childCount = existing._count.other_chart_of_accounts
        if (childCount > 0 && payload.allow_manual_entry) {
            throw Object.assign(
                new Error('Parent accounts with child accounts cannot allow posting. Disable Allow Manual Entries or remove children first.'),
                { status: 400 },
            )
        }

        const updated = await prisma.chart_of_accounts.update({
            where: { id },
            data: payload,
            include: accountInclude,
        })

        if (previousParentId && previousParentId !== payload.parent_id) {
            await syncParentPostingFlags(previousParentId)
        }
        await syncParentPostingFlags(payload.parent_id)

        const refreshed = await prisma.chart_of_accounts.findUnique({ where: { id: updated.id }, include: accountInclude })
        res.status(200).json({ success: true, data: shapeAccount(refreshed) })
    } catch (error) {
        if (error.code === 'P2002') return fail(res, 400, 'Account code already exists for this company')
        fail(res, error.status || 500, error.message)
    }
}

export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)
        const account = await prisma.chart_of_accounts.findUnique({ where: { id } })
        if (!account) return fail(res, 404, 'Account not found')

        const childrenCount = await prisma.chart_of_accounts.count({ where: { parent_id: id } })
        if (childrenCount > 0) {
            return fail(
                res,
                400,
                `This account has ${childrenCount} child account(s). Reassign or remove children before deleting.`,
            )
        }

        const journalItemsCount = await prisma.journal_items.count({ where: { account_id: id } })
        const invoiceLinesCount = await prisma.customer_invoice_lines.count({ where: { income_account_id: id } })
        const billLinesCount = await prisma.vendor_bill_lines.count({ where: { expense_account_id: id } })

        // Preserve ledger integrity: deactivate instead of delete when used.
        if (journalItemsCount > 0 || invoiceLinesCount > 0 || billLinesCount > 0) {
            await prisma.chart_of_accounts.update({
                where: { id },
                data: { is_active: false, allow_manual_entry: false },
            })
            return res.status(200).json({
                success: true,
                message: 'Account is linked to transactions, so it was set to Inactive to preserve historical data.',
            })
        }

        await prisma.products.updateMany({ where: { income_account_id: id }, data: { income_account_id: null } })
        await prisma.products.updateMany({ where: { expense_account_id: id }, data: { expense_account_id: null } })
        await prisma.taxes.updateMany({ where: { tax_account_id: id }, data: { tax_account_id: null } })
        await prisma.bank_accounts.updateMany({ where: { gl_account_id: id }, data: { gl_account_id: null } })
        await prisma.payment_methods.updateMany({ where: { gl_account_id: id }, data: { gl_account_id: null } })

        await prisma.chart_of_accounts.delete({ where: { id } })
        await syncParentPostingFlags(account.parent_id)

        return res.status(200).json({ success: true, message: 'Account deleted successfully' })
    } catch (error) {
        console.error('Account delete error:', error)
        if (error.code === 'P2003') {
            try {
                await prisma.chart_of_accounts.update({
                    where: { id: parseInt(req.params.id, 10) },
                    data: { is_active: false, allow_manual_entry: false },
                })
                return res.status(200).json({
                    success: true,
                    message: 'Account is linked in the system, so it was set to Inactive.',
                })
            } catch {
                return fail(res, 400, 'This account cannot be deleted because it is linked to other records.')
            }
        }
        fail(res, error.status || 500, error.message || 'Unable to delete account')
    }
}
