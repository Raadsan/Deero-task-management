'use client';

import { accountingToast } from '@/lib/accounting-ui';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { SquarePen, Eye, Plus, Printer, RefreshCw, Send, Trash2, X, CreditCard, Receipt } from 'lucide-react';
import { vendorBillApi, vendorRefundApi, type VendorBill, type VendorBillLine, type VendorRefundable } from '@/lib/api/accounting/payables/vendorBillApi';
import VendorBillViewModal from './VendorBillViewModal';
import { vendorApi } from '@/lib/api/accounting/payables/vendorApi';
import { vendorPaymentApi } from '@/lib/api/accounting/payables/vendorPaymentApi';
import { accountingProductApi } from '@/lib/api/accounting/catalog/productApi';
import { accountingTaxApi } from '@/lib/api/accounting/configuration/taxApi';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';
import { paymentTermApi } from '@/lib/api/accounting/configuration/paymentTermApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { bankAccountApi } from '@/lib/api/accounting/banking/bankAccountApi';
import { chartOfAccountApi } from '@/lib/api/accounting/ledger/chartOfAccountApi';
import { accountTypeApi } from '@/lib/api/accounting/configuration/accountTypeApi';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Line = Omit<VendorBillLine, 'id' | 'subtotal'>;
type Form = {
  vendor_id: string; reversed_bill_id: string; bill_date: string; received_date: string; currency_id: string; exchange_rate: string;
  payment_term_id: string; vendor_reference: string; notes: string; lines: Line[]; pay_vendor_now: boolean;
  payment_method_id: string; bank_account_id: string; amount_paid: string; payment_reference: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ line_type: 'expense', product_id: null, expense_account_id: null, description: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null, amount: 0 });
const emptyForm = (): Form => ({ vendor_id: '', reversed_bill_id: '', bill_date: today(), received_date: today(), currency_id: '', exchange_rate: '1', payment_term_id: '', vendor_reference: '', notes: '', lines: [emptyLine()], pay_vendor_now: false, payment_method_id: '', bank_account_id: '', amount_paid: '', payment_reference: '' });
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const apiDate = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString();
const money = (value: unknown) => Number(value || 0).toFixed(2);
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';
const termDueDays = (term: Row | undefined) => {
  if (!term) return 0;
  const lines = Array.isArray(term.payment_term_lines) ? term.payment_term_lines as Array<{ due_days?: number }> : [];
  if (lines.length) return Math.max(...lines.map((line) => Number(line.due_days || 0)));
  const name = String(term.name || '');
  const netMatch = name.match(/net\s*(\d+)/i);
  if (netMatch) return Number(netMatch[1]);
  if (/immediate|receipt|due on receipt|net\s*0/i.test(name)) return 0;
  return 0;
};
const addDays = (isoDate: string, days: number) => {
  if (!isoDate) return '';
  const next = new Date(`${isoDate}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

export default function VendorBillsPage({ kind = 'bill' }: { kind?: 'bill' | 'refund' }) {
  const isRefund = kind === 'refund';
  const recordsApi = isRefund ? vendorRefundApi : vendorBillApi;
  
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [sourceBills, setSourceBills] = useState<VendorBill[]>([]);
  const [vendors, setVendors] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [taxes, setTaxes] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [terms, setTerms] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Row[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [accountTypes, setAccountTypes] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<VendorBill | null>(null);
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [availableAdvance, setAvailableAdvance] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundable, setRefundable] = useState<VendorRefundable | null>(null);
  const [moreNotes, setMoreNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete' | 'post-form'; bill?: VendorBill } | null>(null);
  const [printTarget, setPrintTarget] = useState<VendorBill | null>(null);
  const [viewModalBill, setViewModalBill] = useState<VendorBill | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billRows, sourceRows, vendorRows, productRows, taxRows, currencyRows, termRows, companyRows, methodRows, bankRows, accountRows, accountTypeRows] = await Promise.all([
        recordsApi.getAll(), isRefund ? vendorBillApi.getAll() : Promise.resolve([]), vendorApi.getAll(), accountingProductApi.getAll(), accountingTaxApi.getAll(),
        currencyApi.getAll(), paymentTermApi.getAll(), companyApi.getAll(), accountingPaymentMethodApi.getAll(), bankAccountApi.getAll(), chartOfAccountApi.getAll(), accountTypeApi.getAll(),
      ]);
      setBills(billRows); setSourceBills(sourceRows); setVendors(vendorRows); setProducts(productRows); setTaxes(taxRows);
      setCurrencies(currencyRows); setTerms(termRows); setCompanies(companyRows); setPaymentMethods(methodRows); setBankAccounts(bankRows);
      setAccounts(accountRows); setAccountTypes(accountTypeRows);
    } catch (error) { accountingToast(errorMessage(error), 'error'); } finally { setLoading(false); }
  }, [recordsApi, isRefund]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const totals = useMemo(() => form.lines.reduce((sum, line) => {
    const gross = line.line_type === 'expense' ? Number(line.amount) : Number(line.quantity) * Number(line.unit_price);
    const discounted = gross * (1 - Number(line.discount_percent) / 100);
    const tax = taxes.find((row) => row.id === Number(line.tax_id));
    const rate = Number(tax?.rate_percent || 0) / 100;
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted;
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0;
    return { subtotal: sum.subtotal + untaxed, tax: sum.tax + taxAmount, total: sum.total + untaxed + taxAmount };
  }, { subtotal: 0, tax: 0, total: 0 }), [form.lines, taxes]);
  const selectedVendor = vendors.find((row) => row.id === Number(form.vendor_id));
  const expenseAccountTypeIds = useMemo(() => new Set(accountTypes.filter((type) => type.internal_group === 'expense').map((type) => Number(type.id))), [accountTypes]);
  const expenseAccounts = useMemo(() => {
    const activeCompanyId = Number(selectedVendor?.company_id || companies[0]?.id || 1);
    return accounts.filter((account) => {
      if (account.is_active === false) return false;
      if (account.allow_manual_entry === false) return false;
      if (account.company_id && Number(account.company_id) !== activeCompanyId) return false;
      const typeId = Number(account.account_type_id);
      if (expenseAccountTypeIds.has(typeId)) return true;
      const code = String(account.code || '');
      if (code.startsWith('5')) return true;
      const name = String(account.name || '').toLowerCase();
      return name.includes('expense') || name.includes('cost') || name.includes('charge') || name.includes('utilit') || name.includes('salar') || name.includes('rent');
    });
  }, [accounts, companies, expenseAccountTypeIds, selectedVendor?.company_id]);
  const selectedPaymentMethod = paymentMethods.find((row) => row.id === Number(form.payment_method_id));
  const availableBankAccounts = bankAccounts.filter((row) => {
    const activeCompanyId = Number(selectedVendor?.company_id || companies[0]?.id || 1);
    const matchesCompany = !row.company_id || Number(row.company_id) === activeCompanyId;
    const matchesCurrency = !form.currency_id || Number(row.currency_id) === Number(form.currency_id);
    return matchesCompany && matchesCurrency && row.is_active !== false && row.gl_account_id;
  });
  const maxRefundable = Number(refundable?.max_refundable || 0);
  const currentRefundAmount = isRefund
    ? (refundMode === 'full' ? maxRefundable : Math.max(0, Number(refundAmount) || 0))
    : 0;
  const remainingAfterRefund = Math.max(0, maxRefundable - currentRefundAmount);
  const paymentNow = form.pay_vendor_now ? Math.max(0, Math.min(Number(form.amount_paid) || 0, totals.total)) : 0;
  const summaryPaid = viewOnly && selected ? Number(selected.amount_paid || 0) : paymentNow + Math.min(advanceAmount, totals.total);
  const summaryBalance = Math.max(0, totals.total - summaryPaid);
  const summaryStatus = (!selected || selected.state === 'draft' || !viewOnly)
    ? 'Draft'
    : (summaryPaid <= 0.005 ? 'Unpaid' : summaryBalance <= 0.005 ? 'Paid' : 'Partially Paid');
  const computedDueDate = addDays(form.bill_date, termDueDays(terms.find((row) => row.id === Number(form.payment_term_id))));
  const filtered = bills.filter((bill) => {
    const needle = query.trim().toLowerCase();
    return (!needle || [bill.bill_number, bill.vendor_reference, bill.vendors?.name, bill.state].some((value) => String(value || '').toLowerCase().includes(needle))) &&
      (vendorFilter === 'all' || bill.vendor_id === Number(vendorFilter)) &&
      (statusFilter === 'all' || bill.state === statusFilter);
  });

  function prepareBill() {
    const next = emptyForm();
    if (currencies.length === 1) next.currency_id = String(currencies[0].id);
    const immediate = terms.find((row) => /immediate|receipt/i.test(String(row.name)));
    if (immediate && !isRefund) next.payment_term_id = String(immediate.id);
    setSelected(null); setViewOnly(false); setAvailableAdvance(0); setAdvanceAmount(0);
    setRefundMode('full'); setRefundReason(''); setRefundAmount(''); setRefundable(null); setMoreNotes('');
    setForm(next); setOpen(true);
  }
  async function loadRefundable(billId: number, excludeRefundId?: number, opts?: { mode?: 'full' | 'partial'; preferAmount?: number }) {
    if (!billId) { setRefundable(null); return; }
    try {
      const info = await vendorRefundApi.getRefundable(billId, excludeRefundId);
      setRefundable(info);
      const mode = opts?.mode || refundMode;
      if (mode === 'full') setRefundAmount(String(info.max_refundable));
      else if (opts?.preferAmount != null) setRefundAmount(String(Math.min(Number(opts.preferAmount) || 0, info.max_refundable)));
    } catch (error) {
      setRefundable(null);
      accountingToast(errorMessage(error), 'error');
    }
  }
  function openBill(bill: VendorBill, readonly = false) {
    setSelected(bill); setViewOnly(readonly || bill.state !== 'draft');
    const pending = bill.pending_payment;
    const pendingEnabled = Boolean(pending?.enabled && Number(pending.amount || 0) > 0);
    setForm({
      vendor_id: String(bill.vendor_id), reversed_bill_id: String(bill.reversed_bill_id || ''), bill_date: dateValue(bill.bill_date), received_date: dateValue(bill.received_date),
      currency_id: String(bill.currency_id || ''), exchange_rate: String(bill.exchange_rate || 1),
      payment_term_id: String(bill.payment_term_id || ''), vendor_reference: String(bill.vendor_reference || ''),
      notes: bill.notes_text
        ? String(bill.notes_text)
        : (typeof bill.notes === 'string' && !String(bill.notes).trim().startsWith('{') ? String(bill.notes) : ''),
      pay_vendor_now: pendingEnabled,
      payment_method_id: pendingEnabled ? String(pending?.payment_method_id || '') : '',
      bank_account_id: pendingEnabled ? String(pending?.bank_account_id || '') : '',
      amount_paid: pendingEnabled ? String(pending?.amount ?? '') : '',
      payment_reference: pendingEnabled ? String(pending?.payment_reference || '') : '',
      lines: (bill.vendor_bill_lines || []).map((line) => ({
        product_id: line.product_id || null, description: line.description, quantity: Number(line.quantity),
        unit_price: Number(line.unit_price), discount_percent: Number(line.discount_percent),
        tax_id: line.tax_id || null, line_type: (line.product_id ? 'product' : 'expense') as 'product' | 'expense', expense_account_id: line.expense_account_id || null, amount: Number(line.unit_price),
      })),
    });
    if (isRefund) {
      setRefundMode(bill.refund_type === 'partial' ? 'partial' : 'full');
      setRefundReason(String(bill.refund_reason || ''));
      setRefundAmount(String(bill.amount_total || ''));
      setMoreNotes(String(bill.notes_text || ''));
      if (bill.reversed_bill_id) {
        void loadRefundable(bill.reversed_bill_id, bill.id, {
          mode: bill.refund_type === 'partial' ? 'partial' : 'full',
          preferAmount: Number(bill.amount_total || 0),
        });
      }
    }
    if (!isRefund) {
      setAdvanceAmount(Number(pending?.advance_amount || 0));
      void loadVendorAdvance(bill.vendor_id, bill.currency_id);
    }
    setOpen(true);
  }
  async function loadVendorAdvance(vendorId: number, currencyId: number) {
    if (!vendorId || !currencyId) { setAvailableAdvance(0); setAdvanceAmount(0); return; }
    try { const result = await vendorPaymentApi.getAdvances(vendorId, currencyId); setAvailableAdvance(result.balance); setAdvanceAmount(0); }
    catch { setAvailableAdvance(0); setAdvanceAmount(0); }
  }
  function selectVendor(value: string) {
    const nextVendor = vendors.find((row) => row.id === Number(value));
    const nextCompany = companies.find((row) => row.id === Number(nextVendor?.company_id));
    setForm((current) => ({
      ...current, vendor_id: value, currency_id: String(nextVendor?.currency_id || nextCompany?.currency_id || current.currency_id),
      payment_term_id: String(nextVendor?.payment_term_id || current.payment_term_id), exchange_rate: '1',
      ...(isRefund ? { reversed_bill_id: '', payment_term_id: '' } : {}),
      lines: isRefund ? [emptyLine()] : current.lines,
    }));
    if (isRefund) { setRefundMode('full'); setRefundReason(''); setRefundAmount(''); setRefundable(null); setMoreNotes(''); }
    if (!isRefund) void loadVendorAdvance(Number(value), Number(nextVendor?.currency_id || nextCompany?.currency_id || 0));
  }
  function selectOriginalBill(value: string) {
    const original = sourceBills.find((row) => row.id === Number(value));
    if (!original) { setForm((current) => ({ ...current, reversed_bill_id: value })); setRefundable(null); return; }
    setForm((current) => ({
      ...current,
      vendor_id: String(original.vendor_id),
      reversed_bill_id: value,
      currency_id: String(original.currency_id),
      exchange_rate: String(original.exchange_rate || 1),
      payment_term_id: '',
      bill_date: today(),
      received_date: today(),
      lines: [],
    }));
    setRefundMode('full'); setRefundReason(''); setMoreNotes('');
    void loadRefundable(original.id, selected?.id, { mode: 'full' });
  }
  function updateLine(index: number, patch: Partial<Line>) {
    setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }));
  }
  function chooseProduct(index: number, value: string) {
    const product = products.find((row) => row.id === Number(value));
    updateLine(index, product ? {
      product_id: product.id, description: String(product.name), unit_price: Number(product.standard_cost || 0),
      tax_id: Number(product.purchase_tax_id) || null,
    } : { product_id: null });
  }
  function buildSavePayload() {
    return isRefund
      ? {
          vendor_id: Number(form.vendor_id),
          reversed_bill_id: Number(form.reversed_bill_id),
          bill_date: apiDate(form.bill_date),
          refund_type: refundMode,
          refund_reason: refundReason.trim(),
          refund_amount: currentRefundAmount,
          notes: moreNotes,
        }
      : {
          vendor_id: Number(form.vendor_id),
          bill_date: apiDate(form.bill_date),
          received_date: form.received_date ? apiDate(form.received_date) : null,
          currency_id: Number(form.currency_id),
          exchange_rate: Number(form.exchange_rate),
          payment_term_id: form.payment_term_id ? Number(form.payment_term_id) : null,
          reversed_bill_id: null,
          notes: form.notes,
          lines: form.lines.map((line) => ({
            ...line,
            description: line.description || String(products.find((product) => product.id === Number(line.product_id))?.name || 'Expense'),
          })),
          pay_vendor_now: form.pay_vendor_now,
          payment_method_id: form.pay_vendor_now && form.payment_method_id ? Number(form.payment_method_id) : undefined,
          bank_account_id: form.pay_vendor_now && form.bank_account_id ? Number(form.bank_account_id) : undefined,
          amount_paid: form.pay_vendor_now ? Math.min(Number(form.amount_paid) || 0, totals.total) : undefined,
          payment_reference: form.pay_vendor_now ? form.payment_reference : undefined,
          advance_amount: Math.min(advanceAmount, totals.total),
        };
  }

  function validateBeforeSave(forPost = false) {
    if (isRefund) {
      if (!form.reversed_bill_id) { accountingToast('Original vendor bill is required', 'error'); return false; }
      if (!refundReason.trim()) { accountingToast('Refund reason is required', 'error'); return false; }
      if (!(currentRefundAmount > 0) || currentRefundAmount > maxRefundable + 0.005) {
        accountingToast(`Refund amount must be greater than 0 and at most $${money(maxRefundable)}`, 'error');
        return false;
      }
    }
    if (!isRefund && form.pay_vendor_now) {
      if (!form.payment_method_id || !(Number(form.amount_paid) > 0)) {
        accountingToast('Pay Vendor Now requires a payment method and amount paid', 'error');
        return false;
      }
      if (selectedPaymentMethod?.requires_reference && !String(form.payment_reference || '').trim()) {
        accountingToast('Reference number is required for this payment method', 'error');
        return false;
      }
    }
    if (forPost && !isRefund && !(totals.total > 0)) {
      accountingToast('Add at least one bill line with a positive amount', 'error');
      return false;
    }
    return true;
  }

  async function save() {
    if (!validateBeforeSave(false)) return;
    setSaving(true);
    try {
      const payload = buildSavePayload();
      await (selected ? recordsApi.update(selected.id, payload) : recordsApi.create(payload));
      accountingToast(`Draft vendor ${kind} ${selected ? 'updated' : 'prepared'} successfully`);
      setOpen(false);
      await load();
    } catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }

  /** One-shot: save draft then post. Used after the single confirmation from the form. */
  async function saveThenPost() {
    if (!validateBeforeSave(true)) { setPendingAction(null); return; }
    setSaving(true);
    try {
      const payload = buildSavePayload();
      const saved = selected ? await recordsApi.update(selected.id, payload) : await recordsApi.create(payload);
      await recordsApi.post(saved.id, isRefund ? undefined : {});
      accountingToast(`Vendor ${kind} posted successfully`);
      setPendingAction(null);
      setOpen(false);
      await load();
    } catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }

  function requestPostFromForm(formEl?: HTMLFormElement | null) {
    if (formEl && !formEl.reportValidity()) return;
    if (!validateBeforeSave(true)) return;
    setPendingAction({ type: 'post-form' });
  }

  async function remove(bill: VendorBill) {
    setSaving(true); try { await recordsApi.remove(bill.id); accountingToast(`Draft vendor ${kind} deleted`); setPendingAction(null); await load(); }
    catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  async function postRecord(bill: VendorBill) {
    setSaving(true); try { await recordsApi.post(bill.id, isRefund ? undefined : {}); accountingToast(`Vendor ${kind} posted successfully`); setPendingAction(null); await load(); }
    catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  async function printRecord(bill: VendorBill) {
    try { const fullRecord = await recordsApi.getById(bill.id); setPrintTarget(fullRecord); window.setTimeout(() => window.print(), 100); }
    catch (error) { accountingToast(errorMessage(error), 'error'); }
  }

  const columns: DashboardTableColumn<VendorBill>[] = [
    { key: 'number', header: 'Bill No.', cell: (row) => <span className="font-bold text-primary">{row.bill_number || '—'}</span> },
    { key: 'vendor', header: 'Vendor', cell: (row) => row.vendors?.name || `#${row.vendor_id}` },
    { key: 'date', header: 'Bill Date', cell: (row) => dateValue(row.bill_date) },
    { key: 'due', header: 'Due Date', cell: (row) => dateValue(row.due_date) },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <Status bill={row} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (row) => <span className="font-semibold">{row.currencies?.code} {money(row.amount_total)}</span> },
    { key: 'paidAmount', header: 'Paid', align: 'right', cell: (row) => money(row.amount_paid) },
    { key: 'dueAmount', header: 'Balance', align: 'right', cell: (row) => <span className="font-semibold">{money(row.amount_due)}</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1">
      {row.state === 'draft' ? (
        <>
          <button title="Edit" onClick={() => openBill(row)} className={actionBtnEdit}><SquarePen className="size-4" /></button>
          <button title="View" onClick={() => setViewModalBill(row)} className={actionBtnView}><Eye className="size-4" /></button>
          <button title="Post" onClick={() => setPendingAction({ type: 'post', bill: row })} className={actionBtnView}><Send className="size-4" /></button>
          <button title="Delete" onClick={() => setPendingAction({ type: 'delete', bill: row })} className={actionBtnDelete}><Trash2 className="size-4" /></button>
        </>
      ) : (
        <>
          <button title="View" onClick={() => setViewModalBill(row)} className={actionBtnView}><Eye className="size-4" /></button>
          <button title="Print" onClick={() => setViewModalBill(row)} className={actionBtnView}><Printer className="size-4" /></button>
        </>
      )}
    </div> },
  ];

  return (
    <AccountingPageShell section="Payables" title={isRefund ? 'Vendor Refunds' : 'Vendor Bills'} description={isRefund ? 'Record vendor credits and refunds against posted bills.' : 'Prepare and manage bills received from your vendors.'}>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search vendor ${isRefund ? 'refunds' : 'bills'}...`} emptyText={`No vendor ${isRefund ? 'refunds' : 'bills'} found`} minWidth="1100px" action={<button onClick={prepareBill} className={btnCreatePage}><Plus className="size-4" /> Prepare {isRefund ? 'refund' : 'bill'}</button>} filters={<>
      <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All vendors</option>{vendors.map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select>
      <button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
    </>} />
    <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}>
      <DialogContent className="max-h-[94vh] max-w-[calc(100vw-2rem)] overflow-y-auto xl:max-w-[1360px] p-6 sm:p-7">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {viewOnly ? 'View' : selected ? 'Edit' : 'Prepare'} Vendor {isRefund ? 'Refund' : 'Bill'}
                {selected?.bill_number ? ` · ${selected.bill_number}` : ''}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {viewOnly
                  ? `Vendor Bill No.: ${selected?.bill_number || '—'}`
                  : selected?.bill_number
                    ? `Vendor Bill No.: ${selected.bill_number} (assigned by the system)`
                    : 'Vendor details, currency, lines, and optional immediate payment. Bill number is assigned on save.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-4 space-y-5">
          <fieldset disabled={viewOnly} className="contents">
            {/* Top metadata grid */}
            <div className={`grid gap-4 sm:grid-cols-2 ${isRefund ? 'lg:grid-cols-3' : 'lg:grid-cols-3'} rounded-2xl border border-border/60 bg-muted/20 p-4`}>
              <Select label="Vendor" value={form.vendor_id} set={selectVendor} rows={vendors} />
              {isRefund ? (
                <>
                  <Select label="Original bill" value={form.reversed_bill_id} set={selectOriginalBill} rows={sourceBills.filter((row) => row.vendor_id === Number(form.vendor_id) && row.state === 'posted' && Number(row.amount_paid || 0) > 0.005)} labelKey="bill_number" />
                  <Field label="Refund date" type="date" value={form.bill_date} set={(value) => setForm({ ...form, bill_date: value, received_date: value })} />
                </>
              ) : (
                <>
                  <Field label="Bill date" type="date" value={form.bill_date} set={(value) => setForm({ ...form, bill_date: value })} />
                  <Field label="Received date" type="date" value={form.received_date} set={(value) => setForm({ ...form, received_date: value })} />
                  <Select label="Payment term" value={form.payment_term_id} set={(value) => setForm({ ...form, payment_term_id: value })} rows={terms} optional />
                  <Field label="Due date" type="date" value={computedDueDate} set={() => undefined} disabled />
                </>
              )}
            </div>

            {isRefund && form.reversed_bill_id && (
              <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Refund Type <span className="text-rose-500">*</span></span>
                    <select
                      value={refundMode}
                      onChange={(event) => {
                        const mode = event.target.value as 'full' | 'partial';
                        setRefundMode(mode);
                        if (mode === 'full') setRefundAmount(String(maxRefundable));
                      }}
                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                    >
                      <option value="full">Full Refund</option>
                      <option value="partial">Partial Refund</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Refund Reason <span className="text-rose-500">*</span></span>
                    <input required value={refundReason} onChange={(event) => setRefundReason(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary" placeholder="Reason for this refund" />
                  </label>
                </div>
                <div className="grid gap-3 rounded-xl border border-border/60 bg-background/80 p-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
                  <div><span className="text-muted-foreground">Original Bill Total</span><p className="font-mono font-semibold">${money(refundable?.original_total)}</p></div>
                  <div><span className="text-muted-foreground">Previously Refunded</span><p className="font-mono font-semibold">${money(refundable?.previously_refunded)}</p></div>
                  <div><span className="text-muted-foreground">Maximum Refundable</span><p className="font-mono font-semibold text-primary">${money(maxRefundable)}</p></div>
                  <div><span className="text-muted-foreground">Current Refund</span><p className="font-mono font-semibold">${money(currentRefundAmount)}</p></div>
                  <div><span className="text-muted-foreground">Remaining Refundable</span><p className="font-mono font-semibold">${money(remainingAfterRefund)}</p></div>
                </div>
                {refundMode === 'full' ? (
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    <span>Refund Amount</span>
                    <input readOnly value={money(maxRefundable)} className="mt-1.5 h-10 w-full rounded-xl border bg-muted px-3 font-semibold font-mono" />
                  </label>
                ) : (
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block max-w-xs">
                    <span>Refund Amount <span className="text-rose-500">*</span></span>
                    <input
                      required
                      type="number"
                      min="0.01"
                      max={maxRefundable}
                      step="0.01"
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm focus:ring-1 focus:ring-primary"
                    />
                  </label>
                )}
              </div>
            )}

            {!isRefund && form.vendor_id && availableAdvance > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                <div>
                  <b className="font-semibold text-emerald-900 dark:text-emerald-100">Available Vendor Advance: ${money(availableAdvance)}</b>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Apply it now to reduce this bill&apos;s outstanding balance upon posting.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setAdvanceAmount(Math.min(availableAdvance, totals.total))} className="h-8 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 shadow-sm transition-colors">Apply All</button>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                    Partial
                    <input aria-label="Partial Vendor Advance" type="number" min="0" max={Math.min(availableAdvance, totals.total)} step="0.01" value={advanceAmount} onChange={(event) => setAdvanceAmount(Math.min(Math.max(0, Number(event.target.value) || 0), availableAdvance, totals.total))} className="h-8 w-28 rounded-lg border border-emerald-300 bg-white px-2 text-right font-mono text-xs text-slate-900" />
                  </label>
                  <button type="button" onClick={() => setAdvanceAmount(0)} className="h-8 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 shadow-sm transition-colors">Clear</button>
                </div>
              </div>
            )}

            {/* Line items table */}
            {!isRefund && (
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[22%]" />
                    <col className="w-[6%]" />
                    <col className="w-[12%]" />
                    <col className="w-[7%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[5%]" />
                  </colgroup>
                  <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left">Item / Account</th>
                      <th className="px-3 py-2.5 text-left">Description</th>
                      <th className="px-2 py-2.5 text-center">Qty</th>
                      <th className="px-3 py-2.5 text-right">Cost / Amount</th>
                      <th className="px-2 py-2.5 text-center">Discount</th>
                      <th className="px-3 py-2.5 text-left">Tax</th>
                      <th className="px-3 py-2.5 text-right">Line Total</th>
                      <th className="px-2 py-2.5 text-center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {form.lines.map((line, index) => (
                      <tr key={index} className="hover:bg-muted/10 transition-colors">
                        <td className="p-2.5 align-top">
                          {!isRefund && (
                            <div className="mb-1.5 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateLine(index, { line_type: 'product', expense_account_id: null, amount: 0 })}
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${line.line_type !== 'expense' ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              >
                                Product
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLine(index, { line_type: 'expense', product_id: null, discount_percent: 0, quantity: 1, unit_price: 0 })}
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${line.line_type === 'expense' ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              >
                                Expense
                              </button>
                            </div>
                          )}
                          {line.line_type === 'expense' ? (
                            <select
                              required
                              value={line.expense_account_id || ''}
                              onChange={(event) => {
                                const accId = Number(event.target.value) || null;
                                const matched = expenseAccounts.find((a) => a.id === accId);
                                updateLine(index, { expense_account_id: accId, description: line.description || (matched ? String(matched.name) : '') });
                              }}
                              className="h-9 w-full rounded-xl border border-border bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                            >
                              <option value="">Select expense account...</option>
                              {expenseAccounts.map((row) => (
                                <option key={row.id} value={row.id}>{String(row.code)} — {String(row.name)}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              required
                              value={line.product_id || ''}
                              onChange={(event) => chooseProduct(index, event.target.value)}
                              className="h-9 w-full rounded-xl border border-border bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                            >
                              <option value="">Select product...</option>
                              {products.filter((row) => row.can_be_purchased !== false).map((row) => (
                                <option key={row.id} value={row.id}>{String(row.name)}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="p-2.5 align-top">
                          <input
                            required
                            value={line.description}
                            onChange={(event) => updateLine(index, { description: event.target.value })}
                            className="mt-6 sm:mt-0 h-9 w-full rounded-xl border border-border bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                            placeholder="Description of item or service"
                          />
                        </td>
                        <td className="p-2.5 align-top">
                          {line.line_type === 'expense' ? (
                            <div className="flex h-9 items-center justify-center font-mono text-muted-foreground/40">—</div>
                          ) : (
                            <input
                              required
                              type="number"
                              min="1"
                              step="1"
                              value={line.quantity}
                              onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                              className="h-9 w-full rounded-xl border border-border bg-background px-2 text-center font-mono text-xs focus:ring-1 focus:ring-primary outline-none"
                            />
                          )}
                        </td>
                        <td className="p-2.5 align-top">
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.line_type === 'expense' ? line.amount || 0 : line.unit_price}
                            onChange={(event) => updateLine(index, line.line_type === 'expense' ? { amount: Number(event.target.value) } : { unit_price: Number(event.target.value) })}
                            className="h-9 w-full rounded-xl border border-border bg-background px-2.5 text-right font-mono text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>
                        <td className="p-2.5 align-top">
                          {line.line_type === 'expense' ? (
                            <div className="flex h-9 items-center justify-center font-mono text-muted-foreground/40">—</div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step=".01"
                              value={line.discount_percent}
                              onChange={(event) => updateLine(index, { discount_percent: Number(event.target.value) })}
                              className="h-9 w-full rounded-xl border border-border bg-background px-2 text-center font-mono text-xs focus:ring-1 focus:ring-primary outline-none"
                            />
                          )}
                        </td>
                        <td className="p-2.5 align-top">
                          <select
                            value={line.tax_id || ''}
                            onChange={(event) => updateLine(index, { tax_id: Number(event.target.value) || null })}
                            className="h-9 w-full rounded-xl border border-border bg-background px-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                          >
                            <option value="">No tax</option>
                            {taxes.filter((row) => row.is_active !== false && Number(row.rate_percent || 0) !== 0).map((row) => (
                              <option key={row.id} value={row.id}>{String(row.name)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5 align-top text-right font-mono font-semibold text-foreground">
                          {money((line.line_type === 'expense' ? Number(line.amount) : Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount_percent || 0) / 100)))}
                        </td>
                        <td className="p-2.5 align-top text-center">
                          <button
                            type="button"
                            disabled={form.lines.length === 1}
                            onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-20 transition-colors"
                            title="Remove line"
                          >
                            <X className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-muted/50 shadow-xs transition-colors"
                  >
                    <Plus className="size-3.5" /> Add bill line
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {form.lines.length} {form.lines.length === 1 ? 'line item' : 'line items'}
                  </span>
                </div>
              </div>
            )}

            {/* Payment Information section (vendor bills only) */}
            {!isRefund && !viewOnly && (
              <section className="rounded-2xl border border-border/80 bg-muted/20 p-4 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CreditCard className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Payment Information</h3>
                      <p className="text-[11px] text-muted-foreground">Optionally pay and settle this bill immediately upon posting</p>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={form.pay_vendor_now}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setForm((current) => ({
                          ...current,
                          pay_vendor_now: checked,
                          payment_method_id: checked ? current.payment_method_id : '',
                          bank_account_id: '',
                          amount_paid: checked ? (current.amount_paid || (totals.total > 0 ? String(totals.total) : '')) : '',
                          payment_reference: checked ? current.payment_reference : '',
                        }));
                      }}
                      className="size-4 rounded accent-primary text-primary"
                    />
                    <span>Pay Vendor Now</span>
                  </label>
                </div>

                {form.pay_vendor_now && (
                  <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 pt-3 border-t border-border/60">
                    <Select
                      label="Payment Method"
                      value={form.payment_method_id}
                      set={(value) => setForm((current) => ({ ...current, payment_method_id: value, bank_account_id: '' }))}
                      rows={paymentMethods.filter((row) => row.is_active !== false && ['outbound', 'both'].includes(String(row.payment_type)))}
                    />
                    {selectedPaymentMethod?.allow_multiple_accounts === true && (
                      <Select
                        label="Bank Account"
                        value={form.bank_account_id}
                        set={(value) => setForm((current) => ({ ...current, bank_account_id: value }))}
                        rows={availableBankAccounts}
                        labelKey="account_name"
                        optional={availableBankAccounts.length === 1}
                      />
                    )}
                    <label className="flex flex-col text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>Amount Paid <span className="text-rose-500">*</span></span>
                      <div className="relative mt-1.5">
                        <input
                          required
                          type="number"
                          min="0.01"
                          max={Math.max(0, totals.total - Math.min(advanceAmount, totals.total))}
                          step="0.01"
                          value={form.amount_paid}
                          onChange={(event) => setForm((current) => ({ ...current, amount_paid: event.target.value }))}
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 pr-14 font-mono text-sm focus:border-primary focus:ring-1 focus:ring-primary shadow-xs outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, amount_paid: String(Math.max(0, totals.total - Math.min(advanceAmount, totals.total))) }))}
                          className="absolute right-1.5 top-1.5 rounded-lg bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Full
                        </button>
                      </div>
                    </label>
                    <Field
                      label="Reference"
                      value={form.payment_reference}
                      set={(value) => setForm((current) => ({ ...current, payment_reference: value }))}
                      optional={!Boolean(selectedPaymentMethod?.requires_reference)}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Notes and Bill Summary Card */}
            <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              {isRefund ? (
                <details className="h-fit rounded-2xl border border-border bg-card p-4">
                  <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">More Options & Internal Notes</summary>
                  <label className="mt-3 flex flex-col text-xs font-semibold">
                    <span>Notes</span>
                    <textarea
                      value={moreNotes}
                      onChange={(event) => setMoreNotes(event.target.value)}
                      className="mt-1.5 min-h-[120px] w-full resize-none rounded-xl border border-border bg-background p-3 text-sm focus:ring-1 focus:ring-primary shadow-xs outline-none"
                      placeholder="Optional internal notes..."
                    />
                  </label>
                </details>
              ) : (
                <label className="flex h-full flex-col text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Bill Notes & Terms</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    className="mt-1.5 min-h-[140px] w-full flex-1 resize-none rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary shadow-xs outline-none transition-all placeholder:text-muted-foreground/50"
                    placeholder="Add any notes or internal memo for this bill..."
                  />
                </label>
              )}

              <aside className="flex flex-col justify-between rounded-2xl border border-border bg-muted/20 p-5 shadow-xs">
                <div>
                  <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bill Summary</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {String(currencies.find((c) => c.id === Number(form.currency_id))?.code || 'USD')}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-mono font-medium text-foreground">${money(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax</span>
                      <span className="font-mono font-medium text-foreground">${money(totals.tax)}</span>
                    </div>
                  </div>
                  <div className="my-3 border-t border-border/60" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Grand Total</span>
                    <span className="font-mono text-xl font-black text-foreground">${money(totals.total)}</span>
                  </div>
                </div>

                {!isRefund && (
                  <div className="mt-4 pt-3 border-t border-border/60 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Paid</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">${money(summaryPaid)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Balance Due</span>
                      <span className={`font-mono font-bold ${summaryBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        ${money(summaryBalance)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between items-center pt-2 border-t border-dashed border-border/60">
                      <span className="font-medium text-muted-foreground">Status</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        summaryStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        summaryStatus === 'Partially Paid' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {summaryStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </fieldset>

          <DialogFooter className="mt-6 flex items-center justify-end gap-2.5 border-t border-border/60 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 rounded-xl border border-border bg-background px-4 text-xs font-semibold text-foreground hover:bg-muted/40 shadow-xs transition-all"
            >
              {viewOnly ? 'Close' : 'Cancel'}
            </button>
            {!viewOnly && (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-xl border border-border bg-background px-4 text-xs font-semibold text-foreground hover:bg-muted/40 shadow-xs transition-all disabled:opacity-50"
                >
                  {saving && !pendingAction ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={(event) => requestPostFromForm(event.currentTarget.form)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                  {`Post ${isRefund ? 'Refund' : 'Bill'}`}
                </button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AccountingConfirmDialog
      open={Boolean(pendingAction)}
      title={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Vendor ${isRefund ? 'Refund' : 'Bill'}`}
      description={pendingAction?.type === 'delete'
        ? `Confirm removal of this draft vendor ${kind}.`
        : pendingAction?.type === 'post-form'
          ? (form.pay_vendor_now && Number(form.amount_paid) > 0
            ? `This will save and post the bill with the $${money(form.amount_paid)} payment in one step.`
            : `This will save and post the vendor ${kind} in one step.`)
          : pendingAction?.bill?.pending_payment?.enabled
            ? `Post this vendor bill and apply the saved payment of $${money(pendingAction.bill.pending_payment.amount)} automatically.`
            : `Confirm this vendor ${kind} before updating accounting balances.`}
      confirmLabel={pendingAction?.type === 'delete' ? `Delete ${isRefund ? 'Refund' : 'Bill'}` : `Post ${isRefund ? 'Refund' : 'Bill'}`}
      destructive={pendingAction?.type === 'delete'}
      busy={saving}
      details={pendingAction && (
        <div className="space-y-1">
          {pendingAction.type === 'post-form' ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendor</span><b>{selectedVendor ? String(selectedVendor.name) : '—'}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{isRefund ? 'Refund Total' : 'Bill Total'}</span><b>${money(isRefund ? currentRefundAmount : totals.total)}</b></div>
              {!isRefund && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><b>${money(summaryPaid)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Balance Due</span><b>${money(summaryBalance)}</b></div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendor Bill No.</span><b>{pendingAction.bill?.bill_number}</b></div>
              {pendingAction.type === 'post' && pendingAction.bill && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bill Total</span><b>${money(pendingAction.bill.amount_total)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><b>${money(pendingAction.bill.amount_paid)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Balance Due</span><b>${money(pendingAction.bill.amount_due)}</b></div>
                </>
              )}
            </>
          )}
        </div>
      )}
      onCancel={() => !saving && setPendingAction(null)}
      onConfirm={() => {
        if (!pendingAction) return;
        if (pendingAction.type === 'delete' && pendingAction.bill) void remove(pendingAction.bill);
        else if (pendingAction.type === 'post-form') void saveThenPost();
        else if (pendingAction.type === 'post' && pendingAction.bill) void postRecord(pendingAction.bill);
      }}
    />
    {viewModalBill && (
      <VendorBillViewModal
        open={Boolean(viewModalBill)}
        onOpenChange={(val) => !val && setViewModalBill(null)}
        bill={viewModalBill}
        onPostBill={(bill) => setPendingAction({ type: 'post', bill })}
      />
    )}
    {printTarget && <PrintableVendorDocument record={printTarget} refund={isRefund} />}
    </AccountingPageShell>
  );
}

function PrintableVendorDocument({ record, refund }: { record: VendorBill; refund: boolean }) {
  const currency = record.currencies?.code || '';
  return <section id="printable-vendor-document" className="hidden bg-white text-slate-950 print:block"><header className="flex items-start justify-between border-b-2 border-slate-900 pb-6"><div><h1 className="text-3xl font-bold text-[#6f0d18]">Bloom Cafe</h1><p className="mt-1 text-sm text-slate-500">{refund ? 'Vendor refund' : 'Vendor bill'}</p></div><div className="text-right"><h2 className="text-3xl font-semibold">{refund ? 'VENDOR REFUND' : 'VENDOR BILL'}</h2><p className="mt-2 font-bold">Vendor Bill No.: {record.bill_number}</p></div></header><div className="grid grid-cols-2 gap-10 py-7 text-sm"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vendor</p><p className="mt-2 text-base font-bold">{record.vendors?.name || `Vendor #${record.vendor_id}`}</p>{record.vendors?.phone && <p>{record.vendors.phone}</p>}{record.vendors?.email && <p>{record.vendors.email}</p>}</div><dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-right"><dt className="text-slate-500">{refund ? 'Refund date' : 'Bill date'}</dt><dd className="font-semibold">{dateValue(record.bill_date)}</dd>{!refund && <><dt className="text-slate-500">Due date</dt><dd className="font-semibold">{dateValue(record.due_date) || '—'}</dd></>}<dt className="text-slate-500">Status</dt><dd className="font-semibold uppercase">{record.state}</dd></dl></div><table className="w-full border-collapse text-sm"><thead><tr className="bg-[#6f0d18] text-white"><th className="p-3 text-left">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Discount</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{(record.vendor_bill_lines || []).map((line, index) => { const amount = Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount_percent || 0) / 100); return <tr key={line.id || index} className="border-b"><td className="p-3">{line.description}</td><td className="p-3 text-right">{Number(line.quantity)}</td><td className="p-3 text-right">{money(line.unit_price)}</td><td className="p-3 text-right">{Number(line.discount_percent || 0).toFixed(2)}%</td><td className="p-3 text-right font-medium">{money(amount)}</td></tr>; })}</tbody></table><div className="ml-auto mt-7 w-72 text-sm"><div className="flex justify-between py-1"><span>Subtotal</span><span>{money(record.amount_untaxed)}</span></div><div className="flex justify-between py-1"><span>Tax</span><span>{money(record.amount_tax)}</span></div><div className="my-2 border-t border-slate-400" /><div className="flex justify-between py-2 text-lg font-bold"><span>Total</span><span>{currency} {money(record.amount_total)}</span></div></div></section>;
}

function Select({ label, value, set, rows, labelKey = 'name', optional }: { label: string; value: string; set: (value: string) => void; rows: Row[]; labelKey?: string; optional?: boolean }) {
  return (
    <label className="flex flex-col text-xs font-semibold text-slate-700 dark:text-slate-300">
      <span>{label}{!optional && <span className="text-rose-500"> *</span>}</span>
      <select
        required={!optional}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary shadow-xs outline-none transition-all cursor-pointer"
      >
        <option value="">Select {label.toLowerCase()}...</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>{String(row[labelKey] || row.name || '')}</option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, value, set, type = 'text', optional, disabled }: { label: string; value: string; set: (value: string) => void; type?: string; optional?: boolean; disabled?: boolean }) {
  return (
    <label className="flex flex-col text-xs font-semibold text-slate-700 dark:text-slate-300">
      <span>{label}{!optional && <span className="text-rose-500"> *</span>}</span>
      <input
        disabled={disabled}
        required={!optional}
        type={type}
        step={type === 'number' ? '.000001' : undefined}
        min={type === 'number' ? '.000001' : undefined}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary shadow-xs outline-none transition-all disabled:bg-muted/50 disabled:cursor-not-allowed"
      />
    </label>
  );
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'text-base font-bold' : ''}`}>
      <span>{label}</span>
      <span className="font-mono">${money(value)}</span>
    </div>
  );
}

function dateOnlyKey(value: unknown, utc = false) {
  const d = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(d.getTime())) return null;
  const y = utc ? d.getUTCFullYear() : d.getFullYear();
  const m = String((utc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
  const day = String(utc ? d.getUTCDate() : d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Overdue only when calendar today is strictly after due date (due date itself is still current). */
function isVendorBillOverdue(bill: VendorBill) {
  if (bill.state !== 'posted') return false;
  if (Number(bill.amount_due || 0) <= 0.005) return false;
  if (!bill.due_date) return false;
  const dueKey = dateOnlyKey(bill.due_date, true);
  const todayKey = dateOnlyKey(new Date(), false);
  return Boolean(dueKey && todayKey && todayKey > dueKey);
}

function Status({ bill }: { bill: VendorBill }) {
  const isRefundDoc = String((bill as { document_type?: string }).document_type || '') === 'refund';
  const apiStatus = String((bill as { display_status?: string }).display_status || '').toLowerCase();
  const key = apiStatus && ['draft', 'posted', 'unpaid', 'partial', 'paid', 'overdue', 'cancelled'].includes(apiStatus)
    ? apiStatus
    : bill.state === 'cancelled'
      ? 'cancelled'
      : bill.state === 'draft'
        ? 'draft'
        : isRefundDoc
          ? 'posted'
          : bill.payment_state === 'paid' || Number(bill.amount_due || 0) <= 0.005
            ? 'paid'
            : isVendorBillOverdue(bill)
              ? 'overdue'
              : bill.payment_state === 'partial' || Number(bill.amount_paid || 0) > 0.005
                ? 'partial'
                : 'unpaid';
  const styles: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    posted: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    unpaid: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    partial: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  };
  const label = key === 'partial' ? 'PARTIALLY PAID' : key.replace('_', ' ').toUpperCase();
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[key] || styles.draft}`}>{label}</span>;
}
