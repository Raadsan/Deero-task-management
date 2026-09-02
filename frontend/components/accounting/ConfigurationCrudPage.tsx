'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Check, SquarePen, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { createAccountingCrudApi, type AccountingRecord } from '@/lib/api/accounting/accountingCrud';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';
import { accountingProductCategoryApi } from '@/lib/api/accounting/configuration/productCategoryApi';
import { paymentMethodGlAccountApi } from '@/lib/api/accounting/configuration/paymentMethodApi';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import {
  accountingDialogClass,
  accountingDeleteBtnClass,
  accountingFormFieldClass,
  accountingFormSelectClass,
  accountingFormTextareaClass,
  accountingToast,
  btnFormCancel,
  btnFormSubmit,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
} from '@/lib/accounting-ui';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardStatusBadgeClass } from '@/lib/dashboard-ui';

type Value = string | number | boolean | null;
type Row = AccountingRecord & Record<string, unknown>;
type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'select' | 'boolean' | 'textarea';
  required?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  relation?: 'currencies' | 'categories' | 'accounts';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};
type Config = {
  title: string;
  description: string;
  resource: string;
  singular: string;
  fields: Field[];
  columns: string[];
  defaults: Record<string, Value>;
};

const CONFIGS: Record<string, Config> = {
  'account-types': {
    title: 'Account Types', singular: 'account type', resource: '/accounting/configuration/account-types',
    description: 'Define the classifications used to organize your chart of accounts.',
    columns: ['name', 'internal_group', 'normal_balance', 'report_type', 'sequence'],
    defaults: { name: '', internal_group: 'asset', normal_balance: 'debit', report_type: 'balance_sheet', sequence: 10 },
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Current Assets' },
      { key: 'internal_group', label: 'Internal Group', type: 'select', required: true, options: options(['asset', 'liability', 'equity', 'income', 'expense']) },
      { key: 'normal_balance', label: 'Normal Balance', type: 'select', required: true, options: options(['debit', 'credit']) },
      { key: 'report_type', label: 'Report Type', type: 'select', required: true, options: options(['balance_sheet', 'profit_loss']) },
      { key: 'sequence', label: 'Sequence', type: 'number', required: true, min: 0, step: 1 },
    ],
  },
  currencies: {
    title: 'Currencies', singular: 'currency', resource: '/accounting/configuration/currencies',
    description: 'Manage the currencies available for companies and financial transactions.',
    columns: ['code', 'name', 'symbol', 'decimal_places', 'is_active'],
    defaults: { code: '', name: '', symbol: '', decimal_places: 2, is_active: true },
    fields: [
      { key: 'code', label: 'Currency Code', required: true, placeholder: 'e.g. USD' },
      { key: 'name', label: 'Currency Name', required: true, placeholder: 'e.g. US Dollar' },
      { key: 'symbol', label: 'Symbol', placeholder: 'e.g. $' },
      { key: 'decimal_places', label: 'Decimal Places', type: 'number', required: true, min: 0, max: 6, step: 1 },
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },
  companies: {
    title: 'Companies', singular: 'company', resource: '/accounting/configuration/companies',
    description: 'Maintain company identities, contact information, and base currencies.',
    columns: ['name', 'legal_name', 'currency_id', 'tax_id', 'phone', 'email', 'is_active'],
    defaults: { name: '', legal_name: '', currency_id: '', tax_id: '', address: '', city: '', country: '', phone: '', email: '', is_active: true },
    fields: [
      { key: 'name', label: 'Company Name', required: true }, { key: 'legal_name', label: 'Legal Name' },
      { key: 'currency_id', label: 'Base Currency', type: 'select', relation: 'currencies', required: true },
      { key: 'tax_id', label: 'Tax ID' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'country', label: 'Country' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },
  'payment-methods': {
    title: 'Payment Methods', singular: 'payment method', resource: '/accounting/configuration/payment-methods',
    description: 'Configure the ways customer receipts and vendor payments are recorded.',
    columns: ['name', 'code', 'payment_type', 'gl_account_id', 'allow_multiple_accounts', 'requires_reference', 'is_active'],
    defaults: { name: '', code: '', payment_type: 'both', gl_account_id: null, allow_multiple_accounts: false, requires_reference: false, is_active: true },
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Mobile Money' },
      { key: 'code', label: 'Code', required: true, placeholder: 'e.g. MOBILE' },
      { key: 'payment_type', label: 'Payment Type', type: 'select', required: true, options: options(['inbound', 'outbound', 'both']) },
      { key: 'gl_account_id', label: 'Linked GL Account', type: 'select', relation: 'accounts', required: true },
      { key: 'allow_multiple_accounts', label: 'Allow Multiple Accounts', type: 'boolean' },
      { key: 'requires_reference', label: 'Requires Reference', type: 'boolean' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },
  'payment-terms': {
    title: 'Payment Terms', singular: 'payment term', resource: '/accounting/configuration/payment-terms',
    description: 'Create standard payment conditions used on invoices and bills.',
    columns: ['name', 'description', 'is_active'], defaults: { name: '', description: '', is_active: true },
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Net 30' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe when payment is due' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },
  taxes: {
    title: 'Taxes', singular: 'tax', resource: '/accounting/configuration/taxes',
    description: 'Set tax rates and how they apply to sales and purchases.',
    columns: ['name', 'tax_scope', 'rate_percent', 'price_includes_tax', 'is_active'],
    defaults: { name: '', tax_scope: 'both', rate_percent: 0, price_includes_tax: false, is_active: true },
    fields: [
      { key: 'name', label: 'Tax Name', required: true, placeholder: 'e.g. VAT 5%' },
      { key: 'tax_scope', label: 'Tax Scope', type: 'select', required: true, options: options(['sale', 'purchase', 'both']) },
      { key: 'rate_percent', label: 'Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.01 },
      { key: 'price_includes_tax', label: 'Price Includes Tax', type: 'boolean' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },
  'product-categories': {
    title: 'Service Categories', singular: 'service category', resource: '/accounting/configuration/product-categories',
    description: 'Organize Deero services and billable products into clear categories.',
    columns: ['name', 'parent_id'], defaults: { name: '', parent_id: null },
    fields: [
      { key: 'name', label: 'Category Name', required: true, placeholder: 'e.g. Beverages' },
      { key: 'parent_id', label: 'Parent Category', type: 'select', relation: 'categories' },
    ],
  },
};

function options(values: string[]) {
  return values.map((value) => ({ value, label: humanize(value) }));
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Something went wrong';
}

function displayValue(key: string, value: unknown, relations: RelationMaps) {
  if (key === 'currency_id') return relations.currencies.get(Number(value)) || '—';
  if (key === 'parent_id') return value ? relations.categories.get(Number(value)) || `#${value}` : 'Top level';
  if (key === 'gl_account_id') return value ? relations.accounts.get(Number(value)) || `#${value}` : '---';
  if (key === 'allow_multiple_accounts') return value ? 'Yes' : 'No';
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive';
  if (key === 'rate_percent') return `${Number(value).toFixed(2)}%`;
  if (value === null || value === undefined || value === '') return '—';
  return humanize(String(value));
}

type RelationMaps = { currencies: Map<number, string>; categories: Map<number, string>; accounts: Map<number, string> };

export default function ConfigurationCrudPage({ section }: { section: string }) {
  const config = CONFIGS[section];
  const api = useMemo(() => createAccountingCrudApi<Row>(config.resource), [config.resource]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, Value>>(config.defaults);
  const [relations, setRelations] = useState<RelationMaps>({ currencies: new Map(), categories: new Map(), accounts: new Map() });

  const loadRows = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.getAll()); }
    catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRows]);
  useEffect(() => {
    const needsCurrencies = config.fields.some((field) => field.relation === 'currencies');
    const needsCategories = config.fields.some((field) => field.relation === 'categories');
    const needsAccounts = config.fields.some((field) => field.relation === 'accounts');
    Promise.all([
      needsCurrencies ? currencyApi.getAll() : Promise.resolve([]),
      needsCategories ? accountingProductCategoryApi.getAll() : Promise.resolve([]),
      needsAccounts ? paymentMethodGlAccountApi.getEligible() : Promise.resolve([]),
    ]).then(([currencies, categories, accounts]) => setRelations({
      currencies: new Map(currencies.map((item) => [item.id, `${String(item.code || '')} — ${String(item.name || '')}`])),
      categories: new Map(categories.map((item) => [item.id, String(item.name || '')])),
      accounts: new Map(accounts.filter((item) => item.is_active !== false).map((item) => [item.id, `${String(item.code || '')} - ${String(item.name || '')}`])),
    })).catch(() => undefined);
  }, [config.fields]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => config.columns.some((key) => String(displayValue(key, row[key], relations)).toLowerCase().includes(needle)));
  }, [config.columns, query, relations, rows]);

  function openCreate() {
    setSelected(null); setForm({ ...config.defaults }); setFormOpen(true);
  }

  function openEdit(row: Row) {
    setSelected(row);
    setForm(Object.fromEntries(config.fields.map((field) => [field.key, (row[field.key] as Value) ?? config.defaults[field.key] ?? ''])));
    setFormOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(config.fields.map((field) => {
      let value = form[field.key];
      if (field.type === 'number') value = Number(value);
      if ((field.key.endsWith('_id') || field.type === 'number') && value === '') value = null;
      return [field.key, value];
    }));
    try {
      if (selected) await api.update(selected.id, payload); else await api.create(payload);
      accountingToast(`${humanize(config.singular)} ${selected ? 'updated' : 'created'} successfully`);
      setFormOpen(false); await loadRows();
    } catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!selected) return; setSaving(true);
    try {
      await api.remove(selected.id); accountingToast(`${humanize(config.singular)} deleted successfully`);
      setDeleteOpen(false); setSelected(null); await loadRows();
    } catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  const columns: DashboardTableColumn<Row>[] = [
    { key: 'id', header: 'ID', cell: (row) => <span className="font-bold text-primary">#{row.id}</span> },
    ...config.columns.map((column): DashboardTableColumn<Row> => ({
      key: column,
      header: humanize(column.replace('_id', '')),
      cell: (row) => column === 'is_active'
        ? <span className={`${dashboardStatusBadgeClass} ${row[column] ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>{row[column] ? <span className="inline-flex items-center gap-1"><Check className="size-3" /> Active</span> : 'Inactive'}</span>
        : <span className="block max-w-[240px] truncate font-semibold text-zinc-900">{displayValue(column, row[column], relations)}</span>,
    })),
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1"><button type="button" onClick={() => { setSelected(row); setViewOpen(true); }} aria-label={`View ${config.singular}`} className={actionBtnView}><Eye className="size-4" /></button><button type="button" onClick={() => openEdit(row)} aria-label={`Edit ${config.singular}`} className={actionBtnEdit}><SquarePen className="size-4" /></button><button onClick={() => { setSelected(row); setDeleteOpen(true); }} aria-label={`Delete ${config.singular}`} className={actionBtnDelete}><Trash2 className="size-4" /></button></div> },
  ];

  return (
    <AccountingPageShell
      section="Configuration"
      title={config.title}
      description={config.description}
    >
      <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search ${config.title.toLowerCase()}...`} emptyText={`No ${config.title.toLowerCase()} found`} minWidth="900px" action={<button onClick={openCreate} className={btnCreatePage}><Plus className="size-4" /> Add {humanize(config.singular)}</button>} filters={<button onClick={() => void loadRows()} disabled={loading} aria-label="Refresh records" className="flex size-[42px] items-center justify-center rounded-md border border-zinc-200 bg-white"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className={accountingDialogClass}>
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>{humanize(config.singular)} details</DialogTitle>
            <p className="text-sm text-zinc-500">Review this accounting record.</p>
          </DialogHeader>
          <div className={configDialogBodyClass}>
            <div className="grid gap-3 sm:grid-cols-2">
              {selected && config.columns.map((column) => <div key={column} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{humanize(column.replace('_id', ''))}</p><p className="mt-1 text-sm font-medium text-zinc-700">{column === 'is_active' ? (selected[column] ? 'Active' : 'Inactive') : displayValue(column, selected[column], relations)}</p></div>)}
            </div>
          </div>
          <DialogFooter className={configDialogFooterClass}><Button type="button" variant="outline" onClick={() => setViewOpen(false)} className={btnFormCancel}>Close</Button>{selected && <Button type="button" onClick={() => { setViewOpen(false); openEdit(selected); }} className={btnFormSubmit}>Edit</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}>
        <DialogContent className={accountingDialogClass}>
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>{selected ? 'Edit' : 'Add'} {humanize(config.singular)}</DialogTitle>
            <p className="text-sm text-zinc-500">
              {selected ? 'Update the fields below and save your changes.' : `Create a new ${config.singular} for your accounting workspace.`}
            </p>
          </DialogHeader>
          <form onSubmit={submit}>
            <div className={configDialogBodyClass}>
              <div className="grid gap-4 sm:grid-cols-2">
                {config.fields.map((field) => <FormField key={field.key} field={field} value={form[field.key]} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} relations={relations} currentId={selected?.id} />)}
              </div>
            </div>
            <DialogFooter className={configDialogFooterClass}>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={btnFormCancel}>Cancel</Button>
              <Button type="submit" disabled={saving} className={btnFormSubmit}>{saving ? 'Saving…' : selected ? 'Save changes' : `Add ${humanize(config.singular)}`}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !saving && setDeleteOpen(open)}>
        <DialogContent className={accountingDialogClass}>
          <DialogHeader className={configDialogHeaderClass}>
            <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><Trash2 className="size-5" /></div>
            <DialogTitle>Delete {humanize(config.singular)}?</DialogTitle>
            <p className="text-sm text-zinc-500">This permanently deletes this record. Linked accounting records may prevent deletion.</p>
          </DialogHeader>
          <DialogFooter className={configDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving} className={btnFormCancel}>Cancel</Button>
            <Button type="button" onClick={() => void confirmDelete()} disabled={saving} className={accountingDeleteBtnClass}>{saving ? 'Deleting…' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingPageShell>
  );
}

function FormField({ field, value, onChange, relations, currentId }: { field: Field; value: Value | undefined; onChange: (value: Value) => void; relations: RelationMaps; currentId?: number }) {
  if (field.type === 'boolean') return <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:col-span-2"><div><span className="text-sm font-medium text-zinc-700">{field.label}</span><p className="mt-0.5 text-xs text-zinc-500">Enable this option for the record</p></div><button type="button" role="switch" aria-checked={Boolean(value)} onClick={() => onChange(!value)} className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-primary' : 'bg-zinc-300'}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${value ? 'left-6' : 'left-1'}`} /></button></label>;
  const relationOptions = field.relation === 'currencies' ? [...relations.currencies.entries()].map(([optionValue, label]) => ({ value: optionValue, label })) : field.relation === 'categories' ? [...relations.categories.entries()].filter(([id]) => id !== currentId).map(([optionValue, label]) => ({ value: optionValue, label })) : field.relation === 'accounts' ? [...relations.accounts.entries()].map(([optionValue, label]) => ({ value: optionValue, label })) : field.options;
  return <label className={field.type === 'textarea' ? 'sm:col-span-2' : ''}><span className="mb-1 block text-sm font-medium text-zinc-700">{field.label}{field.required && <span className="ml-0.5 text-rose-500">*</span>}</span>{field.type === 'select' ? <select required={field.required} value={value === null ? '' : String(value ?? '')} onChange={(event) => onChange(event.target.value === '' ? null : field.relation ? Number(event.target.value) : event.target.value)} className={accountingFormSelectClass}><option value="">Select {field.label.toLowerCase()}</option>{relationOptions?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea required={field.required} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} className={accountingFormTextareaClass} /> : <input required={field.required} type={field.type || 'text'} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} min={field.min} max={field.max} step={field.step} className={accountingFormFieldClass} />}</label>;
}

