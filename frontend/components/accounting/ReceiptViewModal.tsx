"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileCheck, Printer, X, Send } from "lucide-react";
import { customerReceiptApi, type CustomerReceipt } from "@/lib/api/accounting/receivables/customerReceiptApi";
import A4ReceiptSheet, { PaymentMethodEntry } from "./A4ReceiptSheet";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: CustomerReceipt | null;
  onReceiptUpdated?: () => void;
  onPostReceipt?: (receipt: CustomerReceipt) => void;
}

export default function ReceiptViewModal({
  open,
  onOpenChange,
  receipt,
  onReceiptUpdated,
  onPostReceipt,
}: Props) {
  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(
    branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2"
  );
  const brandPrimary = isRaadsan ? primaryColor || "#0166d2" : primaryColor || "#6e0002";
  const brandSecondary = isRaadsan ? secondaryColor || "#fdc210" : secondaryColor || "#ea580c";
  const brandLogo = resolveBranchLogoUrl(branchLogoUrl) || (isRaadsan ? "/logo-02.png" : "/deero-logo.png");

  const [activeReceipt, setActiveReceipt] = useState<CustomerReceipt | null>(receipt);

  useEffect(() => {
    setActiveReceipt(receipt);
    if (receipt?.id && open) {
      customerReceiptApi
        .getById(receipt.id)
        .then((fresh) => {
          if (fresh) setActiveReceipt(fresh);
        })
        .catch(() => {});
    }
  }, [receipt, open]);

  const current = activeReceipt || receipt;
  if (!current) return null;

  const customerObj = (current.customers || {}) as any;
  const clientObj = customerObj?.client || {};

  const contactPerson =
    clientObj.contactPerson ||
    customerObj.contact_person ||
    "Abshir Abdullahi";

  const receiptNo =
    current.receipt_number ||
    (current.id ? `#DADVRV${new Date(current.receipt_date || Date.now()).getFullYear().toString().slice(-2)} ${String(current.id).padStart(3, "0")}` : "#DADVRV000");

  const contactEmail =
    customerObj.email ||
    clientObj.email ||
    "-------------------";

  const receiptTo =
    clientObj.institution ||
    customerObj.name ||
    (current.customer_id ? `Customer #${current.customer_id}` : "—");

  const contactPhone =
    customerObj.phone ||
    clientObj.phone ||
    "+252615576333";

  const rawDate = current.receipt_date ? new Date(current.receipt_date) : new Date();
  const formattedDate =
    !isNaN(rawDate.getTime())
      ? `${rawDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })},`
      : "";

  const statusColors: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700 border-zinc-200",
    posted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[900px] w-full max-h-[96vh] p-0 bg-zinc-100 flex flex-col overflow-hidden rounded-2xl"
      >
        {/* Header Bar */}
        <DialogHeader className="px-5 py-3.5 bg-white border-b flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <FileCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                {receiptNo}
              </DialogTitle>
              <p className="text-xs text-zinc-500">Official Customer Payment Receipt Voucher</p>
            </div>
            <span
              className={`ml-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full border ${
                statusColors[current.state] || "bg-zinc-100"
              }`}
            >
              {current.state}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const printBtn = document.querySelector(
                  "#a4-receipt-sheet-print-btn"
                ) as HTMLButtonElement | null;
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

        {/* Modal Body with A4 Receipt Voucher Sheet */}
        <div className="flex-1 overflow-y-auto bg-zinc-100 p-2 sm:p-4 flex justify-center">
          <div className="w-full">
            <A4ReceiptSheet
              contactPerson={contactPerson}
              receiptNo={receiptNo}
              contactEmail={contactEmail}
              receiptTo={receiptTo}
              contactPhone={contactPhone}
              date={formattedDate}
              receivedFrom={receiptTo}
              amount={current.amount}
              currencySymbol={current.currencies?.symbol || "$"}
              currencyCode={current.currencies?.code || "USD"}
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
            Customer: <strong className="text-zinc-800">{receiptTo}</strong>
            <span className="ml-3 font-semibold text-zinc-900">
              Amount: {current.currencies?.symbol || "$"}{Number(current.amount || 0).toFixed(2)}
            </span>
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
            {current.state === "draft" && onPostReceipt && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onPostReceipt(current);
                }}
                className="bg-[#ea580c] hover:bg-orange-700 text-white text-xs font-bold gap-1.5 shadow-sm"
              >
                <Send className="size-3.5" /> Post Receipt
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
