import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Stamps live quotation data onto the uploaded template PDF.
 * This reads the user's actual uploaded template file from disk and
 * overlays the form data with pixel-accurate coordinates.
 */
export async function generateQuotationPdfFromTemplate(templatePath, data) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found at: ${templatePath}`);
  }

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error("Template PDF has no pages");
  }
  const page = pages[0];

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textBlack = rgb(0.12, 0.12, 0.14);
  const textWhite = rgb(1, 1, 1);
  const maroonColor = rgb(110 / 255, 0 / 255, 2 / 255);
  const orangeColor = rgb(234 / 255, 88 / 255, 12 / 255);

  // 1. Header Information
  // Contact Person (x: 54.6, y: 722)
  if (data.contactPerson) {
    const text = String(data.contactPerson).slice(0, 42);
    page.drawText(text, {
      x: 54.6,
      y: 722,
      size: 8.5,
      font: fontBold,
      color: textBlack,
    });
  }

  // Quotation No (x: 257.3, y: 722)
  if (data.quotationNo) {
    const text = String(data.quotationNo).slice(0, 30);
    page.drawText(text, {
      x: 257.3,
      y: 722,
      size: 9,
      font: fontBold,
      color: textBlack,
    });
  }

  // Contact Email (x: 54.6, y: 686)
  if (data.contactEmail) {
    const text = String(data.contactEmail).slice(0, 44);
    page.drawText(text, {
      x: 54.6,
      y: 686,
      size: 8,
      font: fontRegular,
      color: textBlack,
    });
  }

  // Quotation To (x: 257.3, y: 686)
  if (data.quotationTo) {
    const text = String(data.quotationTo).slice(0, 46);
    page.drawText(text, {
      x: 257.3,
      y: 686,
      size: 9,
      font: fontBold,
      color: textBlack,
    });
  }

  // Contact Phone (x: 54.6, y: 650)
  if (data.contactPhone) {
    const text = String(data.contactPhone).slice(0, 36);
    page.drawText(text, {
      x: 54.6,
      y: 650,
      size: 8.5,
      font: fontRegular,
      color: textBlack,
    });
  }

  // Date (x: 257.3, y: 650)
  if (data.date) {
    const text = String(data.date).slice(0, 45);
    page.drawText(text, {
      x: 257.3,
      y: 650,
      size: 8.5,
      font: fontRegular,
      color: textBlack,
    });
  }

  // 2. Line Items
  const items = Array.isArray(data.items) ? data.items : [];
  let currentY = 590;
  const rowStep = 16.5;

  items.forEach((item, idx) => {
    // Prevent overlapping below table boundary (totals sit on the right, but keep table neat)
    if (currentY < 538) return;

    // Number # (column centered ~ x: 57)
    const numStr = `${idx + 1}.`;
    page.drawText(numStr, {
      x: 54,
      y: currentY,
      size: 8,
      font: fontBold,
      color: textBlack,
    });

    // Service Type (x: 72, col width ~95)
    const serviceType = String(item.service_type || "").slice(0, 24);
    page.drawText(serviceType, {
      x: 72,
      y: currentY,
      size: 7.5,
      font: fontBold,
      color: textBlack,
    });

    // Item(s) Description (x: 172, col width ~220)
    const rawDesc = String(item.description || "").replace(/[\r\n]+/g, " ").trim();
    const desc = rawDesc.length > 56 ? `${rawDesc.slice(0, 54)}...` : rawDesc;
    page.drawText(desc, {
      x: 172,
      y: currentY,
      size: 7,
      font: fontRegular,
      color: textBlack,
    });

    // Qty (centered in col x: 396 to 440)
    const qtyStr = String(item.qty ?? item.quantity ?? 1);
    const qtyWidth = fontBold.widthOfTextAtSize(qtyStr, 8);
    page.drawText(qtyStr, {
      x: 396 + (44 - qtyWidth) / 2,
      y: currentY,
      size: 8,
      font: fontBold,
      color: textBlack,
    });

    // Rate (centered in col x: 440 to 485)
    const isFree = Boolean(item.is_free || Number(item.rate || item.unit_price || 0) === 0);
    const rateStr = isFree ? "Free" : `$${Number(item.rate || item.unit_price || 0).toFixed(0)}`;
    const rateWidth = fontBold.widthOfTextAtSize(rateStr, 7.5);
    page.drawText(rateStr, {
      x: 440 + (45 - rateWidth) / 2,
      y: currentY,
      size: 7.5,
      font: fontBold,
      color: textBlack,
    });

    // Amount (centered in col x: 485 to 546)
    const rawAmount = Number(item.amount ?? item.subtotal);
    const calcAmount = !isNaN(rawAmount) && rawAmount > 0
      ? rawAmount
      : Number(item.qty ?? 1) * Number(item.rate ?? 0);
    const amountStr = isFree ? "Free" : `$${calcAmount.toFixed(0)}`;
    const amountWidth = fontBold.widthOfTextAtSize(amountStr, 7.5);
    page.drawText(amountStr, {
      x: 485 + (61 - amountWidth) / 2,
      y: currentY,
      size: 7.5,
      font: fontBold,
      color: textBlack,
    });

    currentY -= rowStep;
  });

  // 3. Totals (Right side column x: 486.35 to 546.37)
  const totalsBoxX = 486.35;
  const totalsBoxWidth = 60.02;

  // Subtotal (y: 575 in template)
  if (data.subtotal != null) {
    const subtotalStr = `$${Number(data.subtotal).toFixed(0)}`;
    const strWidth = fontBold.widthOfTextAtSize(subtotalStr, 8);
    page.drawText(subtotalStr, {
      x: totalsBoxX + (totalsBoxWidth - strWidth) / 2,
      y: 572,
      size: 8,
      font: fontBold,
      color: textWhite,
    });
  }

  // VAT Rate & Amount (y: 559 in template)
  const vatRate = data.vatPercent !== undefined ? Number(data.vatPercent) : 5;
  // If VAT rate is NOT 5%, update the VAT label in the maroon box (x: 401.5, y: 559.1)
  if (vatRate !== 5) {
    // Cover the default "VAT 5%" label with maroon box and draw updated text
    page.drawRectangle({
      x: 397,
      y: 553,
      width: 89,
      height: 14,
      color: maroonColor,
    });
    page.drawText(`VAT ${vatRate}%`, {
      x: 401.5,
      y: 556,
      size: 8,
      font: fontBold,
      color: textWhite,
    });
  }

  if (data.tax != null) {
    const taxStr = `$${Number(data.tax).toFixed(0)}`;
    const strWidth = fontBold.widthOfTextAtSize(taxStr, 8);
    page.drawText(taxStr, {
      x: totalsBoxX + (totalsBoxWidth - strWidth) / 2,
      y: 556,
      size: 8,
      font: fontBold,
      color: textWhite,
    });
  }

  // Grand Total (y: 545 in template)
  if (data.grandTotal != null) {
    const grandStr = `$${Number(data.grandTotal).toFixed(0)}`;
    const strWidth = fontBold.widthOfTextAtSize(grandStr, 8.5);
    page.drawText(grandStr, {
      x: totalsBoxX + (totalsBoxWidth - strWidth) / 2,
      y: 542,
      size: 8.5,
      font: fontBold,
      color: textWhite,
    });
  }

  // 4. Payment Structure Customization (Only if changed from defaults)
  const defaultAdv = "70% of charge paid in advance.";
  const defaultComp = "30% of charge paid after the project Completion";
  const userAdv = String(data.paymentAdvance || "").trim();
  const userComp = String(data.paymentCompletion || "").trim();

  if ((userAdv && userAdv !== defaultAdv) || (userComp && userComp !== defaultComp)) {
    // White-out the payment structure box content (x: 45, y: 450, w: 260, h: 56)
    page.drawRectangle({
      x: 45,
      y: 450,
      width: 260,
      height: 56,
      color: rgb(1, 1, 1),
    });
    if (userAdv) {
      page.drawText(`• ${userAdv}`, {
        x: 48,
        y: 490,
        size: 7.5,
        font: fontRegular,
        color: textBlack,
      });
    }
    if (userComp) {
      page.drawText(`• ${userComp}`, {
        x: 48,
        y: 472,
        size: 7.5,
        font: fontRegular,
        color: textBlack,
      });
    }
  }

  // 5. NB Banner (Only if changed from default)
  const defaultNb = "NB: the advance amount should be paid when you get the invoice.";
  const userNb = String(data.nb || "").trim();
  if (userNb && userNb !== defaultNb) {
    // Redraw NB banner with maroon background
    page.drawRectangle({
      x: 43,
      y: 414,
      width: 508.75,
      height: 24.8,
      color: maroonColor,
    });
    const nbWidth = fontBold.widthOfTextAtSize(userNb, 7.5);
    const startX = Math.max(48, 43 + (508.75 - nbWidth) / 2);
    page.drawText(userNb, {
      x: startX,
      y: 423,
      size: 7.5,
      font: fontBold,
      color: textWhite,
    });
  }

  return await pdfDoc.save();
}
