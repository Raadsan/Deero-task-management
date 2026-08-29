import { prisma } from "../../../../lib/prisma.js";
import { logAudit } from "../../../../utils/auditHelper.js";
import { resolvePublicTemplateUrl, saveTemplateBackground } from "../../../../lib/document-template-files.js";

const DEFAULT_QUOTATION_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; margin: 0; padding: 40px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #5b1017; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { max-height: 60px; }
    .company-title { font-size: 24px; font-weight: bold; color: #5b1017; margin: 0; }
    .doc-title { font-size: 28px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin: 0; }
    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .meta-box { width: 48%; }
    .meta-box h4 { margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-box p { margin: 2px 0; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #5b1017; color: #fff; text-align: left; padding: 10px 14px; font-size: 13px; text-transform: uppercase; }
    td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .totals-area { display: flex; justify-content: flex-end; }
    .totals-table { width: 320px; }
    .totals-table td { padding: 6px 12px; }
    .totals-table .grand-total { font-size: 16px; font-weight: bold; color: #5b1017; border-top: 2px solid #5b1017; }
    .footer-notes { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="company-title">{{company_name}}</h1>
      <p style="margin: 4px 0; font-size: 13px; color: #64748b;">{{company_address}}</p>
    </div>
    <div style="text-align: right;">
      <h2 class="doc-title">QUOTATION</h2>
      <p style="margin: 4px 0; font-weight: bold; color: #5b1017;">{{quotation_number}}</p>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h4>Quotation For</h4>
      <p style="font-weight: bold; font-size: 16px;">{{client_name}}</p>
      <p>{{client_address}}</p>
      <p>{{client_email}} | {{client_phone}}</p>
    </div>
    <div class="meta-box" style="text-align: right;">
      <h4>Details</h4>
      <p><strong>Date:</strong> {{quotation_date}}</p>
      <p><strong>Valid Until:</strong> {{quotation_valid_until}}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Item & Description</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <div class="totals-area">
    <table class="totals-table">
      <tr>
        <td>Subtotal:</td>
        <td style="text-align: right;">{{subtotal}}</td>
      </tr>
      <tr>
        <td>Discount:</td>
        <td style="text-align: right;">-{{discount}}</td>
      </tr>
      <tr>
        <td>Tax:</td>
        <td style="text-align: right;">{{tax}}</td>
      </tr>
      <tr class="grand-total">
        <td>Total:</td>
        <td style="text-align: right;">{{total}}</td>
      </tr>
    </table>
  </div>

  <div class="footer-notes">
    <p><strong>Terms & Conditions:</strong> {{terms}}</p>
    <p><strong>Notes:</strong> {{notes}}</p>
  </div>
</body>
</html>
`;

const DEFAULT_INVOICE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; margin: 0; padding: 40px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
    .company-title { font-size: 24px; font-weight: bold; color: #1e293b; margin: 0; }
    .doc-title { font-size: 28px; font-weight: 800; color: #5b1017; text-transform: uppercase; margin: 0; }
    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .meta-box { width: 48%; }
    .meta-box h4 { margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-box p { margin: 2px 0; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #1e293b; color: #fff; text-align: left; padding: 10px 14px; font-size: 13px; text-transform: uppercase; }
    td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .totals-area { display: flex; justify-content: flex-end; }
    .totals-table { width: 320px; }
    .totals-table td { padding: 6px 12px; }
    .totals-table .grand-total { font-size: 16px; font-weight: bold; color: #1e293b; border-top: 2px solid #1e293b; }
    .footer-notes { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="company-title">{{company_name}}</h1>
      <p style="margin: 4px 0; font-size: 13px; color: #64748b;">{{company_address}}</p>
    </div>
    <div style="text-align: right;">
      <h2 class="doc-title">INVOICE</h2>
      <p style="margin: 4px 0; font-weight: bold; color: #5b1017;">{{invoice_number}}</p>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h4>Billed To</h4>
      <p style="font-weight: bold; font-size: 16px;">{{client_name}}</p>
      <p>{{client_address}}</p>
      <p>{{client_email}} | {{client_phone}}</p>
    </div>
    <div class="meta-box" style="text-align: right;">
      <h4>Invoice Info</h4>
      <p><strong>Invoice Date:</strong> {{invoice_date}}</p>
      <p><strong>Due Date:</strong> {{invoice_due_date}}</p>
      <p><strong>Ref Quotation:</strong> {{quotation_number}}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Item & Description</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <div class="totals-area">
    <table class="totals-table">
      <tr>
        <td>Subtotal:</td>
        <td style="text-align: right;">{{subtotal}}</td>
      </tr>
      <tr>
        <td>Discount:</td>
        <td style="text-align: right;">-{{discount}}</td>
      </tr>
      <tr>
        <td>Tax:</td>
        <td style="text-align: right;">{{tax}}</td>
      </tr>
      <tr class="grand-total">
        <td>Total:</td>
        <td style="text-align: right;">{{total}}</td>
      </tr>
      <tr>
        <td>Amount Paid:</td>
        <td style="text-align: right; color: #16a34a;">{{amount_paid}}</td>
      </tr>
      <tr style="font-weight: bold; font-size: 15px;">
        <td>Balance Due:</td>
        <td style="text-align: right; color: #dc2626;">{{balance_due}}</td>
      </tr>
    </table>
  </div>

  <div class="footer-notes">
    <p><strong>Payment Terms:</strong> {{payment_terms}}</p>
    <p><strong>Notes:</strong> {{notes}}</p>
  </div>
</body>
</html>
`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyReplacements(content, values) {
  let output = content;
  for (const [key, value] of Object.entries(values)) {
    output = output.replace(new RegExp(`{{${key}}}`, "g"), escapeHtml(value));
  }
  return output;
}

function buildItemsTableHtml(itemsHtml) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #5b1017;">Item & Description</th>
          <th style="text-align:center;padding:8px 10px;border-bottom:2px solid #5b1017;">Qty</th>
          <th style="text-align:right;padding:8px 10px;border-bottom:2px solid #5b1017;">Unit Price</th>
          <th style="text-align:right;padding:8px 10px;border-bottom:2px solid #5b1017;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  `;
}

function buildVisualTemplateHtml(template, req, values, itemsHtml) {
  const backgroundUrl = resolvePublicTemplateUrl(template.file_url, req);
  const fields = Array.isArray(template.placeholders) ? template.placeholders : [];
  const fieldHtml = fields.map((field) => {
    const key = String(field.key || "").replace(/[{}]/g, "");
    const left = Number(field.x ?? 5);
    const top = Number(field.y ?? 5);
    const width = Number(field.width ?? 30);
    const fontSize = Number(field.fontSize ?? 13);
    const fontWeight = field.fontWeight || "normal";
    const color = field.color || "#1e293b";

    if (field.isTable || key === "items") {
      return `
        <div style="position:absolute;left:${left}%;top:${top}%;width:${width}%;color:${color};font-size:${fontSize}px;">
          ${buildItemsTableHtml(itemsHtml)}
        </div>
      `;
    }

    const content = values[key] ?? "";
    return `
      <div style="position:absolute;left:${left}%;top:${top}%;width:${width}%;font-size:${fontSize}px;font-weight:${fontWeight};color:${color};line-height:1.35;white-space:pre-wrap;">
        ${escapeHtml(content)}
      </div>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 0; }
    body { margin: 0; background: #fff; }
    .page {
      position: relative;
      width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      background: url('${backgroundUrl}') no-repeat top center;
      background-size: cover;
    }
  </style>
</head>
<body>
  <div class="page">${fieldHtml}</div>
</body>
</html>`;
}

export const uploadTemplateBackground = async (req, res) => {
  try {
    const { dataUrl, fileName } = req.body || {};
    if (!dataUrl) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const file_url = await saveTemplateBackground(dataUrl, fileName);
    res.json({ success: true, data: { file_url } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export async function ensureDefaultDocumentTemplates() {
  const count = await prisma.document_templates.count();
  if (count === 0) {
    await prisma.document_templates.createMany({
      data: [
        {
          name: "Standard Quotation Template",
          type: "quotation",
          html_content: DEFAULT_QUOTATION_HTML,
          is_default: true,
        },
        {
          name: "Standard Invoice Template",
          type: "invoice",
          html_content: DEFAULT_INVOICE_HTML,
          is_default: true,
        },
      ],
    });
  }
}

export const getAllTemplates = async (req, res) => {
  try {
    await ensureDefaultDocumentTemplates();
    const { type } = req.query;
    const where = type ? { type } : {};
    const templates = await prisma.document_templates.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTemplateById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const template = await prisma.document_templates.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const { name, type, file_url, html_content, is_default, placeholders } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, message: "Name and type are required" });
    }

    if (is_default) {
      await prisma.document_templates.updateMany({
        where: { type },
        data: { is_default: false },
      });
    }

    const template = await prisma.document_templates.create({
      data: {
        name,
        type,
        file_url: file_url || null,
        html_content: file_url ? null : (html_content || (type === "quotation" ? DEFAULT_QUOTATION_HTML : DEFAULT_INVOICE_HTML)),
        is_default: is_default ?? false,
        placeholders: placeholders || null,
      },
    });

    await logAudit(req, "CREATE", "document_templates", template.id, `Created template ${name}`);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, type, file_url, html_content, is_default, placeholders } = req.body;

    if (is_default && type) {
      await prisma.document_templates.updateMany({
        where: { type },
        data: { is_default: false },
      });
    }

    const template = await prisma.document_templates.update({
      where: { id },
      data: {
        name,
        type,
        file_url,
        html_content: file_url ? null : html_content,
        is_default,
        placeholders,
      },
    });

    await logAudit(req, "UPDATE", "document_templates", id, `Updated template ${name}`);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.document_templates.delete({ where: { id } });
    await logAudit(req, "DELETE", "document_templates", id, `Deleted template ${id}`);
    res.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Render Quotation HTML with dynamic data
export const renderQuotationDocument = async (req, res) => {
  try {
    const quotationId = Number(req.params.id);
    const quotation = await prisma.quotations.findUnique({
      where: { id: quotationId },
      include: {
        lines: { include: { products: true, taxes: true } },
        client: true,
        customer: true,
      },
    });
    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

    // Fetch active template
    let template = await prisma.document_templates.findFirst({
      where: { type: "quotation", is_default: true },
    });
    if (!template) {
      template = await prisma.document_templates.findFirst({ where: { type: "quotation" } });
    }
    const htmlTemplate = template?.html_content || DEFAULT_QUOTATION_HTML;

    // Fetch company info
    const company = await prisma.companies.findFirst({ where: { is_active: true } });

    // Generate table items rows
    const itemsHtml = quotation.lines.map((l) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(l.description)}</strong></td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${Number(l.quantity)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">$${Number(l.unit_price).toFixed(2)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">$${Number(l.subtotal).toFixed(2)}</td>
      </tr>
    `).join("");

    const clientName = quotation.client?.institution || quotation.client?.companyName || quotation.customer?.name || "Client";
    const clientAddress = quotation.client?.address || quotation.customer?.address || "";
    const clientEmail = quotation.client?.email || quotation.customer?.email || "";
    const clientPhone = quotation.client?.phone || quotation.customer?.phone || "";

    const values = {
      company_name: company?.name || "Deero Management",
      company_address: company?.address || "Mogadishu, Somalia",
      company_logo: "",
      quotation_number: quotation.quotation_number,
      quotation_date: new Date(quotation.date).toLocaleDateString(),
      quotation_valid_until: quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : "N/A",
      client_name: clientName,
      client_address: clientAddress,
      client_email: clientEmail,
      client_phone: clientPhone,
      subtotal: `$${Number(quotation.subtotal).toFixed(2)}`,
      discount: `$${Number(quotation.discount).toFixed(2)}`,
      tax: `$${Number(quotation.tax).toFixed(2)}`,
      total: `$${Number(quotation.total).toFixed(2)}`,
      terms: quotation.terms || "Standard business terms apply.",
      notes: quotation.notes || "Thank you for your business!",
    };

    if (template?.file_url && template?.placeholders) {
      return res.send(buildVisualTemplateHtml(template, req, values, itemsHtml));
    }

    const rendered = applyReplacements(htmlTemplate, values)
      .replace(/{{items}}/g, itemsHtml);

    res.send(rendered);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Render Invoice HTML with dynamic data
export const renderInvoiceDocument = async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const invoice = await prisma.customer_invoices.findUnique({
      where: { id: invoiceId },
      include: {
        customer_invoice_lines: true,
        customers: true,
        client: true,
        payment_terms: true,
      },
    });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    let template = await prisma.document_templates.findFirst({
      where: { type: "invoice", is_default: true },
    });
    if (!template) {
      template = await prisma.document_templates.findFirst({ where: { type: "invoice" } });
    }
    const htmlTemplate = template?.html_content || DEFAULT_INVOICE_HTML;

    const company = await prisma.companies.findFirst({ where: { is_active: true } });

    const itemsHtml = invoice.customer_invoice_lines.map((l) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(l.description)}</strong></td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${Number(l.quantity)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">$${Number(l.unit_price).toFixed(2)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">$${Number(l.subtotal).toFixed(2)}</td>
      </tr>
    `).join("");

    const clientName = invoice.client?.institution || invoice.client?.companyName || invoice.customers?.name || "Client";
    const clientAddress = invoice.client?.address || invoice.customers?.address || "";
    const clientEmail = invoice.client?.email || invoice.customers?.email || "";
    const clientPhone = invoice.client?.phone || invoice.customers?.phone || "";

    const values = {
      company_name: company?.name || "Deero Management",
      company_address: company?.address || "Mogadishu, Somalia",
      company_logo: "",
      invoice_number: invoice.invoice_number || `INV-${invoice.id}`,
      invoice_date: new Date(invoice.invoice_date).toLocaleDateString(),
      invoice_due_date: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A",
      quotation_number: invoice.customer_reference || "N/A",
      client_name: clientName,
      client_address: clientAddress,
      client_email: clientEmail,
      client_phone: clientPhone,
      subtotal: `$${Number(invoice.amount_untaxed).toFixed(2)}`,
      discount: "$0.00",
      tax: `$${Number(invoice.amount_tax).toFixed(2)}`,
      total: `$${Number(invoice.amount_total).toFixed(2)}`,
      amount_paid: `$${Number(invoice.paid_amount).toFixed(2)}`,
      balance_due: `$${Number(invoice.amount_due).toFixed(2)}`,
      payment_terms: invoice.payment_terms?.name || "Due on receipt",
      notes: invoice.notes || "Thank you for your business!",
    };

    if (template?.file_url && template?.placeholders) {
      return res.send(buildVisualTemplateHtml(template, req, values, itemsHtml));
    }

    const rendered = applyReplacements(htmlTemplate, values)
      .replace(/{{items}}/g, itemsHtml);

    res.send(rendered);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
