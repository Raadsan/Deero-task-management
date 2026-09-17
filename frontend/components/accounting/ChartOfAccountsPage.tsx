'use client';

import { accountingToast } from '@/lib/accounting-ui';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BookOpen, Eye, Plus, RefreshCw, SquarePen, Trash2, WalletCards } from 'lucide-react';
import { chartOfAccountApi } from '@/lib/api/accounting/ledger/chartOfAccountApi';
import { accountTypeApi } from '@/lib/api/accounting/configuration/accountTypeApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { currencyApi } from '@/lib/api/accounting/configuration/currencyApi';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardCardClass, dashboardSelectClass, dashboardStatusBadgeClass } from '@/lib/dashboard-ui';

type RecordRow = {
  id: number;
  code?: string;
  name?: string;
  company_id?: number;
  account_type_id?: number;
  parent_id?: number | null;
  currency_id?: number | null;
  is_reconcilable?: boolean;
  allow_manual_entry?: boolean;
  is_active?: boolean;
  notes?: string | null;
  is_parent?: boolean;
  has_children?: boolean;
  allow_posting?: boolean;
  child_count?: number;
  [key: string]: unknown;
};

type FormState = {
  company_id: string; code: string; name: string; account_type_id: string; parent_id: string;
  currency_id: string; is_reconcilable: boolean; allow_manual_entry: boolean; is_active: boolean; notes: string;
};

const emptyForm: FormState = {
  company_id: '', code: '', name: '', account_type_id: '', parent_id: '', currency_id: '',
  is_reconcilable: false, allow_manual_entry: true, is_active: true, notes: '',
};

function apiError(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Something went wrong';
}

function humanize(value: unknown) {
  return String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildTreeRows(accounts: RecordRow[]): Array<RecordRow & { depth: number }> {
  const byParent = new Map<number | null, RecordRow[]>();
  for (const account of accounts) {
    const key = account.parent_id == null ? null : Number(account.parent_id);
    const list = byParent.get(key) || [];
    list.push(account);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  }

  const rows: Array<RecordRow & { depth: number }> = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const account of byParent.get(parentId) || []) {
      rows.push({ ...account, depth });
      visit(account.id, depth + 1);
    }
  };
  visit(null, 0);

  // Orphans (broken parent pointer) — append so nothing is hidden
  const placed = new Set(rows.map((row) => row.id));
  for (const account of accounts) {
    if (!placed.has(account.id)) rows.push({ ...account, depth: 0 });
  }
  return rows;
}

function collectDescendantIds(accounts: RecordRow[], rootId: number): Set<number> {
  const children = new Map<number, number[]>();
  for (const account of accounts) {
    if (account.parent_id == null) continue;
    const parentId = Number(account.parent_id);
    const list = children.get(parentId) || [];
    list.push(account.id);
    children.set(parentId, list);
  }
  const result = new Set<number>();
  const stack = [...(children.get(rootId) || [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const childId of children.get(id) || []) stack.push(childId);
  }
  return result;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<RecordRow[]>([]);
  const [accountTypes, setAccountTypes] = useState<RecordRow[]>([]);
  const [companies, setCompanies] = useState<RecordRow[]>([]);
  const [currencies, setCurrencies] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [codeFilter, setCodeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountRows, types, companyRows, currencyRows] = await Promise.all([
        chartOfAccountApi.getAll(), accountTypeApi.getAll(), companyApi.getAll(), currencyApi.getAll(),
      ]);
      setAccounts(accountRows as RecordRow[]);
      setAccountTypes(types as RecordRow[]);
      setCompanies(companyRows as RecordRow[]);
      setCurrencies(currencyRows as RecordRow[]);
    } catch (error) { accountingToast(apiError(error), 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const typeMap = useMemo(() => new Map(accountTypes.map((row) => [row.id, row])), [accountTypes]);
  const companyMap = useMemo(() => new Map(companies.map((row) => [row.id, row])), [companies]);
  const accountMap = useMemo(() => new Map(accounts.map((row) => [row.id, row])), [accounts]);

  const filtered = useMemo(() => {
    const matched = accounts.filter((account) => codeFilter === 'all' || String(account.code).startsWith(codeFilter))
      .filter((account) => companyFilter === 'all' || String(account.company_id) === companyFilter)
      .filter((account) => typeFilter === 'all' || String(account.account_type_id) === typeFilter)
      .filter((account) => statusFilter === 'all' || Boolean(account.is_active) === (statusFilter === 'active'))
      .filter((account) => {
        const search = query.trim().toLowerCase();
        if (!search) return true;
        const type = typeMap.get(Number(account.account_type_id));
        return [account.code, account.name, account.notes, type?.name].some((value) => String(value ?? '').toLowerCase().includes(search));
      });

    // Keep hierarchy when not searching; when searching, still tree-sort the matched subset + ancestors
    if (!query.trim()) return buildTreeRows(matched);

    const keep = new Set(matched.map((row) => row.id));
    for (const row of matched) {
      let parentId = row.parent_id == null ? null : Number(row.parent_id);
      while (parentId) {
        keep.add(parentId);
        parentId = accountMap.get(parentId)?.parent_id == null ? null : Number(accountMap.get(parentId)?.parent_id);
      }
    }
    return buildTreeRows(accounts.filter((row) => keep.has(row.id)
      && (companyFilter === 'all' || String(row.company_id) === companyFilter)
      && (typeFilter === 'all' || String(row.account_type_id) === typeFilter)
      && (statusFilter === 'all' || Boolean(row.is_active) === (statusFilter === 'active'))
      && (codeFilter === 'all' || String(row.code).startsWith(codeFilter))));
  }, [accountMap, accounts, codeFilter, companyFilter, query, statusFilter, typeFilter, typeMap]);

  const summary = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter((row) => row.is_active).length,
    posting: accounts.filter((row) => row.allow_posting ?? (row.allow_manual_entry && !(row.has_children || (row.child_count ?? 0) > 0))).length,
    reconcilable: accounts.filter((row) => row.is_reconcilable).length,
  }), [accounts]);

  function createAccount() {
    setSelected(null);
    setForm({ ...emptyForm, company_id: companyFilter !== 'all' ? companyFilter : companies.length === 1 ? String(companies[0].id) : '' });
    setFormOpen(true);
  }

  function editAccount(account: RecordRow) {
    setSelected(account);
    setForm({
      company_id: String(account.company_id ?? ''), code: String(account.code ?? ''), name: String(account.name ?? ''),
      account_type_id: String(account.account_type_id ?? ''), parent_id: String(account.parent_id ?? ''), currency_id: String(account.currency_id ?? ''),
      is_reconcilable: Boolean(account.is_reconcilable), allow_manual_entry: Boolean(account.allow_manual_entry),
      is_active: Boolean(account.is_active), notes: String(account.notes ?? ''),
    });
    setFormOpen(true);
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    const payload = {
      company_id: Number(form.company_id), code: form.code.trim(), name: form.name.trim(), account_type_id: Number(form.account_type_id),
      parent_id: form.parent_id ? Number(form.parent_id) : null, currency_id: form.currency_id ? Number(form.currency_id) : null,
      is_reconcilable: form.is_reconcilable,
      allow_manual_entry: selectedHasChildren ? false : form.allow_manual_entry,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    };
    try {
      if (selected) await chartOfAccountApi.update(selected.id, payload); else await chartOfAccountApi.create(payload);
      accountingToast(`Account ${selected ? 'updated' : 'created'} successfully`); setFormOpen(false); await loadData();
    } catch (error) { accountingToast(apiError(error), 'error'); }
    finally { setSaving(false); }
  }

  async function deleteAccount() {
    if (!selected) return; setSaving(true);
    try {
      const res = await chartOfAccountApi.remove(selected.id);
      accountingToast(res?.message || 'Account processed successfully');
      setDeleteOpen(false); setSelected(null); await loadData();
    } catch (error) { accountingToast(apiError(error), 'error'); }
    finally { setSaving(false); }
  }

  const descendantIds = useMemo(
    () => (selected ? collectDescendantIds(accounts, selected.id) : new Set<number>()),
    [accounts, selected],
  );

  const eligibleParents = accounts.filter((account) =>
    account.id !== selected?.id
    && !descendantIds.has(account.id)
    && String(account.company_id) === form.company_id
    && String(account.account_type_id) === form.account_type_id
    && account.is_active !== false,
  ).sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));

  const selectedHasChildren = Boolean(selected && (selected.has_children || (selected.child_count ?? 0) > 0 || accounts.some((row) => Number(row.parent_id) === selected.id)));

  const columns: DashboardTableColumn<RecordRow & { depth?: number }>[] = [
    { key: 'select', header: <input type="checkbox" aria-label="Select all accounts" checked={filtered.length > 0 && filtered.every((account) => selectedIds.has(account.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(filtered.map((account) => account.id)) : new Set())} className="size-4 accent-primary" />, cell: (account) => <input type="checkbox" aria-label={`Select ${String(account.name)}`} checked={selectedIds.has(account.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(account.id); else next.delete(account.id); return next; })} className="size-4 accent-primary" /> },
    { key: 'code', header: 'Code', cell: (account) => <span className="font-mono font-bold text-primary">{String(account.code)}</span> },
    {
      key: 'name',
      header: 'Name',
      cell: (account) => {
        const depth = Number(account.depth || 0);
        const hasChildren = Boolean(account.has_children || (account.child_count ?? 0) > 0);
        const parent = accountMap.get(Number(account.parent_id));
        return (
          <div className="flex min-w-[240px] items-start gap-1" style={{ paddingLeft: `${depth * 18}px` }}>
            <span className="mt-0.5 w-4 shrink-0 text-muted-foreground">{depth > 0 ? '└' : ''}</span>
            <div>
              <p className={`font-medium ${hasChildren ? 'text-foreground' : ''}`}>{String(account.name)}</p>
              <p className="text-[10px] text-muted-foreground">
                {hasChildren ? 'Parent account' : 'Posting account'}
                {parent ? ` · Under ${String(parent.name)}` : ''}
              </p>
            </div>
          </div>
        );
      },
    },
    { key: 'type', header: 'Type', cell: (account) => { const type = typeMap.get(Number(account.account_type_id)); return <div><p className="font-medium">{String(type?.name || 'Unknown')}</p><p className="text-[10px] text-muted-foreground">{humanize(type?.internal_group)}</p></div>; } },
    {
      key: 'posting',
      header: 'Posting',
      align: 'center',
      cell: (account) => {
        const canPost = account.allow_posting ?? (Boolean(account.allow_manual_entry) && !(account.has_children || (account.child_count ?? 0) > 0));
        return <span className={`${dashboardStatusBadgeClass} ${canPost ? 'bg-sky-600 text-white' : 'bg-zinc-500 text-white'}`}>{canPost ? 'Allowed' : 'Parent'}</span>;
      },
    },
    { key: 'company', header: 'Company', cell: (account) => String(companyMap.get(Number(account.company_id))?.name || '—') },
    { key: 'status', header: 'Status', align: 'center', cell: (account) => <span className={`${dashboardStatusBadgeClass} ${account.is_active ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>{account.is_active ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (account) => <div className="flex justify-end gap-1"><button type="button" title="View" onClick={() => { setSelected(account); setViewOpen(true); }} className={actionBtnView}><Eye className="size-4" /></button><button type="button" title="Edit" onClick={() => editAccount(account)} className={actionBtnEdit}><SquarePen className="size-4" /></button><button onClick={() => { setSelected(account); setDeleteOpen(true); }} className={actionBtnDelete}><Trash2 className="size-4" /></button></div> },
  ];

  return (
    <AccountingPageShell section="General Ledger" title="Chart of Accounts" description="Build and maintain the account structure used throughout your books.">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total Accounts', summary.total, 'All ledger accounts'], ['Active Accounts', summary.active, 'Available for transactions'],
          ['Posting Accounts', summary.posting, 'Manual entries allowed'], ['Reconcilable', summary.reconcilable, 'Require reconciliation'],
        ].map(([label, value, hint], index) => <article key={String(label)} className={`${dashboardCardClass} p-4`}><div className="flex items-center justify-between"><span className="text-xs font-medium text-zinc-500">{label}</span><span className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary">{index === 0 ? <BookOpen className="size-4" /> : <WalletCards className="size-4" />}</span></div><p className="mt-3 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-zinc-500">{hint}</p></article>)}
      </div>

      <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search code, account name, or type..." emptyText="No accounts found" minWidth="1100px" action={<button type="button" onClick={createAccount} className={btnCreatePage}><Plus className="size-4" /> Add Account</button>} filters={<><select value={codeFilter} onChange={(event) => setCodeFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All codes</option>{['1', '2', '3', '4', '5'].map((digit) => <option key={digit} value={digit}>Code {digit}</option>)}</select><FilterSelect label="All account types" value={typeFilter} onChange={setTypeFilter} options={accountTypes.map((row) => ({ value: String(row.id), label: String(row.name) }))} /><FilterSelect label="All companies" value={companyFilter} onChange={setCompanyFilter} options={companies.map((row) => ({ value: String(row.id), label: String(row.name) }))} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button onClick={() => void loadData()} disabled={loading} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{String(selected?.code || '')} — {String(selected?.name || 'Account details')}</DialogTitle><DialogDescription>Review this chart of account record.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><DetailCard label="Account Type" value={String(typeMap.get(Number(selected?.account_type_id))?.name || '—')} /><DetailCard label="Company" value={String(companyMap.get(Number(selected?.company_id))?.name || '—')} /><DetailCard label="Parent Account" value={selected?.parent_id ? `${String(accountMap.get(Number(selected.parent_id))?.code || '')} — ${String(accountMap.get(Number(selected.parent_id))?.name || '—')}` : 'None (top level)'} /><DetailCard label="Status" value={selected?.is_active === false ? 'Inactive' : 'Active'} /><DetailCard label="Posting" value={(selected?.allow_posting ?? (selected?.allow_manual_entry !== false && !(selected?.has_children || (selected?.child_count ?? 0) > 0))) ? 'Allowed' : 'Parent / not allowed'} /><DetailCard label="Reconcilable" value={selected?.is_reconcilable ? 'Yes' : 'No'} /><DetailCard label="Notes" value={String(selected?.notes || '—')} /></div><DialogFooter><button type="button" onClick={() => setViewOpen(false)} className="h-10 rounded-md border border-zinc-200 px-5 text-sm font-semibold">Close</button>{selected && <button type="button" onClick={() => { setViewOpen(false); editAccount(selected); }} className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-white">Edit Account</button>}</DialogFooter></DialogContent></Dialog>
      <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{selected ? 'Edit Account' : 'Add Ledger Account'}</DialogTitle><DialogDescription>Configure the identity, classification, hierarchy, and posting behavior for this account.</DialogDescription></DialogHeader><form onSubmit={saveAccount} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Company" required value={form.company_id} onChange={(value) => setForm((current) => ({ ...current, company_id: value, parent_id: '' }))} options={companies.map((row) => ({ value: String(row.id), label: String(row.name) }))} />
          <SelectField label="Account Type" required value={form.account_type_id} onChange={(value) => setForm((current) => ({ ...current, account_type_id: value, parent_id: '' }))} options={accountTypes.map((row) => ({ value: String(row.id), label: `${String(row.name)} — ${humanize(row.internal_group)}` }))} />
          <TextField label="Account Code" required value={form.code} maxLength={16} placeholder="e.g. 1110" onChange={(value) => setForm((current) => ({ ...current, code: value }))} />
          <TextField label="Account Name" required value={form.name} maxLength={128} placeholder="e.g. Cash and Cash Equivalents" onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
          <SelectField label="Parent Account" value={form.parent_id} onChange={(value) => setForm((current) => ({ ...current, parent_id: value, allow_manual_entry: value ? current.allow_manual_entry : current.allow_manual_entry }))} emptyLabel="No parent account (top level)" options={eligibleParents.map((row) => ({ value: String(row.id), label: `${String(row.code)} — ${String(row.name)}` }))} />
          <SelectField label="Account Currency" value={form.currency_id} onChange={(value) => setForm((current) => ({ ...current, currency_id: value }))} emptyLabel="Use company currency" options={currencies.filter((row) => row.is_active).map((row) => ({ value: String(row.id), label: `${String(row.code)} — ${String(row.name)}` }))} />
          <label className="sm:col-span-2"><span className="text-xs font-semibold">Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Optional internal description or usage guidance" className="mt-1.5 w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
          <Toggle label="Allow Manual Entries / Posting" hint={selectedHasChildren ? 'Disabled while this account has children — parents cannot receive journal postings' : 'Users can post journal items directly to this account'} checked={selectedHasChildren ? false : form.allow_manual_entry} onChange={(checked) => !selectedHasChildren && setForm((current) => ({ ...current, allow_manual_entry: checked }))} />
          <Toggle label="Reconcilable" hint="Transactions can be matched and reconciled" checked={form.is_reconcilable} onChange={(checked) => setForm((current) => ({ ...current, is_reconcilable: checked }))} />
          <Toggle label="Active Account" hint="Available for new accounting transactions" checked={form.is_active} onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))} full />
        </div><DialogFooter><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="h-10 rounded-xl border px-5 text-xs font-semibold hover:bg-muted">Cancel</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Account'}</button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !saving && setDeleteOpen(open)}><DialogContent className="sm:max-w-md"><DialogHeader><div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Trash2 className="size-5" /></div><DialogTitle>Delete account?</DialogTitle><DialogDescription>You are deleting {selected ? `${String(selected.code)} — ${String(selected.name)}` : 'this account'}. Accounts linked to transactions or child accounts cannot be deleted (they are deactivated instead).</DialogDescription></DialogHeader><DialogFooter><button onClick={() => setDeleteOpen(false)} disabled={saving} className="h-10 rounded-xl border px-5 text-xs font-semibold hover:bg-muted">Cancel</button><button onClick={() => void deleteAccount()} disabled={saving} className="h-10 rounded-xl bg-rose-600 px-5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{saving ? 'Deleting...' : 'Delete Account'}</button></DialogFooter></DialogContent></Dialog>
    </AccountingPageShell>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p><p className="mt-1 text-sm font-medium text-zinc-700">{value}</p></div>; }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-xs outline-none focus:border-primary"><option value="all">{label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>; }
function SelectField({ label, value, onChange, options, required, emptyLabel }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean; emptyLabel?: string }) { return <label><span className="text-xs font-semibold">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</span><select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"><option value="">{emptyLabel || `Select ${label.toLowerCase()}`}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function TextField({ label, value, onChange, required, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; maxLength?: number }) { return <label><span className="text-xs font-semibold">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>; }
function Toggle({ label, hint, checked, onChange, full }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void; full?: boolean }) { return <label className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3 ${full ? 'sm:col-span-2' : ''}`}><div><span className="text-xs font-semibold">{label}</span><p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button></label>; }
