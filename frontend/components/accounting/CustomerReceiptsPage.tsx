'use client';

import { accountingToast } from '@/lib/accounting-ui';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { SquarePen, Eye, Plus, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { customerReceiptApi, type CustomerReceipt } from '@/lib/api/accounting/receivables/customerReceiptApi';
import type { CustomerInvoice } from '@/lib/api/accounting/receivables/customerInvoiceApi';
import { accountingCustomerApi } from '@/lib/api/accounting/receivables/customerApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import ReceiptViewModal from './ReceiptViewModal';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass, dashboardStatusBadgeClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Allocation = { invoice_id: number; allocated_amount: number };
type Form = {
  customer_id: string; journal_id: string; cash_bank_account_id: string; payment_method_id: string; receipt_date: string;
  currency_id: string; exchange_rate: string; amount: string; reference: string; memo: string;
  allocations: Allocation[];
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): Form => ({ customer_id: '', journal_id: '', cash_bank_account_id: '', payment_method_id: '', receipt_date: today(), currency_id: '', exchange_rate: '1', amount: '', reference: '', memo: '', allocations: [] });
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown, code = '') => `${code ? `${code} ` : ''}${Number(value || 0).toFixed(2)}`;
const message = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

function allocateSelectedInvoices(invoices: CustomerInvoice[], selectedIds: number[], receiptAmount: number): Allocation[] {
  let remaining = Math.max(0, receiptAmount);
  return invoices.filter((invoice) => selectedIds.includes(invoice.id))
    .sort((a, b) => dateValue(a.invoice_date).localeCompare(dateValue(b.invoice_date)) || a.id - b.id)
    .flatMap((invoice) => {
      if (remaining <= 0) return [];
      const applied = Math.min(remaining, Number(invoice.amount_due || 0));
      remaining = Math.round((remaining - applied) * 100) / 100;
      return applied > 0 ? [{ invoice_id: invoice.id, allocated_amount: Math.round(applied * 100) / 100 }] : [];
    });
}

export default function CustomerReceiptsPage() {
  
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [methods, setMethods] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<CustomerReceipt | null>(null);
  const [postTarget, setPostTarget] = useState<CustomerReceipt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerReceipt | null>(null);
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewTarget, setViewTarget] = useState<CustomerReceipt | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [receiptRows, customerRows, methodRows] = await Promise.all([
        customerReceiptApi.getAll(), accountingCustomerApi.getAll(), accountingPaymentMethodApi.getAll(),
      ]);
      setReceipts(receiptRows); setCustomers(customerRows); setMethods(methodRows);
    } catch (error) { accountingToast(message(error), 'error'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const openInvoices = invoices.filter((invoice) => {
    const alreadyAllocated = form.allocations.some((row) => row.invoice_id === invoice.id);
    return invoice.customer_id === Number(form.customer_id) && invoice.state === 'posted' &&
      (alreadyAllocated || ['not_paid', 'partial'].includes(invoice.payment_state)) &&
      true;
  });
  const allocated = form.allocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
  const unallocated = Number(form.amount || 0) - allocated;
  const selectedOutstandingBefore = form.allocations.reduce((sum, allocation) => {
    const invoice = invoices.find((row) => row.id === allocation.invoice_id);
    const currentOutstanding = Number(invoice?.amount_due || 0);
    return sum + currentOutstanding + (viewOnly && selected?.state === 'posted' ? Number(allocation.allocated_amount || 0) : 0);
  }, 0);
  const outstandingAfterPayment = form.allocations.reduce((sum, allocation) => {
    const invoice = invoices.find((row) => row.id === allocation.invoice_id);
    const currentOutstanding = Number(invoice?.amount_due || 0);
    const outstandingBefore = currentOutstanding + (viewOnly && selected?.state === 'posted' ? Number(allocation.allocated_amount || 0) : 0);
    return sum + Math.max(0, outstandingBefore - Number(allocation.allocated_amount || 0));
  }, 0);
  const allocationInvalid = !viewOnly && (allocated > Number(form.amount || 0) + 0.005 || form.allocations.some((allocation) => {
    const invoice = invoices.find((row) => row.id === allocation.invoice_id);
    return !invoice || Number(allocation.allocated_amount) > Number(invoice.amount_due) + 0.005;
  }));
  const filtered = receipts.filter((receipt) => {
    const needle = query.toLowerCase().trim();
    const receiptDate = dateValue(receipt.receipt_date);
    return (!needle || [receipt.receipt_number, receipt.customers?.name, receipt.reference].some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (status === 'all' || receipt.state === status) &&
      (customerFilter === 'all' || receipt.customer_id === Number(customerFilter)) &&
      (methodFilter === 'all' || receipt.payment_method_id === Number(methodFilter)) &&
      (!dateFrom || receiptDate >= dateFrom) &&
      (!dateTo || receiptDate <= dateTo);
  });

  function newReceipt() {
    setSelected(null); setViewOnly(false); setInvoices([]); setForm(emptyForm()); setOpen(true);
  }
  async function edit(receipt: CustomerReceipt, readOnly = false) {
    setSelected(receipt); setViewOnly(readOnly || receipt.state !== 'draft');
    const allocationInvoices = (receipt.receipt_allocations || []).flatMap((row) => row.customer_invoices ? [{ ...row.customer_invoices, customer_id: receipt.customer_id, currency_id: receipt.currency_id, state: 'posted', paid_amount: Number(row.customer_invoices.amount_total) - Number(row.customer_invoices.amount_due), currencies: receipt.currencies }] as unknown as CustomerInvoice[] : []);
    try {
      const outstanding = await customerReceiptApi.outstandingInvoices(receipt.customer_id);
      setInvoices([...new Map([...outstanding, ...allocationInvoices].map((row) => [row.id, row])).values()]);
    } catch { setInvoices(allocationInvoices); }
    setForm({
      customer_id: String(receipt.customer_id), journal_id: '', cash_bank_account_id: '', payment_method_id: String(receipt.payment_method_id),
      receipt_date: dateValue(receipt.receipt_date), currency_id: String(receipt.currency_id), exchange_rate: String(receipt.exchange_rate || 1),
      amount: String(receipt.amount), reference: String(receipt.reference || ''), memo: String(receipt.memo || ''),
      allocations: (receipt.receipt_allocations || []).map((row) => ({ invoice_id: row.invoice_id, allocated_amount: Number(row.allocated_amount) })),
    });
    setOpen(true);
  }
  async function selectCustomer(value: string) {
    setInvoices([]);
    setForm((current) => ({ ...current, customer_id: value, journal_id: '', cash_bank_account_id: '', payment_method_id: '', currency_id: '', exchange_rate: '1', allocations: [] }));
    if (!value) return;
    try {
      const rows = await customerReceiptApi.outstandingInvoices(Number(value));
      setInvoices(rows);
      setForm((current) => ({ ...current, allocations: [] }));
    }
    catch (error) { accountingToast(message(error), 'error'); }
  }
  function selectPaymentMethod(value: string) {
    setForm((current) => ({ ...current, payment_method_id: value, journal_id: '', cash_bank_account_id: '' }));
  }
  function changeReceiptAmount(value: string) {
    setForm((current) => ({ ...current, amount: value }));
  }
  function autoAllocate() {
    setForm((current) => ({ ...current, allocations: allocateSelectedInvoices(openInvoices, current.allocations.map((row) => row.invoice_id), Number(current.amount || 0)) }));
  }
  function toggleInvoice(invoice: CustomerInvoice, checked: boolean) {
    if (!checked) { setForm((current) => ({ ...current, allocations: current.allocations.filter((row) => row.invoice_id !== invoice.id) })); return; }
    const remaining = Math.max(0, Number(form.amount || 0) - allocated);
    setForm((current) => ({ ...current, allocations: [...current.allocations, { invoice_id: invoice.id, allocated_amount: Math.min(remaining, Number(invoice.amount_due || 0)) }] }));
  }
  function setAllocation(invoice: CustomerInvoice, value: string) {
    const otherAllocated = form.allocations.filter((row) => row.invoice_id !== invoice.id).reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
    const amount = Math.min(Math.max(0, Number(value) || 0), Number(invoice.amount_due || 0), Math.max(0, Number(form.amount || 0) - otherAllocated));
    setForm((current) => ({ ...current, allocations: current.allocations.map((row) => row.invoice_id === invoice.id ? { ...row, allocated_amount: amount } : row) }));
  }
  async function save(event?: FormEvent, postAfterSave = false) {
    event?.preventDefault();
    if (allocationInvalid) { accountingToast('The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { customer_id: Number(form.customer_id), payment_method_id: Number(form.payment_method_id), amount: Number(form.amount), receipt_date: new Date(`${form.receipt_date}T00:00:00.000Z`).toISOString(), reference: form.reference, memo: form.memo, allocations: form.allocations.filter((row) => Number(row.allocated_amount) > 0.005) };
      const saved = selected ? await customerReceiptApi.update(selected.id, payload) : await customerReceiptApi.create(payload);
      if (postAfterSave) await customerReceiptApi.post(saved.id);
      accountingToast(postAfterSave ? 'Customer receipt posted successfully' : selected ? 'Draft receipt updated successfully' : 'Draft receipt created successfully');
      setOpen(false); await load();
    } catch (error) { accountingToast(message(error), 'error'); } finally { setSaving(false); }
  }
  async function post(receipt: CustomerReceipt) {
    setSaving(true);
    try { await customerReceiptApi.post(receipt.id); accountingToast('Customer receipt posted successfully'); setPostTarget(null); await load(); }
    catch (error) { accountingToast(message(error), 'error'); }
    finally { setSaving(false); }
  }
  async function remove(receipt: CustomerReceipt) {
    setSaving(true); try { await customerReceiptApi.remove(receipt.id); accountingToast('Draft receipt deleted'); setDeleteTarget(null); await load(); }
    catch (error) { accountingToast(message(error), 'error'); }
    finally { setSaving(false); }
  }
  async function printReceipt(receipt: CustomerReceipt) {
    try {
      const fullReceipt = await customerReceiptApi.getById(receipt.id);
      setViewTarget(fullReceipt || receipt);
      setViewOpen(true);
      setTimeout(() => {
        const printBtn = document.querySelector('#a4-receipt-sheet-print-btn') as HTMLButtonElement | null;
        if (printBtn) {
          printBtn.click();
        } else {
          window.print();
        }
      }, 400);
    } catch (error) {
      accountingToast(message(error), 'error');
    }
  }

  const columns: DashboardTableColumn<CustomerReceipt>[] = [
    {
      key: 'number',
      header: 'Receipt',
      cell: (row) => (
        <button
          type="button"
          onClick={async () => {
            try {
              const full = await customerReceiptApi.getById(row.id);
              setViewTarget(full || row);
            } catch {
              setViewTarget(row);
            }
            setViewOpen(true);
          }}
          className="font-bold text-primary hover:underline text-left cursor-pointer"
        >
          {row.receipt_number || `#${row.id}`}
        </button>
      ),
    },
    { key: 'date', header: 'Date', cell: (row) => dateValue(row.receipt_date) },
    { key: 'customer', header: 'Customer', cell: (row) => row.customers?.name || '—' },
    { key: 'method', header: 'Method', cell: (row) => row.payment_methods?.name || '—' },
    { key: 'journal', header: 'Journal', cell: (row) => row.journals?.name || '—' },
    { key: 'account', header: 'Cash/Bank Account', cell: (row) => row.journal_entries?.journal_items?.[0]?.chart_of_accounts ? `${row.journal_entries.journal_items[0].chart_of_accounts.code} — ${row.journal_entries.journal_items[0].chart_of_accounts.name}` : '—' },
    { key: 'currency', header: 'Currency', cell: (row) => row.currencies?.code || '—' },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="font-semibold">{money(row.amount)}</span> },
    { key: 'allocated', header: 'Allocated', align: 'right', cell: (row) => money(Number(row.amount) - Number(row.unallocated_amount)) },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <span className={`${dashboardStatusBadgeClass} ${row.state === 'posted' ? 'bg-emerald-600 text-white' : row.state === 'cancelled' ? 'bg-rose-600 text-white' : 'bg-secondary/100 text-white'}`}>{row.state}</span> },
    { key: 'reference', header: 'Reference', cell: (row) => row.reference || '—' },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <button
            title="View Receipt Voucher"
            onClick={async () => {
              try {
                const fullReceipt = await customerReceiptApi.getById(row.id);
                setViewTarget(fullReceipt || row);
              } catch {
                setViewTarget(row);
              }
              setViewOpen(true);
            }}
            className={actionBtnView}
          >
            <Eye className="size-4" />
          </button>
          {row.state === 'draft' && (
            <>
              <button title="Edit" onClick={() => void edit(row)} className={actionBtnEdit}>
                <SquarePen className="size-4" />
              </button>
              <button title="Post" onClick={() => setPostTarget(row)} className={actionBtnView}>
                <Send className="size-4" />
              </button>
              <button title="Delete" onClick={() => setDeleteTarget(row)} className={actionBtnDelete}>
                <Trash2 className="size-4" />
              </button>
            </>
          )}
          {row.state === 'posted' && (
            <button title="Print Receipt Voucher" onClick={() => void printReceipt(row)} className={actionBtnView}>
              <Printer className="size-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AccountingPageShell section="Receivables" title="Customer Receipts" description="Record customer payments and allocate them to posted invoices.">
      <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search receipts..." emptyText="No customer receipts found" minWidth="1500px" action={<button onClick={newReceipt} className={btnCreatePage}><Plus className="size-4" /> New receipt</button>} filters={<><select value={status} onChange={(e) => setStatus(e.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select><select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={dashboardSelectClass}><option value="all">All customers</option>{customers.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select><select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={dashboardSelectClass}><option value="all">All methods</option>{methods.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select><input aria-label="From date" title="From date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={dashboardSelectClass} /><input aria-label="To date" title="To date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={dashboardSelectClass} /><button title="Refresh receipts" onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border border-zinc-200 bg-white"><RefreshCw className="size-4" /></button></>} />

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[94vh] max-w-[calc(100vw-2rem)] overflow-y-auto xl:max-w-[1400px]"><DialogHeader><DialogTitle>{viewOnly ? 'Customer receipt' : selected ? 'Edit customer receipt' : 'Customer receipt'}</DialogTitle><DialogDescription>Enter the receipt details and select the outstanding invoices to pay.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <fieldset disabled={viewOnly || saving} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">Customer *<select required value={form.customer_id} onChange={(e) => void selectCustomer(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3"><option value="">Select customer</option>{customers.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></label>
            <label className="text-sm font-medium">Receipt date *<input required type="date" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label>
            <label className="text-sm font-medium">Amount *<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => changeReceiptAmount(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label>
            <label className="text-sm font-medium">Payment method *<select required value={form.payment_method_id} onChange={(e) => selectPaymentMethod(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3"><option value="">Select method</option>{methods.filter((row) => row.is_active !== false && row.gl_account_id && ['inbound', 'both'].includes(String(row.payment_type))).map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></label>
            <label className="text-sm font-medium">Reference{Boolean(methods.find((row) => row.id === Number(form.payment_method_id))?.requires_reference) && <span className="text-rose-500"> *</span>}<input required={Boolean(methods.find((row) => row.id === Number(form.payment_method_id))?.requires_reference)} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={Boolean(methods.find((row) => row.id === Number(form.payment_method_id))?.requires_reference) ? 'e.g. SOM-TRX-123456' : 'Optional'} className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label>
            <label className="text-sm font-medium md:col-span-3">Notes<textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border bg-background p-3" /></label>
          </fieldset>
          <div className="rounded-2xl border"><div className="flex items-center justify-between gap-4 border-b p-4"><div><h3 className="font-semibold">Outstanding Invoices</h3><p className="text-xs text-muted-foreground">Select invoices, then control each allocation manually.</p></div>{openInvoices.length > 0 && <button disabled={viewOnly || !form.amount || !form.allocations.length} type="button" onClick={autoAllocate} className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Recalculate</button>}</div>
            <div className="max-h-64 overflow-auto">
              {!form.customer_id ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Select a customer first.</p>
              ) : openInvoices.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No outstanding posted invoices found for this customer.</p>
              ) : (
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs font-semibold">
                      <th className="w-12 px-3 py-2 text-left font-semibold">Select</th>
                      <th className="min-w-[160px] px-3 py-2 text-left font-semibold">Invoice</th>
                      <th className="w-[120px] px-3 py-2 text-right font-semibold">Invoice Total</th>
                      <th className="w-[120px] px-3 py-2 text-right font-semibold">Previously Paid</th>
                      <th className="w-[130px] px-3 py-2 text-right font-semibold">Remaining Balance</th>
                      <th className="w-[120px] px-3 py-2 text-left font-semibold">Status</th>
                      <th className="w-[140px] px-3 py-2 text-right font-semibold">Amount to Receive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInvoices.map((invoice) => {
                      const allocation = form.allocations.find((row) => row.invoice_id === invoice.id);
                      const isSelected = Boolean(allocation);
                      const transactionOutstanding =
                        Number(invoice.amount_due) +
                        (viewOnly && selected?.state === 'posted' && allocation ? Number(allocation.allocated_amount) : 0);
                      const previouslyPaid = Number(
                        (invoice as any).previously_paid ?? Number(invoice.paid_amount || 0)
                      );
                      return (
                        <tr key={invoice.id} className="border-t">
                          <td className="px-3 py-3 align-middle">
                            <input
                              aria-label={`Select ${invoice.invoice_number}`}
                              disabled={viewOnly}
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) => toggleInvoice(invoice, event.target.checked)}
                              className="size-4 accent-primary"
                            />
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <b>{invoice.invoice_number}</b>
                            <p className="text-xs text-muted-foreground">
                              Invoice {dateValue(invoice.invoice_date)} · Due {dateValue(invoice.due_date)}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right align-middle">
                            <b>{money(invoice.amount_total, invoice.currencies?.code)}</b>
                          </td>
                          <td className="px-3 py-3 text-right align-middle">
                            <b>{money(previouslyPaid)}</b>
                          </td>
                          <td className="px-3 py-3 text-right align-middle">
                            <b>{money(transactionOutstanding)}</b>
                          </td>
                          <td className="px-3 py-3 align-middle capitalize">
                            {invoice.payment_state === 'partial'
                              ? 'Partially Paid'
                              : invoice.payment_state === 'paid'
                              ? 'Paid'
                              : 'Unpaid'}
                          </td>
                          <td className="px-3 py-3 text-right align-middle">
                            <input
                              aria-label={`Allocate to ${invoice.invoice_number}`}
                              disabled={viewOnly || !isSelected}
                              type="number"
                              min="0"
                              max={transactionOutstanding}
                              step=".01"
                              value={allocation?.allocated_amount ?? ''}
                              onChange={(event) => setAllocation(invoice, event.target.value)}
                              className="ml-auto h-10 w-32 rounded-lg border px-3 text-right disabled:bg-muted"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          {allocationInvalid && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.</div>}
          {!allocationInvalid && unallocated > 0.005 && <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm text-secondary">Unallocated amount will be recorded as a customer advance (credit Customer Advances 2140). It will not debit Accounts Receivable until applied to an invoice.</div>}
          <div className="ml-auto w-full rounded-2xl border p-4 sm:max-w-sm"><h3 className="mb-3 font-semibold">Summary</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Receipt Amount</span><b>{money(form.amount)}</b></div><div className="flex justify-between"><span>Outstanding Before</span><b>{money(selectedOutstandingBefore)}</b></div><div className="flex justify-between"><span>Allocated</span><b>{money(allocated)}</b></div><div className={`flex justify-between ${unallocated < -0.005 ? 'text-rose-600' : ''}`}><span>{unallocated > 0.005 ? 'Advance / Unallocated' : 'Remaining'}</span><b>{money(unallocated)}</b></div><div className="flex justify-between border-t pt-2"><span>Outstanding After Payment</span><b>{money(outstandingAfterPayment)}</b></div></div></div>
          <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {form.customer_id && form.amount && (
                <button
                  type="button"
                  onClick={() => {
                    const cust = customers.find((c) => String(c.id) === String(form.customer_id));
                    const previewReceipt: CustomerReceipt = {
                      id: selected?.id || 0,
                      receipt_number: selected?.receipt_number || '#DADVRV-PREVIEW',
                      customer_id: Number(form.customer_id),
                      journal_id: Number(form.journal_id) || 0,
                      payment_method_id: Number(form.payment_method_id) || 0,
                      receipt_date: form.receipt_date,
                      currency_id: Number(form.currency_id) || 1,
                      exchange_rate: Number(form.exchange_rate) || 1,
                      amount: Number(form.amount) || 0,
                      unallocated_amount: unallocated,
                      reference: form.reference,
                      memo: form.memo,
                      state: selected?.state || 'draft',
                      customers: cust ? { id: Number(cust.id), name: String(cust.name), phone: String(cust.phone || '') } : undefined,
                      currencies: { id: 1, code: 'USD', symbol: '$' },
                    };
                    setViewTarget(previewReceipt);
                    setViewOpen(true);
                  }}
                  className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-2.5 text-xs font-semibold text-secondary hover:bg-secondary/20"
                >
                  Preview Voucher
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-5 py-2.5">{viewOnly ? 'Close' : 'Cancel'}</button>
              {!viewOnly && <>
                <button disabled={saving || allocationInvalid || allocated <= 0.005} className="rounded-xl border px-5 py-2.5 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save Draft'}</button>
                <button type="button" disabled={saving || allocationInvalid || allocated <= 0.005} onClick={(event) => { if (event.currentTarget.form?.reportValidity()) void save(undefined, true); }} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Post Receipt</button>
              </>}
            </div>
          </DialogFooter>
        </form>
      </DialogContent></Dialog>
      <Dialog open={Boolean(postTarget)} onOpenChange={(value) => !saving && !value && setPostTarget(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Send className="size-5" /></div><DialogTitle>Post Customer Receipt</DialogTitle><DialogDescription>Confirm the receipt before updating the selected invoice balances.</DialogDescription></DialogHeader>{postTarget && <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Receipt</p><p className="mt-1 font-semibold">{postTarget.receipt_number}</p></div><div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-semibold">{postTarget.customers?.name || '—'}</p></div><div><p className="text-xs text-muted-foreground">Receipt Date</p><p className="mt-1 font-semibold">{dateValue(postTarget.receipt_date)}</p></div><div><p className="text-xs text-muted-foreground">Amount</p><p className="mt-1 font-semibold">{money(postTarget.amount, postTarget.currencies?.code)}</p></div></div>}<div className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-xs text-secondary">Posting updates invoice balances and locks this receipt from further editing.</div><DialogFooter><button type="button" disabled={saving} onClick={() => setPostTarget(null)} className="h-10 rounded-xl border px-5 font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={saving || !postTarget} onClick={() => postTarget && void post(postTarget)} className="h-10 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Posting…' : 'Post Receipt'}</button></DialogFooter></DialogContent></Dialog>
      <AccountingConfirmDialog open={Boolean(deleteTarget)} title="Delete Customer Receipt" description="Confirm removal of this draft customer receipt." confirmLabel="Delete Receipt" destructive busy={saving} details={deleteTarget && <div className="flex justify-between"><span className="text-muted-foreground">Receipt</span><b>{deleteTarget.receipt_number}</b></div>} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && void remove(deleteTarget)} />
      <ReceiptViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        receipt={viewTarget}
        onReceiptUpdated={load}
        onPostReceipt={(r) => setPostTarget(r)}
      />
    </AccountingPageShell>
  );
}

