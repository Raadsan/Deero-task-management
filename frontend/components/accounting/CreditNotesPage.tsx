'use client';

import { accountingToast } from '@/lib/accounting-ui';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Ban, SquarePen, Eye, Plus, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { creditNoteApi, type CreditNote } from '@/lib/api/accounting/receivables/creditNoteApi';
import { accountingPaymentMethodApi, type AccountingPaymentMethod } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { customerInvoiceApi, type CustomerInvoice, type CustomerInvoiceLine } from '@/lib/api/accounting/receivables/customerInvoiceApi';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass } from '@/lib/dashboard-ui';

type Line = {
  original_line_id: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  max_quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_id?: number | null;
  income_account_id: number;
  tax_rate: number;
  price_includes_tax: boolean;
};

type SettlementMethod = 'customer_credit' | 'cash_refund';

type Form = {
  reversed_invoice_id: string;
  invoice_date: string;
  customer_reference: string;
  notes: string;
  settlement_method: SettlementMethod;
  lines: Line[];
};

type RefundForm = {
  amount: string;
  payment_date: string;
  payment_method_id: string;
  reference: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): Form => ({
  reversed_invoice_id: '',
  invoice_date: today(),
  customer_reference: '',
  notes: '',
  settlement_method: 'customer_credit',
  lines: [],
});
const emptyRefundForm = (): RefundForm => ({
  amount: '',
  payment_date: today(),
  payment_method_id: '',
  reference: '',
  notes: '',
});
const dateValue = (value: unknown) => (value ? new Date(String(value)).toISOString().slice(0, 10) : '');
const money = (value: unknown, code = '') => `${code ? `${code} ` : ''}${Number(value || 0).toFixed(2)}`;
const money2 = (value: number) => Math.round(Number(value || 0) * 100) / 100;
const errorMessage = (error: unknown) =>
  axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

function lineAmounts(line: Line) {
  const gross = Number(line.quantity || 0) * Number(line.unit_price || 0);
  const discounted = gross * (1 - Number(line.discount_percent || 0) / 100);
  const rate = Number(line.tax_rate || 0) / 100;
  if (!line.tax_id || rate <= 0) {
    return { untaxed: money2(discounted), tax: 0, total: money2(discounted) };
  }
  if (line.price_includes_tax) {
    const untaxed = money2(discounted / (1 + rate));
    const tax = money2(discounted - untaxed);
    return { untaxed, tax, total: money2(discounted) };
  }
  const untaxed = money2(discounted);
  const tax = money2(untaxed * rate);
  return { untaxed, tax, total: money2(untaxed + tax) };
}

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<CreditNote | null>(null);
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete' | 'cancel'; note: CreditNote } | null>(null);
  const [creditableAmount, setCreditableAmount] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<AccountingPaymentMethod[]>([]);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundForm, setRefundForm] = useState<RefundForm>(emptyRefundForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notes, invoiceRows, methods] = await Promise.all([
        creditNoteApi.getAll(),
        customerInvoiceApi.getAll(),
        accountingPaymentMethodApi.getAll(),
      ]);
      setCreditNotes(notes);
      setInvoices(invoiceRows);
      setPaymentMethods(methods.filter((m) => ['outbound', 'both'].includes(String((m as any).payment_type || 'both'))));
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const creditedQtyByInvoice = useMemo(() => {
    const map = new Map<number, Map<number, number>>();
    creditNotes
      .filter((note) => note.state === 'posted' || note.state === 'draft')
      .forEach((note) => {
        const lineMap = map.get(note.reversed_invoice_id) || new Map<number, number>();
        const meta = Array.isArray((note as any).line_meta) ? (note as any).line_meta : [];
        if (meta.length) {
          meta.forEach((row: any) => {
            const id = Number(row.original_line_id);
            const qty = Number(row.quantity || 0);
            if (id && qty > 0) lineMap.set(id, (lineMap.get(id) || 0) + qty);
          });
        } else {
          (note.customer_invoice_lines || []).forEach((line) => {
            // legacy fallback keyed later by description match in chooseInvoice
            const fakeId = -Math.abs(Number(line.id || 0));
            lineMap.set(fakeId, (lineMap.get(fakeId) || 0) + Number(line.quantity || 0));
          });
        }
        map.set(note.reversed_invoice_id, lineMap);
      });
    return map;
  }, [creditNotes]);

  const creditedAmountByInvoice = useMemo(() => {
    const totals = new Map<number, number>();
    creditNotes
      .filter((note) => note.state === 'posted' || note.state === 'draft')
      .forEach((note) => {
        totals.set(note.reversed_invoice_id, (totals.get(note.reversed_invoice_id) || 0) + Number(note.amount_total));
      });
    return totals;
  }, [creditNotes]);

  const selectedOriginalId = Number(form.reversed_invoice_id) || 0;

  const availableCredit = (invoice?: CustomerInvoice) => {
    if (creditableAmount != null && invoice?.id === selectedOriginalId) return creditableAmount;
    return invoice ? Math.max(0, Number(invoice.amount_total) - (creditedAmountByInvoice.get(invoice.id) || 0)) : 0;
  };

  const remainingQtyForLine = (invoiceId: number, lineId: number, originalQty: number) => {
    const used = creditedQtyByInvoice.get(invoiceId)?.get(lineId) || 0;
    return Math.max(0, money2(Number(originalQty) - used));
  };

  const original = invoices.find((invoice) => invoice.id === selectedOriginalId);
  const eligibleInvoices = invoices.filter((invoice) => invoice.state === 'posted' && availableCredit(invoice) > 0.005);

  const totals = useMemo(() => {
    let untaxed = 0;
    let tax = 0;
    form.lines.forEach((line) => {
      const amounts = lineAmounts(line);
      untaxed += amounts.untaxed;
      tax += amounts.tax;
    });
    return { untaxed: money2(untaxed), tax: money2(tax), total: money2(untaxed + tax) };
  }, [form.lines]);

  const postPreviewSettlement = useMemo(() => {
    if (!original || totals.total <= 0.005) return null;
    const outstanding = Number(original.amount_due || 0);
    const appliedToAr = money2(Math.min(totals.total, outstanding));
    const liability = money2(Math.max(0, totals.total - appliedToAr));
    return { appliedToAr, liability, settlement_method: form.settlement_method };
  }, [original, totals.total, form.settlement_method]);

  const customers = [
    ...new Map(creditNotes.filter((row) => row.customers).map((row) => [row.customer_id, row.customers!])).values(),
  ];

  const filtered = creditNotes.filter((note) => {
    const needle = query.trim().toLowerCase();
    const day = dateValue(note.invoice_date);
    return (
      (!needle ||
        [note.invoice_number, note.customers?.name, note.customer_invoices?.invoice_number, note.customer_reference].some(
          (value) => String(value || '').toLowerCase().includes(needle)
        )) &&
      (status === 'all' || note.state === status) &&
      (customerFilter === 'all' || note.customer_id === Number(customerFilter)) &&
      (!dateFrom || day >= dateFrom) &&
      (!dateTo || day <= dateTo)
    );
  });

  function buildLinesFromInvoice(invoice: CustomerInvoice, quantityOverrides?: Map<number, number>): Line[] {
    return (invoice.customer_invoice_lines || []).map((line: CustomerInvoiceLine) => {
      const maxQty = remainingQtyForLine(invoice.id, Number(line.id), Number(line.quantity));
      const override = quantityOverrides?.get(Number(line.id));
      return {
        original_line_id: Number(line.id),
        product_id: line.product_id || null,
        description: line.description,
        quantity: override != null ? Number(override) : maxQty,
        max_quantity: maxQty,
        unit_price: Number(line.unit_price),
        discount_percent: Number(line.discount_percent || 0),
        tax_id: line.tax_id || null,
        income_account_id: Number(line.income_account_id),
        tax_rate: Number(line.taxes?.rate_percent || 0),
        price_includes_tax: Boolean(line.taxes?.price_includes_tax),
      };
    });
  }

  function createNote() {
    setSelected(null);
    setViewOnly(false);
    setCreditableAmount(null);
    setForm(emptyForm());
    setOpen(true);
  }

  async function chooseInvoice(value: string) {
    const invoice = invoices.find((row) => row.id === Number(value));
    if (!invoice) {
      setCreditableAmount(null);
      setForm((current) => ({ ...current, reversed_invoice_id: value, lines: [] }));
      return;
    }
    try {
      const payload = await creditNoteApi.getCreditableInvoice(invoice.id);
      setCreditableAmount(payload.creditable_amount);
      const lines: Line[] = payload.lines.map((line) => ({
        original_line_id: line.original_line_id,
        product_id: line.product_id || null,
        description: line.description,
        quantity: 0,
        max_quantity: money2(line.remaining_quantity),
        unit_price: line.unit_price,
        discount_percent: line.discount_percent,
        tax_id: line.tax_id || null,
        income_account_id: line.income_account_id,
        tax_rate: line.tax_rate,
        price_includes_tax: line.price_includes_tax,
      }));
      setForm((current) => ({ ...current, reversed_invoice_id: value, lines }));
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
      setCreditableAmount(null);
      setForm((current) => ({ ...current, reversed_invoice_id: value, lines: [] }));
    }
  }

  async function edit(note: CreditNote, readOnly = false) {
    setSelected(note);
    setViewOnly(readOnly || note.state !== 'draft');
    const invoice = invoices.find((row) => row.id === Number(note.reversed_invoice_id));
    const meta = Array.isArray(note.line_meta) ? note.line_meta : [];
    const overrides = new Map<number, number>();
    meta.forEach((row) => {
      if (row.original_line_id != null) overrides.set(Number(row.original_line_id), Number(row.quantity || 0));
    });

    let lines: Line[] = [];
  let nextCreditable: number | null = null;
    if (invoice) {
      try {
        const payload = await creditNoteApi.getCreditableInvoice(
          invoice.id,
          note.state === 'draft' ? note.id : undefined
        );
        nextCreditable = payload.creditable_amount;
        lines = payload.lines.map((line) => {
          const savedQty = overrides.has(line.original_line_id) ? Number(overrides.get(line.original_line_id)) : 0;
          return {
            original_line_id: line.original_line_id,
            product_id: line.product_id || null,
            description: line.description,
            quantity: savedQty,
            max_quantity: money2(line.remaining_quantity + (note.state === 'draft' ? savedQty : 0)),
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_id: line.tax_id || null,
            income_account_id: line.income_account_id,
            tax_rate: line.tax_rate,
            price_includes_tax: line.price_includes_tax,
          };
        });
      } catch {
        lines = buildLinesFromInvoice(invoice, overrides).map((line) => {
          const savedQty = overrides.has(line.original_line_id) ? Number(overrides.get(line.original_line_id)) : 0;
          const maxQty = note.state === 'draft' ? money2(line.max_quantity + savedQty) : line.max_quantity;
          return { ...line, quantity: savedQty, max_quantity: maxQty };
        });
      }
    } else {
      lines = (note.customer_invoice_lines || []).map((line) => ({
        original_line_id: Number(line.id),
        product_id: line.product_id || null,
        description: line.description,
        quantity: Number(line.quantity),
        max_quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        discount_percent: Number(line.discount_percent || 0),
        tax_id: line.tax_id || null,
        income_account_id: Number(line.income_account_id),
        tax_rate: Number(line.taxes?.rate_percent || 0),
        price_includes_tax: Boolean(line.taxes?.price_includes_tax),
      }));
    }

    const reason = note.reason || String(note.notes || '').trim();
    setCreditableAmount(nextCreditable);
    setForm({
      reversed_invoice_id: String(note.reversed_invoice_id),
      invoice_date: dateValue(note.invoice_date),
      customer_reference: String(note.customer_reference || ''),
      notes: reason,
      settlement_method: (note.settlement_method || 'customer_credit') as SettlementMethod,
      lines,
    });
    setOpen(true);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.quantity != null) {
          const qty = Math.max(0, Number(patch.quantity));
          next.quantity = Math.min(qty, Number(line.max_quantity));
        }
        return next;
      }),
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.lines.some((line) => Number(line.quantity) > 0)) {
      return accountingToast('Set at least one credit quantity greater than zero.', 'error');
    }
    setSaving(true);
    try {
      const payload = {
        reversed_invoice_id: Number(form.reversed_invoice_id),
        invoice_date: new Date(`${form.invoice_date}T00:00:00.000Z`).toISOString(),
        customer_reference: form.customer_reference || undefined,
        notes: form.notes,
        settlement_method: form.settlement_method,
        lines: form.lines.map((line) => ({
          original_line_id: line.original_line_id,
          product_id: line.product_id,
          description: line.description,
          quantity: Number(line.quantity),
          unit_price: Number(line.unit_price),
          discount_percent: Number(line.discount_percent),
          tax_id: line.tax_id,
          income_account_id: line.income_account_id,
        })),
      };
      if (selected) await creditNoteApi.update(selected.id, payload);
      else await creditNoteApi.create(payload);
      accountingToast(selected ? 'Draft credit note updated successfully' : 'Draft credit note created successfully');
      setOpen(false);
      await load();
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function post(note: CreditNote) {
    setSaving(true);
    try {
      await creditNoteApi.post(note.id);
      accountingToast('Credit note posted successfully');
      setPendingAction(null);
      await load();
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  function openRefundDialog(note: CreditNote) {
    setSelected(note);
    setRefundForm({
      ...emptyRefundForm(),
      amount: String(note.refund_payable ?? note.amount_due ?? ''),
      payment_date: today(),
    });
    setRefundOpen(true);
  }

  async function submitRefund(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await creditNoteApi.recordRefund(selected.id, {
        amount: Number(refundForm.amount),
        payment_date: new Date(`${refundForm.payment_date}T00:00:00.000Z`).toISOString(),
        payment_method_id: Number(refundForm.payment_method_id),
        reference: refundForm.reference || undefined,
        notes: refundForm.notes || undefined,
      });
      accountingToast('Customer refund recorded successfully');
      setRefundOpen(false);
      setOpen(false);
      await load();
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function cancelNote(note: CreditNote) {
    setSaving(true);
    try {
      await creditNoteApi.cancel(note.id);
      accountingToast('Credit note cancelled successfully');
      setPendingAction(null);
      await load();
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(note: CreditNote) {
    setSaving(true);
    try {
      await creditNoteApi.remove(note.id);
      accountingToast('Draft credit note deleted');
      setPendingAction(null);
      await load();
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  function print(note: CreditNote) {
    edit(note, true);
    window.setTimeout(() => window.print(), 150);
  }

  const columns: DashboardTableColumn<CreditNote>[] = [
    { key: 'number', header: 'Credit Note', cell: (note) => <span className="font-bold text-primary">{note.invoice_number}</span> },
    { key: 'date', header: 'Date', cell: (note) => dateValue(note.invoice_date) },
    { key: 'customer', header: 'Customer', cell: (note) => note.customers?.name || '—' },
    { key: 'invoice', header: 'Original Invoice', cell: (note) => note.customer_invoices?.invoice_number || '—' },
    { key: 'untaxed', header: 'Subtotal', align: 'right', cell: (note) => money(note.amount_untaxed) },
    { key: 'tax', header: 'VAT', align: 'right', cell: (note) => money(note.amount_tax) },
    { key: 'amount', header: 'Total Credit', align: 'right', cell: (note) => <span className="font-semibold">{money(note.amount_total)}</span> },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (note) => (
        <span
          className={`${dashboardStatusBadgeClass} ${
            note.state === 'posted' ? 'bg-emerald-600 text-white' : note.state === 'cancelled' ? 'bg-rose-600 text-white' : 'bg-secondary/100 text-white'
          }`}
        >
          {String(note.display_state || note.state).toUpperCase()}
        </span>
      ),
    },
    { key: 'reference', header: 'Reference', cell: (note) => note.customer_reference || '—' },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (note) => (
        <div className="flex justify-end gap-1">
          <button title="View" onClick={() => edit(note, true)} className={actionBtnView}>
            <Eye className="size-4" />
          </button>
          {note.state === 'draft' && (
            <>
              <button title="Edit" onClick={() => edit(note)} className={actionBtnEdit}>
                <SquarePen className="size-4" />
              </button>
              <button title="Post" onClick={() => setPendingAction({ type: 'post', note })} className={actionBtnView}>
                <Send className="size-4" />
              </button>
              <button title="Delete" onClick={() => setPendingAction({ type: 'delete', note })} className={actionBtnDelete}>
                <Trash2 className="size-4" />
              </button>
            </>
          )}
          {note.state === 'posted' && (
            <>
              {note.settlement_method === 'cash_refund' && Number(note.refund_payable ?? note.amount_due) > 0.005 ? (
                <button title="Record refund" onClick={() => openRefundDialog(note)} className={actionBtnEdit}>
                  <RefreshCw className="size-4" />
                </button>
              ) : null}
              <button title="Print" onClick={() => print(note)} className={actionBtnView}>
                <Printer className="size-4" />
              </button>
              <button title="Void" onClick={() => setPendingAction({ type: 'cancel', note })} className={actionBtnDelete}>
                <Ban className="size-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AccountingPageShell section="Receivables" title="Credit Notes" description="Create customer credits against posted invoices. Drafts do not affect accounting.">
      <DashboardDataTable
        rows={filtered}
        columns={columns}
        loading={loading}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search credit notes..."
        emptyText="No credit notes found"
        minWidth="1200px"
        action={
          <button onClick={createNote} className={btnCreatePage}>
            <Plus className="size-4" /> New credit note
          </button>
        }
        filters={
          <>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={dashboardSelectClass}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={dashboardSelectClass}>
              <option value="all">All customers</option>
              {customers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <input aria-label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={dashboardSelectClass} />
            <input aria-label="Date to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={dashboardSelectClass} />
            <button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border">
              <RefreshCw className="size-4" />
            </button>
          </>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-[min(100vw-2rem,52rem)] max-w-[52rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[52rem]">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-5 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{viewOnly ? 'Credit note' : selected ? 'Edit draft credit note' : 'New credit note'}</DialogTitle>
            <DialogDescription>A draft does not affect the invoice, customer balance, or General Ledger until posted.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Credit Note Number</p>
                <p className="mt-1 font-semibold">{selected?.invoice_number || 'Auto-generated (CN####)'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
                <p className="mt-1 font-semibold uppercase">{selected?.state || 'draft'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Total Credit</p>
                <p className="mt-1 font-semibold">{money(totals.total, original?.currencies?.code)}</p>
              </div>
            </div>

            <fieldset disabled={viewOnly || saving} className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Original posted invoice *
                <select
                  required
                  value={form.reversed_invoice_id}
                  onChange={(e) => chooseInvoice(e.target.value)}
                  disabled={Boolean(selected)}
                  className="mt-1 h-11 w-full rounded-xl border bg-background px-3 disabled:bg-muted"
                >
                  <option value="">Select invoice</option>
                  {eligibleInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} — {invoice.customers?.name} — Creditable {money(availableCredit(invoice), invoice.currencies?.code)}
                      {Number(invoice.amount_due) <= 0.005 ? ' (Paid)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Credit note date *
                <input
                  required
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
                />
              </label>
              <label className="text-sm font-medium">
                Reference
                <input
                  value={form.customer_reference}
                  onChange={(e) => setForm({ ...form, customer_reference: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
                />
              </label>
              <label className="text-sm font-medium">
                Reason / Notes
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Credit settlement method *
                <select
                  required
                  disabled={viewOnly || Boolean(selected && selected.state !== 'draft')}
                  value={form.settlement_method}
                  onChange={(e) => setForm({ ...form, settlement_method: e.target.value as SettlementMethod })}
                  className="mt-1 h-11 w-full rounded-xl border bg-background px-3 disabled:bg-muted"
                >
                  <option value="customer_credit">Customer credit for future invoice (2140)</option>
                  <option value="cash_refund">Cash / bank refund (Customer Refund Payable)</option>
                </select>
              </label>
            </fieldset>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3">Remaining Qty</th>
                    <th className="p-3">Credit Qty</th>
                    <th className="p-3">Unit Price</th>
                    <th className="p-3">Discount %</th>
                    <th className="p-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Select an original invoice to load its lines.
                      </td>
                    </tr>
                  ) : (
                    form.lines.map((line, index) => {
                      const amounts = lineAmounts(line);
                      return (
                        <tr key={line.original_line_id || index} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{line.description}</div>
                            {line.tax_rate > 0 ? <div className="text-xs text-muted-foreground">VAT {line.tax_rate}%</div> : null}
                          </td>
                          <td className="p-3 font-semibold">{line.max_quantity}</td>
                          <td className="p-3">
                            <input
                              disabled={viewOnly || line.max_quantity <= 0}
                              required
                              min="0"
                              max={line.max_quantity}
                              step="1"
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                              className="h-10 w-28 rounded-lg border px-3 disabled:bg-muted"
                            />
                          </td>
                          <td className="p-3">
                            <input disabled value={line.unit_price} className="h-10 w-32 rounded-lg border bg-muted px-3" />
                          </td>
                          <td className="p-3">
                            <input disabled value={line.discount_percent} className="h-10 w-24 rounded-lg border bg-muted px-3" />
                          </td>
                          <td className="p-3 text-right font-semibold">{money(amounts.total)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-sm rounded-xl border p-4 text-sm">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <b>{money(totals.untaxed)}</b>
              </div>
              <div className="flex justify-between py-1">
                <span>VAT</span>
                <b>{money(totals.tax)}</b>
              </div>
              <div className="my-2 border-t" />
              <div className="flex justify-between py-1 text-base font-bold">
                <span>Total Credit</span>
                <span>{money(totals.total)}</span>
              </div>
              {postPreviewSettlement && !viewOnly ? (
                <div className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Applied to receivable</span>
                    <b className="text-foreground">{money(postPreviewSettlement.appliedToAr)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      {postPreviewSettlement.settlement_method === 'cash_refund'
                        ? 'Refund payable (2150)'
                        : 'Customer credit (2140)'}
                    </span>
                    <b className="text-foreground">{money(postPreviewSettlement.liability)}</b>
                  </div>
                </div>
              ) : null}
              {selected?.state === 'posted' && selected.settlement ? (
                <div className="mt-3 space-y-1 border-t pt-2 text-xs">
                  <div className="flex justify-between">
                    <span>Settlement</span>
                    <b>
                      {selected.settlement_method === 'cash_refund' ? 'Cash / bank refund' : 'Future customer credit'}
                    </b>
                  </div>
                  <div className="flex justify-between">
                    <span>Posted AR reduction</span>
                    <b>{money(selected.settlement.applied_to_ar ?? selected.paid_amount)}</b>
                  </div>
                  {selected.settlement_method === 'cash_refund' ? (
                    <>
                      <div className="flex justify-between">
                        <span>Refund payable remaining</span>
                        <b>{money(selected.refund_payable ?? selected.amount_due)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Refund status</span>
                        <b className="uppercase">{String(selected.refund_status || 'not_refunded').replaceAll('_', ' ')}</b>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Customer credit available</span>
                        <b>{money(selected.customer_credit ?? selected.amount_due)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Credit status</span>
                        <b className="uppercase">{String(selected.customer_credit_status || 'available').replaceAll('_', ' ')}</b>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              {original && Number(original.amount_due) <= 0.005 && form.settlement_method === 'customer_credit' ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Original invoice is fully paid. Posting creates customer credit on account 2140 without changing invoice paid history.
                </p>
              ) : null}
              {original && Number(original.amount_due) <= 0.005 && form.settlement_method === 'cash_refund' ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Original invoice stays paid. Posting records refund payable (2150). Cash leaves the business only when you record the refund payment.
                </p>
              ) : null}
            </div>

            {original && totals.total > availableCredit(original) + 0.005 && (
              <p className="text-sm font-medium text-destructive">
                Credit total cannot exceed the remaining creditable amount of {money(availableCredit(original), original.currencies?.code)}.
              </p>
            )}
            </div>

            <DialogFooter className="shrink-0 border-t border-zinc-100 px-5 py-3 sm:px-6">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                Close
              </button>
              {!viewOnly && (
                <button
                  disabled={
                    saving ||
                    !form.lines.some((l) => Number(l.quantity) > 0) ||
                    totals.total <= 0 ||
                    Boolean(original && totals.total > availableCredit(original) + 0.005)
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save draft credit note'}
                </button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record customer refund</DialogTitle>
            <DialogDescription>
              Posts Dr Customer Refund Payable (2150) / Cr Cash or Bank. Original invoice payment history is unchanged.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRefund} className="space-y-3">
            <label className="block text-sm font-medium">
              Refund amount
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                max={selected?.refund_payable ?? selected?.amount_due}
                value={refundForm.amount}
                onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border px-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Payment date
              <input
                required
                type="date"
                value={refundForm.payment_date}
                onChange={(e) => setRefundForm({ ...refundForm, payment_date: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border px-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Cash / bank payment method
              <select
                required
                value={refundForm.payment_method_id}
                onChange={(e) => setRefundForm({ ...refundForm, payment_method_id: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border px-3"
              >
                <option value="">Select method</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {`${String(method.name ?? "")} (${String((method as Record<string, unknown>).payment_type ?? "")})`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Reference
              <input
                value={refundForm.reference}
                onChange={(e) => setRefundForm({ ...refundForm, reference: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border px-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Notes
              <input
                value={refundForm.notes}
                onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border px-3"
              />
            </label>
            <DialogFooter>
              <button type="button" onClick={() => setRefundOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                Close
              </button>
              <button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                {saving ? 'Saving…' : 'Record refund'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AccountingConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.type === 'delete'
            ? 'Delete Credit Note'
            : pendingAction?.type === 'cancel'
              ? 'Cancel Credit Note'
              : 'Post Credit Note'
        }
        description={
          pendingAction?.type === 'delete'
            ? 'Confirm removal of this draft credit note.'
            : pendingAction?.type === 'cancel'
              ? 'Creates a reversal journal entry and restores the original invoice outstanding where applicable. Blocked if customer credit was already used.'
              : 'Confirm posting. This creates one journal entry. Fully paid invoices become customer credit, not fake invoice outstanding.'
        }
        confirmLabel={
          pendingAction?.type === 'delete' ? 'Delete Credit Note' : pendingAction?.type === 'cancel' ? 'Cancel Credit Note' : 'Post Credit Note'
        }
        destructive={pendingAction?.type === 'delete' || pendingAction?.type === 'cancel'}
        busy={saving}
        details={
          pendingAction && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Note</span>
                <b>{pendingAction.note.invoice_number}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Credit</span>
                <b>{money(pendingAction.note.amount_total)}</b>
              </div>
            </div>
          )
        }
        onCancel={() => setPendingAction(null)}
        onConfirm={() =>
          pendingAction &&
          void (pendingAction.type === 'delete'
            ? remove(pendingAction.note)
            : pendingAction.type === 'cancel'
              ? cancelNote(pendingAction.note)
              : post(pendingAction.note))
        }
      />
    </AccountingPageShell>
  );
}
