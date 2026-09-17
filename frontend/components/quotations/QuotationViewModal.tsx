"use client";

import { accountingToast } from "@/lib/accounting-ui";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import A4QuotationSheet, { type QuotationLineItem, type PaymentMethodEntry } from "./A4QuotationSheet";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
  onConverted?: () => void;
}

export default function QuotationViewModal({ open, onOpenChange, quotation, onConverted }: Props) {
  const [converting, setConverting] = useState(false);

  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2");
  const brandPrimary = isRaadsan ? (primaryColor || "#0166d2") : (primaryColor || "#6e0002");
  const brandSecondary = isRaadsan ? (secondaryColor || "#fdc210") : (secondaryColor || "#ea580c");

  // Parse rich metadata stored in notes JSON
  const meta = useMemo(() => {
    if (!quotation?.notes) return null;
    try { return JSON.parse(String(quotation.notes)); } catch { return null; }
  }, [quotation]);

  // Contact info
  const contactPerson =
    meta?.contact_person ||
    quotation?.client?.contactPerson ||
    quotation?.customer?.name ||
    "—";

  const contactEmail =
    meta?.contact_email ||
    quotation?.client?.email ||
    quotation?.customer?.email ||
    "—";

  const contactPhone =
    meta?.contact_phone ||
    quotation?.client?.phone ||
    quotation?.customer?.phone ||
    "—";

  const quotationTo =
    meta?.quotation_to ||
    quotation?.client?.institution ||
    quotation?.customer?.name ||
    "—";

  const dateStr = quotation?.date
    ? new Date(quotation.date).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : "—";

  // Build line items from meta.items or fallback to quotation.lines
  const lines: QuotationLineItem[] = useMemo(() => {
    if (Array.isArray(meta?.items) && meta.items.length > 0) {
      return meta.items.map((item: any, idx: number) => ({
        id: idx + 1,
        service_type: item.service_type || "Service",
        description: item.description || "",
        quantity: Number(item.qty || item.quantity || 1),
        rate: Number(item.rate || item.unit_price || 0),
        is_free: Boolean(item.is_free || Number(item.rate || item.unit_price || 0) === 0),
        amount: Number(item.qty || item.quantity || 1) * Number(item.rate || item.unit_price || 0),
      }));
    }
    return (quotation?.lines || []).map((line, idx) => ({
      id: idx + 1,
      service_type: line.products?.name || "Service",
      description: line.description || "",
      quantity: Number(line.quantity || 1),
      rate: Number(line.unit_price || 0),
      is_free: Number(line.unit_price || 0) === 0,
      amount: Number(line.quantity || 1) * Number(line.unit_price || 0),
    }));
  }, [quotation, meta]);

  const subtotal = Number(quotation?.subtotal || 0);
  const vatPercent = meta?.vat_percent !== undefined ? Number(meta.vat_percent) : 5;
  const taxAmount = Number(quotation?.tax || 0);
  const grandTotal = Number(quotation?.total || 0);

  const paymentAdvance = meta?.payment_advance || "70% of charge paid in advance.";
  const paymentCompletion = meta?.payment_completion || "30% of charge paid after the project Completion";
  const nbText = meta?.nb || meta?.nb_text || "NB: the advance amount should be paid when you get the invoice.";

  const paymentMethods: PaymentMethodEntry[] =
    Array.isArray(meta?.payment_methods) && meta.payment_methods.length > 0
      ? meta.payment_methods.map((pm: any) => ({ label: pm.label || pm.name || "", value: pm.value || pm.account_number || "" }))
      : [
          { label: "SomBank", value: "1001572624" },
          { label: "Premier Bank", value: "020602086001" },
          { label: "Salaam Bank", value: "36122269" },
          { label: "IBS Bank", value: "59676" },
          { label: "EVC-Plus", value: "0618553839" },
          { label: "E-DAHAB", value: "0628553566" },
        ];

  const statusColors: Record<string, string> = {
    DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200",
    SENT: "bg-blue-50 text-blue-700 border-blue-200",
    ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
    CONVERTED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const handleConvert = async () => {
    if (!quotation) return;
    if (
      !confirm(
        `Accept Quotation ${quotation.quotation_number}? No invoice will be created yet. Import it later from Customer Invoices → Import from Accepted Quotation.`
      )
    ) return;

    try {
      setConverting(true);
      await quotationApi.accept(quotation.id);
      accountingToast(`Quotation ${quotation.quotation_number} accepted — available for invoice import`, "success");
      if (onConverted) onConverted();
      onOpenChange(false);
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to accept quotation", "error");
    } finally {
      setConverting(false);
    }
  };

  if (!quotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="!max-w-[880px] w-full max-h-[96vh] p-0 bg-zinc-100 flex flex-col overflow-hidden rounded-2xl">
        {/* Header bar — same layout as InvoiceViewModal */}
        <DialogHeader className="px-5 py-3.5 bg-white border-b flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <FileText className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                {quotation.quotation_number}
              </DialogTitle>
              <p className="text-xs text-zinc-500">Standard Customer Quotation</p>
            </div>
            <span
              className={`ml-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full border ${
                statusColors[quotation.status] || "bg-zinc-100"
              }`}
            >
              {quotation.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Print button triggers A4 print via hidden button inside A4QuotationSheet */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const btn = document.querySelector("#a4-quotation-sheet-print-btn") as HTMLButtonElement | null;
                if (btn) btn.click(); else window.print();
              }}
              className="gap-1.5 text-xs font-bold text-white bg-[#ea580c] hover:bg-orange-700 border-none shadow-sm"
            >
              Print / Download PDF
            </Button>
          </div>
        </DialogHeader>

        {/* A4 Sheet Body — same as InvoiceViewModal */}
        <div className="flex-1 overflow-y-auto bg-zinc-100 p-2 sm:p-4 flex justify-center">
          <div className="w-full">
            <A4QuotationSheet
              contactPerson={contactPerson}
              quotationNo={quotation.quotation_number}
              contactEmail={contactEmail}
              quotationTo={quotationTo}
              contactPhone={contactPhone}
              date={dateStr}
              lines={lines}
              subtotal={subtotal}
              vatPercent={vatPercent}
              taxAmount={taxAmount}
              grandTotal={grandTotal}
              paymentAdvance={paymentAdvance}
              paymentCompletion={paymentCompletion}
              nbText={nbText}
              paymentMethods={paymentMethods}
              brandPrimary={brandPrimary}
              brandSecondary={brandSecondary}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 bg-white border-t flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500 font-medium">
            Customer: <strong className="text-zinc-800">{quotationTo}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
              Close
            </Button>
            {quotation.status !== "ACCEPTED" && quotation.status !== "CONVERTED" && !quotation.converted_invoice_id && (
              <Button
                type="button"
                size="sm"
                onClick={handleConvert}
                disabled={converting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
              >
                {converting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                {converting ? "Accepting..." : "Accept Quotation"}
              </Button>
            )}
            {quotation.status === "ACCEPTED" && !quotation.converted_invoice_id && (
              <span className="text-xs font-semibold text-emerald-700">Accepted — import from Invoice form</span>
            )}
            {Boolean(quotation.converted_invoice_id) && (
              <span className="text-xs font-semibold text-purple-700">
                Invoiced{quotation.converted_invoice?.invoice_number ? `: ${quotation.converted_invoice.invoice_number}` : ""}
              </span>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
