"use client";

import { accountingToast } from "@/lib/accounting-ui";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Loader2, Receipt } from "lucide-react";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import A4QuotationSheet, { type QuotationLineItem, type PaymentMethodEntry } from "./A4QuotationSheet";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import AccountingConfirmDialog from "@/components/accounting/AccountingConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
  onConverted?: () => void;
  /** Called when user clicks Convert to Invoice on an accepted quotation. */
  onConvertToInvoice?: (quotation: Quotation) => void;
}

export default function QuotationViewModal({
  open,
  onOpenChange,
  quotation,
  onConverted,
  onConvertToInvoice,
}: Props) {
  const [accepting, setAccepting] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const { primaryColor, secondaryColor, name: branchName } = useBranchTheme();
  const isRaadsan = Boolean(branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2");
  const brandPrimary = isRaadsan ? (primaryColor || "#0166d2") : (primaryColor || "#6e0002");
  const brandSecondary = isRaadsan ? (secondaryColor || "#fdc210") : (secondaryColor || "#ea580c");

  useEffect(() => {
    setLocalStatus(quotation?.status || null);
  }, [quotation?.id, quotation?.status, open]);

  const status = localStatus || quotation?.status || "DRAFT";

  const meta = useMemo(() => {
    if (!quotation?.notes) return null;
    try {
      return JSON.parse(String(quotation.notes));
    } catch {
      return null;
    }
  }, [quotation]);

  const contactPerson =
    meta?.contact_person || quotation?.client?.contactPerson || quotation?.customer?.name || "—";

  const contactEmail = meta?.contact_email || quotation?.client?.email || quotation?.customer?.email || "—";

  const contactPhone = meta?.contact_phone || quotation?.client?.phone || quotation?.customer?.phone || "—";

  const quotationTo =
    meta?.quotation_to || quotation?.client?.institution || quotation?.customer?.name || "—";

  const dateStr = quotation?.date
    ? new Date(quotation.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const lines: QuotationLineItem[] = useMemo(() => {
    if (Array.isArray(meta?.items) && meta.items.length > 0) {
      return meta.items.map((item: any, idx: number) => {
        const packageName = String(item.package_name || "").trim();
        const serviceType = String(item.service_type || "Service").trim();
        return {
          id: idx + 1,
          service_type: packageName || serviceType,
          description: item.description || (packageName && serviceType !== packageName ? serviceType : ""),
          quantity: Number(item.qty || item.quantity || 1),
          rate: Number(item.rate || item.unit_price || 0),
          is_free: Boolean(item.is_free || Number(item.rate || item.unit_price || 0) === 0),
          amount: Number(item.qty || item.quantity || 1) * Number(item.rate || item.unit_price || 0),
        };
      });
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
    DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200",
    SENT: "bg-blue-50 text-blue-700 border-blue-200",
    ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
    CONVERTED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const handleAccept = async () => {
    if (!quotation) return;
    try {
      setAccepting(true);
      const updated = await quotationApi.accept(quotation.id);
      setLocalStatus(updated?.status || "ACCEPTED");
      accountingToast(`Quotation ${quotation.quotation_number} accepted`, "success");
      setConfirmAccept(false);
      if (onConverted) onConverted();
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to accept quotation", "error");
    } finally {
      setAccepting(false);
    }
  };

  const handleConvertToInvoice = () => {
    if (!quotation) return;
    const payload = { ...quotation, status: status as Quotation["status"] };
    onOpenChange(false);
    if (onConvertToInvoice) onConvertToInvoice(payload);
  };

  if (!quotation) return null;

  const canAccept = status !== "ACCEPTED" && status !== "CONVERTED" && !quotation.converted_invoice_id;
  const canConvert = status === "ACCEPTED" && !quotation.converted_invoice_id;
  const isInvoiced = Boolean(quotation.converted_invoice_id) || status === "CONVERTED";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="!max-w-[880px] w-full max-h-[96vh] p-0 bg-zinc-100 flex flex-col overflow-hidden rounded-2xl"
        >
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
                  statusColors[status] || "bg-zinc-100"
                }`}
              >
                {status}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const btn = document.querySelector("#a4-quotation-sheet-print-btn") as HTMLButtonElement | null;
                  if (btn) btn.click();
                  else window.print();
                }}
                className="gap-1.5 text-xs font-bold text-white bg-[#ea580c] hover:bg-orange-700 border-none shadow-sm"
              >
                Print / Download PDF
              </Button>
            </div>
          </DialogHeader>

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

          <DialogFooter className="px-5 py-3 bg-white border-t flex items-center justify-between shrink-0">
            <div className="text-xs text-zinc-500 font-medium">
              Customer: <strong className="text-zinc-800">{quotationTo}</strong>
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
              {canAccept && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setConfirmAccept(true)}
                  disabled={accepting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                >
                  {accepting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  {accepting ? "Accepting..." : "Accept Quotation"}
                </Button>
              )}
              {canConvert && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConvertToInvoice}
                  className="bg-[#6e0002] hover:bg-[#8a0a0c] text-white font-bold gap-1.5"
                >
                  <Receipt className="size-4" />
                  Convert to Invoice
                </Button>
              )}
              {isInvoiced && (
                <span className="text-xs font-semibold text-purple-700">
                  Invoiced
                  {quotation.converted_invoice?.invoice_number
                    ? `: ${quotation.converted_invoice.invoice_number}`
                    : ""}
                </span>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AccountingConfirmDialog
        open={confirmAccept}
        title="Accept Quotation"
        description={`Accept quotation ${quotation.quotation_number}?`}
        confirmLabel="Accept Quotation"
        busy={accepting}
        notice="After accepting, use Convert to Invoice to open the invoice form with this quotation."
        details={
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Customer</span>
              <span className="font-semibold text-zinc-900">{quotationTo}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Total</span>
              <span className="font-semibold text-zinc-900">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        }
        onCancel={() => !accepting && setConfirmAccept(false)}
        onConfirm={() => void handleAccept()}
      />
    </>
  );
}
