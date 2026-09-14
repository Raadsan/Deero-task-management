"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export interface PaymentAllocationDisplay {
  bill_number?: string;
  bill_date?: string;
  bill_total?: number;
  allocated_amount: number;
}

export interface A4VendorPaymentSheetProps {
  paymentNumber: string;
  vendorName: string;
  vendorPhone?: string;
  vendorEmail?: string;
  paymentDate: string;
  paymentMethod?: string;
  bankAccount?: string;
  reference?: string;
  memo?: string;
  amount: number | string;
  currencySymbol?: string;
  currencyCode?: string;
  allocations?: PaymentAllocationDisplay[];
  brandPrimary?: string;
  brandSecondary?: string;
  brandLogo?: string;
  showStamp?: boolean;
}

const DEERO_MAROON = "#6e0002";
const DEERO_ORANGE = "#ea580c";

export default function A4VendorPaymentSheet({
  paymentNumber,
  vendorName,
  vendorPhone,
  vendorEmail,
  paymentDate,
  paymentMethod = "Cash / Bank Transfer",
  bankAccount,
  reference,
  memo,
  amount,
  currencySymbol = "$",
  currencyCode = "USD",
  allocations = [],
  brandPrimary = DEERO_MAROON,
  brandSecondary = DEERO_ORANGE,
  brandLogo = "/deero-logo.png",
  showStamp = true,
}: A4VendorPaymentSheetProps) {
  const numAmount = Number(amount) || 0;
  const inWords = numberToWords(numAmount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Top Action Bar (hidden when printing) */}
      <div className="w-full max-w-[210mm] mb-3 flex items-center justify-between print:hidden px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-600">Payment Voucher:</span>
          <span className="font-mono text-xs font-bold text-zinc-900">{paymentNumber}</span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-800">
            PAID VOUCHER
          </span>
        </div>
        <Button
          onClick={handlePrint}
          size="sm"
          className="bg-zinc-900 hover:bg-black text-white text-xs font-bold gap-1.5 shadow-sm"
        >
          <Printer className="size-3.5" /> Print Voucher
        </Button>
      </div>

      {/* A4 Sheet Container */}
      <div
        id="printable-vendor-payment-sheet"
        className="w-full max-w-[210mm] min-h-[297mm] bg-white text-zinc-900 shadow-xl border border-zinc-200 print:border-0 print:shadow-none print:m-0 print:p-0 flex flex-col justify-between"
        style={{
          boxSizing: "border-box",
          padding: "16mm 18mm",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b-2" style={{ borderColor: brandPrimary }}>
            <div className="flex items-center gap-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brandLogo}
                alt="Company Logo"
                className="h-14 w-auto object-contain max-w-[160px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div>
                <h1 className="text-xl font-extrabold tracking-tight" style={{ color: brandPrimary }}>
                  Deero Advertising Agency
                </h1>
                <p className="text-[11px] text-zinc-500 leading-snug">
                  Mogadishu, Somalia &bull; info@deero.so &bull; +252 61 5576333
                </p>
                <p className="text-[10px] text-zinc-400 font-medium">Accounting &bull; Disbursement Voucher</p>
              </div>
            </div>

            <div className="text-right">
              <div
                className="inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-widest text-white mb-1.5 shadow-xs"
                style={{ backgroundColor: brandPrimary }}
              >
                PAYMENT VOUCHER
              </div>
              <p className="font-mono text-sm font-bold text-zinc-900">{paymentNumber}</p>
              {reference && (
                <p className="text-[11px] text-zinc-500">
                  Ref: <span className="font-semibold text-zinc-700">{reference}</span>
                </p>
              )}
            </div>
          </div>

          {/* Info Section: Paid To & Payment Metadata */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            {/* Paid To (Vendor) */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                PAID TO (BENEFICIARY)
              </span>
              <h3 className="text-sm font-bold text-zinc-900 mb-1">{vendorName || "Vendor"}</h3>
              {vendorPhone && (
                <p className="text-zinc-600 flex items-center gap-1.5">
                  <span className="text-zinc-400 font-medium">Phone:</span> {vendorPhone}
                </p>
              )}
              {vendorEmail && (
                <p className="text-zinc-600 flex items-center gap-1.5">
                  <span className="text-zinc-400 font-medium">Email:</span> {vendorEmail}
                </p>
              )}
            </div>

            {/* Payment Details */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                VOUCHER DETAILS
              </span>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-zinc-500 font-medium">Payment Date:</span>
                <span className="font-semibold text-zinc-900 text-right">{paymentDate || "—"}</span>

                <span className="text-zinc-500 font-medium">Payment Method:</span>
                <span className="font-semibold text-zinc-900 text-right">{paymentMethod}</span>

                {bankAccount && (
                  <>
                    <span className="text-zinc-500 font-medium">Account / Channel:</span>
                    <span className="font-semibold text-zinc-900 text-right">{bankAccount}</span>
                  </>
                )}

                <span className="text-zinc-500 font-medium">Currency:</span>
                <span className="font-bold text-zinc-900 text-right">{currencyCode}</span>
              </div>
            </div>
          </div>

          {/* Amount In Figures & Words Card */}
          <div
            className="rounded-2xl p-5 mb-6 border flex items-center justify-between text-zinc-900"
            style={{
              borderColor: `${brandPrimary}33`,
              background: `linear-gradient(135deg, ${brandPrimary}08 0%, #ffffff 100%)`,
            }}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                DISBURSED AMOUNT
              </span>
              <p className="text-xs font-semibold text-zinc-700 italic max-w-md">
                &ldquo;{inWords}&rdquo;
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                TOTAL PAID
              </span>
              <span
                className="font-mono text-2xl font-black"
                style={{ color: brandPrimary }}
              >
                {currencySymbol}
                {numAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Allocated Bills Breakdown Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 mb-6">
            <div className="bg-zinc-100/80 px-3.5 py-2 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                Applied Bill Allocations
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {allocations.length} {allocations.length === 1 ? "bill settlement" : "bill settlements"}
              </span>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-white text-[11px] font-bold uppercase tracking-wider" style={{ backgroundColor: brandPrimary }}>
                  <th className="p-3 text-left w-[10%]">#</th>
                  <th className="p-3 text-left w-[40%]">Bill Number</th>
                  <th className="p-3 text-left w-[25%]">Bill Date</th>
                  <th className="p-3 text-right w-[25%]">Settled Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-zinc-400 italic">
                      Direct payment or immediate settlement against vendor account.
                    </td>
                  </tr>
                ) : (
                  allocations.map((alloc, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50">
                      <td className="p-3 text-zinc-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-zinc-900">
                        {alloc.bill_number || `Bill #${idx + 1}`}
                      </td>
                      <td className="p-3 text-zinc-600 font-mono">{alloc.bill_date || "—"}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        {currencySymbol}
                        {Number(alloc.allocated_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Memo / Notes */}
          {memo && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                MEMO / REMARKS
              </span>
              <p className="text-zinc-700 leading-relaxed">{memo}</p>
            </div>
          )}
        </div>

        {/* Footer & Signatures */}
        <div className="mt-10 pt-6 border-t border-zinc-200">
          <div className="flex items-end justify-between">
            {/* Signatures */}
            <div className="grid grid-cols-3 gap-6 text-xs">
              <div className="border-t border-zinc-400 pt-1.5 w-32 text-center">
                <p className="font-semibold text-zinc-700">Prepared By</p>
                <p className="text-[10px] text-zinc-400">Cashier / Finance</p>
              </div>
              <div className="border-t border-zinc-400 pt-1.5 w-32 text-center">
                <p className="font-semibold text-zinc-700">Authorized By</p>
                <p className="text-[10px] text-zinc-400">Finance Manager</p>
              </div>
              <div className="border-t border-zinc-400 pt-1.5 w-32 text-center">
                <p className="font-semibold text-zinc-700">Received By</p>
                <p className="text-[10px] text-zinc-400">Vendor Signature</p>
              </div>
            </div>

            {/* Official Stamp */}
            {showStamp && (
              <div
                className="size-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center text-center p-1 font-bold text-[8px] uppercase tracking-wider rotate-[-6deg] opacity-80 shadow-xs"
                style={{ borderColor: brandPrimary, color: brandPrimary }}
              >
                <span>DEERO</span>
                <span className="text-[7px]">DISBURSEMENT</span>
                <span>PAID</span>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-[10px] text-zinc-400">
            Deero Advertising Agency &bull; Digfeer Road, Hodan, Mogadishu, Somalia &bull; www.deero.so
          </p>
        </div>
      </div>
    </div>
  );
}
