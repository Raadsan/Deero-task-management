import prisma from '../../../../config/db.js'

export const getAll = async (req, res) => {
    try {
        const data = await prisma.taxes.findMany()
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const getById = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.taxes.findUnique({ where: { id: parseInt(id) } })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const create = async (req, res) => {
    try {
        let payload = { ...req.body }
        if (!payload.tax_account_id) {
            const defaultTaxAcc = await prisma.chart_of_accounts.findFirst({
                where: { OR: [{ code: '2100' }, { name: { contains: 'Tax' } }], is_active: true }
            })
            if (defaultTaxAcc) payload.tax_account_id = defaultTaxAcc.id
        }
        const data = await prisma.taxes.create({ data: payload })
        res.status(201).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const update = async (req, res) => {
    try {
        const { id } = req.params
        let payload = { ...req.body }
        if (!payload.tax_account_id) {
            const existing = await prisma.taxes.findUnique({ where: { id: parseInt(id) } })
            if (!existing?.tax_account_id) {
                const defaultTaxAcc = await prisma.chart_of_accounts.findFirst({
                    where: { OR: [{ code: '2100' }, { name: { contains: 'Tax' } }], is_active: true }
                })
                if (defaultTaxAcc) payload.tax_account_id = defaultTaxAcc.id
            }
        }
        const data = await prisma.taxes.update({ where: { id: parseInt(id) }, data: payload })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const remove = async (req, res) => {
    try {
        const { id } = req.params
        await prisma.taxes.delete({ where: { id: parseInt(id) } })
        res.status(200).json({ success: true, message: 'Deleted successfully' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}
