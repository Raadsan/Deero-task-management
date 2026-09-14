import fs from "fs";
import path from "path";
import { prisma } from "../../../../lib/prisma.js";
import { logAudit } from "../../../../utils/auditHelper.js";
import { resolvePublicTemplateUrl, saveTemplateBackground } from "../../../../lib/document-template-files.js";
import { generateQuotationPdfFromTemplate } from "./pdfQuotationService.js";

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
        client: { include: { portfolio: true } },
        customer: true,
      },
    });
    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

    // Parse rich metadata from notes first (stores contact details, items, template_id)
    let meta = null;
    try { meta = quotation.notes ? JSON.parse(quotation.notes) : null; } catch { meta = null; }

    // Fetch quotation template (selected template ID from metadata, or default, or latest)
    let customTemplate = null;
    if (meta?.template_id) {
      customTemplate = await prisma.document_templates.findUnique({
        where: { id: Number(meta.template_id) },
      });
    }
    if (!customTemplate) {
      customTemplate = await prisma.document_templates.findFirst({
        where: { type: "quotation", is_default: true },
      });
    }
    if (!customTemplate) {
      customTemplate = await prisma.document_templates.findFirst({
        where: { type: "quotation" },
        orderBy: { updated_at: "desc" },
      });
    }

    const contactPerson = meta?.contact_person || quotation.client?.contactPerson || "—";
    const contactEmail = meta?.contact_email || quotation.client?.email || "—";
    const contactPhone = meta?.contact_phone || quotation.client?.phone || "—";
    const quotationTo = meta?.quotation_to || quotation.client?.institution || quotation.customer?.name || "—";
    const quotationNo = quotation.quotation_number || "#DADVQT0000";
    const vatRate = meta?.vat_percent !== undefined ? Number(meta.vat_percent) : 5;
    const paymentAdvance = meta?.payment_advance || "70% of charge paid in advance.";
    const paymentCompletion = meta?.payment_completion || "30% of charge paid after the project Completion";
    const nbText = meta?.nb_text || meta?.nb || "NB: the advance amount should be paid when you get the invoice.";
    const quotationDate = new Date(quotation.date || quotation.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Build base URL for serving static assets
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Portfolio dynamic branding
    const branch = quotation.client?.portfolio;
    const isRaadsan = Boolean(branch?.name?.toLowerCase().includes("raadsan") || branch?.primaryColor?.toLowerCase() === "#0166d2");
    const primaryColor = branch?.primaryColor || (isRaadsan ? "#0166d2" : "#6e0002");
    const secondaryColor = branch?.secondaryColor || (isRaadsan ? "#fdc210" : "#ea580c");
    const companyTitle = branch?.name || "Deero Advertising Agency";
    const logoUrl = branch?.logoUrl
      ? `${baseUrl}${branch.logoUrl.startsWith("/") ? branch.logoUrl : `/${branch.logoUrl}`}`
      : `${baseUrl}/uploads/document-templates/deero-logo.png`;
    const footerUrl = `${baseUrl}/uploads/document-templates/deero-footer.png`;

    // Items rows from saved lines or meta items
    const displayItems = Array.isArray(meta?.items) && meta.items.length > 0
      ? meta.items
      : (quotation.lines || []).map((l) => ({
          service_type: l.products?.name || "Service",
          description: l.description || "",
          qty: Number(l.quantity || 1),
          rate: Number(l.unit_price || 0),
          is_free: Number(l.unit_price || 0) === 0,
          amount: Number(l.subtotal || 0),
        }));

    const subtotal = Number(quotation.subtotal || 0).toFixed(0);
    const tax = Number(quotation.tax || 0).toFixed(0);
    const grandTotal = Number(quotation.total || 0).toFixed(0);

    const itemsRows = displayItems.map((item, i) => {
      const isFree = Boolean(item.is_free || Number(item.rate || item.unit_price || 0) === 0);
      const rateStr = isFree ? "Free" : `$${Number(item.rate || item.unit_price || 0).toFixed(0)}`;
      const amountStr = isFree ? "Free" : `$${(Number(item.amount || item.subtotal) || Number(item.qty || item.quantity || 1) * Number(item.rate || item.unit_price || 0)).toFixed(0)}`;
      return `<tr style="background:#ffffff;">
        <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${i + 1}.</td>
        <td style="border:1px solid #ddd;padding:8px 10px;font-weight:700;font-size:12px;vertical-align:top;line-height:1.4;">${escapeHtml(item.service_type || "")}</td>
        <td style="border:1px solid #ddd;padding:8px 10px;white-space:pre-wrap;word-break:break-word;line-height:1.5;font-size:11.5px;vertical-align:top;">${escapeHtml(item.description || "—")}</td>
        <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${item.qty || item.quantity || 1}</td>
        <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${rateStr}</td>
        <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${amountStr}</td>
      </tr>`;
    }).join("");

    // Only use PDF overlay if template is explicitly a custom uploaded non-standard PDF document
    const isStandard = !customTemplate || customTemplate.name?.toLowerCase().includes("standard") || customTemplate.is_default;
    if (!isStandard && customTemplate?.file_url && customTemplate.file_url.toLowerCase().endsWith(".pdf")) {
      const cleanPath = customTemplate.file_url.replace(/^\//, "");
      const filePath = path.join(process.cwd(), cleanPath);
      if (fs.existsSync(filePath)) {
        const pdfBytes = await generateQuotationPdfFromTemplate(filePath, {
          contactPerson,
          quotationNo,
          contactEmail,
          quotationTo,
          contactPhone,
          date: quotationDate,
          validUntil: quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-US") : "",
          items: displayItems,
          subtotal,
          tax,
          grandTotal,
          vatPercent: vatRate,
          paymentAdvance,
          paymentCompletion,
          nb: nbText,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="Quotation-${quotation.quotation_number || quotationId}.pdf"`
        );
        return res.send(Buffer.from(pdfBytes));
      }
    }

    // If template has custom HTML content, render it with placeholders replaced
    if (customTemplate?.html_content) {
      const values = {
        company_name: companyTitle,
        company_address: branch?.location || "",
        company_phone: branch?.phone || "",
        client_name: quotationTo,
        client_address: quotation.client?.address || quotation.customer?.address || "",
        client_email: contactEmail,
        client_phone: contactPhone,
        contact_person: contactPerson,
        quotation_number: quotationNo,
        quotation_date: quotationDate,
        quotation_valid_until: quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-US") : "",
        subtotal: `$${subtotal}`,
        tax: `$${tax}`,
        discount: `$${Number(quotation.discount || 0).toFixed(0)}`,
        total: `$${grandTotal}`,
        terms: quotation.terms || "",
        notes: nbText,
        items: itemsRows,
      };
      const rendered = applyReplacements(customTemplate.html_content, values);
      return res.setHeader("Content-Type", "text/html").send(rendered);
    }

    // If template has visual placeholder overlay
    if (customTemplate?.placeholders && customTemplate?.file_url) {
      const values = {
        company_name: companyTitle,
        company_address: branch?.location || "",
        client_name: quotationTo,
        client_address: quotation.client?.address || quotation.customer?.address || "",
        client_email: contactEmail,
        client_phone: contactPhone,
        contact_person: contactPerson,
        quotation_number: quotationNo,
        quotation_date: quotationDate,
        quotation_valid_until: quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-US") : "",
        subtotal: `$${subtotal}`,
        tax: `$${tax}`,
        total: `$${grandTotal}`,
        notes: nbText,
        terms: quotation.terms || "",
      };
      const rendered = buildVisualTemplateHtml(customTemplate, req, values, itemsRows);
      return res.setHeader("Content-Type", "text/html").send(rendered);
    }

    const DEFAULT_PAYMENT_METHODS = [
      { label: "SomBank", value: "1001572624" },
      { label: "Premier Bank", value: "020602086001" },
      { label: "Salaam Bank", value: "36122269" },
      { label: "IBS Bank", value: "59676" },
      { label: "EVC-Plus", value: "0618553839" },
      { label: "E-DAHAB", value: "0628553566" },
    ];
    const pms = Array.isArray(meta?.payment_methods) && meta.payment_methods.length > 0
      ? meta.payment_methods
      : DEFAULT_PAYMENT_METHODS;
    const methodRows = [];
    for (let i = 0; i < pms.length; i += 3) {
      methodRows.push(pms.slice(i, i + 3));
    }
    if (methodRows.length === 0) methodRows.push([]);
    const padRowTo3 = (row) => {
      const copy = [...row];
      while (copy.length < 3) copy.push({ label: "", value: "" });
      return copy;
    };
    const methodRowspan = Math.max(1, methodRows.length) * 2;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quotation ${escapeHtml(quotationNo)} - Deero Advertising Agency</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: A4 portrait;
      margin: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #f4f4f4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: block; }
    .print-btn-bar {
      max-width: 210mm;
      margin: 16px auto 10px;
      display: flex;
      justify-content: flex-end;
    }
    .sheet-page {
      position: relative;
      width: 100%;
      max-width: 210mm;
      height: 297mm;
      max-height: 297mm;
      margin: 0 auto 30px;
      padding: 30px 36px 24px 36px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #fff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      width: 100%;
    }
    .badge-wrap {
      display: inline-flex;
      align-items: stretch;
      margin-right: -36px;
      height: 42px;
      line-height: 1;
      gap: 8px;
    }
    .badge-pill {
      background: ${primaryColor};
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      padding: 0 34px;
      border-radius: 24px 0 0 24px;
      letter-spacing: 0.5px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      border: 0;
    }
    .badge-sq {
      background: ${secondaryColor};
      width: 32px;
      height: 42px;
      display: block;
      margin: 0;
      border: 0;
    }
    .footer-box {
      margin-top: auto;
      padding-top: 14px;
      text-align: center;
      width: 100%;
    }
    .footer-img {
      max-width: 84%;
      height: auto;
      object-fit: contain;
      display: inline-block;
      margin: 0 auto;
    }
    @media print {
      body { background: #fff !important; }
      .print-btn-bar { display: none !important; }
      .sheet-page {
        margin: 0 auto !important;
        box-shadow: none !important;
        page-break-after: always;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar no-print">
    <button onclick="window.print()" style="background:${secondaryColor};color:#fff;border:none;padding:9px 20px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:7px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
      Print / Download PDF
    </button>
  </div>

  <div class="sheet-page">
    <div>
      <!-- HEADER: Logo + Quotation Badge (Flush to right) -->
      <div class="header-box">
        <img src="${logoUrl}" alt="${escapeHtml(companyTitle)}" style="height:74px;width:auto;object-fit:contain;" onerror="this.style.display='none'" />
        <div class="badge-wrap">
          <div class="badge-pill">Quotation</div>
          <div class="badge-sq"></div>
        </div>
      </div>

      <!-- CONTACT META TABLE -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #ddd;">
        <thead>
          <tr>
            <th style="background:${primaryColor};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;width:50%;border:1px solid #ddd;">Contact Person</th>
            <th style="background:${secondaryColor};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;width:50%;border:1px solid #ddd;">Quotation No</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 10px;font-size:11.5px;font-weight:500;border:1px solid #ddd;">${escapeHtml(contactPerson || "—")}</td>
            <td style="padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">${escapeHtml(quotationNo || "#DADVQT0000")}</td>
          </tr>
        </tbody>
        <thead>
          <tr>
            <th style="background:${primaryColor};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Contact Email</th>
            <th style="background:${secondaryColor};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Quotation To</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 10px;font-size:11.5px;color:#444;border:1px solid #ddd;">${escapeHtml(contactEmail || "—")}</td>
            <td style="padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">${escapeHtml(quotationTo || "—")}</td>
          </tr>
        </tbody>
        <thead>
          <tr>
            <th style="background:${primaryColor};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Contact Phone</th>
            <th style="background:${secondaryColor};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 10px;font-size:11.5px;font-weight:500;border:1px solid #ddd;">${escapeHtml(contactPhone || "—")}</td>
            <td style="padding:6px 10px;font-size:11.5px;border:1px solid #ddd;">${escapeHtml(quotationDate || "")}</td>
          </tr>
        </tbody>
      </table>

      <!-- SERVICES TABLE -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;margin-bottom:0;">
        <thead>
          <tr style="background:${secondaryColor};color:#fff;">
            <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:5%;">#</th>
            <th style="padding:6px 8px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:23%;">Service Type</th>
            <th style="padding:6px 8px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:43%;">Item(s)</th>
            <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:8%;">Qty</th>
            <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:10%;">Rate</th>
            <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:11%;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemsRows || `<tr><td colspan="6" style="padding:14px;text-align:center;font-size:11.5px;color:#888;border:1px solid #ddd;">No services added.</td></tr>`}</tbody>
      </table>

      <!-- TOTALS -->
      <div style="display:flex;justify-content:flex-end;margin-top:-1px;margin-bottom:16px;">
        <table style="border-collapse:collapse;width:38%;min-width:210px;border:1px solid #ddd;">
          <tr>
            <td style="background:${primaryColor};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:60%;">Subtotal</td>
            <td style="background:${primaryColor};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;text-align:right;border:1px solid #ddd;">$${subtotal}</td>
          </tr>
          <tr>
            <td style="background:${primaryColor};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">VAT ${vatRate}%</td>
            <td style="background:${primaryColor};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;text-align:right;border:1px solid #ddd;">$${tax}</td>
          </tr>
          <tr>
            <td style="background:${primaryColor};color:#fff;padding:6px 12px;font-size:12px;font-weight:700;border:1px solid #ddd;">Grand. Total</td>
            <td style="background:${primaryColor};color:#fff;padding:6px 12px;font-size:12px;font-weight:700;text-align:right;border:1px solid #ddd;">$${grandTotal}</td>
          </tr>
        </table>
      </div>

      <!-- PAYMENT TABLE (rows of 3 methods) -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ddd;">
        <thead>
          <tr>
            <th style="background:${primaryColor};color:#fff;text-align:center;padding:6px 8px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:35%;">Payment Structure</th>
            <th colspan="3" style="background:${secondaryColor};color:#fff;text-align:center;padding:6px 8px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:65%;">Payment Method</th>
          </tr>
        </thead>
        <tbody>
          ${methodRows.map((rawRow, rIdx) => {
            const row = padRowTo3(rawRow);
            const isFirst = rIdx === 0;
            return `
              <tr>
                ${isFirst ? `
                  <td rowspan="${methodRowspan}" style="padding:8px 10px;font-size:11px;line-height:1.6;border:1px solid #ddd;vertical-align:top;background:#fff;width:35%;">
                    <div>&bull; ${escapeHtml(paymentAdvance)}</div>
                    <div>&bull; ${escapeHtml(paymentCompletion)}</div>
                  </td>` : ''}
                ${row.map(pm => `
                  <th style="border:1px solid #ddd;background:#fafafa;color:#111;font-size:11px;font-weight:600;padding:4px 6px;text-align:center;width:21.67%;">
                    ${escapeHtml(pm.label || '&nbsp;')}
                  </th>`).join('')}
              </tr>
              <tr>
                ${row.map(pm => `
                  <td style="text-align:center;font-weight:600;font-size:11px;padding:5px;border:1px solid #ddd;color:#111;height:24px;">
                    ${escapeHtml(pm.value || '&nbsp;')}
                  </td>`).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- NB BANNER -->
      <div style="background:${primaryColor};color:#fff;text-align:center;padding:7px 12px;font-size:11.5px;font-weight:600;border:1px solid #ddd;margin-bottom:0;">
        ${escapeHtml(nbText)}
      </div>
    </div>

    <!-- FOOTER: Pinned to bottom of the A4 page -->
    <div class="footer-box">
      <img src="${footerUrl}" alt="Deero Contact Information" class="footer-img" onerror="this.style.display='none'" />
    </div>
  </div>
</body>
</html>`;

    res.send(html);
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
        customer_invoice_lines: { include: { products: true, taxes: true } },
        customers: true,
        client: { include: { portfolio: true } },
        payment_terms: true,
      },
    });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    // Parse rich metadata from notes if available
    let meta = null;
    try { meta = invoice.notes ? JSON.parse(invoice.notes) : null; } catch { meta = null; }

    let template = null;
    if (meta?.template_id) {
      template = await prisma.document_templates.findUnique({ where: { id: Number(meta.template_id) } });
    }
    if (!template) {
      template = await prisma.document_templates.findFirst({
        where: { type: "invoice", is_default: true },
      });
    }
    if (!template) {
      template = await prisma.document_templates.findFirst({ where: { type: "invoice" } });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Portfolio dynamic branding
    const branch = invoice.client?.portfolio;
    const isRaadsan = Boolean(branch?.name?.toLowerCase().includes("raadsan") || branch?.primaryColor?.toLowerCase() === "#0166d2");
    const primaryColor = branch?.primaryColor || (isRaadsan ? "#0166d2" : "#6e0002");
    const secondaryColor = branch?.secondaryColor || (isRaadsan ? "#fdc210" : "#ea580c");
    const companyTitle = branch?.name || "Deero Advertising Agency";
    const logoUrl = branch?.logoUrl
      ? `${baseUrl}${branch.logoUrl.startsWith("/") ? branch.logoUrl : `/${branch.logoUrl}`}`
      : `${baseUrl}/uploads/document-templates/deero-logo.png`;
    const footerUrl = `${baseUrl}/uploads/document-templates/deero-footer.png`;

    const contactPerson = meta?.contact_person || invoice.client?.contactPerson || invoice.customers?.contact_person || invoice.customers?.name || "—";
    const contactEmail = meta?.contact_email || invoice.client?.email || invoice.customers?.email || "—";
    const contactPhone = meta?.contact_phone || invoice.client?.phone || invoice.customers?.phone || "—";
    const invoiceTo = meta?.invoice_to || meta?.quotation_to || invoice.client?.institution || invoice.customers?.name || "—";
    const invoiceNo = invoice.invoice_number || `INV-${invoice.id}`;
    const invoiceDate = new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "—";

    const subtotalNum = Number(invoice.amount_untaxed || 0);
    const taxNum = Number(invoice.amount_tax || 0);
    const grandTotalNum = Number(invoice.amount_total || 0);

    const subtotal = subtotalNum.toFixed(0);
    const tax = taxNum.toFixed(0);
    const grandTotal = grandTotalNum.toFixed(0);

    const vatRate = meta?.vat_percent !== undefined
      ? Number(meta.vat_percent)
      : subtotalNum > 0 && taxNum > 0
      ? Math.round((taxNum / subtotalNum) * 100)
      : 5;

    const paymentAdvance = meta?.payment_advance || "70% of charge paid in advance.";
    const paymentCompletion = meta?.payment_completion || "30% of charge paid after the project Completion";
    const nbText = meta?.nb_text || meta?.nb || "NB: the advance amount should be paid when you get the invoice.";

    const paidNum = Number(invoice.paid_amount ?? (Number(invoice.amount_total) - Number(invoice.amount_due)));
    const paid = paidNum.toFixed(0);

    // Items rows from saved lines or meta items
    const displayItems = Array.isArray(meta?.items) && meta.items.length > 0
      ? meta.items
      : (invoice.customer_invoice_lines || []).map((l) => ({
          service_type: l.products?.name || "Service",
          description: l.description || "",
          qty: Number(l.quantity || 1),
          rate: Number(l.unit_price || 0),
          is_free: Number(l.unit_price || 0) === 0,
          amount: Number(l.subtotal || 0),
        }));

    const itemsRows = displayItems.map((item, i) => {
      const isFree = Boolean(item.is_free || Number(item.rate || item.unit_price || 0) === 0);
      const rateStr = isFree ? "Free" : `$${Number(item.rate || item.unit_price || 0).toFixed(0)}`;
      const amountStr = isFree ? "Free" : `$${(Number(item.amount || item.subtotal) || Number(item.qty || item.quantity || 1) * Number(item.rate || item.unit_price || 0)).toFixed(0)}`;
      const descLines = escapeHtml(item.description || "")
        .split("\n")
        .map((l) => {
          const isTl = l.toLowerCase().includes("timeline");
          return `<div style="${isTl ? "color:#dc2626;font-weight:700;margin-top:6px;" : "margin-top:2px;"}">${l}</div>`;
        })
        .join("");

      return `<tr style="background:#ffffff;">
        <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;vertical-align:top;font-size:12px;">${i + 1}.</td>
        <td style="border:1.5px solid #222;padding:8px 10px;font-weight:700;vertical-align:top;line-height:1.4;font-size:12px;">${escapeHtml(item.service_type || "")}</td>
        <td style="border:1.5px solid #222;padding:8px 10px;line-height:1.45;font-size:11.5px;vertical-align:top;word-break:break-word;">${descLines}</td>
        <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;vertical-align:top;font-size:12px;">${item.qty || item.quantity || 1}</td>
        <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;vertical-align:top;font-size:12px;color:${secondaryColor};">${rateStr}</td>
        <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;vertical-align:top;font-size:12px;color:${secondaryColor};">${amountStr}</td>
      </tr>`;
    }).join("");

    // If template has visual placeholder overlay
    if (template?.placeholders && template?.file_url) {
      const values = {
        company_name: companyTitle,
        company_address: branch?.location || "",
        client_name: invoiceTo,
        client_address: invoice.client?.address || invoice.customers?.address || "",
        client_email: contactEmail,
        client_phone: contactPhone,
        contact_person: contactPerson,
        invoice_number: invoiceNo,
        invoice_date: invoiceDate,
        invoice_due_date: dueDate,
        subtotal: `$${subtotal}`,
        tax: `$${tax}`,
        total: `$${grandTotal}`,
        notes: nbText,
      };
      const rendered = buildVisualTemplateHtml(template, req, values, itemsRows);
      return res.setHeader("Content-Type", "text/html").send(rendered);
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${escapeHtml(invoiceNo)} - Deero Advertising Agency</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111;
      background: #f4f4f4;
      font-size: 13px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: block; }

    /* Screen wrapper */
    .page-outer {
      padding: 20px;
    }
    .print-btn-bar {
      max-width: 820px;
      margin: 0 auto 12px;
      display: flex;
      justify-content: flex-end;
    }
    .page-sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border-radius: 3px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.10);
      overflow: hidden;
    }

    /* The wrapper table makes header/footer repeat on every print page */
    table.pw {
      width: 100%;
      border-collapse: collapse;
    }
    table.pw > thead > tr > td { padding: 20px 32px 14px 32px; }
    table.pw > tfoot > tr > td { padding: 14px 32px 18px 32px; }
    table.pw > tbody > tr > td { padding: 0 32px 20px 32px; }

    /* Invoice badge */
    .badge-wrap { display: inline-flex; align-items: stretch; margin-right: -32px; height: 42px; line-height: 1; }
    .badge-pill {
      background: ${primaryColor};
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      padding: 0 34px;
      border-radius: 24px 0 0 24px;
      letter-spacing: 0.5px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      border: 0;
    }
    .badge-sq { background: ${secondaryColor}; width: 28px; height: 42px; display: block; margin: 0; border: 0; }

    /* Info table */
    table.info-tbl { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #ddd; }
    table.info-tbl th { padding: 6px 10px; font-size: 11.5px; font-weight: 600; color: #fff; text-align: left; border: 1px solid #ddd; }
    table.info-tbl td { padding: 6px 10px; font-size: 11.5px; border: 1px solid #ddd; background: #fff; }
    .th-m { background: ${primaryColor}; }
    .th-o { background: ${secondaryColor}; }

    /* Items table */
    table.items-tbl { width: 100%; border-collapse: collapse; border: 1.5px solid #222; margin-bottom: 0; }
    table.items-tbl thead th { background: ${secondaryColor}; color: #fff; padding: 6px 6px; font-size: 11.5px; font-weight: 700; text-align: center; border: 1.5px solid #222; }
    table.items-tbl tbody td { border: 1.5px solid #222; background: #fff; vertical-align: top; padding: 6px 8px; font-size: 11.5px; }

    @media print {
      @page { size: A4 portrait; margin: 0mm; }
      body { background: #fff !important; }
      .page-outer { padding: 14mm 14mm 12mm 14mm !important; }
      .print-btn-bar { display: none !important; }
      .page-sheet { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tbody { display: table-row-group; }
    }
  </style>
</head>
<body>
<div class="page-outer">
  <div class="print-btn-bar no-print">
    <button onclick="window.print()" style="background:${secondaryColor};color:#fff;border:none;padding:8px 18px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
      Print / Download PDF
    </button>
  </div>

  <div class="page-sheet">
    <table class="pw">
      <!-- ===== HEADER (repeats on every print page) ===== -->
      <thead>
        <tr><td>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <img src="${logoUrl}" alt="${escapeHtml(companyTitle)}" style="height:74px;width:auto;object-fit:contain;" onerror="this.style.display='none'" />
            <div class="badge-wrap">
              <div class="badge-pill">Invoice</div>
              <div class="badge-sq"></div>
            </div>
          </div>
        </td></tr>
      </thead>

      <!-- ===== FOOTER (repeats on every print page) ===== -->
      <tfoot>
        <tr><td style="text-align:center;padding-top:16px;">
          <img src="${footerUrl}" alt="Deero Contact Footer" style="max-width:84%;height:auto;object-fit:contain;display:inline-block;margin:0 auto;" onerror="this.style.display='none'" />
        </td></tr>
      </tfoot>

      <!-- ===== MAIN CONTENT ===== -->
      <tbody>
        <tr><td>

          <!-- Contact & Meta -->
          <table class="info-tbl">
            <thead><tr>
              <th class="th-m" style="width:50%;">Contact Person</th>
              <th class="th-o" style="width:50%;">Invoice No</th>
            </tr></thead>
            <tbody><tr>
              <td style="font-weight:600;">${escapeHtml(contactPerson)}</td>
              <td style="font-weight:700;">${escapeHtml(invoiceNo)}</td>
            </tr></tbody>
            <thead><tr>
              <th class="th-m">Contact Email</th>
              <th class="th-o">Invoice To</th>
            </tr></thead>
            <tbody><tr>
              <td style="color:#555;">${escapeHtml(contactEmail)}</td>
              <td style="font-weight:700;">${escapeHtml(invoiceTo)}</td>
            </tr></tbody>
            <thead><tr>
              <th class="th-m">Contact Phone</th>
              <th class="th-o">Date</th>
            </tr></thead>
            <tbody><tr>
              <td style="font-weight:600;">${escapeHtml(contactPhone)}</td>
              <td>${escapeHtml(invoiceDate)}</td>
            </tr></tbody>
          </table>

          <!-- Services / Items -->
          <table class="items-tbl">
            <thead><tr>
              <th style="width:5%;">#</th>
              <th style="width:22%;">Service Type</th>
              <th style="width:43%;">Item(s)</th>
              <th style="width:10%;">Qua</th>
              <th style="width:10%;">Rate</th>
              <th style="width:10%;">Amount</th>
            </tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>

          <!-- Stamp & Totals -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;margin-bottom:14px;position:relative;">
            <!-- Blue Stamp on Left -->
            <div style="padding-left:16px;position:relative;z-index:10;">
              <img src="${baseUrl}/uploads/document-templates/deero-stamp.svg" alt="Deero Official Stamp" style="width:138px;height:138px;object-fit:contain;opacity:0.95;transform:rotate(-12deg);margin-top:-8px;" onerror="this.style.display='none'" />
            </div>

            <!-- Totals Table on Right matching Screenshot -->
            <table style="border-collapse:collapse;width:40%;min-width:240px;border:1.5px solid #222;">
              <tr>
                <td style="background:#fff;color:#111;padding:6px 12px;font-size:12px;font-weight:700;border:1.5px solid #222;width:55%;">Subtotal</td>
                <td style="background:#fff;color:#111;padding:6px 12px;font-size:12px;font-weight:700;text-align:right;border:1.5px solid #222;">$${subtotal}</td>
              </tr>
              ${
                taxNum > 0
                  ? `<tr>
                      <td style="background:#fff;color:#111;padding:5px 12px;font-size:11.5px;font-weight:600;border:1.5px solid #222;">VAT ${vatRate}%</td>
                      <td style="background:#fff;color:#111;padding:5px 12px;font-size:11.5px;font-weight:600;text-align:right;border:1.5px solid #222;">$${tax}</td>
                    </tr>`
                  : ""
              }
              <tr>
                <td style="background:${primaryColor};color:#fff;padding:6px 12px;font-size:12px;font-weight:800;border:1.5px solid #222;letter-spacing:0.5px;">PAID</td>
                <td style="background:${primaryColor};color:#fff;padding:6px 12px;font-size:12px;font-weight:800;text-align:right;border:1.5px solid #222;">$${paid}</td>
              </tr>
              <tr>
                <td style="background:${secondaryColor};color:#fff;padding:6px 12px;font-size:12.5px;font-weight:800;border:1.5px solid #222;letter-spacing:0.5px;">Total Amount</td>
                <td style="background:${secondaryColor};color:#fff;padding:6px 12px;font-size:12.5px;font-weight:800;text-align:right;border:1.5px solid #222;">$${grandTotal}</td>
              </tr>
            </table>
          <!-- Payment -->
          <table class="pay-tbl">
            <thead>
              <tr>
                <th class="pay-th-m" style="width:40%;">Payment Structure</th>
                <th class="pay-th-o" colspan="3">Payment Method</th>
              </tr>
              <tr>
                <th class="pay-th-sub" style="border:1px solid #ddd;"></th>
                <th class="pay-th-sub" style="border:1px solid #ddd;">Premier Bank</th>
                <th class="pay-th-sub" style="border:1px solid #ddd;">Salaam Bank</th>
                <th class="pay-th-sub" style="border:1px solid #ddd;">IBS Bank</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowspan="2" style="vertical-align:top;line-height:1.7;padding:8px 12px;">
                  <div>• ${escapeHtml(paymentAdvance)}</div>
                  <div>• ${escapeHtml(paymentCompletion)}</div>
                </td>
                <td style="text-align:center;font-weight:700;">020602086001</td>
                <td style="text-align:center;font-weight:700;">36122269</td>
                <td style="text-align:center;font-weight:700;">59676</td>
              </tr>
              <tr>
                <td colspan="2" style="text-align:center;">EVC-Plus: <strong>0618553839</strong></td>
                <td style="text-align:center;">E-DAHAB: <strong>0628553566</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- NB Banner -->
          <div class="nb-banner">${escapeHtml(nbText)}</div>

        </td></tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Live PDF preview on user's real template paper
export const previewQuotationPdf = async (req, res) => {
  try {
    const {
      templateId,
      contactPerson,
      quotationNo,
      contactEmail,
      quotationTo,
      contactPhone,
      date,
      validUntil,
      items,
      subtotal,
      tax,
      grandTotal,
      vatPercent,
      paymentAdvance,
      paymentCompletion,
      nb,
    } = req.body;

    let template = null;
    if (templateId) {
      template = await prisma.document_templates.findUnique({ where: { id: Number(templateId) } });
    }
    if (!template) {
      template = await prisma.document_templates.findFirst({
        where: { type: "quotation", is_default: true },
      });
    }
    if (!template) {
      template = await prisma.document_templates.findFirst({
        where: { type: "quotation" },
        orderBy: { updated_at: "desc" },
      });
    }

    if (!template?.file_url || !template.file_url.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ success: false, message: "Template is not an uploaded PDF document" });
    }

    const cleanPath = template.file_url.replace(/^\//, "");
    const filePath = path.join(process.cwd(), cleanPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Template PDF file not found on disk" });
    }

    const pdfBytes = await generateQuotationPdfFromTemplate(filePath, {
      contactPerson,
      quotationNo,
      contactEmail,
      quotationTo,
      contactPhone,
      date,
      validUntil,
      items,
      subtotal,
      tax,
      grandTotal,
      vatPercent,
      paymentAdvance,
      paymentCompletion,
      nb,
    });

    res.setHeader("Content-Type", "application/pdf");
    return res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Failed to generate preview PDF:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
