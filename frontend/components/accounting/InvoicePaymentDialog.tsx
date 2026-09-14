"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard, DollarSign, Loader2, Send, Wallet } from "lucide-react";
import { customerInvoiceApi, type CustomerInvoice } from "@/lib/api/accounting/receivables/customerInvoiceApi";
import { customerReceiptApi } from "@/lib/api/accounting/receivables/customerReceiptApi";
import { accountingPaymentMethodApi, type AccountingPaymentMethod } from "@/lib/api/accounting/configuration/paymentMethodApi";
import { accountingToast } from "@/lib/accounting-ui";

const money = (value: unknown, code = "$") => `${code ? `${code}` : "$"}${Number(value || 0).toFixed(2)}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CustomerInvoice | null;
  onSuccess?: () => void;
}

const DEFAULT_PAPER_METHODS = [
  { label: "SomBank", value: "1001572624" },
  { label: "Premier Bank", value: "020602086001" },
  { label: "Salaam Bank", value: "36122269" },
  { label: "IBS Bank", value: "59676" },
  { label: "EVC-Plus", value: "0618553839" },
  { label: "E-DAHAB", value: "0628553566" },
];

export default function InvoicePaymentDialog({ open, onOpenChange, invoice, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [accountingMethods, setAccountingMethods] = useState<AccountingPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  // Form states
  const [createReceipt, setCreateReceipt] = useState(true);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>("");
  const [selectedPaperMethodIdx, setSelectedPaperMethodIdx] = useState<number>(0);
  const [accountingMethodId, setAccountingMethodId] = useState<string>("");
  const [reference, setReference] = useState("");

  // Load accounting payment methods
  useEffect(() => {
    if (!open) return;
    setLoadingMethods(true);
    accountingPaymentMethodApi
      .getAll()
      .then((methods) => {
        const inbound = (methods || []).filter(
          (m) => m.is_active !== false && m.gl_account_id && ["inbound", "both"].includes(String(m.payment_type))
        );
        setAccountingMethods(inbound);
      })
      .catch((err) => console.error("Failed to load payment methods", err))
      .finally(() => setLoadingMethods(false));
  }, [open]);

  // Parse paper payment methods from invoice notes
  const paperMethods = useMemo(() => {
    if (!invoice?.notes) return DEFAULT_PAPER_METHODS;
    try {
      const meta = JSON.parse(String(invoice.notes));
      if (Array.isArray(meta?.payment_methods) && meta.payment_methods.length > 0) {
        return meta.payment_methods.map((pm: any) => ({
          label: pm.label || pm.name || "Payment Method",
          value: pm.value || pm.account_number || "",
        }));
      }
    } catch {
      // ignore
    }
    return DEFAULT_PAPER_METHODS;
  }, [invoice]);

  // Set default amount and date when invoice opens
  useEffect(() => {
    if (invoice && open) {
      const due = Number(invoice.amount_due ?? invoice.amount_total ?? 0);
      setAmount(due > 0 ? due.toFixed(2) : Number(invoice.amount_total || 0).toFixed(2));
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setReference("");
      setSelectedPaperMethodIdx(0);
      setCreateReceipt(true);
    }
  }, [invoice, open]);

  // Automatically sync Accounting method with selected Paper method
  useEffect(() => {
    if (!accountingMethods.length) return;
    const selectedPaper = paperMethods[selectedPaperMethodIdx];
    const paperName = selectedPaper ? selectedPaper.label.toLowerCase() : "";
    const paperVal = selectedPaper ? selectedPaper.value.toLowerCase() : "";

    // 1. Direct match with specific registered bank / payment method
    const directMatch = accountingMethods.find((m) => {
      const n = String(m.name || "").toLowerCase();
      const c = String(m.code || "").toLowerCase();
      if (paperName.includes("sombank") && (n.includes("sombank") || c.includes("sombank"))) return true;
      if (paperName.includes("premier") && (n.includes("premier") || c.includes("premier"))) return true;
      if (paperName.includes("salaam") && (n.includes("salaam") || c.includes("salaam"))) return true;
      if (paperName.includes("ibs") && (n.includes("ibs") || c.includes("ibs"))) return true;
      if (
        (paperName.includes("evc") || paperName.includes("marchent") || paperName.includes("merchant")) &&
        (n.includes("evc") || c.includes("evc") || n.includes("merchant") || n.includes("marchent"))
      )
        return true;
      if (paperName.includes("dahab") && (n.includes("dahab") || c.includes("dahab"))) return true;
      if (paperVal && n.includes(paperVal)) return true;
      return false;
    });

    if (directMatch) {
      setAccountingMethodId(String(directMatch.id));
      return;
    }

    // 2. Fallback to generic cash/bank
    if (paperName.includes("evc") || paperName.includes("dahab") || paperName.includes("cash") || paperName.includes("mobile")) {
      const cashMatch = accountingMethods.find((m) => {
        const n = String(m.name || "").toLowerCase();
        const c = String(m.code || "").toLowerCase();
        return n.includes("cash") || c.includes("cash");
      });
      if (cashMatch) {
        setAccountingMethodId(String(cashMatch.id));
        return;
      }
    }

    if (paperName.includes("bank")) {
      const bankMatch = accountingMethods.find((m) => {
        const n = String(m.name || "").toLowerCase();
        const c = String(m.code || "").toLowerCase();
        return n.includes("bank") || c.includes("bank");
      });
      if (bankMatch) {
        setAccountingMethodId(String(bankMatch.id));
        return;
      }
    }

    // Default to first accounting method
    if (!accountingMethodId && accountingMethods.length > 0) {
      setAccountingMethodId(String(accountingMethods[0].id));
    }
  }, [selectedPaperMethodIdx, paperMethods, accountingMethods]);

  if (!invoice) return null;

  const isDraft = invoice.state === "draft";
  const selectedPaper = paperMethods[selectedPaperMethodIdx] || paperMethods[0];
  const maxPayable = Number(invoice.amount_due ?? invoice.amount_total ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const numAmount = Number(amount);
    if (createReceipt) {
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return accountingToast("Payment amount must be greater than zero.", "error");
      }
      if (numAmount > maxPayable + 0.01) {
        return accountingToast(`Amount cannot exceed the balance of ${money(maxPayable)}`, "error");
      }
      if (!accountingMethodId) {
        return accountingToast("Please select an Accounting Deposit Account.", "error");
      }
    }

    setSubmitting(true);
    try {
      let activeInvoice = invoice;

      // If draft, post the invoice first
      if (isDraft) {
        activeInvoice = await customerInvoiceApi.post(invoice.id);
      }

      // If creating receipt, post it into accounting
      if (createReceipt) {
        const methodDesc = selectedPaper ? `${selectedPaper.label} (${selectedPaper.value})` : "Direct Payment";
        const refString = reference.trim() ? `${reference.trim()} - ${methodDesc}` : methodDesc;

        const receipt = await customerReceiptApi.create({
          customer_id: activeInvoice.customer_id,
          payment_method_id: Number(accountingMethodId),
          receipt_date: paymentDate,
          amount: numAmount,
          reference: refString,
          memo: `Payment for invoice ${activeInvoice.invoice_number} via ${methodDesc}`,
          allocations: [{ invoice_id: activeInvoice.id, allocated_amount: numAmount }],
        });

        // Post the receipt to trigger accounting entries
        await customerReceiptApi.post(receipt.id);
        accountingToast(`Payment registered & Receipt #${receipt.receipt_number || ""} posted in Accounting!`, "success");
      } else {
        accountingToast(`Invoice ${activeInvoice.invoice_number} posted successfully!`, "success");
      }

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to process payment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !submitting && onOpenChange(val)}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl bg-white border border-zinc-200">
        <DialogHeader className="px-6 py-4 bg-zinc-50 border-b border-zinc-200">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-[#ea580c] text-white flex items-center justify-center font-bold shadow-sm">
              <CreditCard className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900">
                {isDraft ? "Accept & Post Invoice" : "Register Invoice Payment"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                {isDraft
                  ? "Post this invoice and optionally record an immediate customer payment."
                  : "Record customer payment and post a Customer Receipt in Accounting."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Invoice Summary Card */}
          <div className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-200 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Invoice Number:</span>
              <span className="font-bold text-[#ea580c]">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Customer:</span>
              <span className="font-semibold text-zinc-800">{invoice.customers?.name || `#${invoice.customer_id}`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Total Amount:</span>
              <span className="font-semibold text-zinc-800">{money(invoice.amount_total)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-zinc-200 pt-2">
              <span className="text-zinc-700 font-bold">Outstanding Balance:</span>
              <span className="font-bold text-sm text-emerald-600">{money(maxPayable)}</span>
            </div>
          </div>

          {/* If draft: option to toggle immediate receipt */}
          {isDraft && (
            <div className="rounded-xl border border-zinc-200 p-3 bg-white">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createReceipt}
                  onChange={(e) => setCreateReceipt(e.target.checked)}
                  className="size-4 rounded text-orange-600 border-zinc-300 focus:ring-orange-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-zinc-800">Mark as Paid (Create Customer Receipt)</span>
                  <p className="text-[11px] text-zinc-500">
                    Immediately mark the invoice as paid and post journal entries into Accounting.
                  </p>
                </div>
              </label>
            </div>
          )}

          {createReceipt && (
            <div className="space-y-4">
              {/* Payment Methods from Invoice Paper */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center justify-between">
                  <span>Payment Method (from Invoice Paper) *</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Specified on invoice</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {paperMethods.map((pm, idx) => {
                    const isSelected = selectedPaperMethodIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPaperMethodIdx(idx)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-orange-600 bg-[#ea580c] text-white shadow-md ring-2 ring-orange-400 font-bold"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                        }`}
                      >
                        <div className={`text-xs font-semibold leading-snug truncate ${isSelected ? "text-white font-bold" : "text-zinc-800"}`}>
                          {pm.label}
                        </div>
                        <div className={`text-[10.5px] truncate ${isSelected ? "text-white/90 font-medium" : "text-zinc-500"}`}>
                          {pm.value}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Amount Received ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={maxPayable}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Accounting Deposit GL Account */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Accounting Deposit Account (General Ledger) *
                </label>
                <select
                  value={accountingMethodId}
                  onChange={(e) => setAccountingMethodId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-xs font-medium text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {accountingMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {String(m.name || "")} ({String(m.code || "")})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Debits this asset account and credits Accounts Receivable.
                </p>
              </div>

              {/* Reference / Transaction ID */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Transaction Reference / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tx ID #4829104, Cheque #004, etc."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={submitting || (createReceipt && !accountingMethodId)}
              className="bg-[#ea580c] hover:bg-orange-700 text-white text-xs font-bold gap-1.5 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Processing...
                </>
              ) : isDraft ? (
                <>
                  <Send className="size-3.5" /> Accept & Post {createReceipt ? "with Payment" : ""}
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" /> Confirm Payment & Post Receipt
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
