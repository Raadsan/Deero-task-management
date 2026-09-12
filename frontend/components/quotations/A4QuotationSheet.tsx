"use client";

import React, { useRef } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuotationLineItem {
  id?: string;
  service_type: string;
  description: string;
  quantity: number;
  rate: number;
  is_free: boolean;
  amount?: number;
}

export interface PaymentMethodEntry {
  label: string;
  value: string;
}

interface A4QuotationSheetProps {
  contactPerson: string;
  quotationNo: string;
  contactEmail: string;
  quotationTo: string;
  contactPhone: string;
  date: string;
  lines: QuotationLineItem[];
  subtotal: number | string;
  vatPercent: number;
  taxAmount: number | string;
  grandTotal: number | string;
  paymentAdvance?: string;
  paymentCompletion?: string;
  nbText?: string;
  paymentMethods?: PaymentMethodEntry[];
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

export default function A4QuotationSheet({
  contactPerson,
  quotationNo,
  contactEmail,
  quotationTo,
  contactPhone,
  date,
  lines = [],
  subtotal,
  vatPercent = 5,
  taxAmount,
  grandTotal,
  paymentAdvance = "70% of charge paid in advance.",
  paymentCompletion = "30% of charge paid after the project Completion",
  nbText = "NB: the advance amount should be paid when you get the invoice.",
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  brandPrimary,
  brandSecondary,
  onBackToEdit,
}: A4QuotationSheetProps) {
  const primary = brandPrimary || DEERO_MAROON;
  const secondary = brandSecondary || DEERO_ORANGE;
  const pms = paymentMethods.length > 0 ? paymentMethods : DEFAULT_PAYMENT_METHODS;

  // Split payment methods into rows of 3 columns each per user specification
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

  // Generate print HTML using table thead/tfoot trick for repeating header/footer on every page
  const buildPrintHtml = () => {
    const itemsHtml = lines.map((item, idx) => {
      const isFree = item.is_free || Number(item.rate || 0) === 0;
      const rateText = isFree ? "Free" : `$${Number(item.rate || 0).toFixed(0)}`;
      const lineAmt = item.amount !== undefined ? item.amount : Number(item.quantity || 1) * Number(item.rate || 0);
      const amountText = isFree ? "Free" : `$${Number(lineAmt).toFixed(0)}`;
      return `
        <tr>
          <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${idx + 1}.</td>
          <td style="border:1px solid #ddd;padding:8px 10px;font-weight:700;font-size:12px;vertical-align:top;">${item.service_type || ""}</td>
          <td style="border:1px solid #ddd;padding:8px 10px;font-size:11.5px;line-height:1.5;vertical-align:top;white-space:pre-wrap;word-break:break-word;">${item.description || ""}</td>
          <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${item.quantity || 1}</td>
          <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${rateText}</td>
          <td style="border:1px solid #ddd;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;vertical-align:top;">${amountText}</td>
        </tr>`;
    }).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quotation</title>
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
      padding: 30px 36px 24px 36px;
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
      background: ${primary};
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
      background: ${secondary};
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
      .sheet-page {
        page-break-after: always;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
<div class="sheet-page">
  <div>
    <!-- HEADER: Logo + Quotation Badge (Right edge flush) -->
    <div class="header-box">
      <img src="/deero-logo.png" alt="Deero Advertising Agency" style="height:74px;width:auto;object-fit:contain;" />
      <div class="badge-wrap">
        <div class="badge-pill">Quotation</div>
        <div class="badge-sq"></div>
      </div>
    </div>

    <!-- CONTACT META TABLE -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #ddd;">
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;width:50%;border:1px solid #ddd;">Contact Person</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;width:50%;border:1px solid #ddd;">Quotation No</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 10px;font-size:11.5px;font-weight:500;border:1px solid #ddd;">${contactPerson || "—"}</td>
          <td style="padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">${quotationNo || "#DADVQT0000"}</td>
        </tr>
      </tbody>
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Contact Email</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">Quotation To</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 10px;font-size:11.5px;color:#444;border:1px solid #ddd;">${contactEmail || "—"}</td>
          <td style="padding:6px 10px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">${quotationTo || "—"}</td>
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
          <td style="padding:6px 10px;font-size:11.5px;font-weight:500;border:1px solid #ddd;">${contactPhone || "—"}</td>
          <td style="padding:6px 10px;font-size:11.5px;border:1px solid #ddd;">${date || ""}</td>
        </tr>
      </tbody>
    </table>

    <!-- SERVICES TABLE -->
    <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;margin-bottom:0;">
      <thead>
        <tr style="background:${secondary};color:#fff;">
          <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:5%;">#</th>
          <th style="padding:6px 8px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:23%;">Service Type</th>
          <th style="padding:6px 8px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:43%;">Item(s)</th>
          <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:8%;">Qty</th>
          <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:10%;">Rate</th>
          <th style="padding:6px 4px;font-size:11.5px;font-weight:600;text-align:center;border:1px solid #ddd;width:11%;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml || `<tr><td colspan="6" style="padding:14px;text-align:center;font-size:11.5px;color:#888;border:1px solid #ddd;">No services added.</td></tr>`}</tbody>
    </table>

    <!-- TOTALS -->
    <div style="display:flex;justify-content:flex-end;margin-top:-1px;margin-bottom:16px;">
      <table style="border-collapse:collapse;width:38%;min-width:210px;border:1px solid #ddd;">
        <tr>
          <td style="background:${primary};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:60%;">Subtotal</td>
          <td style="background:${primary};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;text-align:right;border:1px solid #ddd;">$${subtotal}</td>
        </tr>
        <tr>
          <td style="background:${primary};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;border:1px solid #ddd;">VAT ${vatPercent}%</td>
          <td style="background:${primary};color:#fff;padding:5px 12px;font-size:11.5px;font-weight:600;text-align:right;border:1px solid #ddd;">$${taxAmount}</td>
        </tr>
        <tr>
          <td style="background:${primary};color:#fff;padding:6px 12px;font-size:12px;font-weight:700;border:1px solid #ddd;">Grand. Total</td>
          <td style="background:${primary};color:#fff;padding:6px 12px;font-size:12px;font-weight:700;text-align:right;border:1px solid #ddd;">$${grandTotal}</td>
        </tr>
      </table>
    </div>

    <!-- PAYMENT TABLE (2 rows of 3 methods) -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ddd;">
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:center;padding:6px 8px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:35%;">Payment Structure</th>
          <th colspan="3" style="background:${secondary};color:#fff;text-align:center;padding:6px 8px;font-size:11.5px;font-weight:600;border:1px solid #ddd;width:65%;">Payment Method</th>
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
                  <div>&bull; ${paymentAdvance}</div>
                  <div>&bull; ${paymentCompletion}</div>
                </td>` : ''}
              ${row.map(pm => `
                <th style="border:1px solid #ddd;background:#fafafa;color:#111;font-size:11px;font-weight:600;padding:4px 6px;text-align:center;width:21.67%;">
                  ${pm.label || '&nbsp;'}
                </th>`).join('')}
            </tr>
            <tr>
              ${row.map(pm => `
                <td style="text-align:center;font-weight:600;font-size:11px;padding:5px;border:1px solid #ddd;color:#111;height:24px;">
                  ${pm.value || '&nbsp;'}
                </td>`).join('')}
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- NB BANNER -->
    <div style="background:${primary};color:#fff;text-align:center;padding:7px 12px;font-size:11.5px;font-weight:600;border:1px solid #ddd;margin-bottom:0;">
      ${nbText}
    </div>
  </div>

  <!-- FOOTER: Pinned to bottom of the A4 page -->
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
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
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
      <div className="w-full max-w-[820px] flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-zinc-200 shadow-sm">
        <div>
          <span className="text-xs font-extrabold text-zinc-900 block leading-tight">Standard Quotation (A4)</span>
          <span className="text-[11px] text-zinc-500">Header &amp; footer repeat on every print page</span>
        </div>
        <div className="flex items-center gap-2">
          {onBackToEdit && (
            <Button type="button" variant="outline" size="sm" onClick={onBackToEdit} className="h-8 text-xs font-semibold gap-1.5">
              <ArrowLeft className="size-3.5" /> Edit Form
            </Button>
          )}
          <Button
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

      {/* A4 Sheet — clean white, no hard border */}
      <div
        className="w-full overflow-x-auto pb-4 flex justify-center"
      >
        <div
          style={{
            width: "800px",
            minHeight: "1060px",
            background: "#ffffff",
            boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
            borderRadius: "3px",
            padding: "32px 36px 28px 36px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── HEADER ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <img
              src="/deero-logo.png"
              alt="Deero Advertising Agency"
              style={{ height: "74px", width: "auto", objectFit: "contain" }}
            />
            <div style={{ display: "inline-flex", alignItems: "stretch", marginRight: "-36px", height: "42px", gap: "8px" }}>
              <div
                style={{
                  background: primary,
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 700,
                  padding: "0 34px",
                  borderRadius: "24px 0 0 24px",
                  letterSpacing: "0.5px",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: 0,
                  border: 0,
                }}
              >
                Quotation
              </div>
              <div style={{ background: secondary, width: "32px", height: "42px", margin: 0, border: 0, display: "block" }} />
            </div>
          </div>

          {/* ── CONTACT TABLE ── */}
          <table
            style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px", border: "1px solid #ddd" }}
          >
            {(
              [
                ["Contact Person", contactPerson || "—", "Quotation No", quotationNo || "#DADVQT0000"],
                ["Contact Email", contactEmail || "—", "Quotation To", quotationTo || "—"],
                ["Contact Phone", contactPhone || "—", "Date", date || ""],
              ] as [string, string, string, string][]
            ).map(([labelA, valA, labelB, valB], i) => (
              <React.Fragment key={i}>
                <thead>
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
                      {labelA}
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
                      {labelB}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      style={{
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        fontWeight: i === 0 ? 500 : 400,
                        color: i === 1 ? "#555" : "#111",
                        border: "1px solid #ddd",
                      }}
                    >
                      {valA}
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        fontWeight: i === 0 ? 600 : 400,
                        border: "1px solid #ddd",
                      }}
                    >
                      {valB}
                    </td>
                  </tr>
                </tbody>
              </React.Fragment>
            ))}
          </table>

          {/* ── ITEMS TABLE ── */}
          <table
            style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", marginBottom: 0 }}
          >
            <thead>
              <tr style={{ background: secondary, color: "#fff" }}>
                {["#", "Service Type", "Item(s)", "Qty", "Rate", "Amount"].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "6px 4px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      textAlign: "center",
                      border: "1px solid #ddd",
                      width: ["5%", "23%", "43%", "8%", "10%", "11%"][i],
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.length > 0 ? (
                lines.map((item, idx) => {
                  const isFree = item.is_free || Number(item.rate || 0) === 0;
                  const rateText = isFree ? "Free" : `$${Number(item.rate || 0).toFixed(0)}`;
                  const lineAmt = item.amount !== undefined ? item.amount : Number(item.quantity || 1) * Number(item.rate || 0);
                  const amountText = isFree ? "Free" : `$${Number(lineAmt).toFixed(0)}`;
                  return (
                    <tr key={idx} style={{ background: "#fff" }}>
                      <td style={{ padding: "6px 4px", fontSize: "11.5px", fontWeight: 600, textAlign: "center", border: "1px solid #ddd", verticalAlign: "top" }}>{idx + 1}.</td>
                      <td style={{ padding: "6px 8px", fontSize: "11.5px", fontWeight: 600, border: "1px solid #ddd", verticalAlign: "top", lineHeight: 1.4 }}>{item.service_type || "Service"}</td>
                      <td style={{ padding: "6px 8px", fontSize: "11.5px", lineHeight: 1.5, border: "1px solid #ddd", verticalAlign: "top", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.description || "—"}</td>
                      <td style={{ padding: "6px 4px", fontSize: "11.5px", fontWeight: 600, textAlign: "center", border: "1px solid #ddd", verticalAlign: "top" }}>{item.quantity || 1}</td>
                      <td style={{ padding: "6px 4px", fontSize: "11.5px", fontWeight: 600, textAlign: "center", border: "1px solid #ddd", verticalAlign: "top" }}>{rateText}</td>
                      <td style={{ padding: "6px 4px", fontSize: "11.5px", fontWeight: 600, textAlign: "center", border: "1px solid #ddd", verticalAlign: "top" }}>{amountText}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "14px", textAlign: "center", fontSize: "11.5px", color: "#888", border: "1px solid #ddd" }}>
                    No services added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── TOTALS ── */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-1px", marginBottom: "16px" }}>
            <table style={{ borderCollapse: "collapse", width: "38%", minWidth: "210px", border: "1px solid #ddd" }}>
              <tbody>
              {[
                ["Subtotal", `$${subtotal}`],
                [`VAT ${vatPercent}%`, `$${taxAmount}`],
                ["Grand. Total", `$${grandTotal}`],
              ].map(([label, val], i) => (
                <tr key={i}>
                  <td
                    style={{
                      background: primary,
                      color: "#fff",
                      padding: i === 2 ? "6px 12px" : "5px 12px",
                      fontSize: i === 2 ? "12px" : "11.5px",
                      fontWeight: 600,
                      border: "1px solid #ddd",
                      width: "60%",
                    }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      background: primary,
                      color: "#fff",
                      padding: i === 2 ? "6px 12px" : "5px 12px",
                      fontSize: i === 2 ? "12px" : "11.5px",
                      fontWeight: 600,
                      textAlign: "right",
                      border: "1px solid #ddd",
                    }}
                  >
                    {val}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>

          {/* ── PAYMENT TABLE (2 rows of 3 methods) ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", border: "1px solid #ddd" }}>
            <thead>
              <tr>
                <th style={{ background: primary, color: "#fff", textAlign: "center", padding: "6px 8px", fontSize: "11.5px", fontWeight: 600, border: "1px solid #ddd", width: "35%" }}>
                  Payment Structure
                </th>
                <th colSpan={3} style={{ background: secondary, color: "#fff", textAlign: "center", padding: "6px 8px", fontSize: "11.5px", fontWeight: 600, border: "1px solid #ddd", width: "65%" }}>
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
                            lineHeight: "1.6",
                            border: "1px solid #ddd",
                            verticalAlign: "top",
                            background: "#fff",
                            width: "35%",
                          }}
                        >
                          <div>&bull; {paymentAdvance}</div>
                          <div>&bull; {paymentCompletion}</div>
                        </td>
                      )}
                      {row.map((pm, i) => (
                        <th
                          key={i}
                          style={{
                            border: "1px solid #ddd",
                            background: "#fafafa",
                            color: "#111",
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 6px",
                            textAlign: "center",
                            width: "21.67%",
                          }}
                        >
                          {pm.label || "\u00A0"}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {row.map((pm, i) => (
                        <td
                          key={i}
                          style={{
                            textAlign: "center",
                            fontWeight: 600,
                            fontSize: "11px",
                            padding: "5px",
                            border: "1px solid #ddd",
                            color: "#111",
                            height: "24px",
                          }}
                        >
                          {pm.value || "\u00A0"}
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
              marginBottom: "24px",
            }}
          >
            {nbText}
          </div>

          {/* ── FOOTER ── */}
          <div style={{ marginTop: "auto", paddingTop: "24px", textAlign: "center" }}>
            <img
              src="/deero-footer.png"
              alt="Deero Contact Information"
              style={{ maxWidth: "84%", height: "auto", objectFit: "contain", display: "inline-block", margin: "0 auto" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
