"use client";

import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Download, X } from "lucide-react";
import type { CustomerInvoice } from "@/lib/api/accounting/receivables/customerInvoiceApi";
import A4InvoiceSheet, { InvoiceLineItem, PaymentMethodEntry } from "./A4InvoiceSheet";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CustomerInvoice | null;
}

export default function InvoiceViewModal({ open, onOpenChange, invoice }: Props) {
  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2");
  const brandPrimary = isRaadsan ? (primaryColor || "#0166d2") : (primaryColor || "#6e0002");
  const brandSecondary = isRaadsan ? (secondaryColor || "#fdc210") : (secondaryColor || "#ea580c");
  const brandLogo = resolveBranchLogoUrl(branchLogoUrl) || (isRaadsan ? "/logo-02.png" : "/deero-logo.png");

  // Parse invoice metadata if stored in notes as JSON
  const meta = useMemo(() => {
    if (!invoice || !invoice.notes) return null;
    try {
      return JSON.parse(String(invoice.notes));
    } catch {
      return null;
    }
  }, [invoice]);

  if (!invoice) return null;

  const customerObj = invoice.customers as { name?: string; contact_person?: string; email?: string; phone?: string } | undefined;

  // Header & Contact mapping
  const contactPerson =
    meta?.contact_person ||
    customerObj?.contact_person ||
    customerObj?.name ||
    "—";

  const invoiceNo = invoice.invoice_number || `INV-${invoice.id}`;

  const contactEmail =
    meta?.contact_email ||
    customerObj?.email ||
    "—";

  const invoiceTo =
    meta?.invoice_to ||
    meta?.quotation_to ||
    customerObj?.name ||
    `Customer #${invoice.customer_id}`;

  const contactPhone =
    meta?.contact_phone ||
    customerObj?.phone ||
    "—";

  const dateStr = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const dueDateStr = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : undefined;

  // Lines mapping
  const lines: InvoiceLineItem[] = (invoice.customer_invoice_lines || []).map((line, idx) => {
    // Check if line metadata item exists in meta.items
    const metaItem = Array.isArray(meta?.items) ? meta.items[idx] : null;
    return {
      id: line.id || idx + 1,
      service_type: metaItem?.service_type || line.description?.split(" - ")[0] || "Service",
      description: metaItem?.description || line.description || "",
      quantity: Number(line.quantity || 1),
      rate: Number(line.unit_price || 0),
      is_free: Number(line.unit_price || 0) === 0,
      amount: Number(line.subtotal || 0),
    };
  });

  const subtotal = Number(invoice.amount_untaxed || 0);
  const taxAmount = Number(invoice.amount_tax || 0);
  const grandTotal = Number(invoice.amount_total || 0);

  const vatPercent =
    meta?.vat_percent !== undefined
      ? Number(meta.vat_percent)
      : subtotal > 0 && taxAmount > 0
      ? Math.round((taxAmount / subtotal) * 100)
      : 5;

  const paymentAdvance =
    meta?.payment_advance || "70% of charge paid in advance.";
  const paymentCompletion =
    meta?.payment_completion || "30% of charge paid after the project Completion";
  const nbText =
    meta?.nb || meta?.nb_text || "NB: the advance amount should be paid when you get the invoice.";

  const paymentMethods: PaymentMethodEntry[] =
    Array.isArray(meta?.payment_methods) && meta.payment_methods.length > 0
      ? meta.payment_methods.map((pm: any) => ({
          label: pm.label || pm.name || "",
          value: pm.value || pm.account_number || "",
        }))
      : [
          { label: "SomBank", value: "1001572624" },
          { label: "Premier Bank", value: "020602086001" },
          { label: "Salaam Bank", value: "36122269" },
          { label: "IBS Bank", value: "59676" },
          { label: "EVC-Plus", value: "0618553839" },
          { label: "E-DAHAB", value: "0628553566" },
        ];

  const statusColors: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700 border-zinc-200",
    posted: "bg-blue-50 text-blue-700 border-blue-200",
    partial: "bg-orange-50 text-orange-700 border-orange-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const currentStatus =
    invoice.state === "cancelled"
      ? "cancelled"
      : invoice.payment_state === "paid"
      ? "paid"
      : invoice.payment_state === "partial"
      ? "partial"
      : invoice.state || "draft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[99vw] max-h-[97vh] p-0 bg-zinc-100 flex flex-col overflow-hidden">
        {/* Header bar */}
        <DialogHeader className="px-5 py-3.5 bg-white border-b flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <FileText className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                {invoiceNo}
              </DialogTitle>
              <p className="text-xs text-zinc-500">Standard Customer Sales Invoice</p>
            </div>
            <span
              className={`ml-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full border ${
                statusColors[currentStatus] || "bg-zinc-100"
              }`}
            >
              {currentStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Trigger print from A4InvoiceSheet print logic
                const printBtn = document.querySelector("#a4-invoice-sheet-print-btn") as HTMLButtonElement | null;
                if (printBtn) {
                  printBtn.click();
                } else {
                  window.print();
                }
              }}
              className="gap-1.5 text-xs font-bold text-white bg-[#ea580c] hover:bg-orange-700 border-none shadow-sm"
            >
              <Printer className="size-3.5" /> Print / Download PDF
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="size-8 p-0 text-zinc-500 hover:text-zinc-900"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Modal Body with A4 Invoice Template Sheet */}
        <div className="flex-1 overflow-y-auto bg-zinc-100 p-3 sm:p-6 flex justify-center">
          <div className="w-full max-w-[960px]">
            <A4InvoiceSheet
              contactPerson={contactPerson}
              invoiceNo={invoiceNo}
              contactEmail={contactEmail}
              invoiceTo={invoiceTo}
              contactPhone={contactPhone}
              date={dateStr}
              dueDate={dueDateStr}
              lines={lines}
              subtotal={subtotal}
              vatPercent={vatPercent}
              taxAmount={taxAmount}
              paidAmount={invoice.paid_amount ?? Number(invoice.amount_total) - Number(invoice.amount_due)}
              grandTotal={grandTotal}
              paymentAdvance={paymentAdvance}
              paymentCompletion={paymentCompletion}
              nbText={nbText}
              paymentMethods={paymentMethods}
              showStamp={true}
              brandPrimary={brandPrimary}
              brandSecondary={brandSecondary}
              brandLogo={brandLogo}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 bg-white border-t flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500 font-medium">
            Customer: <strong className="text-zinc-800">{invoiceTo}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold"
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
