import prisma from '../../../../config/db.js'

export const getAll = async (req, res) => {
    try {
        const data = await prisma.chart_of_accounts.findMany()
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const getById = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.chart_of_accounts.findUnique({ where: { id: parseInt(id) } })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const create = async (req, res) => {
    try {
        const data = await prisma.chart_of_accounts.create({ data: req.body })
        res.status(201).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const update = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.chart_of_accounts.update({ where: { id: parseInt(id) }, data: req.body })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id)
        const account = await prisma.chart_of_accounts.findUnique({ where: { id } })
        if (!account) return res.status(404).json({ success: false, message: 'Account not found' })

        // Check if there are child accounts
        const childrenCount = await prisma.chart_of_accounts.count({ where: { parent_id: id } })
        if (childrenCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Akoon-kan waxa ku hoos jira ${childrenCount} akoon oo kale. Fadlan marka hore tiri ama bedel akoonada hoos yimaada.`
            })
        }

        // Check if there are journal transactions linked
        const journalItemsCount = await prisma.journal_items.count({ where: { account_id: id } })
        const invoiceLinesCount = await prisma.customer_invoice_lines.count({ where: { income_account_id: id } })
        const billLinesCount = await prisma.vendor_bill_lines.count({ where: { expense_account_id: id } })

        // If there are journal items or invoices, hard delete would corrupt the ledger, so deactivate it!
        if (journalItemsCount > 0 || invoiceLinesCount > 0 || billLinesCount > 0) {
            await prisma.chart_of_accounts.update({
                where: { id },
                data: { is_active: false }
            })
            return res.status(200).json({
                success: true,
                message: `Akoon-ka waxa ku xidhan macaamilo hore, sidaas darteed waxa laga dhigay mid aan shaqaynaynin (Inactive) si xogtaadu u xafidnaato.`
            })
        }

        // If linked only to products or taxes, safely unlink before deleting
        await prisma.products.updateMany({ where: { income_account_id: id }, data: { income_account_id: null } })
        await prisma.products.updateMany({ where: { expense_account_id: id }, data: { expense_account_id: null } })
        await prisma.taxes.updateMany({ where: { tax_account_id: id }, data: { tax_account_id: null } })
        await prisma.bank_accounts.updateMany({ where: { gl_account_id: id }, data: { gl_account_id: null } })
        await prisma.payment_methods.updateMany({ where: { gl_account_id: id }, data: { gl_account_id: null } })

        await prisma.chart_of_accounts.delete({ where: { id } })
        return res.status(200).json({ success: true, message: 'Account deleted successfully' })
    } catch (error) {
        console.error('Account delete error:', error)
        // If foreign key constraint still triggered, deactivate it cleanly
        if (error.code === 'P2003') {
            try {
                await prisma.chart_of_accounts.update({
                    where: { id: parseInt(req.params.id) },
                    data: { is_active: false }
                })
                return res.status(200).json({
                    success: true,
                    message: `Akoon-ka waxa ku xidhan nidaamka, sidaas darteed waxa laga dhigay mid aan shaqaynaynin (Inactive).`
                })
            } catch {
                return res.status(400).json({
                    success: false,
                    message: `Akoon-kan lama tiri karo sababtoo ah waxa ku xidhan xog kale oo nidaamka ah.`
                })
            }
        }
        res.status(500).json({ success: false, message: error.message || 'Unable to delete account' })
    }
}
