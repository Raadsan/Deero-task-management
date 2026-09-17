import { prisma } from "../../../../lib/prisma.js";
import { generateCustomId } from "../../../../lib/id-generator.js";
import { logAudit } from "../../../../utils/auditHelper.js";

// Generate unique quotation number QT-YYYY-MM-XXXX
async function generateQuotationNumber(tx = prisma) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `QT-${year}${month}-`;
  
  const lastQuotation = await tx.quotations.findFirst({
    where: { quotation_number: { startsWith: prefix } },
    orderBy: { quotation_number: "desc" },
    select: { quotation_number: true },
  });

  let seq = 1;
  if (lastQuotation?.quotation_number) {
    const parts = lastQuotation.quotation_number.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export const getAllQuotations = async (req, res) => {
  try {
    const { status, clientId, customerId, search } = req.query;
    const where = {};

    if (status) where.status = status;
    if (clientId) where.client_id = clientId;
    if (customerId) where.customer_id = Number(customerId);
    if (search) {
      where.OR = [
        { quotation_number: { contains: search } },
        { client: { institution: { contains: search } } },
        { customer: { name: { contains: search } } },
      ];
    }

    const items = await prisma.quotations.findMany({
      where,
      include: {
        client: { select: { id: true, institution: true, contactPerson: true, email: true, phone: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        converted_invoice: { select: { id: true, invoice_number: true, state: true, payment_state: true, amount_total: true } },
        lines: {
          include: {
            products: { select: { id: true, name: true, sku: true } },
            taxes: { select: { id: true, name: true, rate_percent: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid quotation ID" });

    const quotation = await prisma.quotations.findUnique({
      where: { id },
      include: {
        client: true,
        customer: true,
        converted_invoice: {
          include: {
            customer_invoice_lines: true,
            customer_receipts: true,
          },
        },
        lines: {
          include: {
            products: true,
            taxes: true,
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

    res.json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createQuotation = async (req, res) => {
  try {
    const {
      client_id,
      customer_id,
      quotation_to,
      client_name,
      contact_person,
      contact_email,
      contact_phone,
      date,
      valid_until,
      currency_id,
      notes,
      terms,
      lines = [],
      status = "DRAFT",
      quotation_number: customQuotationNumber,
    } = req.body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: "At least one item is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Resolve client and accounting customer
      let resolvedClientId = client_id || null;
      let resolvedCustomerId = customer_id ? Number(customer_id) : null;
      let resolvedCompanyId = 1;

      // Check if a manual client name was provided (either directly or in notes JSON)
      let manualClientName = (quotation_to || client_name || "").trim();
      if (!manualClientName && notes) {
        try {
          const parsed = JSON.parse(notes);
          if (parsed.quotation_to) manualClientName = parsed.quotation_to.trim();
        } catch {}
      }

      if (!resolvedClientId && !resolvedCustomerId && manualClientName) {
        const company = await tx.companies.findFirst({ where: { is_active: true } });
        resolvedCompanyId = company ? company.id : 1;
        let cust = await tx.customers.findFirst({
          where: { name: manualClientName },
        });
        if (!cust) {
          cust = await tx.customers.create({
            data: {
              company_id: resolvedCompanyId,
              name: manualClientName,
              email: contact_email?.trim() || null,
              phone: contact_phone?.trim() || null,
            },
          });
        }
        resolvedCustomerId = cust.id;
        resolvedCompanyId = cust.company_id;
      } else if (resolvedClientId && !resolvedCustomerId) {
        const client = await tx.client.findUnique({ where: { id: resolvedClientId } });
        if (client) {
          // Look up or auto-provision accounting customer
          let cust = await tx.customers.findFirst({
            where: { OR: [{ clientId: client.id }, { email: client.email }] },
          });
          if (!cust) {
            const company = await tx.companies.findFirst({ where: { is_active: true } });
            resolvedCompanyId = company ? company.id : 1;
            cust = await tx.customers.create({
              data: {
                company_id: resolvedCompanyId,
                name: client.institution || client.companyName || "Client",
                email: client.email || null,
                phone: client.phone || null,
                address: client.address || null,
                clientId: client.id,
              },
            });
          }
          resolvedCustomerId = cust.id;
          resolvedCompanyId = cust.company_id;
        }
      } else if (resolvedCustomerId) {
        const cust = await tx.customers.findUnique({ where: { id: resolvedCustomerId } });
        if (cust) {
          resolvedCompanyId = cust.company_id;
          if (cust.clientId) resolvedClientId = cust.clientId;
        }
      }

      const quotation_number = customQuotationNumber?.trim() || (await generateQuotationNumber(tx));

      // Compute totals
      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      const preparedLines = [];
      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const qty = Number(item.quantity || 1);
        const price = Number(item.unit_price || 0);
        const discPercent = Number(item.discount_percent || 0);
        const rawSubtotal = qty * price;
        const discAmount = (rawSubtotal * discPercent) / 100;
        const lineSubtotal = rawSubtotal - discAmount;

        let taxAmount = 0;
        if (item.tax_id) {
          const taxRecord = await tx.taxes.findUnique({ where: { id: Number(item.tax_id) } });
          if (taxRecord) {
            taxAmount = (lineSubtotal * Number(taxRecord.rate_percent)) / 100;
          }
        }

        subtotal += rawSubtotal;
        totalDiscount += discAmount;
        totalTax += taxAmount;

        preparedLines.push({
          sequence: (i + 1) * 10,
          product_id: item.product_id ? Number(item.product_id) : null,
          description: String(item.description || item.name || "Item"),
          quantity: qty,
          unit_price: price,
          discount_percent: discPercent,
          tax_id: item.tax_id ? Number(item.tax_id) : null,
          subtotal: lineSubtotal + taxAmount,
        });
      }

      // Check vat_percent from request body or notes metadata
      let vatPercent = Number(req.body.vat_percent || 0);
      if (!vatPercent && notes) {
        try {
          const parsed = JSON.parse(notes);
          if (parsed.vat_percent) vatPercent = Number(parsed.vat_percent);
        } catch {}
      }
      if (totalTax === 0 && vatPercent > 0) {
        totalTax = Math.round(((subtotal - totalDiscount) * (vatPercent / 100)) * 100) / 100;
      }

      const total = subtotal - totalDiscount + totalTax;

      const quotation = await tx.quotations.create({
        data: {
          company_id: resolvedCompanyId,
          quotation_number,
          client_id: resolvedClientId,
          customer_id: resolvedCustomerId,
          date: date ? new Date(date) : new Date(),
          valid_until: valid_until ? new Date(valid_until) : null,
          currency_id: currency_id ? Number(currency_id) : 1,
          status,
          subtotal,
          discount: totalDiscount,
          tax: totalTax,
          total,
          notes: notes || null,
          terms: terms || null,
          lines: {
            create: preparedLines,
          },
        },
        include: {
          lines: true,
          client: true,
          customer: true,
        },
      });

      return quotation;
    });

    await logAudit(req, "CREATE", "quotations", result.id, `Created quotation ${result.quotation_number}`);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid quotation ID" });

    const existing = await prisma.quotations.findUnique({ where: { id }, include: { lines: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Quotation not found" });

    if (existing.status === "CONVERTED") {
      return res.status(400).json({ success: false, message: "Converted quotations cannot be modified" });
    }

    const {
      client_id,
      customer_id,
      date,
      valid_until,
      currency_id,
      status,
      notes,
      terms,
      lines,
      quotation_number: customQuotationNumber,
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      let subtotal = Number(existing.subtotal);
      let totalDiscount = Number(existing.discount);
      let totalTax = Number(existing.tax);
      let total = Number(existing.total);

      if (Array.isArray(lines)) {
        await tx.quotation_lines.deleteMany({ where: { quotation_id: id } });

        subtotal = 0;
        totalDiscount = 0;
        totalTax = 0;
        const preparedLines = [];

        for (let i = 0; i < lines.length; i++) {
          const item = lines[i];
          const qty = Number(item.quantity || 1);
          const price = Number(item.unit_price || 0);
          const discPercent = Number(item.discount_percent || 0);
          const rawSubtotal = qty * price;
          const discAmount = (rawSubtotal * discPercent) / 100;
          const lineSubtotal = rawSubtotal - discAmount;

          let taxAmount = 0;
          if (item.tax_id) {
            const taxRecord = await tx.taxes.findUnique({ where: { id: Number(item.tax_id) } });
            if (taxRecord) {
              taxAmount = (lineSubtotal * Number(taxRecord.rate_percent)) / 100;
            }
          }

          subtotal += rawSubtotal;
          totalDiscount += discAmount;
          totalTax += taxAmount;

          preparedLines.push({
            quotation_id: id,
            sequence: (i + 1) * 10,
            product_id: item.product_id ? Number(item.product_id) : null,
            description: String(item.description || item.name || "Item"),
            quantity: qty,
            unit_price: price,
            discount_percent: discPercent,
            tax_id: item.tax_id ? Number(item.tax_id) : null,
            subtotal: lineSubtotal + taxAmount,
          });
        }

        await tx.quotation_lines.createMany({ data: preparedLines });

        // Check vat_percent from request body or notes metadata
        let vatPercent = Number(req.body.vat_percent || 0);
        if (!vatPercent && (notes || existing.notes)) {
          try {
            const parsed = JSON.parse(notes || existing.notes);
            if (parsed.vat_percent) vatPercent = Number(parsed.vat_percent);
          } catch {}
        }
        if (totalTax === 0 && vatPercent > 0) {
          totalTax = Math.round(((subtotal - totalDiscount) * (vatPercent / 100)) * 100) / 100;
        }

        total = subtotal - totalDiscount + totalTax;
      }

      let resolvedCustomerId = customer_id !== undefined ? (customer_id ? Number(customer_id) : null) : existing.customer_id;
      let resolvedClientId = client_id !== undefined ? client_id : existing.client_id;

      let manualClientName = (req.body.quotation_to || req.body.client_name || "").trim();
      if (!manualClientName && notes) {
        try {
          const parsed = JSON.parse(notes);
          if (parsed.quotation_to) manualClientName = parsed.quotation_to.trim();
        } catch {}
      }

      if (!resolvedClientId && !resolvedCustomerId && manualClientName) {
        const company = await tx.companies.findFirst({ where: { is_active: true } });
        const resolvedCompanyId = company ? company.id : (existing.company_id || 1);
        let cust = await tx.customers.findFirst({
          where: { name: manualClientName },
        });
        if (!cust) {
          cust = await tx.customers.create({
            data: {
              company_id: resolvedCompanyId,
              name: manualClientName,
              email: req.body.contact_email?.trim() || null,
              phone: req.body.contact_phone?.trim() || null,
            },
          });
        }
        resolvedCustomerId = cust.id;
      }

      const updated = await tx.quotations.update({
        where: { id },
        data: {
          client_id: resolvedClientId,
          customer_id: resolvedCustomerId,
          quotation_number: customQuotationNumber?.trim() || existing.quotation_number,
          date: date ? new Date(date) : existing.date,
          valid_until: valid_until !== undefined ? (valid_until ? new Date(valid_until) : null) : existing.valid_until,
          currency_id: currency_id ? Number(currency_id) : existing.currency_id,
          status: status || existing.status,
          subtotal,
          discount: totalDiscount,
          tax: totalTax,
          total,
          notes: notes !== undefined ? notes : existing.notes,
          terms: terms !== undefined ? terms : existing.terms,
        },
        include: {
          lines: true,
          client: true,
          customer: true,
        },
      });

      return updated;
    });

    await logAudit(req, "UPDATE", "quotations", id, `Updated quotation ${result.quotation_number}`);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid quotation ID" });

    const existing = await prisma.quotations.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Quotation not found" });

    if (existing.status === "CONVERTED" || existing.converted_invoice_id) {
      return res.status(400).json({ success: false, message: "Cannot delete a quotation that has been invoiced" });
    }

    await prisma.quotations.delete({ where: { id } });
    await logAudit(req, "DELETE", "quotations", id, `Deleted quotation ${existing.quotation_number}`);
    res.json({ success: true, message: "Quotation deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Accepted quotations available for invoice import (not yet linked to an invoice). */
export const getAcceptedForInvoice = async (req, res) => {
  try {
    const companyId = req.query.company_id ? Number(req.query.company_id) : null
    const where = {
      status: 'ACCEPTED',
      converted_invoice_id: null,
      ...(companyId ? { company_id: companyId } : {}),
    }
    const items = await prisma.quotations.findMany({
      where,
      include: {
        client: { select: { id: true, institution: true, contactPerson: true, email: true, phone: true } },
        customer: { select: { id: true, name: true, email: true, phone: true, company_id: true } },
        lines: {
          include: {
            products: { select: { id: true, name: true, sku: true } },
            taxes: { select: { id: true, name: true, rate_percent: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    })
    res.json({ success: true, data: items })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * Accept a quotation for later invoicing.
 * Does NOT create an invoice, journal entry, or receipt.
 */
export const acceptQuotation = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: 'Invalid quotation ID' })

    const quotation = await prisma.quotations.findUnique({
      where: { id },
      include: {
        client: true,
        customer: true,
        converted_invoice: { select: { id: true, invoice_number: true, state: true } },
      },
    })
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' })
    if (quotation.converted_invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'This quotation is already linked to invoice ' + (quotation.converted_invoice?.invoice_number || quotation.converted_invoice_id),
      })
    }
    if (['REJECTED', 'EXPIRED'].includes(quotation.status)) {
      return res.status(400).json({ success: false, message: 'Cannot accept a ' + quotation.status.toLowerCase() + ' quotation' })
    }

    // Ensure an accounting customer exists so the invoice form can select it later.
    let customerId = quotation.customer_id
    const companyId = quotation.company_id || quotation.customer?.company_id || 1
    if (!customerId && quotation.client) {
      const orFilters = [{ clientId: quotation.client.id }]
      if (quotation.client.email) orFilters.push({ email: quotation.client.email })
      let cust = await prisma.customers.findFirst({ where: { OR: orFilters } })
      if (!cust) {
        cust = await prisma.customers.create({
          data: {
            company_id: companyId,
            name: quotation.client.institution || quotation.client.companyName || 'Client',
            email: quotation.client.email || null,
            phone: quotation.client.phone || null,
            address: quotation.client.address || null,
            clientId: quotation.client.id,
          },
        })
      }
      customerId = cust.id
    }

    const updated = await prisma.quotations.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        ...(customerId ? { customer_id: customerId } : {}),
      },
      include: {
        client: { select: { id: true, institution: true, contactPerson: true, email: true, phone: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        lines: true,
      },
    })

    await logAudit(req, 'ACCEPT', 'quotations', id, 'Accepted quotation ' + updated.quotation_number + ' (available for invoice import)')
    res.json({
      success: true,
      message: 'Quotation accepted. Import it from the Invoice form when ready — no invoice was created yet.',
      data: updated,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/** @deprecated Use acceptQuotation — kept as alias so old clients do not auto-create invoices. */
export const convertQuotationToInvoice = acceptQuotation
