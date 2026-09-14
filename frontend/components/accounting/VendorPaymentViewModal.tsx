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
import { Printer, X, Send, CreditCard } from "lucide-react";
import { vendorPaymentApi, type VendorPayment } from "@/lib/api/accounting/payables/vendorPaymentApi";
import A4VendorPaymentSheet, { PaymentAllocationDisplay } from "./A4VendorPaymentSheet";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: VendorPayment | null;
  onPostPayment?: (payment: VendorPayment) => void;
}

export default function VendorPaymentViewModal({
  open,
  onOpenChange,
  payment,
  onPostPayment,
}: Props) {
  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(
    branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2"
  );
  const brandPrimary = isRaadsan ? primaryColor || "#0166d2" : primaryColor || "#6e0002";
  const brandSecondary = isRaadsan ? secondaryColor || "#fdc210" : secondaryColor || "#ea580c";
  const brandLogo = resolveBranchLogoUrl(branchLogoUrl) || (isRaadsan ? "/logo-02.png" : "/deero-logo.png");

  const [activePayment, setActivePayment] = useState<VendorPayment | null>(payment);

  useEffect(() => {
    setActivePayment(payment);
    if (payment?.id && open) {
      vendorPaymentApi
        .getById(payment.id)
        .then((fresh) => {
          if (fresh) setActivePayment(fresh);
        })
        .catch(() => {});
    }
  }, [payment, open]);

  const current = activePayment || payment;
  if (!current) return null;

  const vendorObj = (current as any).vendors || {};
  const paymentNo = current.payment_number || `PAY-${String(current.id || 0).padStart(4, "0")}`;

  const rawDate = current.payment_date ? new Date(current.payment_date) : new Date();
  const formattedDate = !isNaN(rawDate.getTime())
    ? rawDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const allocations: PaymentAllocationDisplay[] = ((current as any).payment_allocations || []).map((alloc: any) => ({
    bill_number: alloc.vendor_bills?.bill_number || `Bill #${alloc.bill_id}`,
    bill_date: alloc.vendor_bills?.bill_date
      ? new Date(alloc.vendor_bills.bill_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : undefined,
    bill_total: alloc.vendor_bills?.amount_total ? Number(alloc.vendor_bills.amount_total) : undefined,
    allocated_amount: Number(alloc.allocated_amount || 0),
  }));

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
              <CreditCard className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 leading-tight">
                Payment Voucher Preview &bull; {paymentNo}
              </DialogTitle>
              <p className="text-xs text-zinc-500 font-medium">
                Paid to: <span className="font-semibold text-zinc-800">{vendorObj.name || "Vendor"}</span>
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

        {/* Voucher Sheet Preview Canvas */}
        <div className="flex-1 overflow-y-auto bg-zinc-100/90 p-3 sm:p-5 flex justify-center">
          <div className="w-full">
            <A4VendorPaymentSheet
              paymentNumber={paymentNo}
              vendorName={vendorObj.name || "Vendor"}
              vendorPhone={vendorObj.phone || undefined}
              vendorEmail={vendorObj.email || undefined}
              paymentDate={formattedDate}
              paymentMethod={(current as any).payment_methods?.name || "Cash / Mobile Wallet / Bank"}
              bankAccount={(current as any).bank_accounts?.account_name || undefined}
              reference={current.reference || undefined}
              memo={current.memo || undefined}
              amount={current.amount || 0}
              currencySymbol={(current as any).currencies?.symbol || "$"}
              currencyCode={(current as any).currencies?.code || "USD"}
              allocations={allocations}
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
            Beneficiary: <strong className="text-zinc-800">{vendorObj.name || "Vendor"}</strong>
            <span className="ml-3 font-semibold text-zinc-900">
              Paid: {(current as any).currencies?.symbol || "$"}{Number(current.amount || 0).toFixed(2)}
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
            {current.state === "draft" && onPostPayment && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onPostPayment(current);
                }}
                className="bg-[#6e0002] hover:bg-[#560002] text-white text-xs font-bold gap-1.5 h-8 px-4 rounded-lg shadow-xs"
              >
                <Send className="size-3.5" /> Post Payment
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
