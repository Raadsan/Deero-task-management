"use client";

import {
  accountingDialogXWideClass,
  accountingFormFieldClass,
  accountingFormSelectClass,
  accountingFormTextareaClass,
  accountingToast,
  btnFormCancel,
  btnFormSubmit,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
} from "@/lib/accounting-ui";
import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calculator } from "lucide-react";
import { quotationApi, type Quotation, type QuotationLine } from "@/lib/api/quotationApi";
import { accountingProductApi } from "@/lib/api/accounting/catalog/productApi";
import { accountingTaxApi } from "@/lib/api/accounting/configuration/taxApi";
import axiosClient from "@/lib/apis/axios";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation?: Quotation | null;
  onSuccess: () => void;
  initialClientId?: string;
}

export default function QuotationModal({ open, onOpenChange, quotation, onSuccess, initialClientId }: Props) {
    const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; institution: string; email?: string }>>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);


  const [clientId, setClientId] = useState(initialClientId || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED">("DRAFT");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment is required within 30 days of invoice date.");
  const [lines, setLines] = useState<QuotationLine[]>([
    { description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null },
  ]);

  useEffect(() => {
    if (open) {
      // Fetch clients list from backend
      axiosClient.get("/clients/basic").then((res) => {
        if (res.data?.data) setClients(res.data.data);
      }).catch(() => {});
      accountingProductApi.getAll().then((data) => setProducts(data || [])).catch(() => {});
      accountingTaxApi.getAll().then((data) => setTaxes(data || [])).catch(() => {});


      if (quotation) {
        setClientId(quotation.client_id || "");
        setDate(quotation.date ? quotation.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setValidUntil(quotation.valid_until ? quotation.valid_until.slice(0, 10) : "");
        setStatus(quotation.status);
        setNotes(quotation.notes || "");
        setTerms(quotation.terms || "");
        if (quotation.lines && quotation.lines.length > 0) {
          setLines(quotation.lines.map((l) => ({
            product_id: l.product_id,
            description: l.description,
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
            discount_percent: Number(l.discount_percent),
            tax_id: l.tax_id,
          })));
        }
      } else {
        setClientId(initialClientId || "");
        setDate(new Date().toISOString().slice(0, 10));
        const defaultValid = new Date();
        defaultValid.setDate(defaultValid.getDate() + 30);
        setValidUntil(defaultValid.toISOString().slice(0, 10));
        setStatus("DRAFT");
        setNotes("");
        setTerms("Payment is required within 30 days of invoice date.");
        setLines([{ description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null }]);
      }
    }
  }, [open, quotation, initialClientId]);

  const handleAddLine = () => {
    setLines([...lines, { description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof QuotationLine, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "product_id" && value) {
      const prod = products.find((p) => String(p.id) === String(value));
      if (prod) {
        updated[index].description = prod.name;
        updated[index].unit_price = Number(prod.list_price || 0);
      }
    }
    setLines(updated);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    lines.forEach((l) => {
      const qty = Number(l.quantity || 0);
      const price = Number(l.unit_price || 0);
      const disc = Number(l.discount_percent || 0);
      const lineRaw = qty * price;
      const lineDisc = (lineRaw * disc) / 100;
      const taxable = lineRaw - lineDisc;

      let lineTax = 0;
      if (l.tax_id) {
        const t = taxes.find((tax) => String(tax.id) === String(l.tax_id));
        if (t) {
          lineTax = (taxable * Number(t.rate_percent)) / 100;
        }
      }

      subtotal += lineRaw;
      discountTotal += lineDisc;
      taxTotal += lineTax;
    });

    const grandTotal = subtotal - discountTotal + taxTotal;
    return { subtotal, discountTotal, taxTotal, grandTotal };
  }, [lines, taxes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      accountingToast("Please select a client", 'error');
      return;
    }
    if (lines.some((l) => !l.description.trim() || Number(l.quantity) <= 0)) {
      accountingToast("Please fill all item descriptions and quantities", 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        client_id: clientId,
        date,
        valid_until: validUntil || null,
        status,
        notes,
        terms,
        lines,
      };

      if (quotation) {
        await quotationApi.update(quotation.id, payload);
        accountingToast("Quotation updated successfully");
      } else {
        await quotationApi.create(payload as any);
        accountingToast("Quotation created successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to save quotation", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={accountingDialogXWideClass}>
        <DialogHeader className={configDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" />
            {quotation ? `Edit Quotation (${quotation.quotation_number})` : "Create New Quotation"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className={`${configDialogBodyClass} space-y-6`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-zinc-600">Client *</Label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full h-10 px-3 mt-1 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.institution} ({c.email || c.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-zinc-600">Quotation Date *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-zinc-600">Valid Until</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Items & Services
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLine} className="h-8 gap-1 text-xs">
                <Plus className="size-3.5" /> Add Item
              </Button>
            </div>

            <div className="border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 border-b text-zinc-600">
                  <tr>
                    <th className="p-3 w-1/4">Product/Service</th>
                    <th className="p-3 w-1/3">Description *</th>
                    <th className="p-3 w-20 text-center">Qty</th>
                    <th className="p-3 w-24 text-right">Price ($)</th>
                    <th className="p-3 w-20 text-center">Disc %</th>
                    <th className="p-3 w-24">Tax</th>
                    <th className="p-3 w-24 text-right">Total ($)</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {lines.map((line, idx) => {
                    const qty = Number(line.quantity || 0);
                    const price = Number(line.unit_price || 0);
                    const disc = Number(line.discount_percent || 0);
                    const lineSub = qty * price * (1 - disc / 100);

                    return (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="p-2">
                          <select
                            value={line.product_id || ""}
                            onChange={(e) => handleLineChange(idx, "product_id", e.target.value ? Number(e.target.value) : null)}
                            className="w-full h-8 px-2 rounded border border-zinc-200 bg-white text-xs"
                          >
                            <option value="">-- Custom --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="Description"
                            value={line.description}
                            onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                            required
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(idx, "quantity", Number(e.target.value))}
                            required
                            className="h-8 text-center text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(idx, "unit_price", Number(e.target.value))}
                            required
                            className="h-8 text-right text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={line.discount_percent}
                            onChange={(e) => handleLineChange(idx, "discount_percent", Number(e.target.value))}
                            className="h-8 text-center text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={line.tax_id || ""}
                            onChange={(e) => handleLineChange(idx, "tax_id", e.target.value ? Number(e.target.value) : null)}
                            className="w-full h-8 px-2 rounded border border-zinc-200 bg-white text-xs"
                          >
                            <option value="">No Tax</option>
                            {taxes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({Number(t.rate_percent)}%)
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-right font-medium">
                          ${lineSub.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lines.length === 1}
                            className="text-zinc-400 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-600">Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-9 px-3 mt-1 rounded-md border border-zinc-200 bg-white text-xs"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="SENT">SENT</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-600">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes for client..."
                  className="w-full p-2 mt-1 rounded-md border border-zinc-200 bg-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-600">Terms & Conditions</Label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={2}
                  placeholder="Terms and conditions..."
                  className="w-full p-2 mt-1 rounded-md border border-zinc-200 bg-white text-xs"
                />
              </div>
            </div>

            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 flex flex-col justify-between">
              <h4 className="font-semibold text-sm text-zinc-700">Summary</h4>
              <div className="space-y-2 mt-3 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal:</span>
                  <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Discount:</span>
                  <span className="font-medium text-amber-600">-${totals.discountTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Tax:</span>
                  <span className="font-medium">${totals.taxTotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-zinc-200 pt-2 flex justify-between font-bold text-base text-primary">
                  <span>Total:</span>
                  <span>${totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          </div>

          <DialogFooter className={configDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className={btnFormCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className={btnFormSubmit}>
              {loading ? "Saving..." : quotation ? "Update Quotation" : "Save Quotation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
