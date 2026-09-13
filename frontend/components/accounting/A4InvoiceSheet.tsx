"use client";

import React from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InvoiceLineItem {
  id?: string | number;
  service_type?: string;
  description: string;
  quantity: number;
  rate: number;
  is_free?: boolean;
  amount?: number;
  selected_subservice_ids?: string[];
}

export interface PaymentMethodEntry {
  label: string;
  value: string;
}

interface A4InvoiceSheetProps {
  contactPerson: string;
  invoiceNo: string;
  contactEmail: string;
  invoiceTo: string;
  contactPhone: string;
  date: string;
  dueDate?: string;
  lines: InvoiceLineItem[];
  subtotal: number | string;
  vatPercent?: number;
  taxAmount: number | string;
  paidAmount?: number | string;
  grandTotal: number | string;
  paymentAdvance?: string;
  paymentCompletion?: string;
  nbText?: string;
  paymentMethods?: PaymentMethodEntry[];
  showStamp?: boolean;
  brandPrimary?: string;
  brandSecondary?: string;
  brandLogo?: string;
  onBackToEdit?: () => void;
}

// Deero brand colors
const DEERO_MAROON = "#6e0002";
const DEERO_ORANGE = "#ea580c";

const DEFAULT_PAYMENT_METHODS: PaymentMethodEntry[] = [
  { label: "SomBank", value: "1001572624" },
  { label: "Premier Bank", value: "020602086001" },
  { label: "Salaam Bank", value: "36122269" },
  { label: "IBS Bank", value: "59676" },
  { label: "EVC-Plus", value: "0618553839" },
  { label: "E-DAHAB", value: "0628553566" },
];

export default function A4InvoiceSheet({
  contactPerson,
  invoiceNo,
  contactEmail,
  invoiceTo,
  contactPhone,
  date,
  dueDate,
  lines = [],
  subtotal,
  vatPercent = 5,
  taxAmount,
  paidAmount = "0.00",
  grandTotal,
  paymentAdvance = "70% of charge paid in advance.",
  paymentCompletion = "30% of charge paid after the project Completion",
  nbText = "NB: the advance amount should be paid when you get the invoice.",
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  showStamp = true,
  brandPrimary,
  brandSecondary,
  onBackToEdit,
}: A4InvoiceSheetProps) {
  const primary = brandPrimary || DEERO_MAROON;
  const secondary = brandSecondary || DEERO_ORANGE;
  const pms = paymentMethods.length > 0 ? paymentMethods : DEFAULT_PAYMENT_METHODS;

  const formattedSubtotal = Number(subtotal || 0).toFixed(2);
  const formattedTax = Number(taxAmount || 0).toFixed(2);
  const formattedPaid = Number(paidAmount || 0).toFixed(2);
  const formattedGrandTotal = Number(grandTotal || 0).toFixed(2);

  // Split payment methods into rows of 3 columns each per specification
  const methodRows: PaymentMethodEntry[][] = [];
  for (let i = 0; i < pms.length; i += 3) {
    methodRows.push(pms.slice(i, i + 3));
  }
  if (methodRows.length === 0) {
    methodRows.push([]);
  }

  const padRowTo3 = (row: PaymentMethodEntry[]): PaymentMethodEntry[] => {
    const copy = [...row];
    while (copy.length < 3) {
      copy.push({ label: "", value: "" });
    }
    return copy;
  };

  const methodRowspan = Math.max(1, methodRows.length) * 2;

  // Helper to format item description lines (highlight Timeline in red)
  const renderDescription = (text: string) => {
    const rawLines = (text || "").split("\n");
    return rawLines.map((line, idx) => {
      const isTimeline = line.toLowerCase().includes("timeline");
      return (
        <div
          key={idx}
          style={{
            color: isTimeline ? "#dc2626" : "#111",
            fontWeight: isTimeline ? 700 : 400,
            marginTop: isTimeline ? "8px" : "2px",
          }}
        >
          {line}
        </div>
      );
    });
  };

  // Build clean HTML string for the standard A4 print iframe
  const buildPrintHtml = () => {
    const itemsHtml = lines
      .map((item, idx) => {
        const isFree = item.is_free || Number(item.rate || 0) === 0;
        const rateText = isFree ? "Free" : `$${Number(item.rate || 0).toFixed(0)}`;
        const lineAmt =
          item.amount !== undefined
            ? item.amount
            : Number(item.quantity || 1) * Number(item.rate || 0);
        const amountText = isFree ? "Free" : `$${Number(lineAmt).toFixed(0)}`;

        const descLines = (item.description || "")
          .split("\n")
          .map((l) => {
            const isTimeline = l.toLowerCase().includes("timeline");
            return `<div style="${isTimeline ? "color:#dc2626;font-weight:700;margin-top:8px;" : "margin-top:2px;"}">${l}</div>`;
          })
          .join("");

        return `
        <tr style="background:#ffffff;">
          <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${idx + 1}.</td>
          <td style="border:1.5px solid #222;padding:8px 10px;font-weight:700;font-size:12px;vertical-align:top;line-height:1.4;">${item.service_type || "Service Item"}</td>
          <td style="border:1.5px solid #222;padding:8px 10px;font-size:11.5px;line-height:1.45;vertical-align:top;word-break:break-word;">${descLines || "—"}</td>
          <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${item.quantity || 1}</td>
          <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;font-size:12px;color:${secondary};vertical-align:top;">${rateText}</td>
          <td style="border:1.5px solid #222;padding:8px 4px;text-align:center;font-weight:700;font-size:12px;color:${secondary};vertical-align:top;">${amountText}</td>
        </tr>`;
      })
      .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNo || ""}</title>
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
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sheet-page {
      position: relative;
      width: 100%;
      max-width: 210mm;
      height: 297mm;
      max-height: 297mm;
      margin: 0 auto;
      padding: 26px 36px 20px 36px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #fff;
      overflow: hidden;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
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
      background: ${primary};
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      padding: 0 42px;
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
      background: ${secondary};
      width: 32px;
      height: 42px;
      display: block;
      margin: 0;
      border: 0;
    }
    .footer-box {
      width: 100%;
      text-align: center;
      padding-top: 8px;
    }
    .footer-img {
      max-width: 84%;
      height: auto;
      object-fit: contain;
      display: inline-block;
      margin: 0 auto;
    }
  </style>
</head>
<body>
<div class="sheet-page">
  <div>
    <!-- HEADER: Logo + Invoice Badge -->
    <div class="header-box">
      <img src="/deero-logo.png" alt="Deero Advertising Agency" style="height:74px;width:auto;object-fit:contain;" />
      <div class="badge-wrap">
        <div class="badge-pill">Invoice</div>
        <div class="badge-sq"></div>
      </div>
    </div>

    <!-- CONTACT META TABLE -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ddd;">
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;width:50%;border:1px solid #ddd;">Contact Person</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;width:50%;border:1px solid #ddd;">Invoice No</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">${contactPerson || "—"}</td>
          <td style="padding:6px 10px;font-size:11.5px;font-weight:700;border:1px solid #ddd;color:#111;">${invoiceNo || "#DADVIN000"}</td>
        </tr>
      </tbody>
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Contact Email</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Invoice To</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 10px;font-size:11.5px;color:#555;border:1px solid #ddd;">${contactEmail || "-------------------"}</td>
          <td style="padding:6px 10px;font-size:11.5px;font-weight:800;border:1px solid #ddd;">${invoiceTo || "—"}</td>
        </tr>
      </tbody>
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Contact Phone</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Date</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">${contactPhone || "-------------------"}</td>
          <td style="padding:6px 10px;font-size:11.5px;border:1px solid #ddd;">${date || ""}${dueDate ? ` &nbsp;|&nbsp; Due: ${dueDate}` : ""}</td>
        </tr>
      </tbody>
    </table>

    <!-- SERVICES TABLE (Qua, Rate, Amount in Orange) -->
    <table style="width:100%;border-collapse:collapse;border:1.5px solid #222;margin-bottom:0;">
      <thead>
        <tr style="background:${secondary};color:#fff;">
          <th style="padding:6px 4px;font-size:11.5px;font-weight:700;text-align:center;border:1.5px solid #222;width:5%;">#</th>
          <th style="padding:6px 8px;font-size:11.5px;font-weight:700;text-align:center;border:1.5px solid #222;width:22%;">Service Type</th>
          <th style="padding:6px 8px;font-size:11.5px;font-weight:700;text-align:center;border:1.5px solid #222;width:43%;">Item(s)</th>
          <th style="padding:6px 4px;font-size:11.5px;font-weight:700;text-align:center;border:1.5px solid #222;width:10%;">Qua</th>
          <th style="padding:6px 4px;font-size:11.5px;font-weight:700;text-align:center;border:1.5px solid #222;width:10%;">Rate</th>
          <th style="padding:6px 4px;font-size:11.5px;font-weight:700;text-align:center;border:1.5px solid #222;width:10%;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml || `<tr><td colspan="6" style="padding:14px;text-align:center;font-size:11.5px;color:#888;border:1.5px solid #222;">No items added.</td></tr>`}</tbody>
    </table>

    <!-- STAMP & TOTALS ROW -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:2px;margin-bottom:14px;position:relative;">
      <!-- Blue Stamp on Left overlapping table border -->
      <div style="padding-left:16px;position:relative;z-index:20;margin-top:-34px;">
        ${
          showStamp
            ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="146" height="146" style="opacity:0.92;display:block;">
                <defs>
                  <path id="top-arc-p" d="M 27 100 A 73 73 0 1 1 173 100" fill="none" />
                  <path id="bottom-arc-p" d="M 173 100 A 73 73 0 0 1 27 100" fill="none" />
                </defs>
                <g transform="rotate(-28 100 100)">
                  <circle cx="100" cy="100" r="92" fill="none" stroke="#0d3eb8" stroke-width="3.2" />
                  <circle cx="100" cy="100" r="87.5" fill="none" stroke="#0d3eb8" stroke-width="1.2" />
                  <circle cx="100" cy="100" r="58" fill="none" stroke="#0d3eb8" stroke-width="1.5" />
                  <circle cx="100" cy="100" r="55.5" fill="none" stroke="#0d3eb8" stroke-width="0.8" />
                  <text fill="#0d3eb8" font-family="'Arial Black', Arial, sans-serif" font-size="10.5" font-weight="900" letter-spacing="1.2">
                    <textPath href="#top-arc-p" startOffset="50%" text-anchor="middle">★ Deero Advertising Agency ★</textPath>
                  </text>
                  <text fill="#0d3eb8" font-family="'Arial Black', Arial, sans-serif" font-size="10" font-weight="900" letter-spacing="1.8">
                    <textPath href="#bottom-arc-p" startOffset="50%" text-anchor="middle">Mogadishu - somalia</textPath>
                  </text>
                  <g transform="translate(53.5, 42.3) scale(6.2)" fill="#0d3eb8">
                    <path d="M13.4,7.62c-.57.18-.99.71-1,1.34,0,0,0,.02,0,.02s0,.01,0,.02c0,.14.04.29.11.41s.16.23.28.31c.25.17.6.21.88.15.07-.02.14-.04.21-.07s.12-.08.18-.12c0,0,0,0,0,0,.17-.15.27-.38.27-.62,0-.17-.05-.33-.14-.47,0,0,0,0,0,0,0,0,0,0,0,0-.02.02-.04.03-.06.04-.25.17-.53.1-.81.04-.08-.02-.14-.12-.22-.21.06-.04.08-.06.1-.07.11-.05.22-.11.32-.18.03-.02.06-.05.09-.07.14-.11.25-.25.35-.4,0,0,0-.02.01-.02.03-.05.07-.09.1-.13.16-.17.37-.26.61-.32.11-.03.23-.06.34-.1.04-.01.08-.03.12-.04.21-.08.34-.19.41-.33.07-.14.07-.31.02-.52.16.19.19.42.08.63-.02.03-.04.07-.06.1-.11.15-.26.23-.42.3-.07.03-.13.05-.2.08-.16.05-.31.1-.45.19-.05.03-.08.07-.12.11-.03.04-.07.09-.1.13.01.02.03.04.05.06.07-.03.14-.07.21-.1.06-.03.11-.06.17-.09.02.01.03.02.05.03-.02.05-.05.1-.07.15-.04.08-.08.17-.13.25.06.08.13.17.19.27.01.02.03.04.04.07.09.19.14.4.14.62,0,.14-.02.28-.06.41-.07.25-.22.47-.4.65-.15.14-.34.25-.54.31-.14.04-.28.07-.43.07-.1,0-.2-.01-.3-.03-.65-.14-1.13-.71-1.13-1.4,0-.76.59-1.38,1.34-1.43ZM13.77,8.21c.1,0,.15-.04.2-.16-.1,0-.16.04-.2.16Z"/>
                    <path d="M13.5,7.25h0c0,.13-.1.24-.23.26-.75.11-1.33.76-1.33,1.54v1.17c0,.15-.12.27-.27.27h0c-.15,0-.27-.12-.27-.27v-1.17c0-.53.2-1.02.53-1.39.32-.36.76-.6,1.25-.67.16-.02.3.1.3.26Z"/>
                    <path d="M3.78,5.81v2.92c0,.07,0,.14-.01.2h0c-.07.61-.45,1.12-.99,1.38-.23.11-.48.17-.75.17-.97,0-1.75-.78-1.75-1.75s.78-1.75,1.75-1.75c.27,0,.52.06.75.17-.1-.02-.19-.03-.29-.03-.88,0-1.59.7-1.61,1.58,0,.01,0,.02,0,.03s0,.02,0,.03c.02.62.53,1.12,1.15,1.12s1.15-.52,1.15-1.15v-2.92c0-.08.03-.16.09-.21.05-.05.13-.09.21-.09.17,0,.3.13.3.3Z"/>
                    <path d="M5.54,8.44h1.36c-.13-.49-.58-.85-1.11-.85-.2,0-.39.05-.55.14-.36.2-.6.57-.6,1.01,0,.27.09.52.25.72.1.12.21.22.35.29.16.09.35.14.55.14.64,0,1.22-.23,1.67-.62-.22.71-.89,1.22-1.67,1.22s-1.44-.51-1.67-1.22c-.04-.14-.07-.28-.08-.43,0-.03,0-.06,0-.1,0-.97.78-1.75,1.75-1.75.86,0,1.58.63,1.73,1.45.02.1.03.2.03.3,0,.03,0,.07,0,.1-.06.07-.13.14-.2.2h-1.8c-.08,0-.16-.03-.21-.09-.05-.05-.09-.13-.09-.21,0-.17.13-.3.3-.3Z"/>
                    <path d="M9.22,8.44h1.36c-.13-.49-.58-.85-1.11-.85-.2,0-.39.05-.55.14-.36.2-.6.57-.6,1.01,0,.27.09.52.25.72.1.12.21.22.35.29.16.09.35.14.55.14.64,0,1.22-.23,1.67-.62-.22.71-.89,1.22-1.67,1.22s-1.44-.51-1.67-1.22c-.04-.14-.07-.28-.08-.43,0-.03,0-.06,0-.1,0-.97.78-1.75,1.75-1.75.86,0,1.58.63,1.73,1.45.02.1.03.2.03.3,0,.03,0,.07,0,.1-.06.07-.13.14-.2.2h-1.8c-.08,0-.16-.03-.21-.09-.05-.05-.09-.13-.09-.21,0-.17.13-.3.3-.3Z"/>
                  </g>
                  <text x="100" y="117" text-anchor="middle" fill="#0d3eb8" font-family="Arial, Helvetica, sans-serif" font-size="7" font-weight="bold" letter-spacing="0.8">Advertising Agency</text>
                </g>
              </svg>`
            : ""
        }
      </div>

      <!-- Totals Table on Right matching Screenshot -->
      <table style="border-collapse:collapse;width:40%;min-width:240px;border:1.5px solid #222;">
        <tr>
          <td style="background:#fff;color:#111;padding:6px 12px;font-size:12px;font-weight:700;border:1.5px solid #222;width:55%;">Subtotal</td>
          <td style="background:#fff;color:#111;padding:6px 12px;font-size:12px;font-weight:700;text-align:right;border:1.5px solid #222;">$${formattedSubtotal}</td>
        </tr>
        ${
          Number(taxAmount || 0) > 0
            ? `<tr>
                <td style="background:#fff;color:#111;padding:5px 12px;font-size:11.5px;font-weight:600;border:1.5px solid #222;">VAT ${vatPercent}%</td>
                <td style="background:#fff;color:#111;padding:5px 12px;font-size:11.5px;font-weight:600;text-align:right;border:1.5px solid #222;">$${formattedTax}</td>
              </tr>`
            : ""
        }
        <tr>
          <td style="background:${primary};color:#fff;padding:6px 12px;font-size:12px;font-weight:800;border:1.5px solid #222;letter-spacing:0.5px;">PAID</td>
          <td style="background:${primary};color:#fff;padding:6px 12px;font-size:12px;font-weight:800;text-align:right;border:1.5px solid #222;">$${formattedPaid}</td>
        </tr>
        <tr>
          <td style="background:${secondary};color:#fff;padding:6px 12px;font-size:12.5px;font-weight:800;border:1.5px solid #222;letter-spacing:0.5px;">Total Amount</td>
          <td style="background:${secondary};color:#fff;padding:6px 12px;font-size:12.5px;font-weight:800;text-align:right;border:1.5px solid #222;">$${formattedGrandTotal}</td>
        </tr>
      </table>
    </div>

    <!-- PAYMENT TABLE (Payment Structure & Methods) -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;border:1px solid #ddd;">
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:center;padding:6px 8px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:38%;">Payment Structure</th>
          <th colspan="3" style="background:${secondary};color:#fff;text-align:center;padding:6px 8px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:62%;">Payment Method</th>
        </tr>
      </thead>
      <tbody>
        ${methodRows
          .map((rawRow, rIdx) => {
            const row = padRowTo3(rawRow);
            const isFirst = rIdx === 0;
            return `
            <tr>
              ${
                isFirst
                  ? `
                <td rowspan="${methodRowspan}" style="padding:8px 10px;font-size:11px;line-height:1.6;border:1px solid #ddd;vertical-align:top;background:#fff;width:38%;">
                  <div>&bull; ${paymentAdvance}</div>
                  <div>&bull; ${paymentCompletion}</div>
                </td>`
                  : ""
              }
              ${row
                .map(
                  (pm) => `
                <th style="border:1px solid #ddd;background:#fafafa;color:#111;font-size:11px;font-weight:600;padding:4px 6px;text-align:center;width:20.67%;">
                  ${pm.label || "&nbsp;"}
                </th>`
                )
                .join("")}
            </tr>
            <tr>
              ${row
                .map(
                  (pm) => `
                <td style="text-align:center;font-weight:700;font-size:11px;padding:5px;border:1px solid #ddd;color:#111;height:24px;">
                  ${pm.value || "&nbsp;"}
                </td>`
                )
                .join("")}
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>

    <!-- NB BANNER -->
    <div style="background:${primary};color:#fff;text-align:center;padding:7px 12px;font-size:11.5px;font-weight:600;border:1px solid #ddd;margin-bottom:0;">
      ${nbText}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer-box">
    <img src="/deero-footer.png" alt="Deero Contact Information" class="footer-img" onerror="this.style.display='none'" />
  </div>
</div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const html = buildPrintHtml();
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 2000);
    }, 500);
  };

  // ──────────────────── Screen Preview ────────────────────
  return (
    <div className="w-full flex flex-col items-center gap-3 py-2">
      {/* Toolbar */}
      <div className="w-full max-w-[850px] flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-zinc-200 shadow-sm">
        <div>
          <span className="text-xs font-extrabold text-zinc-900 block leading-tight">
            Standard Invoice (A4)
          </span>
          <span className="text-[11px] text-zinc-500">
            Deero Advertising Agency official invoice template
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onBackToEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackToEdit}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <ArrowLeft className="size-3.5" /> Edit Form
            </Button>
          )}
          <Button
            id="a4-invoice-sheet-print-btn"
            type="button"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs font-bold gap-1.5 text-white shadow-sm"
            style={{ background: secondary }}
          >
            <Printer className="size-3.5" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* A4 Sheet Preview */}
      <div className="w-full overflow-x-auto pb-4 flex justify-center">
        <div
          style={{
            width: "900px",
            minHeight: "1080px",
            background: "#ffffff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            borderRadius: "3px",
            padding: "28px 36px 22px 36px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* ── HEADER: Logo + Invoice Badge ── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <img
                src="/deero-logo.png"
                alt="Deero Advertising Agency"
                style={{ height: "74px", width: "auto", objectFit: "contain" }}
                onError={(e) => ((e.currentTarget as HTMLElement).style.display = "none")}
              />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "stretch",
                  marginRight: "-36px",
                  height: "42px",
                  lineHeight: 1,
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    background: primary,
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 700,
                    padding: "0 42px",
                    borderRadius: "24px 0 0 24px",
                    letterSpacing: "0.5px",
                    height: "42px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Invoice
                </div>
                <div
                  style={{
                    background: secondary,
                    width: "32px",
                    height: "42px",
                    display: "block",
                  }}
                />
              </div>
            </div>

            {/* ── CONTACT META TABLE ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "12px",
                border: "1px solid #ddd",
              }}
            >
              <tbody>
                {[
                  {
                    thA: "Contact Person",
                    valA: contactPerson || "—",
                    thB: "Invoice No",
                    valB: invoiceNo || "#DADVIN000",
                    isThABold: false,
                  },
                  {
                    thA: "Contact Email",
                    valA: contactEmail || "-------------------",
                    thB: "Invoice To",
                    valB: invoiceTo || "—",
                    isThABold: true,
                  },
                  {
                    thA: "Contact Phone",
                    valA: contactPhone || "-------------------",
                    thB: "Date",
                    valB: `${date || ""}${dueDate ? `  |  Due: ${dueDate}` : ""}`,
                    isThABold: false,
                  },
                ].map((row, i) => (
                  <React.Fragment key={i}>
                    <tr>
                      <th
                        style={{
                          background: primary,
                          color: "#fff",
                          textAlign: "left",
                          padding: "6px 10px",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          width: "50%",
                          border: "1px solid #ddd",
                        }}
                      >
                        {row.thA}
                      </th>
                      <th
                        style={{
                          background: secondary,
                          color: "#fff",
                          textAlign: "left",
                          padding: "6px 10px",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          width: "50%",
                          border: "1px solid #ddd",
                        }}
                      >
                        {row.thB}
                      </th>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "6px 10px",
                          fontSize: "11.5px",
                          fontWeight: i === 0 ? 600 : 400,
                          color: i === 1 ? "#555" : "#111",
                          border: "1px solid #ddd",
                        }}
                      >
                        {row.valA}
                      </td>
                      <td
                        style={{
                          padding: "6px 10px",
                          fontSize: "11.5px",
                          fontWeight: i === 1 ? 800 : 700,
                          color: "#111",
                          border: "1px solid #ddd",
                        }}
                      >
                        {row.valB}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* ── ITEMS TABLE (# | Service Type | Item(s) | Qua | Rate | Amount) ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1.5px solid #222",
                marginBottom: 0,
              }}
            >
              <thead>
                <tr style={{ background: secondary, color: "#fff" }}>
                  {["#", "Service Type", "Item(s)", "Qua", "Rate", "Amount"].map(
                    (h, i) => (
                      <th
                        key={i}
                        style={{
                          padding: "6px 4px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          textAlign: "center",
                          border: "1.5px solid #222",
                          width: ["5%", "22%", "43%", "10%", "10%", "10%"][i],
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.length > 0 ? (
                  lines.map((item, idx) => {
                    const isFree = item.is_free || Number(item.rate || 0) === 0;
                    const rateText = isFree ? "Free" : `$${Number(item.rate || 0).toFixed(0)}`;
                    const lineAmt =
                      item.amount !== undefined
                        ? item.amount
                        : Number(item.quantity || 1) * Number(item.rate || 0);
                    const amountText = isFree ? "Free" : `$${Number(lineAmt).toFixed(0)}`;
                    return (
                      <tr key={idx} style={{ background: "#fff" }}>
                        <td
                          style={{
                            padding: "8px 4px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textAlign: "center",
                            border: "1.5px solid #222",
                            verticalAlign: "top",
                          }}
                        >
                          {idx + 1}.
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontSize: "12px",
                            fontWeight: 700,
                            border: "1.5px solid #222",
                            verticalAlign: "top",
                            lineHeight: 1.4,
                          }}
                        >
                          {item.service_type || "Service Item"}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontSize: "11.5px",
                            lineHeight: 1.45,
                            border: "1.5px solid #222",
                            verticalAlign: "top",
                            wordBreak: "break-word",
                          }}
                        >
                          {renderDescription(item.description)}
                        </td>
                        <td
                          style={{
                            padding: "8px 4px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textAlign: "center",
                            border: "1.5px solid #222",
                            verticalAlign: "top",
                          }}
                        >
                          {item.quantity || 1}
                        </td>
                        <td
                          style={{
                            padding: "8px 4px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textAlign: "center",
                            color: secondary,
                            border: "1.5px solid #222",
                            verticalAlign: "top",
                          }}
                        >
                          {rateText}
                        </td>
                        <td
                          style={{
                            padding: "8px 4px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textAlign: "center",
                            color: secondary,
                            border: "1.5px solid #222",
                            verticalAlign: "top",
                          }}
                        >
                          {amountText}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "14px",
                        textAlign: "center",
                        fontSize: "11.5px",
                        color: "#888",
                        border: "1.5px solid #222",
                      }}
                    >
                      No items added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* ── STAMP & TOTALS ── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginTop: "2px",
                marginBottom: "14px",
                position: "relative",
              }}
            >
              {/* Stamp on Left — overlapping table grid line like real rubber stamp */}
              <div
                style={{
                  paddingLeft: "16px",
                  position: "relative",
                  zIndex: 20,
                  marginTop: "-34px",
                  pointerEvents: "none",
                }}
              >
                {showStamp && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 200 200"
                    width="146"
                    height="146"
                    style={{
                      opacity: 0.92,
                      display: "block",
                      filter: "drop-shadow(0 1px 2px rgba(13,62,184,0.18))",
                    }}
                  >
                    <defs>
                      <path id="top-arc-s" d="M 27 100 A 73 73 0 1 1 173 100" fill="none" />
                      <path id="bottom-arc-s" d="M 173 100 A 73 73 0 0 1 27 100" fill="none" />
                    </defs>
                    <g transform="rotate(-28 100 100)">
                      {/* Outer thick circular border */}
                      <circle cx="100" cy="100" r="92" fill="none" stroke="#0d3eb8" strokeWidth="3.2" />
                      {/* Outer thin circular line */}
                      <circle cx="100" cy="100" r="87.5" fill="none" stroke="#0d3eb8" strokeWidth="1.2" />

                      {/* Inner double circle */}
                      <circle cx="100" cy="100" r="58" fill="none" stroke="#0d3eb8" strokeWidth="1.5" />
                      <circle cx="100" cy="100" r="55.5" fill="none" stroke="#0d3eb8" strokeWidth="0.8" />

                      {/* Circular upper text: ★ Deero Advertising Agency ★ */}
                      <text fill="#0d3eb8" fontFamily="'Arial Black', Arial, sans-serif" fontSize="10.5" fontWeight="900" letterSpacing="1.2">
                        <textPath href="#top-arc-s" startOffset="50%" textAnchor="middle">
                          ★ Deero Advertising Agency ★
                        </textPath>
                      </text>

                      {/* Circular lower text: Mogadishu - somalia */}
                      <text fill="#0d3eb8" fontFamily="'Arial Black', Arial, sans-serif" fontSize="10" fontWeight="900" letterSpacing="1.8">
                        <textPath href="#bottom-arc-s" startOffset="50%" textAnchor="middle">
                          Mogadishu - somalia
                        </textPath>
                      </text>

                      {/* Center official Deero vector logo */}
                      <g transform="translate(53.5, 42.3) scale(6.2)" fill="#0d3eb8">
                        <path d="M13.4,7.62c-.57.18-.99.71-1,1.34,0,0,0,.02,0,.02s0,.01,0,.02c0,.14.04.29.11.41s.16.23.28.31c.25.17.6.21.88.15.07-.02.14-.04.21-.07s.12-.08.18-.12c0,0,0,0,0,0,.17-.15.27-.38.27-.62,0-.17-.05-.33-.14-.47,0,0,0,0,0,0,0,0,0,0,0,0-.02.02-.04.03-.06.04-.25.17-.53.1-.81.04-.08-.02-.14-.12-.22-.21.06-.04.08-.06.1-.07.11-.05.22-.11.32-.18.03-.02.06-.05.09-.07.14-.11.25-.25.35-.4,0,0,0-.02.01-.02.03-.05.07-.09.1-.13.16-.17.37-.26.61-.32.11-.03.23-.06.34-.1.04-.01.08-.03.12-.04.21-.08.34-.19.41-.33.07-.14.07-.31.02-.52.16.19.19.42.08.63-.02.03-.04.07-.06.1-.11.15-.26.23-.42.3-.07.03-.13.05-.2.08-.16.05-.31.1-.45.19-.05.03-.08.07-.12.11-.03.04-.07.09-.1.13.01.02.03.04.05.06.07-.03.14-.07.21-.1.06-.03.11-.06.17-.09.02.01.03.02.05.03-.02.05-.05.1-.07.15-.04.08-.08.17-.13.25.06.08.13.17.19.27.01.02.03.04.04.07.09.19.14.4.14.62,0,.14-.02.28-.06.41-.07.25-.22.47-.4.65-.15.14-.34.25-.54.31-.14.04-.28.07-.43.07-.1,0-.2-.01-.3-.03-.65-.14-1.13-.71-1.13-1.4,0-.76.59-1.38,1.34-1.43ZM13.77,8.21c.1,0,.15-.04.2-.16-.1,0-.16.04-.2.16Z"/>
                        <path d="M13.5,7.25h0c0,.13-.1.24-.23.26-.75.11-1.33.76-1.33,1.54v1.17c0,.15-.12.27-.27.27h0c-.15,0-.27-.12-.27-.27v-1.17c0-.53.2-1.02.53-1.39.32-.36.76-.6,1.25-.67.16-.02.3.1.3.26Z"/>
                        <path d="M3.78,5.81v2.92c0,.07,0,.14-.01.2h0c-.07.61-.45,1.12-.99,1.38-.23.11-.48.17-.75.17-.97,0-1.75-.78-1.75-1.75s.78-1.75,1.75-1.75c.27,0,.52.06.75.17-.1-.02-.19-.03-.29-.03-.88,0-1.59.7-1.61,1.58,0,.01,0,.02,0,.03s0,.02,0,.03c.02.62.53,1.12,1.15,1.12s1.15-.52,1.15-1.15v-2.92c0-.08.03-.16.09-.21.05-.05.13-.09.21-.09.17,0,.3.13.3.3Z"/>
                        <path d="M5.54,8.44h1.36c-.13-.49-.58-.85-1.11-.85-.2,0-.39.05-.55.14-.36.2-.6.57-.6,1.01,0,.27.09.52.25.72.1.12.21.22.35.29.16.09.35.14.55.14.64,0,1.22-.23,1.67-.62-.22.71-.89,1.22-1.67,1.22s-1.44-.51-1.67-1.22c-.04-.14-.07-.28-.08-.43,0-.03,0-.06,0-.1,0-.97.78-1.75,1.75-1.75.86,0,1.58.63,1.73,1.45.02.1.03.2.03.3,0,.03,0,.07,0,.1-.06.07-.13.14-.2.2h-1.8c-.08,0-.16-.03-.21-.09-.05-.05-.09-.13-.09-.21,0-.17.13-.3.3-.3Z"/>
                        <path d="M9.22,8.44h1.36c-.13-.49-.58-.85-1.11-.85-.2,0-.39.05-.55.14-.36.2-.6.57-.6,1.01,0,.27.09.52.25.72.1.12.21.22.35.29.16.09.35.14.55.14.64,0,1.22-.23,1.67-.62-.22.71-.89,1.22-1.67,1.22s-1.44-.51-1.67-1.22c-.04-.14-.07-.28-.08-.43,0-.03,0-.06,0-.1,0-.97.78-1.75,1.75-1.75.86,0,1.58.63,1.73,1.45.02.1.03.2.03.3,0,.03,0,.07,0,.1-.06.07-.13.14-.2.2h-1.8c-.08,0-.16-.03-.21-.09-.05-.05-.09-.13-.09-.21,0-.17.13-.3.3-.3Z"/>
                      </g>

                      {/* Center Subtitle: Advertising Agency */}
                      <text x="100" y="117" textAnchor="middle" fill="#0d3eb8" fontFamily="Arial, Helvetica, sans-serif" fontSize="7" fontWeight="bold" letterSpacing="0.8">
                        Advertising Agency
                      </text>
                    </g>
                  </svg>
                )}
              </div>


              {/* Totals Table on Right matching Screenshot */}
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "40%",
                  minWidth: "240px",
                  border: "1.5px solid #222",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        background: "#fff",
                        color: "#111",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: "1.5px solid #222",
                        width: "55%",
                      }}
                    >
                      Subtotal
                    </td>
                    <td
                      style={{
                        background: "#fff",
                        color: "#111",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 700,
                        textAlign: "right",
                        border: "1.5px solid #222",
                      }}
                    >
                      ${formattedSubtotal}
                    </td>
                  </tr>
                  {Number(taxAmount || 0) > 0 && (
                    <tr>
                      <td
                        style={{
                          background: "#fff",
                          color: "#111",
                          padding: "5px 12px",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          border: "1.5px solid #222",
                        }}
                      >
                        VAT {vatPercent}%
                      </td>
                      <td
                        style={{
                          background: "#fff",
                          color: "#111",
                          padding: "5px 12px",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          textAlign: "right",
                          border: "1.5px solid #222",
                        }}
                      >
                        ${formattedTax}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td
                      style={{
                        background: primary,
                        color: "#fff",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 800,
                        border: "1.5px solid #222",
                        letterSpacing: "0.5px",
                      }}
                    >
                      PAID
                    </td>
                    <td
                      style={{
                        background: primary,
                        color: "#fff",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 800,
                        textAlign: "right",
                        border: "1.5px solid #222",
                      }}
                    >
                      ${formattedPaid}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        background: secondary,
                        color: "#fff",
                        padding: "6px 12px",
                        fontSize: "12.5px",
                        fontWeight: 800,
                        border: "1.5px solid #222",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Total Amount
                    </td>
                    <td
                      style={{
                        background: secondary,
                        color: "#fff",
                        padding: "6px 12px",
                        fontSize: "12.5px",
                        fontWeight: 800,
                        textAlign: "right",
                        border: "1.5px solid #222",
                      }}
                    >
                      ${formattedGrandTotal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── PAYMENT TABLE ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "10px",
                border: "1px solid #ddd",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      background: primary,
                      color: "#fff",
                      textAlign: "center",
                      padding: "6px 8px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      border: "1px solid #ddd",
                      width: "38%",
                    }}
                  >
                    Payment Structure
                  </th>
                  <th
                    colSpan={3}
                    style={{
                      background: secondary,
                      color: "#fff",
                      textAlign: "center",
                      padding: "6px 8px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      border: "1px solid #ddd",
                      width: "62%",
                    }}
                  >
                    Payment Method
                  </th>
                </tr>
              </thead>
              <tbody>
                {methodRows.map((rawRow, rIdx) => {
                  const row = padRowTo3(rawRow);
                  const isFirst = rIdx === 0;
                  return (
                    <React.Fragment key={rIdx}>
                      <tr>
                        {isFirst && (
                          <td
                            rowSpan={methodRowspan}
                            style={{
                              padding: "8px 10px",
                              fontSize: "11px",
                              lineHeight: 1.6,
                              border: "1px solid #ddd",
                              verticalAlign: "top",
                              background: "#fff",
                              width: "38%",
                            }}
                          >
                            <div>• {paymentAdvance}</div>
                            <div>• {paymentCompletion}</div>
                          </td>
                        )}
                        {row.map((pm, cIdx) => (
                          <th
                            key={`lbl-${cIdx}`}
                            style={{
                              border: "1px solid #ddd",
                              background: "#fafafa",
                              color: "#111",
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "4px 6px",
                              textAlign: "center",
                              width: "20.67%",
                            }}
                          >
                            {pm.label || <>&nbsp;</>}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {row.map((pm, cIdx) => (
                          <td
                            key={`val-${cIdx}`}
                            style={{
                              textAlign: "center",
                              fontWeight: 700,
                              fontSize: "11px",
                              padding: "5px",
                              border: "1px solid #ddd",
                              color: "#111",
                              height: "24px",
                            }}
                          >
                            {pm.value || <>&nbsp;</>}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* ── NB BANNER ── */}
            <div
              style={{
                background: primary,
                color: "#fff",
                textAlign: "center",
                padding: "7px 12px",
                fontSize: "11.5px",
                fontWeight: 600,
                border: "1px solid #ddd",
                marginBottom: 0,
              }}
            >
              {nbText}
            </div>
          </div>

          {/* ── FOOTER: Pinned to bottom of the A4 page ── */}
          <div className="footer-box" style={{ width: "100%", textAlign: "center", paddingTop: "8px" }}>
            <img
              src="/deero-footer.png"
              alt="Deero Contact Information"
              className="footer-img"
              style={{ maxWidth: "84%", height: "auto", objectFit: "contain", display: "inline-block", margin: "0 auto" }}
              onError={(e) => ((e.currentTarget as HTMLElement).style.display = "none")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
