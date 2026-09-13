'use client';

import { accountingToast } from '@/lib/accounting-ui';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CreditCard, Eye, FileText, Plus, Printer, RefreshCw, Save, Send, StickyNote, Trash2, SquarePen, X, Check } from 'lucide-react';
import { customerInvoiceApi, type CustomerInvoice, type CustomerInvoiceLine } from '@/lib/api/accounting/receivables/customerInvoiceApi';
import { accountingCustomerApi } from '@/lib/api/accounting/receivables/customerApi';
import { accountingProductApi } from '@/lib/api/accounting/catalog/productApi';
import { accountingTaxApi } from '@/lib/api/accounting/configuration/taxApi';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';
import { paymentTermApi } from '@/lib/api/accounting/configuration/paymentTermApi';
import { accountingPaymentMethodApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import { customerReceiptApi } from '@/lib/api/accounting/receivables/customerReceiptApi';
import { getAllServices, type ServiceRecord, type SubServiceRecord } from '@/lib/apis/serviceApi';
import { quotationApi, type Quotation } from '@/lib/api/quotationApi';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import AccountingConfirmDialog from './AccountingConfirmDialog';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import InvoiceViewModal from './InvoiceViewModal';
import A4InvoiceSheet, { type InvoiceLineItem } from './A4InvoiceSheet';
import { useBranchTheme } from '@/components/branding/BranchThemeProvider';
import { resolveBranchLogoUrl } from '@/lib/portfolio-branding';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass } from '@/lib/dashboard-ui';
import {
  GRAPHIC_DESIGN,
  SOCIAL_MEDIA_MARKETING,
  WEBSITE_DESIGN,
  EVENT_BRANDING,
  WEB_HOSTING,
} from '@/lib/constants';

type Row = { id: number; [key: string]: unknown };
type Line = {
  product_id: number | null;
  service_type: string;
  selected_subservice_ids: string[];
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_id: number | null;
  is_free?: boolean;
};
type Form = {
  customer_id: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  invoice_to: string;
  invoice_date: string;
  due_date: string;
  payment_term_id: string;
  payment_advance: string;
  payment_completion: string;
  nb: string;
  notes: string;
  lines: Line[];
  receive_payment_now: boolean;
  payment_method_id: string;
  amount_received: string;
  payment_reference: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({
  product_id: null,
  service_type: 'Graphic design & Branding',
  selected_subservice_ids: [],
  description: '',
  quantity: 1,
  unit_price: 0,
  discount_percent: 0,
  tax_id: null,
  is_free: false,
});
const emptyForm = (): Form => ({
  customer_id: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  invoice_to: '',
  invoice_date: today(),
  due_date: today(),
  payment_term_id: '',
  payment_advance: '70% of charge paid in advance.',
  payment_completion: '30% of charge paid after the project Completion',
  nb: 'NB: the advance amount should be paid when you get the invoice.',
  notes: '',
  lines: [emptyLine()],
  receive_payment_now: false,
  payment_method_id: '',
  amount_received: '',
  payment_reference: '',
});
const apiDate = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString();
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const money = (value: unknown, code = '') => `${code ? `${code} ` : ''}${Number(value || 0).toFixed(2)}`;
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';

export default function CustomerInvoicesPage() {
  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2");
  const brandPrimary = isRaadsan ? (primaryColor || "#0166d2") : (primaryColor || "#6e0002");
  const brandSecondary = isRaadsan ? (secondaryColor || "#fdc210") : (secondaryColor || "#ea580c");
  const brandLogo = resolveBranchLogoUrl(branchLogoUrl) || (isRaadsan ? "/logo-02.png" : "/deero-logo.png");

  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [taxes, setTaxes] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [terms, setTerms] = useState<Row[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Row[]>([]);
  const [availableServices, setAvailableServices] = useState<ServiceRecord[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selected, setSelected] = useState<CustomerInvoice | null>(null);
  const [open, setOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<'form' | 'preview'>('form');
  const [viewInvoice, setViewInvoice] = useState<CustomerInvoice | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'post' | 'delete'; invoice: CustomerInvoice } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewOnly, setViewOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const productRows = await accountingProductApi.getAll();
      const [invoiceRows, customerRows, taxRows, currencyRows, termRows, methodRows, serviceRes, quotationRows] = await Promise.all([
        customerInvoiceApi.getAll(), accountingCustomerApi.getAll(), accountingTaxApi.getAll(),
        currencyApi.getAll(), paymentTermApi.getAll(), accountingPaymentMethodApi.getAll(),
        getAllServices().catch(() => ({ success: false, data: [] as ServiceRecord[] })),
        quotationApi.getAll().catch(() => [] as Quotation[]),
      ]);
      setInvoices(invoiceRows); setCustomers(customerRows); setProducts(productRows); setTaxes(taxRows); setCurrencies(currencyRows);
      setTerms(termRows);
      setPaymentMethods(methodRows);
      if (serviceRes && (serviceRes as any).success && Array.isArray((serviceRes as any).data)) {
        setAvailableServices((serviceRes as any).data);
      }
      setQuotations(Array.isArray(quotationRows) ? quotationRows : []);
    } catch (error) { accountingToast(errorMessage(error), 'error'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const totals = useMemo(() => form.lines.reduce((sum, line) => {
    const gross = Number(line.quantity || 0) * Number(line.unit_price || 0);
    const discounted = gross * (1 - Number(line.discount_percent || 0) / 100);
    const tax = taxes.find((item) => item.id === Number(line.tax_id));
    const rate = Number(tax?.rate_percent || 0) / 100;
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted;
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0;
    return { untaxed: sum.untaxed + untaxed, discount: sum.discount + gross - discounted, tax: sum.tax + taxAmount, total: sum.total + untaxed + taxAmount };
  }, { untaxed: 0, discount: 0, tax: 0, total: 0 }), [form.lines, taxes]);

  const filtered = invoices.filter((invoice) => {
    const needle = query.trim().toLowerCase();
    const searchable = !needle || [invoice.invoice_number, invoice.customers?.name, invoice.state, invoice.payment_state].some((value) => String(value || '').toLowerCase().includes(needle));
    const effectiveStatus = invoice.state === 'cancelled' ? 'cancelled' : invoice.payment_state === 'paid' ? 'paid' : invoice.payment_state === 'partial' ? 'partial' : invoice.state;
    const invoiceDay = dateValue(invoice.invoice_date);
    return searchable &&
      (statusFilter === 'all' || effectiveStatus === statusFilter) &&
      (currencyFilter === 'all' || Number(invoice.currency_id) === Number(currencyFilter)) &&
      (customerFilter === 'all' || Number(invoice.customer_id) === Number(customerFilter)) &&
      (!dateFrom || invoiceDay >= dateFrom) && (!dateTo || invoiceDay <= dateTo);
  });

  function createInvoice() {
    setSelected(null);
    setViewOnly(false);
    setDialogTab('form');
    const next = emptyForm();
    const immediate = terms.find((item) => /immediate/i.test(String(item.name)));
    if (immediate) next.payment_term_id = String(immediate.id);
    setForm(next); setOpen(true);
  }

  const acceptedQuotations = useMemo(() => {
    return quotations.filter((q) => q.status === 'ACCEPTED' || q.status === 'CONVERTED');
  }, [quotations]);

  function importFromQuotation(q: Quotation) {
    let qMeta: any = null;
    try {
      qMeta = q.notes ? JSON.parse(String(q.notes)) : null;
    } catch {
      qMeta = null;
    }

    const linkedCustomer = customers.find(
      (c) => c.id === Number(q.customer_id) || (q.client_id && (c as any).clientId === q.client_id)
    );

    const custName = qMeta?.quotation_to || qMeta?.invoice_to || linkedCustomer?.name || q.client?.institution || q.customer?.name || '';
    const custPerson = qMeta?.contact_person || q.client?.contactPerson || (linkedCustomer as any)?.contact_person || custName;
    const custEmail = qMeta?.contact_email || q.client?.email || q.customer?.email || (linkedCustomer as any)?.email || '';
    const custPhone = qMeta?.contact_phone || q.client?.phone || q.customer?.phone || (linkedCustomer as any)?.phone || '';

    let importedLines: Line[] = [];

    if (Array.isArray(qMeta?.items) && qMeta.items.length > 0) {
      importedLines = qMeta.items.map((item: any) => ({
        product_id: null,
        service_type: item.service_type || 'Graphic design & Branding',
        selected_subservice_ids: Array.isArray(item.selected_subservice_ids) ? item.selected_subservice_ids : [],
        description: item.description || '',
        quantity: Number(item.qty || item.quantity || 1),
        unit_price: Number(item.rate || item.unit_price || 0),
        discount_percent: Number(item.discount_percent || 0),
        tax_id: null,
        is_free: Boolean(item.is_free || Number(item.rate || 0) === 0),
      }));
    } else if (Array.isArray(q.lines) && q.lines.length > 0) {
      importedLines = q.lines.map((line) => ({
        product_id: line.product_id || null,
        service_type: line.products?.name || 'Graphic design & Branding',
        selected_subservice_ids: [],
        description: line.description || '',
        quantity: Number(line.quantity || 1),
        unit_price: Number(line.unit_price || 0),
        discount_percent: Number(line.discount_percent || 0),
        tax_id: line.tax_id || null,
        is_free: Number(line.unit_price || 0) === 0,
      }));
    }

    if (importedLines.length === 0) {
      importedLines = [emptyLine()];
    }

    setForm((current) => ({
      ...current,
      customer_id: linkedCustomer ? String(linkedCustomer.id) : (q.customer_id ? String(q.customer_id) : current.customer_id),
      invoice_to: custName,
      contact_person: custPerson,
      contact_email: custEmail,
      contact_phone: custPhone,
      due_date: q.valid_until ? dateValue(q.valid_until) : current.due_date,
      payment_advance: qMeta?.payment_advance || current.payment_advance,
      payment_completion: qMeta?.payment_completion || current.payment_completion,
      nb: qMeta?.nb || current.nb,
      lines: importedLines,
    }));

    accountingToast(`Xogta Quotation-ka ${q.quotation_number} si guul leh ayaa loogu shubay invoice-ka!`, 'success');
  }

  function editInvoice(invoice: CustomerInvoice) {
    setSelected(invoice);
    setViewOnly(invoice.state !== 'draft');
    setDialogTab('form');

    let meta: any = null;
    try {
      meta = invoice.notes ? JSON.parse(String(invoice.notes)) : null;
    } catch {
      meta = null;
    }

    const cust = customers.find((c) => c.id === Number(invoice.customer_id)) || (invoice.customers as any);
    const invoiceLines = invoice.customer_invoice_lines || [];

    const hydratedLines: Line[] = invoiceLines.map((line, idx) => {
      const metaItem = Array.isArray(meta?.items) ? meta.items[idx] : null;
      return {
        product_id: line.product_id || null,
        service_type: metaItem?.service_type || line.products?.name || 'Graphic design & Branding',
        selected_subservice_ids: Array.isArray(metaItem?.selected_subservice_ids) ? metaItem.selected_subservice_ids : [],
        description: metaItem?.description || line.description || '',
        quantity: Number(line.quantity || 1),
        unit_price: Number(line.unit_price || 0),
        discount_percent: Number(line.discount_percent || 0),
        tax_id: line.tax_id || null,
        is_free: metaItem?.is_free ?? (Number(line.unit_price || 0) === 0),
      };
    });

    if (hydratedLines.length === 0) {
      hydratedLines.push(emptyLine());
    }

    const cName = meta?.invoice_to || meta?.quotation_to || String(cust?.name || (invoice.customers as any)?.name || '');
    const cPerson = meta?.contact_person || String((cust as any)?.contact_person || (cust as any)?.client?.contactPerson || cName);
    const cEmail = meta?.contact_email || String((cust as any)?.email || (cust as any)?.client?.email || (invoice.customers as any)?.email || '');
    const cPhone = meta?.contact_phone || String((cust as any)?.phone || (cust as any)?.client?.phone || (invoice.customers as any)?.phone || '');

    setForm({
      customer_id: String(invoice.customer_id),
      contact_person: cPerson,
      contact_email: cEmail,
      contact_phone: cPhone,
      invoice_to: cName,
      invoice_date: dateValue(invoice.invoice_date),
      due_date: dateValue(invoice.due_date),
      payment_term_id: String(invoice.payment_term_id || ''),
      payment_advance: meta?.payment_advance || '70% of charge paid in advance.',
      payment_completion: meta?.payment_completion || '30% of charge paid after the project Completion',
      nb: meta?.nb || meta?.nb_text || 'NB: the advance amount should be paid when you get the invoice.',
      notes: meta?.notes_text || (typeof invoice.notes === 'string' && !meta ? invoice.notes : ''),
      lines: hydratedLines,
      receive_payment_now: false,
      payment_method_id: '',
      amount_received: '',
      payment_reference: '',
    });
    setOpen(true);
  }

  function selectCustomer(value: string) {
    const nextCustomer = customers.find((item) => item.id === Number(value));
    const termId = nextCustomer?.payment_term_id || terms.find((item) => /immediate/i.test(String(item.name)))?.id || '';
    const due = new Date(`${form.invoice_date}T00:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() + paymentDays(String(termId)));

    const cName = String(nextCustomer?.name || '');
    const cPerson = String((nextCustomer as any)?.contact_person || (nextCustomer as any)?.client?.contactPerson || cName);
    const cEmail = String((nextCustomer as any)?.email || (nextCustomer as any)?.client?.email || '');
    const cPhone = String((nextCustomer as any)?.phone || (nextCustomer as any)?.client?.phone || '');

    // Check if customer has an accepted quotation
    const customerQuotation = quotations.find(
      (q) => (q.status === 'ACCEPTED' || q.status === 'CONVERTED') &&
             (Number(q.customer_id) === Number(value) || (q.client_id && (nextCustomer as any)?.clientId === q.client_id))
    );

    let patch: Partial<Form> = {
      customer_id: value,
      invoice_to: cName,
      contact_person: cPerson,
      contact_email: cEmail,
      contact_phone: cPhone,
      payment_term_id: String(termId),
      due_date: due.toISOString().slice(0, 10),
    };

    if (customerQuotation) {
      let qMeta: any = null;
      try { qMeta = customerQuotation.notes ? JSON.parse(String(customerQuotation.notes)) : null; } catch {}
      if (qMeta?.contact_person) patch.contact_person = qMeta.contact_person;
      if (qMeta?.quotation_to) patch.invoice_to = qMeta.quotation_to;
      if (qMeta?.contact_email) patch.contact_email = qMeta.contact_email;
      if (qMeta?.contact_phone) patch.contact_phone = qMeta.contact_phone;
      if (qMeta?.payment_advance) patch.payment_advance = qMeta.payment_advance;
      if (qMeta?.payment_completion) patch.payment_completion = qMeta.payment_completion;
      if (qMeta?.nb) patch.nb = qMeta.nb;

      // If form lines are still empty default, copy quotation lines too
      if (form.lines.length === 1 && !form.lines[0].description && Number(form.lines[0].unit_price) === 0) {
        if (Array.isArray(qMeta?.items) && qMeta.items.length > 0) {
          patch.lines = qMeta.items.map((item: any) => ({
            product_id: null,
            service_type: item.service_type || 'Graphic design & Branding',
            selected_subservice_ids: Array.isArray(item.selected_subservice_ids) ? item.selected_subservice_ids : [],
            description: item.description || '',
            quantity: Number(item.qty || item.quantity || 1),
            unit_price: Number(item.rate || item.unit_price || 0),
            discount_percent: Number(item.discount_percent || 0),
            tax_id: null,
            is_free: Boolean(item.is_free || Number(item.rate || 0) === 0),
          }));
        }
      }
      accountingToast(`Xogta Quotation-ka (${customerQuotation.quotation_number}) ayaa toos loo soo qaatay!`, 'info');
    }

    setForm((current) => ({
      ...current,
      ...patch,
    }));
  }

  function paymentDays(termId: string) {
    const name = String(terms.find((item) => item.id === Number(termId))?.name || '');
    if (/immediate/i.test(name)) return 0;
    return Number(name.match(/\d+/)?.[0] || 0);
  }

  function setPaymentTerm(value: string) {
    const due = new Date(`${form.invoice_date}T00:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() + paymentDays(value));
    setForm({ ...form, payment_term_id: value, due_date: due.toISOString().slice(0, 10) });
  }

  function setInvoiceDate(value: string) {
    const due = new Date(`${value}T00:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() + paymentDays(form.payment_term_id));
    setForm({ ...form, invoice_date: value, due_date: due.toISOString().slice(0, 10) });
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  }

  function extractSubServiceItems(sub: SubServiceRecord): string[] {
    if (Array.isArray(sub.features) && sub.features.length > 0) {
      const list = sub.features.map((f) => String(f).trim()).filter(Boolean);
      if (list.length > 0) return list;
    }
    if (typeof sub.features === 'string') {
      try {
        const parsed = JSON.parse(sub.features);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.map((f) => String(f).trim()).filter(Boolean);
          if (list.length > 0) return list;
        }
      } catch {
        // ignore
      }
    }

    const allPackages: Record<string, string[]> = {
      ...GRAPHIC_DESIGN,
      ...SOCIAL_MEDIA_MARKETING,
      ...WEBSITE_DESIGN,
      ...EVENT_BRANDING,
      ...WEB_HOSTING,
    };

    const clean = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/^(xirmada\s+|package\s+)/, '')
        .replace(/\s+package$/, '')
        .replace(/\s+hosting$/, '')
        .trim();

    const subClean = clean(sub.name);

    for (const [pkgName, items] of Object.entries(allPackages)) {
      const pkgClean = clean(pkgName);
      if (pkgClean === subClean || pkgName.toLowerCase() === (sub.name || '').toLowerCase()) {
        return items;
      }
    }

    for (const [pkgName, items] of Object.entries(allPackages)) {
      const pkgClean = clean(pkgName);
      if (subClean.includes(pkgClean) || pkgClean.includes(subClean)) {
        return items;
      }
    }

    if (sub.description && sub.description.trim()) {
      const descItems = sub.description
        .split('\n')
        .map((line) => line.replace(/^[•\-\*\d\.\)]\s*/, '').trim())
        .filter(Boolean);
      if (descItems.length > 1) {
        return descItems;
      }
    }

    return [sub.name];
  }

  function handleServiceSelect(index: number, serviceName: string) {
    const nextLines = [...form.lines];
    const targetLine = { ...nextLines[index], service_type: serviceName };
    const matched = availableServices.find((s) => s.serviceName.toLowerCase() === serviceName.toLowerCase());

    if (matched && Array.isArray(matched.subService) && matched.subService.length > 0) {
      const firstSub = matched.subService[0];
      targetLine.selected_subservice_ids = [firstSub.id];
      const items = extractSubServiceItems(firstSub);
      targetLine.description = items.join(', ');
      if (firstSub.price && !targetLine.is_free && Number(targetLine.unit_price) === 0) {
        targetLine.unit_price = Number(firstSub.price);
      }
    } else {
      targetLine.selected_subservice_ids = [];
      if (!targetLine.description) {
        targetLine.description = serviceName;
      }
    }
    nextLines[index] = targetLine;
    setForm((current) => ({ ...current, lines: nextLines }));
  }

  function handleToggleSubService(index: number, sub: SubServiceRecord) {
    const nextLines = [...form.lines];
    const targetLine = { ...nextLines[index] };
    const exists = targetLine.selected_subservice_ids.includes(sub.id);
    const newSelected = exists
      ? targetLine.selected_subservice_ids.filter((id) => id !== sub.id)
      : [...targetLine.selected_subservice_ids, sub.id];

    targetLine.selected_subservice_ids = newSelected;

    const matched = availableServices.find((s) => s.serviceName.toLowerCase() === targetLine.service_type.toLowerCase());
    if (matched && Array.isArray(matched.subService)) {
      const selectedSubs = matched.subService.filter((s) => newSelected.includes(s.id));
      if (selectedSubs.length > 0) {
        const oldLines = targetLine.description.split('\n');
        const timelineLine = oldLines.find((l) => l.toLowerCase().includes('timeline'));

        // Extract detailed items of clicked subservices separated by commas
        const allItems = selectedSubs.flatMap((s) => extractSubServiceItems(s));
        const itemsLine = allItems.join(', ');

        targetLine.description = timelineLine ? `${itemsLine}\n\n${timelineLine}` : itemsLine;

        if (selectedSubs.length === 1 && selectedSubs[0].price && !targetLine.is_free && Number(targetLine.unit_price) === 0) {
          targetLine.unit_price = Number(selectedSubs[0].price);
        }
      } else {
        // All deselected — clear description
        targetLine.description = '';
      }
    }

    nextLines[index] = targetLine;
    setForm((current) => ({ ...current, lines: nextLines }));
  }


  function handleToggleFree(index: number) {
    const nextLines = [...form.lines];
    const item = { ...nextLines[index] };
    const nowFree = !item.is_free;
    item.is_free = nowFree;
    if (nowFree) {
      item.unit_price = 0;
    }
    nextLines[index] = item;
    setForm((current) => ({ ...current, lines: nextLines }));
  }

  async function save(postAfterSave = false) {
    const amountReceived = Number(form.amount_received || 0);
    if (postAfterSave && form.receive_payment_now) {
      if (!form.payment_method_id) return accountingToast('Select a payment method for the immediate payment.', 'error');
      if (!Number.isFinite(amountReceived) || amountReceived <= 0) return accountingToast('Amount received must be greater than zero.', 'error');
      if (amountReceived > totals.total + 0.005) return accountingToast('Amount received cannot exceed the invoice total.', 'error');
      try {
        const options = await customerReceiptApi.options({ customer_id: Number(form.customer_id), payment_method_id: Number(form.payment_method_id) });
        if (!options.accounts.length) return accountingToast('The selected payment method has no compatible active money account and journal.', 'error');
      } catch (error) { return accountingToast(errorMessage(error), 'error'); }
    }
    setSaving(true);

    const richNotesMeta = {
      notes_text: form.notes,
      contact_person: form.contact_person,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      invoice_to: form.invoice_to,
      payment_advance: form.payment_advance,
      payment_completion: form.payment_completion,
      nb: form.nb,
      vat_percent: previewVatRate,
      items: form.lines.map((l) => ({
        service_type: l.service_type,
        selected_subservice_ids: l.selected_subservice_ids,
        description: l.description,
        qty: Number(l.quantity || 1),
        quantity: Number(l.quantity || 1),
        rate: Number(l.unit_price || 0),
        unit_price: Number(l.unit_price || 0),
        is_free: Boolean(l.is_free),
        amount: Number(l.quantity || 1) * Number(l.unit_price || 0) * (1 - Number(l.discount_percent || 0) / 100),
      })),
    };

    const payload = {
      notes: JSON.stringify(richNotesMeta),
      lines: form.lines.map((line) => ({
        product_id: line.product_id,
        description: line.description || line.service_type || 'Custom line',
        quantity: Number(line.quantity || 1),
        unit_price: Number(line.unit_price || 0),
        discount_percent: Number(line.discount_percent || 0),
        tax_id: line.tax_id || null,
      })),
      customer_id: Number(form.customer_id),
      invoice_date: apiDate(form.invoice_date),
      due_date: form.due_date ? apiDate(form.due_date) : null,
      payment_term_id: form.payment_term_id ? Number(form.payment_term_id) : null,
    };
    try {
      const saved = selected ? await customerInvoiceApi.update(selected.id, payload) : await customerInvoiceApi.create(payload);
      if (postAfterSave) {
        const postedInvoice = await customerInvoiceApi.post(saved.id);
        if (form.receive_payment_now) {
          const receipt = await customerReceiptApi.create({
            customer_id: postedInvoice.customer_id,
            payment_method_id: Number(form.payment_method_id),
            receipt_date: apiDate(form.invoice_date),
            amount: amountReceived,
            reference: form.payment_reference.trim() || undefined,
            memo: `Immediate payment for invoice ${postedInvoice.invoice_number}`,
            allocations: [{ invoice_id: postedInvoice.id, allocated_amount: amountReceived }],
          });
          await customerReceiptApi.post(receipt.id);
        }
      }
      accountingToast(postAfterSave ? form.receive_payment_now ? 'Invoice and payment posted successfully' : 'Invoice posted successfully' : `Draft invoice ${selected ? 'updated' : 'created'} successfully`);
      setOpen(false); await load();
    } catch (error) { accountingToast(errorMessage(error), 'error'); } finally { setSaving(false); }
  }
  async function remove(invoice: CustomerInvoice) {
    setSaving(true); try { await customerInvoiceApi.remove(invoice.id); accountingToast('Draft invoice deleted successfully'); setPendingAction(null); await load(); }
    catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  async function postInvoice(invoice: CustomerInvoice) {
    setSaving(true); try { await customerInvoiceApi.post(invoice.id); accountingToast('Invoice and journal entry posted successfully'); setPendingAction(null); await load(); }
    catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }

  // Accept & Post with optional Customer Receipt
  const [acceptInvoice, setAcceptInvoice] = useState<CustomerInvoice | null>(null);
  const [createReceiptOnPost, setCreateReceiptOnPost] = useState(true);
  const [receiptPaymentMethodId, setReceiptPaymentMethodId] = useState<string>('');

  const openAcceptInvoice = (invoice: CustomerInvoice) => {
    setAcceptInvoice(invoice);
    setCreateReceiptOnPost(true);
    const validMethod = paymentMethods.find((m) => m.is_active !== false && m.gl_account_id && ['inbound', 'both'].includes(String(m.payment_type)));
    if (validMethod) setReceiptPaymentMethodId(String(validMethod.id));
  };

  async function handleConfirmPost() {
    if (!acceptInvoice) return;
    if (createReceiptOnPost && !receiptPaymentMethodId) {
      return accountingToast('Select a payment method for the customer receipt.', 'error');
    }
    setSaving(true);
    try {
      const posted = await customerInvoiceApi.post(acceptInvoice.id);
      if (createReceiptOnPost && receiptPaymentMethodId) {
        const receipt = await customerReceiptApi.create({
          customer_id: posted.customer_id,
          payment_method_id: Number(receiptPaymentMethodId),
          receipt_date: apiDate(today()),
          amount: Number(posted.amount_total),
          reference: `Receipt for ${posted.invoice_number}`,
          memo: `Payment for invoice ${posted.invoice_number}`,
          allocations: [{ invoice_id: posted.id, allocated_amount: Number(posted.amount_total) }],
        });
        await customerReceiptApi.post(receipt.id);
        accountingToast(`Invoice posted & Customer Receipt created successfully!`);
      } else {
        accountingToast('Invoice and journal entry posted successfully');
      }
      setAcceptInvoice(null);
      await load();
    } catch (error) {
      accountingToast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }


  const columns: DashboardTableColumn<CustomerInvoice>[] = [
    { key: 'number', header: 'Invoice', cell: (row) => <span className="font-bold text-primary">{row.invoice_number}</span> },
    { key: 'customer', header: 'Customer', cell: (row) => row.customers?.name || `#${row.customer_id}` },
    { key: 'date', header: 'Invoice Date', cell: (row) => dateValue(row.invoice_date) },
    { key: 'due', header: 'Due Date', cell: (row) => dateValue(row.due_date) },
    { key: 'currency', header: 'Currency', cell: (row) => row.currencies?.code || '—' },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => (
        <button
          type="button"
          disabled={row.state !== 'draft' || saving}
          onClick={() => row.state === 'draft' && openAcceptInvoice(row)}
          className={row.state === 'draft' ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"}
          title={row.state === 'draft' ? "Click to Accept / Post Invoice & Create Receipt" : undefined}
        >
          <Status invoice={row} />
        </button>
      ),
    },
    { key: 'subtotal', header: 'Subtotal', align: 'right', cell: (row) => money(row.amount_untaxed) },
    { key: 'tax', header: 'Tax', align: 'right', cell: (row) => money(row.amount_tax) },
    { key: 'total', header: 'Total', align: 'right', cell: (row) => <span className="font-semibold">{money(row.amount_total)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', cell: (row) => money(row.paid_amount ?? Number(row.amount_total) - Number(row.amount_due)) },
    { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (row) => money(row.amount_due) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <button
            title="View Invoice (Standard Template)"
            onClick={() => {
              setViewInvoice(row);
              setViewModalOpen(true);
            }}
            className={actionBtnView}
          >
            <Eye className="size-4" />
          </button>
          {row.state === 'draft' && (
            <>
              <button title="Edit" onClick={() => editInvoice(row)} className={actionBtnEdit}>
                <SquarePen className="size-4" />
              </button>
              <button title="Accept & Post (with Receipt)" onClick={() => openAcceptInvoice(row)} className={actionBtnView}>
                <Send className="size-4" />
              </button>
              <button title="Delete" onClick={() => setPendingAction({ type: 'delete', invoice: row })} className={actionBtnDelete}>
                <Trash2 className="size-4" />
              </button>
            </>
          )}
          <button
            title="Print / View Invoice"
            onClick={() => {
              setViewInvoice(row);
              setViewModalOpen(true);
            }}
            className={actionBtnView}
          >
            <Printer className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  // Live preview helpers for A4InvoiceSheet
  const selectedCustomer = customers.find((c) => c.id === Number(form.customer_id));
  const previewContactPerson = form.contact_person || (selectedCustomer ? String((selectedCustomer as any).contact_person || selectedCustomer.name || '—') : '—');
  const previewInvoiceTo = form.invoice_to || (selectedCustomer ? String(selectedCustomer.name || 'Customer') : 'Customer');
  const previewContactEmail = form.contact_email || (selectedCustomer ? String((selectedCustomer as any).email || '—') : '—');
  const previewContactPhone = form.contact_phone || (selectedCustomer ? String((selectedCustomer as any).phone || '—') : '—');
  const previewInvoiceNo = selected?.invoice_number || '#DADV-INV-DRAFT';
  const previewDateStr = new Date(form.invoice_date || today()).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const previewDueDateStr = form.due_date
    ? new Date(form.due_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : undefined;
  const previewLines: InvoiceLineItem[] = form.lines.map((l, idx) => ({
    id: idx + 1,
    service_type: l.service_type || 'Service',
    description: l.description || '',
    quantity: Number(l.quantity || 1),
    rate: Number(l.unit_price || 0),
    is_free: Boolean(l.is_free || Number(l.unit_price || 0) === 0),
    amount: Number(l.quantity || 1) * Number(l.unit_price || 0) * (1 - Number(l.discount_percent || 0) / 100),
    selected_subservice_ids: l.selected_subservice_ids,
  }));
  const previewVatRate = totals.untaxed > 0 && totals.tax > 0 ? Math.round((totals.tax / totals.untaxed) * 100) : 5;

  return (
    <AccountingPageShell section="Receivables" title="Customer Invoices" description="Prepare and manage customer sales invoices.">
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search invoices..." emptyText="No customer invoices found" minWidth="1350px" action={<button onClick={createInvoice} className={btnCreatePage}><Plus className="size-4" /> New invoice</button>} filters={<><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All customers</option>{customers.map((item) => <option key={item.id} value={item.id}>{String(item.name)}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="partial">Partially paid</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select><select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All currencies</option>{currencies.map((item) => <option key={item.id} value={item.id}>{String(item.code)}</option>)}</select><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={dashboardSelectClass} /><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={dashboardSelectClass} /><button onClick={() => void load()} className="flex size-[42px] items-center justify-center rounded-md border border-zinc-200 bg-white"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />
    
    <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}>
      <DialogContent className="max-h-[94vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader className="flex-row items-center justify-between text-left pb-2 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <DialogTitle>{viewOnly ? 'View' : selected ? 'Edit' : 'Prepare'} customer invoice</DialogTitle>
              <DialogDescription className="mt-1">
                {selected ? selected.invoice_number : 'New Customer Invoice'} • {viewOnly ? 'Posted invoices are read-only.' : 'Invoice number, company, and accounting defaults are applied automatically.'}
              </DialogDescription>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex rounded-lg bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setDialogTab('form')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                dialogTab === 'form' ? 'bg-white text-zinc-900 shadow-sm font-bold' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <SquarePen className="size-3.5" /> Edit Form
            </button>
            <button
              type="button"
              onClick={() => setDialogTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                dialogTab === 'preview' ? 'bg-white text-primary shadow-sm font-bold' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Eye className="size-3.5" /> Live Preview
            </button>
          </div>
        </DialogHeader>

        {dialogTab === 'preview' ? (
          <div className="space-y-4 py-2">
            <div className="flex justify-between items-center bg-orange-50/70 border border-orange-200/60 rounded-xl px-4 py-2.5 text-xs text-orange-900">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-orange-600 shrink-0" />
                <span>Standard Invoice Template live preview with Deero branding and official stamp.</span>
              </div>
              <button
                type="button"
                onClick={() => setDialogTab('form')}
                className="text-xs font-bold text-orange-700 underline hover:text-orange-950"
              >
                Back to Edit Form
              </button>
            </div>
            <div className="bg-zinc-100 p-2 sm:p-4 rounded-xl flex justify-center max-h-[70vh] overflow-y-auto">
              <div className="w-full max-w-[850px]">
                <A4InvoiceSheet
                  contactPerson={previewContactPerson}
                  invoiceNo={previewInvoiceNo}
                  contactEmail={previewContactEmail}
                  invoiceTo={previewInvoiceTo}
                  contactPhone={previewContactPhone}
                  date={previewDateStr}
                  dueDate={previewDueDateStr}
                  lines={previewLines}
                  subtotal={totals.untaxed}
                  vatPercent={previewVatRate}
                  taxAmount={totals.tax}
                  paidAmount={selected ? (selected.paid_amount ?? Number(selected.amount_total) - Number(selected.amount_due)) : form.receive_payment_now ? Math.min(Number(form.amount_received || 0), totals.total) : 0}
                  grandTotal={totals.total}
                  paymentAdvance={form.payment_advance}
                  paymentCompletion={form.payment_completion}
                  nbText={form.nb}
                  showStamp={true}
                  brandPrimary={brandPrimary}
                  brandSecondary={brandSecondary}
                  brandLogo={brandLogo}
                  onBackToEdit={() => setDialogTab('form')}
                />
              </div>
            </div>
            <DialogFooter className="border-t border-zinc-100 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-md border border-zinc-200 px-4 text-sm font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setDialogTab('form')}
                className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white"
              >
                <SquarePen className="size-4" /> Return to Form
              </button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
            <fieldset disabled={viewOnly} className="contents">
              {/* Customer & Invoice Dates Header Card */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Select label="Customer" value={form.customer_id} set={selectCustomer} rows={customers} />
                  <Field label="Invoice date" type="date" value={form.invoice_date} set={setInvoiceDate} />
                  <Field label="Due date" type="date" value={form.due_date} set={(value) => setForm({ ...form, due_date: value })} />
                  <Select label="Payment term" value={form.payment_term_id} set={setPaymentTerm} rows={terms} optional />
                </div>

                {/* Editable Contact Info on Document */}
                <div className="pt-2 border-t border-zinc-200/80 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">Contact Person</label>
                    <input
                      type="text"
                      value={form.contact_person}
                      onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                      placeholder="e.g. Abdisalam Abdullahi"
                      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">Invoice To (Company / Client)</label>
                    <input
                      type="text"
                      value={form.invoice_to}
                      onChange={(e) => setForm({ ...form, invoice_to: e.target.value })}
                      placeholder="e.g. CARAF AND CO."
                      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-bold text-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">Contact Email</label>
                    <input
                      type="text"
                      value={form.contact_email}
                      onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                      placeholder="e.g. info@client.com"
                      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">Contact Phone</label>
                    <input
                      type="text"
                      value={form.contact_phone}
                      onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                      placeholder="e.g. +252 61 5000000"
                      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800"
                    />
                  </div>
                </div>
              </div>

              {/* Service & Items Builder (Quotation Style) */}
              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-zinc-50/70">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Invoice Services & Items</h3>
                    <p className="text-[11px] text-zinc-500">
                      Dooro service-ka si subservice-yada ay toos ugu soo baxaan, kadibna calaamadee kuwa aad rabto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}
                    className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Plus className="size-3.5" /> Add Service Line
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {form.lines.map((line, index) => {
                    const matchedService = availableServices.find(
                      (s) => s.serviceName.toLowerCase() === line.service_type.toLowerCase()
                    );
                    const lineAmount = Number(line.quantity || 1) * Number(line.unit_price || 0) * (1 - Number(line.discount_percent || 0) / 100);

                    return (
                      <div
                        key={index}
                        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3 relative transition-all hover:border-zinc-300"
                      >
                        {/* Top Line: Service Selection & Title */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-700 text-xs font-bold shrink-0">
                              #{index + 1}
                            </span>
                            <span className="text-xs font-bold text-zinc-800">Service Line</span>
                          </div>

                          <button
                            type="button"
                            disabled={form.lines.length === 1}
                            onClick={() => setForm({ ...form, lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })}
                            className="text-zinc-400 hover:text-rose-600 disabled:opacity-25 transition-colors p-1"
                            title="Delete this line"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        {/* Service Type Pickers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-700 mb-1">
                              Service Catalog *
                            </label>
                            <select
                              value={
                                availableServices.some((s) => s.serviceName.toLowerCase() === line.service_type.toLowerCase())
                                  ? availableServices.find((s) => s.serviceName.toLowerCase() === line.service_type.toLowerCase())?.serviceName
                                  : '__CUSTOM__'
                              }
                              onChange={(e) => {
                                if (e.target.value === '__CUSTOM__') {
                                  updateLine(index, { service_type: '' });
                                } else {
                                  handleServiceSelect(index, e.target.value);
                                }
                              }}
                              className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-800"
                            >
                              <option value="__CUSTOM__">✍️ Custom Service (Gacanta ku qor)</option>
                              {availableServices.map((s) => (
                                <option key={s.id} value={s.serviceName}>
                                  {s.serviceName}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-700 mb-1">
                              Service Name (Display in Invoice) *
                            </label>
                            <input
                              required
                              value={line.service_type}
                              onChange={(e) => updateLine(index, { service_type: e.target.value })}
                              placeholder="e.g. Graphic design & Branding"
                              className="h-9 w-full rounded-md border border-zinc-200 px-3 text-xs font-bold text-zinc-900"
                            />
                          </div>
                        </div>

                        {/* Subservice multi-select chips */}
                        {matchedService && Array.isArray(matchedService.subService) && matchedService.subService.length > 0 && (
                          <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                                Sub-services (Click to include / exclude):
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {line.selected_subservice_ids.length} selected
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {matchedService.subService.map((sub) => {
                                const isChecked = line.selected_subservice_ids.includes(sub.id);
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => handleToggleSubService(index, sub)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium border flex items-center gap-1.5 transition-all ${
                                      isChecked
                                        ? 'bg-[#ea580c] text-white border-orange-600 shadow-sm font-bold'
                                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                                    }`}
                                  >
                                    {isChecked && <Check className="size-3.5 stroke-[3]" />}
                                    <span>{sub.name}</span>
                                    {sub.price != null && Number(sub.price) > 0 && (
                                      <span className={`text-[10px] ${isChecked ? 'text-white/90 font-bold' : 'text-zinc-400'}`}>
                                        (${sub.price})
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Item(s) Description textarea */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-zinc-700">
                              Item(s) Detailed Description *
                            </label>
                            <span className="text-[11px] text-zinc-400">
                              Waad wax ka beddeli kartaa, wax ku dari kartaa, ama tirtiri kartaa
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            required
                            value={line.description}
                            onChange={(e) => updateLine(index, { description: e.target.value })}
                            placeholder={`• Logo design\n• Stationery Design (Bc Card, ID Card, Letterhead & Stamp)\n\nTimeline 7 days`}
                            className="w-full p-2.5 rounded-md border border-zinc-200 text-xs text-zinc-800 leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>

                        {/* Pricing & Financials: Qua, Rate, Free, Discount, Tax, Amount */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end pt-2 bg-zinc-50/50 p-3 rounded-lg border border-zinc-200/60">
                          <div>
                            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Qua (Qty)</label>
                            <input
                              required
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-center text-xs font-bold"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-semibold text-zinc-600">Rate ($)</label>
                              <button
                                type="button"
                                onClick={() => handleToggleFree(index)}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                  line.is_free
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
                                }`}
                              >
                                {line.is_free ? 'FREE' : 'Free?'}
                              </button>
                            </div>
                            <input
                              required
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={line.is_free}
                              value={line.is_free ? 0 : line.unit_price}
                              onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })}
                              className={`h-8 w-full rounded-md border px-2.5 text-center text-xs font-bold ${
                                line.is_free ? 'bg-zinc-100 text-zinc-400' : 'border-zinc-200 bg-white text-orange-600'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Discount %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={line.discount_percent}
                              onChange={(e) => updateLine(index, { discount_percent: Number(e.target.value) })}
                              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-center text-xs font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Tax</label>
                            <select
                              value={line.tax_id || ''}
                              onChange={(e) => updateLine(index, { tax_id: Number(e.target.value) || null })}
                              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs"
                            >
                              <option value="">No tax</option>
                              {taxes
                                .filter((item) => item.is_active !== false && Number(item.rate_percent || 0) !== 0)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {String(item.name)}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="text-right sm:text-right">
                            <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Amount</span>
                            <span className="text-sm font-extrabold text-orange-600">
                              {line.is_free ? 'Free' : `$${lineAmount.toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Terms & Structure */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Payment Structure & Notes Banner
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Advance Payment Text
                    </label>
                    <input
                      type="text"
                      value={form.payment_advance}
                      onChange={(e) => setForm({ ...form, payment_advance: e.target.value })}
                      placeholder="70% of charge paid in advance."
                      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Completion Payment Text
                    </label>
                    <input
                      type="text"
                      value={form.payment_completion}
                      onChange={(e) => setForm({ ...form, payment_completion: e.target.value })}
                      placeholder="30% of charge paid after the project Completion"
                      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      NB Banner Text
                    </label>
                    <input
                      type="text"
                      value={form.nb}
                      onChange={(e) => setForm({ ...form, nb: e.target.value })}
                      placeholder="NB: the advance amount should be paid when you get the invoice."
                      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  {!viewOnly && (
                    <section className="rounded-xl border border-zinc-200 p-4 bg-white">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <CreditCard className="size-4" />
                        </span>
                        <h3 className="text-sm font-semibold">Immediate Payment (Optional)</h3>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.receive_payment_now}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              receive_payment_now: event.target.checked,
                              payment_method_id: event.target.checked ? current.payment_method_id : '',
                              amount_received: event.target.checked ? current.amount_received : '',
                              payment_reference: event.target.checked ? current.payment_reference : '',
                            }))
                          }
                          className="size-4 accent-primary"
                        />
                        Receive Payment Now (Auto mark as paid)
                      </label>
                      <p className="ml-6 mt-1 text-[11px] text-zinc-400">
                        Mark this invoice as paid upon saving and record the payment receipt.
                      </p>
                      {form.receive_payment_now && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <label className="text-xs font-semibold">
                            Payment Method *
                            <select
                              required
                              value={form.payment_method_id}
                              onChange={(event) => setForm({ ...form, payment_method_id: event.target.value })}
                              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 bg-white"
                            >
                              <option value="">Select method</option>
                              {paymentMethods
                                .filter(
                                  (method) =>
                                    method.is_active !== false &&
                                    method.gl_account_id &&
                                    ['inbound', 'both'].includes(String(method.payment_type))
                                )
                                .map((method) => (
                                  <option key={method.id} value={method.id}>
                                    {String(method.name)}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="text-xs font-semibold">
                            Amount *
                            <input
                              required
                              type="number"
                              min="0.01"
                              max={totals.total || undefined}
                              step="0.01"
                              value={form.amount_received}
                              onChange={(event) => setForm({ ...form, amount_received: event.target.value })}
                              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3"
                            />
                          </label>
                          <label className="text-xs font-semibold">
                            Reference
                            <input
                              value={form.payment_reference}
                              onChange={(event) => setForm({ ...form, payment_reference: event.target.value })}
                              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3"
                            />
                          </label>
                        </div>
                      )}
                    </section>
                  )}
                  <section className="rounded-xl border border-zinc-200 p-4 bg-white">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <StickyNote className="size-4" />
                      </span>
                      <h3 className="text-sm font-semibold">Additional Notes</h3>
                    </div>
                    <textarea
                      maxLength={500}
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      className="min-h-[90px] w-full resize-none rounded-md border border-zinc-200 p-3 text-sm"
                      placeholder="Add any internal or invoice notes..."
                    />
                    <p className="mt-1 text-right text-[10px] text-zinc-400">{form.notes.length} / 500</p>
                  </section>
                </div>

                <aside className="h-full rounded-xl border border-zinc-200 p-4 text-sm bg-white">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileText className="size-4" />
                    </span>
                    <p className="font-semibold">Invoice summary</p>
                  </div>
                  <Total label="Subtotal" value={selected ? Number(selected.amount_untaxed) : totals.untaxed} />
                  <Total label="Tax" value={selected ? Number(selected.amount_tax) : totals.tax} />
                  <div className="my-3 border-t border-zinc-200" />
                  <Total label="Grand total" value={selected ? Number(selected.amount_total) : totals.total} strong />
                  <div className="my-3 border-t border-zinc-200" />
                  <Total
                    label="Paid"
                    value={
                      selected
                        ? Number(selected.paid_amount || 0)
                        : form.receive_payment_now
                        ? Math.min(Number(form.amount_received || 0), totals.total)
                        : 0
                    }
                  />
                  <Total
                    label="Balance"
                    value={
                      selected
                        ? Number(selected.amount_due)
                        : Math.max(0, totals.total - (form.receive_payment_now ? Number(form.amount_received || 0) : 0))
                    }
                  />
                  <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3">
                    <span>Status</span>
                    <span className="rounded-full bg-secondary/15 px-3 py-1 text-[11px] font-semibold text-secondary">
                      {selected?.state === 'cancelled'
                        ? 'Cancelled'
                        : selected?.payment_state === 'paid'
                        ? 'Paid'
                        : selected?.payment_state === 'partial'
                        ? 'Partially Paid'
                        : selected?.state === 'posted'
                        ? 'Posted'
                        : 'Draft'}
                    </span>
                  </div>
                </aside>
              </div>
            </fieldset>
            <DialogFooter className="border-t border-zinc-100 pt-4"><button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md border border-zinc-200 px-4 text-sm font-semibold">{viewOnly ? 'Close' : 'Cancel'}</button>{!viewOnly && <><button disabled={saving} className="flex h-9 items-center gap-2 rounded-md border border-primary/30 px-4 text-sm font-semibold text-primary"><Save className="size-4" />{saving ? 'Saving...' : 'Save Draft'}</button><button type="button" disabled={saving} onClick={(event) => { if (event.currentTarget.form?.reportValidity()) void save(true); }} className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white"><Send className="size-4" /> Post Invoice</button></>}</DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
    <AccountingConfirmDialog open={Boolean(pendingAction)} title={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Customer Invoice`} description={pendingAction?.type === 'delete' ? 'Confirm removal of this draft customer invoice.' : 'Confirm this invoice before posting its journal entry and locking it.'} confirmLabel={`${pendingAction?.type === 'delete' ? 'Delete' : 'Post'} Invoice`} destructive={pendingAction?.type === 'delete'} busy={saving} details={pendingAction && <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><b>{pendingAction.invoice.invoice_number}</b></div>} onCancel={() => setPendingAction(null)} onConfirm={() => pendingAction && void (pendingAction.type === 'delete' ? remove(pendingAction.invoice) : postInvoice(pendingAction.invoice))} />

    {/* Accept & Post Invoice Dialog with Automatic Customer Receipt Option */}
    <Dialog open={Boolean(acceptInvoice)} onOpenChange={(val) => !saving && !val && setAcceptInvoice(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <Send className="size-4 text-primary" /> Accept & Post Customer Invoice
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Posting will recognize revenue in Accounting (Dr Accounts Receivable, Cr Sales Revenue).
          </DialogDescription>
        </DialogHeader>

        {acceptInvoice && (
          <div className="space-y-4 py-2">
            {/* Invoice Info Summary */}
            <div className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">Invoice Number:</span>
                <span className="font-bold text-primary">{acceptInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">Customer:</span>
                <span className="font-semibold text-zinc-800">{acceptInvoice.customers?.name || `#${acceptInvoice.customer_id}`}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">Invoice Date:</span>
                <span className="text-zinc-700">{dateValue(acceptInvoice.invoice_date)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-200 pt-2">
                <span className="text-zinc-700 font-bold">Total Amount:</span>
                <span className="font-bold text-sm text-zinc-900">{money(acceptInvoice.amount_total, acceptInvoice.currencies?.code || '')}</span>
              </div>
            </div>

            {/* Auto Customer Receipt Option */}
            <div className="rounded-xl border border-zinc-200 p-3.5 bg-white space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createReceiptOnPost}
                  onChange={(e) => setCreateReceiptOnPost(e.target.checked)}
                  className="size-4 accent-primary rounded"
                />
                <span className="text-xs font-bold text-zinc-800">
                  Create Customer Receipt (Mark as Paid)
                </span>
              </label>
              <p className="text-[11px] text-zinc-500 ml-6">
                Automatically generate and post a Customer Receipt in Accounting for this invoice.
              </p>

              {createReceiptOnPost && (
                <div className="pt-2 border-t border-zinc-100">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={receiptPaymentMethodId}
                    onChange={(e) => setReceiptPaymentMethodId(e.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-200 px-3 text-xs bg-white"
                  >
                    <option value="">Select payment method</option>
                    {paymentMethods
                      .filter((m) => m.is_active !== false && m.gl_account_id && ['inbound', 'both'].includes(String(m.payment_type)))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {String(m.name)}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            disabled={saving}
            onClick={() => setAcceptInvoice(null)}
            className="h-9 rounded-md border border-zinc-200 px-4 text-xs font-semibold hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmPost}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="size-3.5 animate-spin mr-1" /> Posting...
              </>
            ) : (
              <>
                <Send className="size-3.5" /> Accept & Post Invoice
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <InvoiceViewModal
      open={viewModalOpen}
      onOpenChange={setViewModalOpen}
      invoice={viewInvoice}
    />

    </AccountingPageShell>
  );
}

function ProductPicker({ value, products, onChange }: { value?: number | null; products: Row[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = products.find((item) => item.id === Number(value));
  const visible = products.filter((item) => String(item.name || '').toLowerCase().includes(search.trim().toLowerCase()));

  function select(id: number | null) {
    onChange(id ? String(id) : '');
    setOpen(false);
    setSearch('');
  }

  return <div className="relative min-w-0">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-background px-2 text-left">
      <span className="truncate">{selected ? String(selected.name) : 'Custom line'}</span><span className="text-[10px] text-muted-foreground">▼</span>
    </button>
    {open && <div className="mt-1 w-full rounded-lg border bg-background p-1 shadow-sm">
      <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." className="mb-1 h-9 w-full rounded-md border px-2 outline-none focus:border-primary" />
      <div role="listbox" className="max-h-40 overflow-y-auto overscroll-contain">
        <button type="button" role="option" aria-selected={!value} onClick={() => select(null)} className={`block w-full rounded px-2 py-2 text-left hover:bg-muted ${!value ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>Custom line</button>
        {visible.map((item) => <button key={item.id} type="button" role="option" aria-selected={item.id === Number(value)} onClick={() => select(item.id)} className={`block w-full rounded px-2 py-2 text-left hover:bg-muted ${item.id === Number(value) ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>{String(item.name)}</button>)}
        {!visible.length && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matching products</p>}
      </div>
    </div>}
  </div>;
}

function PrintableInvoice({ invoice }: { invoice: CustomerInvoice }) {
  const currency = invoice.currencies?.code || '';
  return <section id="printable-invoice" className="hidden bg-white text-slate-950 print:block">
    <header className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
      <div><h1 className="text-3xl font-bold text-[#6f0d18]">Bloom Cafe</h1><p className="mt-1 text-sm text-slate-500">Customer sales invoice</p></div>
      <div className="text-right"><h2 className="text-3xl font-semibold">INVOICE</h2><p className="mt-2 font-bold">{invoice.invoice_number}</p></div>
    </header>
    <div className="grid grid-cols-2 gap-10 py-7 text-sm">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill to</p><p className="mt-2 text-base font-bold">{invoice.customers?.name || `Customer #${invoice.customer_id}`}</p>{invoice.customers?.phone && <p>{invoice.customers.phone}</p>}</div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-right"><dt className="text-slate-500">Invoice date</dt><dd className="font-semibold">{dateValue(invoice.invoice_date)}</dd><dt className="text-slate-500">Due date</dt><dd className="font-semibold">{dateValue(invoice.due_date) || '—'}</dd><dt className="text-slate-500">Status</dt><dd className="font-semibold uppercase">{invoice.payment_state || invoice.state}</dd></dl>
    </div>
    <table className="w-full border-collapse text-sm"><thead><tr className="bg-[#6f0d18] text-white"><th className="p-3 text-left">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit price</th><th className="p-3 text-right">Discount</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{(invoice.customer_invoice_lines || []).map((line, index) => { const amount = Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount_percent || 0) / 100); return <tr key={line.id || index} className="border-b"><td className="p-3">{line.description}</td><td className="p-3 text-right">{Number(line.quantity)}</td><td className="p-3 text-right">{money(line.unit_price)}</td><td className="p-3 text-right">{Number(line.discount_percent || 0).toFixed(2)}%</td><td className="p-3 text-right font-medium">{money(amount)}</td></tr>; })}</tbody></table>
    <div className="ml-auto mt-7 w-72 text-sm"><Total label="Subtotal" value={Number(invoice.amount_untaxed)} /><Total label="Tax" value={Number(invoice.amount_tax)} /><div className="my-2 border-t border-slate-400" /><div className="flex justify-between py-2 text-lg font-bold"><span>Total</span><span>{money(invoice.amount_total, currency)}</span></div><div className="flex justify-between py-1"><span>Paid</span><span>{money(invoice.paid_amount ?? Number(invoice.amount_total) - Number(invoice.amount_due), currency)}</span></div><div className="flex justify-between py-1"><span>Balance due</span><span>{money(invoice.amount_due, currency)}</span></div></div>
  </section>;
}

function Select({ label, value, set, rows, labelKey = 'name', optional, account, disabled }: { label: string; value: string; set: (value: string) => void; rows: Row[]; labelKey?: string; optional?: boolean; account?: boolean; disabled?: boolean }) {
  return <label className="text-xs font-semibold">{label}{!optional && <span className="text-rose-500"> *</span>}<select disabled={disabled} required={!optional} value={value} onChange={(event) => set(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted"><option value="">Select {label.toLowerCase()}</option>{rows.map((row) => <option key={row.id} value={row.id}>{account ? `${String(row.code || '')} — ${String(row.name || '')}` : String(row[labelKey] || row.name || '')}</option>)}</select></label>;
}
function Field({ label, value, set, type = 'text', optional, disabled }: { label: string; value: string; set: (value: string) => void; type?: string; optional?: boolean; disabled?: boolean }) {
  return <label className="text-xs font-semibold">{label}{!optional && <span className="text-rose-500"> *</span>}<input disabled={disabled} required={!optional} type={type} step={type === 'number' ? '0.000001' : undefined} min={type === 'number' ? '0.000001' : undefined} value={value} onChange={(event) => set(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted" /></label>;
}
function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between py-1 ${strong ? 'text-base font-bold' : ''}`}><span>{label}</span><span>{value.toFixed(2)}</span></div>; }
function Status({ invoice }: { invoice: CustomerInvoice }) {
  const key = invoice.state === 'cancelled' ? 'cancelled' : invoice.payment_state === 'paid' ? 'paid' : invoice.payment_state === 'partial' ? 'partial' : invoice.state;
  const styles: Record<string, string> = { draft: 'bg-zinc-100 text-zinc-700', posted: 'bg-blue-50 text-blue-700', partial: 'bg-orange-50 text-orange-700', paid: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-rose-50 text-rose-700' };
  const labels: Record<string, string> = { draft: 'DRAFT', posted: 'POSTED', partial: 'PARTIALLY PAID', paid: 'PAID', cancelled: 'CANCELLED' };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[key] || styles.draft}`}>{labels[key] || key.toUpperCase()}</span>;
}
