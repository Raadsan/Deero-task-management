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
        client: { select: { id: true, institution: true, email: true, phone: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        currencies: { select: { id: true, code: true, symbol: true } },
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
        currencies: true,
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
      date,
      valid_until,
      currency_id,
      notes,
      terms,
      lines = [],
      status = "DRAFT",
    } = req.body;

    if (!client_id && !customer_id) {
      return res.status(400).json({ success: false, message: "Client is required for quotation" });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: "At least one item is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Resolve client and accounting customer
      let resolvedClientId = client_id || null;
      let resolvedCustomerId = customer_id ? Number(customer_id) : null;
      let resolvedCompanyId = 1;

      if (resolvedClientId && !resolvedCustomerId) {
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

      const quotation_number = await generateQuotationNumber(tx);

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
        total = subtotal - totalDiscount + totalTax;
      }

      const updated = await tx.quotations.update({
        where: { id },
        data: {
          client_id: client_id !== undefined ? client_id : existing.client_id,
          customer_id: customer_id !== undefined ? (customer_id ? Number(customer_id) : null) : existing.customer_id,
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

    if (existing.status === "CONVERTED") {
      return res.status(400).json({ success: false, message: "Cannot delete a converted quotation" });
    }

    await prisma.quotations.delete({ where: { id } });
    await logAudit(req, "DELETE", "quotations", id, `Deleted quotation ${existing.quotation_number}`);
    res.json({ success: true, message: "Quotation deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// STEP 9 & STEP 20: ATOMIC CONVERSION TO INVOICE WITH JOURNAL ENTRY
export const convertQuotationToInvoice = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid quotation ID" });

    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotations.findUnique({
        where: { id },
        include: {
          lines: {
            include: { products: true, taxes: true },
            orderBy: { sequence: "asc" },
          },
          customer: true,
          client: true,
        },
      });

      if (!quotation) throw new Error("Quotation not found");
      if (quotation.status === "CONVERTED" && quotation.converted_invoice_id) {
        throw new Error("This quotation has already been converted to an invoice");
      }

      let customerId = quotation.customer_id;
      let companyId = quotation.company_id || 1;

      // Ensure customer exists
      if (!customerId && quotation.client) {
        let cust = await tx.customers.findFirst({
          where: { OR: [{ clientId: quotation.client.id }, { email: quotation.client.email }] },
        });
        if (!cust) {
          cust = await tx.customers.create({
            data: {
              company_id: companyId,
              name: quotation.client.institution || quotation.client.companyName || "Client",
              email: quotation.client.email || null,
              phone: quotation.client.phone || null,
              address: quotation.client.address || null,
              clientId: quotation.client.id,
            },
          });
        }
        customerId = cust.id;
        companyId = cust.company_id;
      }

      if (!customerId) {
        throw new Error("No linked accounting customer found for this quotation");
      }

      const customer = await tx.customers.findUnique({ where: { id: customerId } });
      if (!customer) throw new Error("Customer not found in accounting");

      // Find active sales journal (INV), receivable account (1200 / default), revenue account (4000)
      let journal = await tx.journals.findFirst({
        where: { company_id: companyId, journal_type: "sale", is_active: true },
      });
      if (!journal) {
        journal = await tx.journals.findFirst({
          where: { company_id: companyId, code: "INV" },
        });
      }
      if (!journal) {
        journal = await tx.journals.findFirst({ where: { is_active: true } });
      }
      if (!journal) throw new Error("No active sales journal found. Please configure journals first.");

      let arAccount = await tx.chart_of_accounts.findFirst({
        where: {
          company_id: companyId,
          code: { in: ["1200", "1100", "1000"] },
          is_active: true,
        },
      });
      if (!arAccount) {
        arAccount = await tx.chart_of_accounts.findFirst({
          where: { company_id: companyId, account_types: { internal_group: "asset" }, is_active: true },
        });
      }
      if (!arAccount) throw new Error("Accounts Receivable account not found in Chart of Accounts");

      let revenueAccount = await tx.chart_of_accounts.findFirst({
        where: {
          company_id: companyId,
          code: { in: ["4000", "4100", "4200"] },
          is_active: true,
        },
      });
      if (!revenueAccount) {
        revenueAccount = await tx.chart_of_accounts.findFirst({
          where: { company_id: companyId, account_types: { internal_group: "income" }, is_active: true },
        });
      }
      if (!revenueAccount) throw new Error("Sales Revenue account (4000) not found in Chart of Accounts");

      // Find open fiscal period
      const invoiceDate = new Date();
      let fiscalPeriod = await tx.fiscal_periods.findFirst({
        where: {
          state: "open",
          fiscal_years: { company_id: companyId, state: "open" },
          start_date: { lte: invoiceDate },
          end_date: { gte: invoiceDate },
        },
        orderBy: { period_number: "asc" },
      });

      // Generate invoice number INV-YYYY-MM-XXXX
      const year = invoiceDate.getFullYear();
      const month = String(invoiceDate.getMonth() + 1).padStart(2, "0");
      const prefix = `INV-${year}${month}-`;
      const lastInv = await tx.customer_invoices.findFirst({
        where: { invoice_number: { startsWith: prefix } },
        orderBy: { invoice_number: "desc" },
        select: { invoice_number: true },
      });
      let nextSeq = 1;
      if (lastInv?.invoice_number) {
        const parts = lastInv.invoice_number.split("-");
        const parsed = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(parsed)) nextSeq = parsed + 1;
      }
      const invoice_number = `${prefix}${String(nextSeq).padStart(4, "0")}`;

      const totalAmount = Number(quotation.total);
      const untaxedAmount = Number(quotation.subtotal) - Number(quotation.discount);
      const taxAmount = Number(quotation.tax);

      // 1. Create Invoice
      const invoice = await tx.customer_invoices.create({
        data: {
          company_id: companyId,
          document_type: "invoice",
          invoice_number,
          customer_id: customerId,
          client_id: quotation.client_id || null,
          journal_id: journal.id,
          fiscal_period_id: fiscalPeriod?.id || null,
          invoice_date: invoiceDate,
          due_date: quotation.valid_until || invoiceDate,
          currency_id: quotation.currency_id || 1,
          receivable_account_id: arAccount.id,
          customer_reference: quotation.quotation_number,
          state: "posted",
          payment_state: "not_paid",
          amount_untaxed: untaxedAmount,
          amount_tax: taxAmount,
          amount_total: totalAmount,
          paid_amount: 0,
          amount_due: totalAmount,
          notes: quotation.notes || `Converted from Quotation ${quotation.quotation_number}`,
          posted_at: invoiceDate,
        },
      });

      // 2. Create Invoice Lines
      for (let i = 0; i < quotation.lines.length; i++) {
        const line = quotation.lines[i];
        await tx.customer_invoice_lines.create({
          data: {
            invoice_id: invoice.id,
            sequence: line.sequence || (i + 1) * 10,
            product_id: line.product_id || null,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_id: line.tax_id || null,
            income_account_id: revenueAccount.id,
            subtotal: line.subtotal,
          },
        });
      }

      // 3. Create Double-Entry Journal Entry
      const entryNumber = `JE-INV-${invoice_number}`;
      const journalEntry = await tx.journal_entries.create({
        data: {
          company_id: companyId,
          journal_id: journal.id,
          entry_number: entryNumber,
          entry_date: invoiceDate,
          fiscal_period_id: fiscalPeriod?.id || null,
          reference: invoice_number,
          narration: `Invoice ${invoice_number} for customer ${customer.name} (Quotation ${quotation.quotation_number})`,
          state: "posted",
          source_type: "customer_invoice",
          source_id: invoice.id,
          posted_at: invoiceDate,
        },
      });

      // Dr Accounts Receivable
      await tx.journal_items.create({
        data: {
          entry_id: journalEntry.id,
          sequence: 10,
          account_id: arAccount.id,
          partner_type: "customer",
          partner_id: customer.id,
          label: `Receivable for ${invoice_number}`,
          debit: totalAmount,
          credit: 0,
          currency_id: quotation.currency_id || 1,
        },
      });

      // Cr Sales Revenue
      await tx.journal_items.create({
        data: {
          entry_id: journalEntry.id,
          sequence: 20,
          account_id: revenueAccount.id,
          label: `Sales Revenue for ${invoice_number}`,
          debit: 0,
          credit: untaxedAmount,
          currency_id: quotation.currency_id || 1,
        },
      });

      // Cr Tax Payable (if tax > 0)
      if (taxAmount > 0) {
        let taxAccount = await tx.chart_of_accounts.findFirst({
          where: {
            company_id: companyId,
            code: { in: ["2200", "2300", "2000"] },
            is_active: true,
          },
        });
        if (!taxAccount) {
          taxAccount = await tx.chart_of_accounts.findFirst({
            where: { company_id: companyId, account_types: { internal_group: "liability" }, is_active: true },
          });
        }
        if (taxAccount) {
          await tx.journal_items.create({
            data: {
              entry_id: journalEntry.id,
              sequence: 30,
              account_id: taxAccount.id,
              label: `Tax Payable for ${invoice_number}`,
              debit: 0,
              credit: taxAmount,
              currency_id: quotation.currency_id || 1,
            },
          });
        }
      }

      // Link Journal Entry to Invoice
      await tx.customer_invoices.update({
        where: { id: invoice.id },
        data: { journal_entry_id: journalEntry.id },
      });

      // 4. Update Quotation Status to CONVERTED
      const updatedQuotation = await tx.quotations.update({
        where: { id },
        data: {
          status: "CONVERTED",
          converted_invoice_id: invoice.id,
        },
      });

      return {
        quotation: updatedQuotation,
        invoice,
        journalEntry,
      };
    }, { maxWait: 10000, timeout: 30000 });

    await logAudit(
      req,
      "CONVERT",
      "quotations",
      id,
      `Converted Quotation ${id} to Invoice ${result.invoice.invoice_number}`
    );

    res.json({
      success: true,
      message: `Quotation converted to Invoice ${result.invoice.invoice_number}`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
