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
import { Printer, X, Send, Receipt } from "lucide-react";
import { vendorBillApi, type VendorBill } from "@/lib/api/accounting/payables/vendorBillApi";
import A4VendorBillSheet, { VendorBillLineDisplay } from "./A4VendorBillSheet";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: VendorBill | null;
  onPostBill?: (bill: VendorBill) => void;
}

export default function VendorBillViewModal({
  open,
  onOpenChange,
  bill,
  onPostBill,
}: Props) {
  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(
    branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2"
  );
  const brandPrimary = isRaadsan ? primaryColor || "#0166d2" : primaryColor || "#6e0002";
  const brandSecondary = isRaadsan ? secondaryColor || "#fdc210" : secondaryColor || "#ea580c";
  const brandLogo = resolveBranchLogoUrl(branchLogoUrl) || (isRaadsan ? "/logo-02.png" : "/deero-logo.png");

  const [activeBill, setActiveBill] = useState<VendorBill | null>(bill);

  useEffect(() => {
    setActiveBill(bill);
    if (bill?.id && open) {
      vendorBillApi
        .getById(bill.id)
        .then((fresh) => {
          if (fresh) setActiveBill(fresh);
        })
        .catch(() => {});
    }
  }, [bill, open]);

  const current = activeBill || bill;
  if (!current) return null;

  const vendorObj = (current.vendors || {}) as any;
  const billNo = current.bill_number || `VB-${String(current.id || 0).padStart(6, "0")}`;

  const rawBillDate = current.bill_date ? new Date(current.bill_date) : new Date();
  const formattedBillDate = !isNaN(rawBillDate.getTime())
    ? rawBillDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const rawDueDate = current.due_date ? new Date(current.due_date) : null;
  const formattedDueDate = rawDueDate && !isNaN(rawDueDate.getTime())
    ? rawDueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : formattedBillDate;

  const lines: VendorBillLineDisplay[] = (current.vendor_bill_lines || []).map((line) => {
    const qty = Number(line.quantity || 1);
    const unitPrice = Number(line.unit_price || line.amount || 0);
    const discount = Number(line.discount_percent || 0);
    const amount = Number(line.subtotal || qty * unitPrice * (1 - discount / 100));

    return {
      id: line.id,
      description: line.description || "Vendor expense / item",
      account_name: (line as any).chart_of_accounts?.name,
      account_code: (line as any).chart_of_accounts?.code,
      quantity: qty,
      unit_price: unitPrice,
      discount_percent: discount,
      tax_rate: (line as any).taxes?.rate_percent ? Number((line as any).taxes.rate_percent) : undefined,
      amount,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] xl:max-w-[1050px] w-full h-[92vh] max-h-[95vh] p-0 flex flex-col overflow-hidden bg-white rounded-2xl shadow-2xl border border-zinc-200"
      >
        {/* Header Bar */}
        <DialogHeader className="px-5 py-3.5 bg-zinc-50 border-b flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: brandPrimary }}
            >
              <Receipt className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 leading-tight">
                Vendor Bill No.: {billNo}
              </DialogTitle>
              <p className="text-xs text-zinc-500 font-medium">
                Vendor: <span className="font-semibold text-zinc-800">{vendorObj.name || "Vendor"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-zinc-900 hover:bg-black text-white text-xs font-semibold gap-1.5 h-8 px-3 rounded-lg shadow-xs"
            >
              <Printer className="size-3.5" /> Print
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              size="sm"
              className="size-8 p-0 rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Sheet Preview Canvas */}
        <div className="flex-1 overflow-y-auto bg-zinc-100/90 p-3 sm:p-5 flex justify-center">
          <div className="w-full">
            <A4VendorBillSheet
              billNumber={billNo}
              vendorName={vendorObj.name || "Vendor"}
              vendorPhone={vendorObj.phone || undefined}
              vendorEmail={vendorObj.email || undefined}
              vendorCode={vendorObj.vendor_code || undefined}
              vendorReference={current.vendor_reference ? String(current.vendor_reference) : undefined}
              billDate={formattedBillDate}
              dueDate={formattedDueDate}
              paymentTerm={(current as any).payment_terms?.name ? String((current as any).payment_terms.name) : undefined}
              lines={lines}
              subtotal={current.amount_untaxed || 0}
              taxAmount={current.amount_tax || 0}
              grandTotal={current.amount_total || 0}
              paidAmount={current.amount_paid || 0}
              balanceDue={current.amount_due || 0}
              notes={(() => {
                const meta = (current as { notes_text?: string }).notes_text
                if (meta) return String(meta)
                const raw = String(current.notes || '')
                if (raw.trim() && !raw.trim().startsWith('{')) return raw
                return undefined
              })()}
              status={
                current.state === 'draft'
                  ? 'draft'
                  : current.payment_state === 'paid'
                    ? 'paid'
                    : current.payment_state === 'partial'
                      ? 'partial'
                      : current.state
              }
              currencySymbol={current.currencies?.symbol || "$"}
              currencyCode={current.currencies?.code || "USD"}
              brandPrimary={brandPrimary}
              brandSecondary={brandSecondary}
              brandLogo={brandLogo}
              showStamp={true}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 bg-white border-t flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500 font-medium">
            Vendor: <strong className="text-zinc-800">{vendorObj.name || "Vendor"}</strong>
            <span className="ml-3 font-semibold text-zinc-900">
              Total: {current.currencies?.symbol || "$"}{Number(current.amount_total || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold h-8 rounded-lg"
            >
              Close
            </Button>
            {current.state === "draft" && onPostBill && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onPostBill(current);
                }}
                className="bg-[#6e0002] hover:bg-[#560002] text-white text-xs font-bold gap-1.5 h-8 px-4 rounded-lg shadow-xs"
              >
                <Send className="size-3.5" /> Post Bill
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
