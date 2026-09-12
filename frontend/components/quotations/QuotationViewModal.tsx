"use client";

import { accountingToast } from "@/lib/accounting-ui";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer, Download, FileText, Loader2 } from "lucide-react";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import { documentTemplateApi } from "@/lib/api/documentTemplateApi";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
  onConverted?: () => void;
}

export default function QuotationViewModal({ open, onOpenChange, quotation, onConverted }: Props) {
  const [converting, setConverting] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  if (!quotation) return null;

  // Build the render URL from the database render endpoint
  const renderUrl = documentTemplateApi.getQuotationRenderUrl(quotation.id);

  const handleConvert = async () => {
    if (
      !confirm(
        `Are you sure you want to convert Quotation ${quotation.quotation_number} into an Accounting Invoice? This will post the appropriate Journal Entries.`
      )
    ) {
      return;
    }

    try {
      setConverting(true);
      const res = await quotationApi.convertToInvoice(quotation.id);
      accountingToast(`Successfully converted to Invoice ${res.invoice?.invoice_number || ""}`, "success");
      if (onConverted) onConverted();
      onOpenChange(false);
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to convert quotation", "error");
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadPdf = () => {
    const win = window.open(renderUrl, "_blank");
    if (win) win.focus();
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200",
    SENT: "bg-blue-50 text-blue-700 border-blue-200",
    ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
    CONVERTED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] p-0 bg-zinc-50 flex flex-col overflow-hidden">
        {/* Sticky Header */}
        <DialogHeader className="px-4 py-3 bg-white border-b flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-zinc-900">
              <FileText className="size-4 text-[#ea580c]" />
              {quotation.quotation_number}
            </DialogTitle>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full border ${
                statusColors[quotation.status] || "bg-zinc-100"
              }`}
            >
              {quotation.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="gap-1.5 text-xs font-bold text-zinc-700 hover:text-black border-zinc-300"
            >
              <Printer className="size-3.5 text-[#ea580c]" /> Print / Download PDF
            </Button>
          </div>
        </DialogHeader>

        {/* iframe Body - reads real template from database via backend render endpoint */}
        <div className="flex-1 relative overflow-hidden bg-zinc-100 min-h-0">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-100 z-10">
              <Loader2 className="size-8 text-[#ea580c] animate-spin" />
              <span className="text-xs font-semibold text-zinc-500">Loading quotation template from database...</span>
            </div>
          )}
          <iframe
            key={quotation.id}
            src={renderUrl}
            title={`Quotation ${quotation.quotation_number}`}
            className="w-full h-full border-0"
            style={{ minHeight: "calc(95vh - 130px)" }}
            onLoad={() => setIframeLoading(false)}
            onError={() => setIframeLoading(false)}
          />
        </div>

        {/* Sticky Footer */}
        <DialogFooter className="px-4 py-3 bg-white border-t flex flex-wrap justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="gap-1.5 text-xs font-bold text-white bg-[#ea580c] hover:bg-orange-700 border-none"
            >
              <Download className="size-4" /> Download / Print PDF
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {quotation.status !== "CONVERTED" && (
              <Button
                type="button"
                size="sm"
                onClick={handleConvert}
                disabled={converting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
              >
                <ArrowRight className="size-4" />
                {converting ? "Converting..." : "Convert to Invoice"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
