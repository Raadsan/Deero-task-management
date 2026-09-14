"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VendorBillLineDisplay {
  id?: string | number;
  description: string;
  account_name?: string;
  account_code?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tax_rate?: number;
  amount: number;
}

export interface A4VendorBillSheetProps {
  billNumber: string;
  vendorName: string;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorCode?: string;
  vendorReference?: string;
  billDate: string;
  dueDate?: string;
  paymentTerm?: string;
  lines: VendorBillLineDisplay[];
  subtotal: number | string;
  taxAmount: number | string;
  grandTotal: number | string;
  paidAmount?: number | string;
  balanceDue?: number | string;
  notes?: string;
  status?: string;
  currencySymbol?: string;
  currencyCode?: string;
  brandPrimary?: string;
  brandSecondary?: string;
  brandLogo?: string;
  showStamp?: boolean;
}

const DEERO_MAROON = "#6e0002";
const DEERO_ORANGE = "#ea580c";

export default function A4VendorBillSheet({
  billNumber,
  vendorName,
  vendorPhone,
  vendorEmail,
  vendorCode,
  vendorReference,
  billDate,
  dueDate,
  paymentTerm,
  lines = [],
  subtotal,
  taxAmount,
  grandTotal,
  paidAmount = 0,
  balanceDue = 0,
  notes,
  status = "posted",
  currencySymbol = "$",
  currencyCode = "USD",
  brandPrimary = DEERO_MAROON,
  brandSecondary = DEERO_ORANGE,
  brandLogo = "/deero-logo.png",
  showStamp = true,
}: A4VendorBillSheetProps) {
  const numSubtotal = Number(subtotal) || 0;
  const numTax = Number(taxAmount) || 0;
  const numGrandTotal = Number(grandTotal) || 0;
  const numPaid = Number(paidAmount) || 0;
  const numBalance = Number(balanceDue) || Math.max(0, numGrandTotal - numPaid);

  const statusLabel =
    status === "draft"
      ? "DRAFT"
      : numBalance <= 0.005
      ? "PAID"
      : numPaid > 0.005
      ? "PARTIAL"
      : "POSTED";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Top Action Bar (hidden when printing) */}
      <div className="w-full max-w-[210mm] mb-3 flex items-center justify-between print:hidden px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-600">Vendor Bill:</span>
          <span className="font-mono text-xs font-bold text-zinc-900">{billNumber}</span>
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              statusLabel === "PAID"
                ? "bg-emerald-100 text-emerald-800"
                : statusLabel === "PARTIAL"
                ? "bg-amber-100 text-amber-800"
                : statusLabel === "DRAFT"
                ? "bg-zinc-100 text-zinc-700"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <Button
          onClick={handlePrint}
          size="sm"
          className="bg-zinc-900 hover:bg-black text-white text-xs font-bold gap-1.5 shadow-sm"
        >
          <Printer className="size-3.5" /> Print Bill
        </Button>
      </div>

      {/* A4 Sheet Container */}
      <div
        id="printable-vendor-bill-sheet"
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
                <p className="text-[10px] text-zinc-400 font-medium">Accounting &bull; Accounts Payable</p>
              </div>
            </div>

            <div className="text-right">
              <div
                className="inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-widest text-white mb-1.5 shadow-xs"
                style={{ backgroundColor: brandPrimary }}
              >
                VENDOR BILL
              </div>
              <p className="font-mono text-sm font-bold text-zinc-900">{billNumber}</p>
              {vendorReference && (
                <p className="text-[11px] text-zinc-500">
                  Ref: <span className="font-semibold text-zinc-700">{vendorReference}</span>
                </p>
              )}
            </div>
          </div>

          {/* Info Section: Bill From & Bill Details */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            {/* Vendor Details */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                BILL FROM (VENDOR)
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
              {vendorCode && (
                <p className="text-zinc-600 flex items-center gap-1.5">
                  <span className="text-zinc-400 font-medium">Vendor ID:</span> {vendorCode}
                </p>
              )}
            </div>

            {/* Bill Details */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  BILL DETAILS
                </span>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-zinc-500 font-medium">Bill Date:</span>
                  <span className="font-semibold text-zinc-900 text-right">{billDate || "—"}</span>

                  <span className="text-zinc-500 font-medium">Due Date:</span>
                  <span className="font-semibold text-zinc-900 text-right">{dueDate || billDate || "—"}</span>

                  {paymentTerm && (
                    <>
                      <span className="text-zinc-500 font-medium">Payment Term:</span>
                      <span className="font-semibold text-zinc-900 text-right">{paymentTerm}</span>
                    </>
                  )}

                  <span className="text-zinc-500 font-medium">Currency:</span>
                  <span className="font-bold text-zinc-900 text-right">{currencyCode}</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-200 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500">Bill Status:</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    statusLabel === "PAID"
                      ? "bg-emerald-100 text-emerald-800"
                      : statusLabel === "PARTIAL"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-zinc-200 text-zinc-800"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Table of Line Items */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 mb-6">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-white text-[11px] font-bold uppercase tracking-wider" style={{ backgroundColor: brandPrimary }}>
                  <th className="p-3 text-left w-[8%]">#</th>
                  <th className="p-3 text-left w-[46%]">Description / Service</th>
                  <th className="p-3 text-right w-[10%]">Qty</th>
                  <th className="p-3 text-right w-[16%]">Unit Price</th>
                  <th className="p-3 text-right w-[20%]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-400 italic">
                      No line items recorded on this vendor bill.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50">
                      <td className="p-3 text-zinc-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-medium text-zinc-900">
                        <p>{line.description || "Vendor expense"}</p>
                        {line.account_name && (
                          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                            Account: {line.account_code ? `${line.account_code} - ` : ""}
                            {line.account_name}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-zinc-700">{line.quantity || 1}</td>
                      <td className="p-3 text-right font-mono text-zinc-700">
                        {currencySymbol}
                        {Number(line.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-zinc-900">
                        {currencySymbol}
                        {Number(line.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Grid: Notes on Left & Financial Totals on Right */}
          <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-6 items-start">
            {/* Notes & Terms */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 min-h-[140px] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  NOTES & TERMS
                </span>
                <p className="text-xs text-zinc-700 whitespace-pre-line leading-relaxed">
                  {notes || "No special notes or terms specified for this bill."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-200/80 text-[10px] text-zinc-400">
                Authorized accounts payable document processed through Deero Accounting.
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-xs">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-zinc-900">
                    {currencySymbol}
                    {numSubtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Tax Amount</span>
                  <span className="font-mono font-medium text-zinc-900">
                    {currencySymbol}
                    {numTax.toFixed(2)}
                  </span>
                </div>

                <div className="my-2 border-t-2 border-zinc-300" />

                <div className="flex justify-between text-sm font-extrabold text-zinc-900">
                  <span>Grand Total</span>
                  <span className="font-mono" style={{ color: brandPrimary }}>
                    {currencySymbol}
                    {numGrandTotal.toFixed(2)}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Paid to Date</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {currencySymbol}
                      {numPaid.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between font-bold">
                    <span className="text-zinc-800">Balance Due</span>
                    <span
                      className={`font-mono ${
                        numBalance > 0.005 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {currencySymbol}
                      {numBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer & Signatures */}
        <div className="mt-10 pt-6 border-t border-zinc-200">
          <div className="flex items-end justify-between">
            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 text-xs">
              <div className="border-t border-zinc-400 pt-1.5 w-36 text-center">
                <p className="font-semibold text-zinc-700">Prepared By</p>
                <p className="text-[10px] text-zinc-400">Finance Dept</p>
              </div>
              <div className="border-t border-zinc-400 pt-1.5 w-36 text-center">
                <p className="font-semibold text-zinc-700">Approved By</p>
                <p className="text-[10px] text-zinc-400">Management</p>
              </div>
            </div>

            {/* Official Stamp */}
            {showStamp && (
              <div
                className="size-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center text-center p-1 font-bold text-[8px] uppercase tracking-wider rotate-[-8deg] opacity-75 shadow-xs"
                style={{ borderColor: brandPrimary, color: brandPrimary }}
              >
                <span>DEERO</span>
                <span className="text-[7px]">ACCOUNTS</span>
                <span>VERIFIED</span>
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
