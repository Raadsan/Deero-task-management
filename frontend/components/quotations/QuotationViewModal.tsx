"use client";

import { accountingToast } from '@/lib/accounting-ui';
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, ArrowRight, Printer, Download, CheckCircle, FileText } from "lucide-react";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import { documentTemplateApi } from "@/lib/api/documentTemplateApi";
import { formatDate } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
  onConverted?: () => void;
}

export default function QuotationViewModal({ open, onOpenChange, quotation, onConverted }: Props) {
    const [converting, setConverting] = useState(false);

  if (!quotation) return null;

  const handleConvert = async () => {
    if (!confirm(`Are you sure you want to convert Quotation ${quotation.quotation_number} into an Accounting Invoice? This will post the appropriate Journal Entries.`)) {
      return;
    }

    try {
      setConverting(true);
      const res = await quotationApi.convertToInvoice(quotation.id);
      accountingToast(
        `Successfully converted to Invoice ${res.invoice?.invoice_number || ""}`,
        "success"
      );
      if (onConverted) onConverted();
      onOpenChange(false);
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to convert quotation", 'error');
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadPdf = () => {
    const url = documentTemplateApi.getQuotationRenderUrl(quotation.id);
    const win = window.open(url, "_blank");
    if (win) win.focus();
  };

  const statusColors = {
    DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200",
    SENT: "bg-blue-50 text-blue-700 border-blue-200",
    ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
    CONVERTED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 bg-white">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#1e293b]">
              <FileSpreadsheet className="size-5 text-primary" />
              {quotation.quotation_number}
            </DialogTitle>
            <span
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
                statusColors[quotation.status] || "bg-zinc-100"
              }`}
            >
              {quotation.status}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-6 my-4">
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50 border text-xs">
            <div>
              <p className="text-zinc-500 font-medium">Client / Customer:</p>
              <p className="font-bold text-sm text-zinc-800 mt-0.5">
                {quotation.client?.institution || quotation.customer?.name || "Client"}
              </p>
              <p className="text-zinc-500">{quotation.client?.email || quotation.customer?.email || ""}</p>
              <p className="text-zinc-500">{quotation.client?.phone || quotation.customer?.phone || ""}</p>
            </div>
            <div className="text-right space-y-1">
              <p>
                <span className="text-zinc-500">Quotation Date:</span>{" "}
                <strong>{formatDate(quotation.date)}</strong>
              </p>
              <p>
                <span className="text-zinc-500">Valid Until:</span>{" "}
                <strong>{quotation.valid_until ? formatDate(quotation.valid_until) : "N/A"}</strong>
              </p>
              {quotation.converted_invoice && (
                <p className="text-purple-600 font-bold flex items-center justify-end gap-1 mt-1">
                  <CheckCircle className="size-3.5" /> Converted to Invoice:{" "}
                  {quotation.converted_invoice.invoice_number}
                </p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              Itemized Lines
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-600">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-center">Disc %</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {quotation.lines?.map((line, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50">
                      <td className="p-3 font-medium">{line.description}</td>
                      <td className="p-3 text-center">{Number(line.quantity)}</td>
                      <td className="p-3 text-right">${Number(line.unit_price).toFixed(2)}</td>
                      <td className="p-3 text-center">{Number(line.discount_percent)}%</td>
                      <td className="p-3 text-right font-bold">${Number(line.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-72 bg-zinc-50 p-4 rounded-xl border space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal:</span>
                <span>${Number(quotation.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Discount:</span>
                <span className="text-amber-600">-${Number(quotation.discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Tax:</span>
                <span>${Number(quotation.tax).toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-sm text-primary">
                <span>Grand Total:</span>
                <span>${Number(quotation.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {quotation.notes && (
            <div className="text-xs text-zinc-600 bg-zinc-50 p-3 rounded-lg border">
              <strong>Notes:</strong> {quotation.notes}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4 border-t flex flex-wrap justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1.5">
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
                className="btn-brand gap-1.5"
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
