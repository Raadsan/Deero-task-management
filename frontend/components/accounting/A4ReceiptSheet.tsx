"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PaymentMethodEntry {
  label: string;
  value: string;
}

// Brand Colors matching official Deero template
const DEERO_MAROON = "#6e0002";
const DEERO_ORANGE = "#ea580c";

const DEFAULT_PAYMENT_METHODS: PaymentMethodEntry[] = [
  { label: "Premier Bank", value: "020602086001" },
  { label: "Salaam Bank", value: "36122269" },
  { label: "IBS Bank", value: "59676" },
  { label: "EVC-Plus", value: "0618553839" },
  { label: "E-DAHAB", value: "0628553566" },
  { label: "SomBank", value: "1001572624" },
];

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"
];

function convertBelowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ten = TENS[Math.floor(n / 10)];
    const one = ONES[n % 10];
    return one ? `${ten}-${one}` : ten;
  }
  const hundred = ONES[Math.floor(n / 100)];
  const rest = convertBelowThousand(n % 100);
  return rest ? `${hundred} hundred ${rest}` : `${hundred} hundred`;
}

export function numberToWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "Zero dollars and zero cents.";
  const abs = Math.abs(amount);
  const dollars = Math.floor(abs);
  const cents = Math.round((abs - dollars) * 100);

  const scales = ["", "thousand", "million", "billion"];
  let num = dollars;
  let scaleIndex = 0;
  let dollarWords = "";

  if (dollars === 0) {
    dollarWords = "zero";
  } else {
    const parts: string[] = [];
    while (num > 0 && scaleIndex < scales.length) {
      const chunk = num % 1000;
      if (chunk !== 0) {
        const chunkStr = convertBelowThousand(chunk);
        const scale = scales[scaleIndex];
        parts.unshift(scale ? `${chunkStr} ${scale}` : chunkStr);
      }
      num = Math.floor(num / 1000);
      scaleIndex++;
    }
    dollarWords = parts.join(" ");
  }

  let centsWords = "zero";
  if (cents > 0) {
    if (cents < 20) {
      centsWords = ONES[cents];
    } else {
      const ten = TENS[Math.floor(cents / 10)];
      const one = ONES[cents % 10];
      centsWords = one ? `${ten}-${one}` : ten;
    }
  }

  const result = `${dollarWords} dollars and ${centsWords} cents.`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export interface A4ReceiptSheetProps {
  contactPerson?: string;
  receiptNo: string;
  contactEmail?: string;
  receiptTo: string;
  contactPhone?: string;
  date: string;
  receivedFrom: string;
  amount: number | string;
  currencySymbol?: string;
  currencyCode?: string;
  amountInWords?: string;
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

export default function A4ReceiptSheet({
  contactPerson = "Abshir Abdullahi",
  receiptNo,
  contactEmail = "-------------------",
  receiptTo,
  contactPhone = "+252615576333",
  date,
  receivedFrom,
  amount,
  currencySymbol = "$",
  currencyCode = "USD",
  amountInWords,
  paymentAdvance = "70% of charge paid in advance.",
  paymentCompletion = "30% of charge paid after completion of the project",
  nbText = "NB: the advance amount should be paid when you get the invoice.",
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  showStamp = true,
  brandPrimary,
  brandSecondary,
  brandLogo = "/deero-logo.png",
  onBackToEdit,
}: A4ReceiptSheetProps) {
  const primary = brandPrimary || DEERO_MAROON;
  const secondary = brandSecondary || DEERO_ORANGE;

  const numAmount = Number(amount || 0);
  const formattedFigure = `${currencySymbol}${numAmount.toFixed(2)}`;
  const words = amountInWords || numberToWords(numAmount);

  const pms = paymentMethods.length > 0 ? paymentMethods : DEFAULT_PAYMENT_METHODS;
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

  // Stamp SVG component
  const stampSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="146" height="146" style="opacity:0.92;display:block;margin:0 auto;">
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
        <path id="agency-arc-p" d="M 68 116.5 A 36 36 0 0 0 132 116.5" fill="none" />
        <text fill="#0d3eb8" font-family="'Arial', Helvetica, sans-serif" font-size="6.8" font-weight="bold" letter-spacing="0.7">
          <textPath href="#agency-arc-p" startOffset="50%" text-anchor="middle">Advertising Agency</textPath>
        </text>
      </g>
    </svg>
  `;

  // Build clean HTML string for A4 print
  const buildPrintHtml = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt Voucher ${receiptNo || ""}</title>
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
      margin-bottom: 20px;
      width: 100%;
    }
    .badge-wrap {
      display: inline-flex;
      align-items: stretch;
      margin-right: -36px;
      height: 44px;
      line-height: 1;
      gap: 8px;
    }
    .badge-pill {
      background: ${primary};
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      padding: 0 44px;
      border-radius: 24px 0 0 24px;
      letter-spacing: 0.5px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      border: 0;
    }
    .badge-sq {
      background: ${secondary};
      width: 34px;
      height: 44px;
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
    <!-- HEADER: Logo + Receipt Voucher Badge -->
    <div class="header-box">
      <img src="${brandLogo}" alt="Deero Advertising Agency" style="height:76px;width:auto;object-fit:contain;" />
      <div class="badge-wrap">
        <div class="badge-pill">Receipt Voucher</div>
        <div class="badge-sq"></div>
      </div>
    </div>

    <!-- CONTACT META TABLE -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;border:1px solid #ddd;">
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:7px 12px;font-size:12px;font-weight:700;width:50%;border:1px solid #ddd;">Contact Person</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:7px 12px;font-size:12px;font-weight:700;width:50%;border:1px solid #ddd;">Receipt Voucher No</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:7px 12px;font-size:12px;font-weight:600;border:1px solid #ddd;">${contactPerson || "Abshir Abdullahi"}</td>
          <td style="padding:7px 12px;font-size:12px;font-weight:700;border:1px solid #ddd;color:#111;">${receiptNo || "#DADVRV000"}</td>
        </tr>
      </tbody>
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:7px 12px;font-size:12px;font-weight:700;width:50%;border:1px solid #ddd;">Contact Email</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:7px 12px;font-size:12px;font-weight:700;width:50%;border:1px solid #ddd;">Receipt Voucher To</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:7px 12px;font-size:12px;color:#555;border:1px solid #ddd;">${contactEmail || "-------------------"}</td>
          <td style="padding:7px 12px;font-size:13.5px;font-weight:800;border:1px solid #ddd;color:#111;">${receiptTo || "—"}</td>
        </tr>
      </tbody>
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:7px 12px;font-size:12px;font-weight:700;width:50%;border:1px solid #ddd;">Contact Phone</th>
          <th style="background:${secondary};color:#fff;text-align:left;padding:7px 12px;font-size:12px;font-weight:700;width:50%;border:1px solid #ddd;">Date</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:7px 12px;font-size:12px;font-weight:600;border:1px solid #ddd;">${contactPhone || "-------------------"}</td>
          <td style="padding:7px 12px;font-size:12px;border:1px solid #ddd;">${date || ""}</td>
        </tr>
      </tbody>
    </table>

    <!-- MAIN RECEIPT DETAILS TABLE (Received From, Amount in figure, Amount In words) -->
    <table style="width:100%;border-collapse:collapse;border:1.5px solid #222;margin-bottom:34px;">
      <tbody>
        <tr>
          <td style="background:${primary};color:#fff;font-weight:700;font-size:12.5px;padding:9px 12px;width:30%;border:1.5px solid #222;">Received From</td>
          <td style="background:#fff;color:#111;font-weight:800;font-size:13.5px;padding:9px 12px;border:1.5px solid #222;">${receivedFrom || receiptTo || "—"}</td>
        </tr>
        <tr>
          <td style="background:${secondary};color:#fff;font-weight:700;font-size:12.5px;padding:9px 12px;width:30%;border:1.5px solid #222;">Amount in figure</td>
          <td style="background:#fff;color:#111;font-weight:800;font-size:13.5px;padding:9px 12px;border:1.5px solid #222;">${formattedFigure}</td>
        </tr>
        <tr>
          <td style="background:${primary};color:#fff;font-weight:700;font-size:12.5px;padding:9px 12px;width:30%;border:1.5px solid #222;">Amount In words</td>
          <td style="background:#fff;color:#111;font-weight:600;font-size:12px;padding:9px 12px;border:1.5px solid #222;">${words}</td>
        </tr>
      </tbody>
    </table>

    <!-- CENTERED OFFICIAL STAMP -->
    <div style="text-align:center;margin:32px 0 36px 0;">
      ${showStamp ? stampSvg : ""}
    </div>

    <!-- PAYMENT STRUCTURE & PAYMENT METHOD TABLE -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:0;border:1.5px solid #222;">
      <thead>
        <tr>
          <th style="background:${primary};color:#fff;text-align:left;padding:7px 10px;font-size:12px;font-weight:700;border:1.5px solid #222;width:48%;">Payment Structure</th>
          <th colspan="3" style="background:${secondary};color:#fff;text-align:left;padding:7px 10px;font-size:12px;font-weight:700;border:1.5px solid #222;width:52%;">Payment Method</th>
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
                <td rowspan="${methodRowspan}" style="padding:10px 12px;font-size:11.5px;line-height:1.7;border:1.5px solid #222;vertical-align:top;background:#fff;width:48%;">
                  <div style="margin-bottom:4px;">&bull; &nbsp;${paymentAdvance}</div>
                  <div>&bull; &nbsp;${paymentCompletion}</div>
                </td>`
                  : ""
              }
              ${row
                .map(
                  (pm) => `
                <th style="border:1px solid #ddd;background:#fafafa;color:#111;font-size:11px;font-weight:700;padding:5px 6px;text-align:center;width:17.33%;">
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
    <div style="background:${primary};color:#fff;text-align:center;padding:7px 12px;font-size:11.5px;font-weight:700;border:1.5px solid #222;border-top:none;margin-bottom:0;">
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
      {/* Hidden print trigger for modal integration */}
      <button
        id="a4-receipt-sheet-print-btn"
        type="button"
        onClick={handlePrint}
        className="hidden"
        style={{ display: "none" }}
      />

      {/* A4 Sheet Preview Container */}
      <div className="w-full overflow-x-auto pb-4 flex justify-center">
        <div
          style={{
            width: "860px",
            minHeight: "1120px",
            background: "#ffffff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            borderRadius: "3px",
            padding: "32px 40px 24px 40px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* ── HEADER: Logo + Receipt Voucher Badge ── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <img
                src={brandLogo}
                alt="Deero Advertising Agency"
                style={{ height: "76px", width: "auto", objectFit: "contain" }}
                onError={(e) => ((e.currentTarget as HTMLElement).style.display = "none")}
              />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "stretch",
                  marginRight: "-40px",
                  height: "44px",
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
                    padding: "0 44px",
                    borderRadius: "24px 0 0 24px",
                    letterSpacing: "0.5px",
                    height: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Receipt Voucher
                </div>
                <div
                  style={{
                    background: secondary,
                    width: "34px",
                    height: "44px",
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
                marginBottom: "28px",
                border: "1px solid #ddd",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      background: primary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      width: "50%",
                      border: "1px solid #ddd",
                    }}
                  >
                    Contact Person
                  </th>
                  <th
                    style={{
                      background: secondary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      width: "50%",
                      border: "1px solid #ddd",
                    }}
                  >
                    Receipt Voucher No
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      border: "1px solid #ddd",
                    }}
                  >
                    {contactPerson || "Abshir Abdullahi"}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "1px solid #ddd",
                      color: "#111",
                    }}
                  >
                    {receiptNo || "#DADVRV000"}
                  </td>
                </tr>
              </tbody>
              <thead>
                <tr>
                  <th
                    style={{
                      background: primary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      width: "50%",
                      border: "1px solid #ddd",
                    }}
                  >
                    Contact Email
                  </th>
                  <th
                    style={{
                      background: secondary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      width: "50%",
                      border: "1px solid #ddd",
                    }}
                  >
                    Receipt Voucher To
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "7px 12px",
                      fontSize: "12px",
                      color: "#555",
                      border: "1px solid #ddd",
                    }}
                  >
                    {contactEmail || "-------------------"}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      fontSize: "13.5px",
                      fontWeight: 800,
                      border: "1px solid #ddd",
                      color: "#111",
                    }}
                  >
                    {receiptTo || "—"}
                  </td>
                </tr>
              </tbody>
              <thead>
                <tr>
                  <th
                    style={{
                      background: primary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      width: "50%",
                      border: "1px solid #ddd",
                    }}
                  >
                    Contact Phone
                  </th>
                  <th
                    style={{
                      background: secondary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      width: "50%",
                      border: "1px solid #ddd",
                    }}
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      border: "1px solid #ddd",
                    }}
                  >
                    {contactPhone || "-------------------"}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      fontSize: "12px",
                      border: "1px solid #ddd",
                    }}
                  >
                    {date || ""}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── MAIN RECEIPT DETAILS TABLE ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1.5px solid #222",
                marginBottom: "36px",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      background: primary,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "12.5px",
                      padding: "9px 14px",
                      width: "32%",
                      border: "1.5px solid #222",
                    }}
                  >
                    Received From
                  </td>
                  <td
                    style={{
                      background: "#fff",
                      color: "#111",
                      fontWeight: 800,
                      fontSize: "14px",
                      padding: "9px 14px",
                      border: "1.5px solid #222",
                    }}
                  >
                    {receivedFrom || receiptTo || "—"}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      background: secondary,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "12.5px",
                      padding: "9px 14px",
                      width: "32%",
                      border: "1.5px solid #222",
                    }}
                  >
                    Amount in figure
                  </td>
                  <td
                    style={{
                      background: "#fff",
                      color: "#111",
                      fontWeight: 800,
                      fontSize: "14px",
                      padding: "9px 14px",
                      border: "1.5px solid #222",
                    }}
                  >
                    {formattedFigure}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      background: primary,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "12.5px",
                      padding: "9px 14px",
                      width: "32%",
                      border: "1.5px solid #222",
                    }}
                  >
                    Amount In words
                  </td>
                  <td
                    style={{
                      background: "#fff",
                      color: "#111",
                      fontWeight: 600,
                      fontSize: "12.5px",
                      padding: "9px 14px",
                      border: "1.5px solid #222",
                    }}
                  >
                    {words}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── CENTERED OFFICIAL STAMP ── */}
            {showStamp && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  margin: "30px 0 36px 0",
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: stampSvg }}
                  style={{ display: "inline-block" }}
                />
              </div>
            )}

            {/* ── PAYMENT STRUCTURE & PAYMENT METHOD TABLE ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "0",
                border: "1.5px solid #222",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      background: primary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "1.5px solid #222",
                      width: "48%",
                    }}
                  >
                    Payment Structure
                  </th>
                  <th
                    colSpan={3}
                    style={{
                      background: secondary,
                      color: "#fff",
                      textAlign: "left",
                      padding: "7px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "1.5px solid #222",
                      width: "52%",
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
                              padding: "10px 12px",
                              fontSize: "11.5px",
                              lineHeight: 1.7,
                              border: "1.5px solid #222",
                              verticalAlign: "top",
                              background: "#fff",
                              width: "48%",
                            }}
                          >
                            <div style={{ marginBottom: "4px" }}>
                              &bull; &nbsp;{paymentAdvance}
                            </div>
                            <div>&bull; &nbsp;{paymentCompletion}</div>
                          </td>
                        )}
                        {row.map((pm, cIdx) => (
                          <th
                            key={cIdx}
                            style={{
                              border: "1px solid #ddd",
                              background: "#fafafa",
                              color: "#111",
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "5px 6px",
                              textAlign: "center",
                              width: "17.33%",
                            }}
                          >
                            {pm.label || <>&nbsp;</>}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {row.map((pm, cIdx) => (
                          <td
                            key={cIdx}
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
                fontWeight: 700,
                border: "1.5px solid #222",
                borderTop: "none",
                marginBottom: "0",
              }}
            >
              {nbText}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div
            style={{
              width: "100%",
              textAlign: "center",
              paddingTop: "12px",
            }}
          >
            <img
              src="/deero-footer.png"
              alt="Deero Contact Information"
              style={{
                maxWidth: "84%",
                height: "auto",
                objectFit: "contain",
                display: "inline-block",
                margin: "0 auto",
              }}
              onError={(e) => ((e.currentTarget as HTMLElement).style.display = "none")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
