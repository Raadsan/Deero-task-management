"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Printer, X, CreditCard, Send } from "lucide-react";
import { customerInvoiceApi, type CustomerInvoice } from "@/lib/api/accounting/receivables/customerInvoiceApi";
import { accountingToast } from "@/lib/accounting-ui";
import A4InvoiceSheet, { InvoiceLineItem, PaymentMethodEntry } from "./A4InvoiceSheet";
import AccountingConfirmDialog from "./AccountingConfirmDialog";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CustomerInvoice | null;
  autoPrint?: boolean;
  onInvoiceUpdated?: () => void;
}

export default function InvoiceViewModal({ open, onOpenChange, invoice, autoPrint = false, onInvoiceUpdated }: Props) {
  const router = useRouter();
  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2");
  const brandPrimary = isRaadsan ? (primaryColor || "#0166d2") : (primaryColor || "#6e0002");
  const brandSecondary = isRaadsan ? (secondaryColor || "#fdc210") : (secondaryColor || "#ea580c");
  const brandLogo = resolveBranchLogoUrl(branchLogoUrl) || (isRaadsan ? "/logo-02.png" : "/deero-logo.png");

  const [activeInvoice, setActiveInvoice] = useState<CustomerInvoice | null>(invoice);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setActiveInvoice(invoice);
    if (invoice?.id && open) {
      customerInvoiceApi
        .getById(invoice.id)
        .then((fresh) => {
          if (fresh) setActiveInvoice(fresh);
        })
        .catch(() => {});
    }
  }, [invoice, open]);

  useEffect(() => {
    if (!open || !autoPrint) return;
    const timer = window.setTimeout(() => {
      const printBtn = document.querySelector("#a4-invoice-sheet-print-btn") as HTMLButtonElement | null;
      printBtn?.click();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [autoPrint, open, invoice?.id]);

  const currentInvoice = activeInvoice || invoice;

  // Parse invoice metadata if stored in notes as JSON
  const meta = useMemo(() => {
    if (!currentInvoice || !currentInvoice.notes) return null;
    try {
      return JSON.parse(String(currentInvoice.notes));
    } catch {
      return null;
    }
  }, [currentInvoice]);

  const customerObj = (currentInvoice?.customers || {}) as any;
  const directClient = (currentInvoice as any)?.client || customerObj?.client;

  // Header & Contact mapping
  const contactPerson =
    meta?.contact_person ||
    customerObj?.contact_person ||
    customerObj?.client?.contactPerson ||
    directClient?.contactPerson ||
    customerObj?.name ||
    "—";

  const invoiceNo = currentInvoice?.invoice_number || (currentInvoice?.id ? `INV-${currentInvoice.id}` : "INV-0000");

  const contactEmail =
    meta?.contact_email ||
    customerObj?.email ||
    customerObj?.client?.email ||
    directClient?.email ||
    "—";

  const invoiceTo =
    meta?.invoice_to ||
    meta?.quotation_to ||
    customerObj?.client?.institution ||
    directClient?.institution ||
    customerObj?.name ||
    (currentInvoice?.customer_id ? `Customer #${currentInvoice.customer_id}` : "—");

  const contactPhone =
    meta?.contact_phone ||
    customerObj?.phone ||
    customerObj?.client?.phone ||
    directClient?.phone ||
    "—";

  const dateStr = currentInvoice?.invoice_date
    ? new Date(currentInvoice.invoice_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const dueDateStr = currentInvoice?.due_date
    ? new Date(currentInvoice.due_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : undefined;

  // Lines mapping: check meta.items first for full subservice details, then customer_invoice_lines
  const lines: InvoiceLineItem[] = useMemo(() => {
    if (!currentInvoice) return [];
    if (Array.isArray(meta?.items) && meta.items.length > 0) {
      return meta.items.map((item: any, idx: number) => ({
        id: idx + 1,
        service_type: item.service_type || "Service",
        description: item.description || "",
        quantity: Number(item.qty || item.quantity || 1),
        rate: Number(item.rate || item.unit_price || 0),
        is_free: Boolean(item.is_free || Number(item.rate || item.unit_price || 0) === 0),
        amount: Number(item.qty || item.quantity || 1) * Number(item.rate || item.unit_price || 0) * (1 - Number(item.discount_percent || 0) / 100),
      }));
    }
    return (currentInvoice?.customer_invoice_lines || []).map((line, idx) => {
      const metaItem = Array.isArray(meta?.items) ? meta.items[idx] : null;
      let sType = metaItem?.service_type || line.products?.name || "Service";
      let desc = metaItem?.description || line.description || "";
      if (desc.includes(":") && !line.products?.name && !metaItem?.service_type) {
        const parts = desc.split(":");
        if (parts.length > 1) {
          sType = parts[0].trim();
          desc = parts.slice(1).join(":").trim();
        }
      }
      return {
        id: line.id || idx + 1,
        service_type: sType,
        description: desc,
        quantity: Number(line.quantity || 1),
        rate: Number(line.unit_price || 0),
        is_free: Number(line.unit_price || 0) === 0,
        amount: Number(line.subtotal || Number(line.quantity || 1) * Number(line.unit_price || 0)),
      };
    });
  }, [currentInvoice, meta]);

  const subtotal =
    Number(currentInvoice?.amount_untaxed || 0) ||
    lines.reduce((acc, l) => acc + (l.is_free ? 0 : l.amount), 0);
  const taxAmount = Number(currentInvoice?.amount_tax || 0);
  const grandTotal =
    Number(currentInvoice?.amount_total || 0) || (subtotal + taxAmount);

  const vatPercent =
    meta?.vat_percent !== undefined
      ? Number(meta.vat_percent)
      : subtotal > 0 && taxAmount > 0
      ? Math.round((taxAmount / subtotal) * 100)
      : 5;

  const advanceApplied = Number(currentInvoice?.advance_credit_applied || meta?.advance_credit_applied || 0);
  const previousDebt = Number(currentInvoice?.previous_outstanding_balance || meta?.previous_outstanding_balance || 0);
  const installmentAmount = Number(
    currentInvoice?.contract_installment_amount
    || meta?.contract_installment_amount
    || Math.max(0, grandTotal - previousDebt),
  );
  const invoiceAmount = Number(
    currentInvoice?.invoice_amount ?? Math.max(0, grandTotal - advanceApplied),
  );
  const cashPaid = Math.max(0, Number(currentInvoice?.paid_amount || 0) - advanceApplied);
  const netDue = Number(currentInvoice?.amount_due ?? Math.max(0, grandTotal - Number(currentInvoice?.paid_amount || 0)));
  const contractNumber = currentInvoice?.contract_number || meta?.contract_number || "—";
  const installmentLabel = currentInvoice?.installment_number || meta?.installment_number
    ? `Payment ${String(currentInvoice?.installment_number || meta?.installment_number).padStart(2, "0")}`
    : lines[0]?.description || "—";

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

  const pendingPaid =
    currentInvoice?.state === "draft" && meta?.pending_payment?.enabled
      ? Math.min(Number(meta.pending_payment.amount || 0), Number(currentInvoice.amount_total || 0))
      : Number(currentInvoice?.paid_amount || 0);
  const pendingBalance = Math.max(
    0,
    Math.round((Number(currentInvoice?.amount_total || 0) - pendingPaid) * 100) / 100
  );

  const handlePostInvoice = async () => {
    if (!currentInvoice || currentInvoice.state !== "draft" || posting) return;
    setPosting(true);
    try {
      const posted = await customerInvoiceApi.post(currentInvoice.id);
      setActiveInvoice(posted);
      const paid = Number(posted.paid_amount || 0);
      accountingToast(
        paid > 0.005
          ? `Invoice posted. Paid $${paid.toFixed(2)}. Balance $${Number(posted.amount_due || 0).toFixed(2)}.`
          : "Invoice posted successfully"
      );
      setPostConfirmOpen(false);
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to post invoice", "error");
    } finally {
      setPosting(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700 border-zinc-200",
    posted: "bg-blue-50 text-blue-700 border-blue-200",
    partial: "bg-orange-50 text-orange-700 border-orange-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
    overdue: "bg-red-100 text-red-700 border-red-300 ring-1 ring-red-200",
    DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200",
    UNPAID: "bg-rose-50 text-rose-700 border-rose-200",
    PARTIALLY_PAID: "bg-orange-50 text-orange-700 border-orange-200",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    OVERDUE: "bg-red-100 text-red-700 border-red-300 ring-1 ring-red-200",
    CANCELLED: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = currentInvoice?.due_date ? new Date(currentInvoice.due_date) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);
  const isOverdue =
    currentInvoice?.state === "posted" &&
    currentInvoice?.payment_state === "not_paid" &&
    dueDate !== null &&
    dueDate < today;

  const currentStatus = currentInvoice?.display_status
    || (currentInvoice?.state === "cancelled"
      ? "CANCELLED"
      : currentInvoice?.payment_state === "paid"
      ? "PAID"
      : currentInvoice?.payment_state === "partial"
      ? "PARTIALLY_PAID"
      : isOverdue
      ? "OVERDUE"
      : currentInvoice?.state === "posted"
      ? "UNPAID"
      : "DRAFT");

  if (!currentInvoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="!max-w-[880px] w-full max-h-[96vh] p-0 bg-zinc-100 flex flex-col overflow-hidden rounded-2xl">
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
        <InvoiceDetails
          invoice={currentInvoice}
          customerName={invoiceTo}
          contactPerson={contactPerson}
          phone={contactPhone}
          email={contactEmail}
          status={currentStatus}
          installmentAmount={installmentAmount}
          previousDebt={previousDebt}
          invoiceAmount={invoiceAmount}
          advance={advanceApplied}
          cashPaid={cashPaid}
          netDue={netDue}
          installmentLabel={installmentLabel}
        />
        <div className="flex-1 overflow-y-auto bg-zinc-100 p-2 sm:p-4 flex justify-center">
          <div className="w-full">
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
              paidAmount={cashPaid}
              advanceCreditApplied={advanceApplied}
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
            {currentInvoice.state === "draft" && (
              <Button
                type="button"
                size="sm"
                onClick={() => setPostConfirmOpen(true)}
                className="bg-[#ea580c] hover:bg-orange-700 text-white text-xs font-bold gap-1.5 shadow-sm"
              >
                <Send className="size-3.5" /> Post Invoice
              </Button>
            )}
            {currentInvoice.state === "posted" && currentInvoice.payment_state !== "paid" && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  try {
                    sessionStorage.setItem('receiptFromInvoiceId', String(currentInvoice.id));
                  } catch {}
                  router.push('/accounting/customer-receipts');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
              >
                <CreditCard className="size-3.5" /> Register Payment
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <AccountingConfirmDialog
        open={postConfirmOpen}
        title="Post Invoice"
        description="Confirm posting. Any Receive Payment Now amount already entered will be applied automatically."
        confirmLabel="Post Invoice"
        busy={posting}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Invoice Number</span><b>{invoiceNo}</b></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Customer</span><b>{currentInvoice.customers?.name || invoiceTo}</b></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Invoice Total</span><b>${Number(currentInvoice.amount_total || 0).toFixed(2)}</b></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Paid</span><b>${pendingPaid.toFixed(2)}</b></div>
            <div className="my-1 border-t border-zinc-200" />
            <div className="flex justify-between gap-4"><span className="font-semibold text-zinc-800">Balance Due</span><b className="text-emerald-700">${pendingBalance.toFixed(2)}</b></div>
            {pendingPaid > 0.005 ? (
              <p className="pt-1 text-[11px] text-zinc-500">
                The existing Receive Payment Now amount will be applied automatically. No additional payment is required.
              </p>
            ) : (
              <p className="pt-1 text-[11px] text-zinc-500">
                No payment will be recorded. The balance remains Accounts Receivable.
              </p>
            )}
          </div>
        }
        onCancel={() => setPostConfirmOpen(false)}
        onConfirm={() => void handlePostInvoice()}
      />

    </Dialog>
  );
}

function milestoneName(value?: string | null) {
  const labels: Record<string, string> = {
    CONTRACT_START: "Advance",
    AFTER_1_MONTH: "After 1 Month",
    AFTER_3_MONTHS: "After 3 Months",
    AFTER_6_MONTHS: "After 6 Months",
    AFTER_12_MONTHS: "After 12 Months",
    CONTRACT_COMPLETION: "Contract Completion",
  };
  if (!value) return "—";
  return labels[value] || value.replace(/_/g, " ");
}

function detailDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function moneyText(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function InvoiceDetails({
  invoice,
  customerName,
  contactPerson,
  phone,
  email,
  status,
  installmentAmount,
  previousDebt,
  invoiceAmount,
  advance,
  cashPaid,
  netDue,
  installmentLabel,
}: {
  invoice: CustomerInvoice;
  customerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  status: string;
  installmentAmount: number;
  previousDebt: number;
  invoiceAmount: number;
  advance: number;
  cashPaid: number;
  netDue: number;
  installmentLabel: string;
}) {
  const address = invoice.client?.address || invoice.customers?.client?.address || "—";
  const payments = invoice.payment_history || [];
  const duration = invoice.contract_duration
    || [detailDate(invoice.contract_start), detailDate(invoice.contract_end)].filter((value) => value !== "—").join(" – ")
    || "—";
  return (
    <div className="max-h-[42vh] space-y-4 overflow-y-auto border-b border-zinc-200 bg-white px-5 py-4 text-xs text-zinc-700">
      <DetailBlock title="Invoice">
        <Detail label="Invoice number" value={invoice.invoice_number || "—"} />
        <Detail label="Invoice date" value={detailDate(invoice.invoice_date)} />
        <Detail label="Due date" value={detailDate(invoice.due_date)} />
        <Detail label="Status" value={status.replace(/_/g, " ")} />
      </DetailBlock>
      <DetailBlock title="Customer">
        <Detail label="Client name" value={customerName} />
        <Detail label="Contact person" value={contactPerson || "—"} />
        <Detail label="Phone" value={phone || "—"} />
        <Detail label="Email" value={email || "—"} />
        <Detail label="Address" value={address} />
      </DetailBlock>
      <DetailBlock title="Contract">
        <Detail label="Contract number" value={invoice.contract_number || "—"} />
        <Detail label="Contract title" value={invoice.contract_title || "—"} />
        <Detail label="Duration" value={duration} />
        <Detail label="Contract amount" value={invoice.contract_amount != null ? moneyText(Number(invoice.contract_amount)) : "—"} />
        <Detail label="Payment terms" value={invoice.contract_payment_terms || "—"} />
      </DetailBlock>
      <DetailBlock title="Installment">
        <Detail label="Installment" value={invoice.installment_label || installmentLabel || "—"} />
        <Detail label="Percentage" value={invoice.installment_percentage != null ? `${invoice.installment_percentage}%` : "—"} />
        <Detail label="Milestone" value={milestoneName(invoice.installment_milestone)} />
        <Detail label="Scheduled due date" value={detailDate(invoice.installment_due_date || invoice.due_date)} />
      </DetailBlock>
      <DetailBlock title="Financial summary">
        <Detail label="Contract installment amount" value={moneyText(installmentAmount)} />
        <Detail label="Previous outstanding balance" value={moneyText(previousDebt)} />
        <Detail label="Advance/credit applied" value={moneyText(advance)} />
        <Detail label="Invoice amount" value={moneyText(invoiceAmount)} />
        <Detail label="Amount paid" value={moneyText(cashPaid)} />
        <Detail label="Balance due" value={moneyText(netDue)} />
      </DetailBlock>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Payment history</p>
        {payments.length === 0 ? (
          <p className="text-zinc-500">No cash receipt has been recorded for this invoice. Advance credit is not a receipt.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wide text-zinc-500">
                <th className="py-1 pr-2 font-semibold">Date</th>
                <th className="py-1 pr-2 font-semibold">Receipt</th>
                <th className="py-1 pr-2 font-semibold">Method</th>
                <th className="py-1 pr-2 font-semibold">Amount</th>
                <th className="py-1 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr key={`${payment.receipt_number || "receipt"}-${index}`} className="border-b border-zinc-100">
                  <td className="py-1.5 pr-2">{detailDate(payment.date)}</td>
                  <td className="py-1.5 pr-2">{payment.receipt_number || "—"}</td>
                  <td className="py-1.5 pr-2">{payment.method || "—"}</td>
                  <td className="py-1.5 pr-2">{moneyText(Number(payment.amount || 0))}</td>
                  <td className="py-1.5">{payment.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-zinc-500">{label}: </span>
      <span className="font-semibold text-zinc-900">{value}</span>
    </p>
  );
}
