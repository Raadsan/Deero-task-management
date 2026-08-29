'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { SquarePen, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { createAccountingCrudApi, type AccountingRecord } from '@/lib/api/accounting/accountingCrud';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import { AccountingFieldLabel, AccountingFormDialog, accountingFormFieldClass } from '@/components/accounting/AccountingFormDialog';
import { accountingToast } from '@/lib/accounting-ui';
import { usePermissions } from '@/context/PermissionContext';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import { actionBtnDelete, actionBtnEdit, btnCreatePage, dashboardStatusBadgeClass } from '@/lib/dashboard-ui';

type Kind = 'customer' | 'vendor';
type Record = AccountingRecord & { name?: string; fullName?: string; phone?: string; email?: string; address?: string; is_active?: boolean; currency?: string | null; receivable_balance?: number; payable_balance?: number; advance_balance?: number; vendor_balance?: number };
const EMPTY = { name: '', phone: '', email: '', address: '', is_active: true };

function message(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Something went wrong';
}

export default function PartnerMasterDataPage({ kind, restaurantLabel = false, embedded = false }: { kind: Kind; restaurantLabel?: boolean; embedded?: boolean }) {
  const plural = kind === 'customer' ? 'customers' : 'vendors';
  const title = restaurantLabel ? (kind === 'customer' ? 'Customer Management' : 'Supplier Management') : (kind === 'customer' ? 'Customers' : 'Vendors');
  const singular = restaurantLabel && kind === 'vendor' ? 'supplier' : kind;
  const api = useMemo(() => createAccountingCrudApi<Record>(`/accounting/${plural}`), [plural]);
  const permissions = usePermissions();
  const permissionUrl = restaurantLabel ? (kind === 'customer' ? '/clients' : '/suppliers') : `/${plural}`;
  const canAdd = permissions.canAdd(permissionUrl);
  const canEdit = permissions.canEdit(permissionUrl);
  const canDelete = permissions.canDelete(permissionUrl);
  const [rows, setRows] = useState<Record[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record | null>(null);
  const [form, setForm] = useState(EMPTY);

  const revalidate = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.getAll()); } catch (error) { accountingToast(message(error), 'error'); } finally { setLoading(false); }
  }, [api]);
  useEffect(() => {
    const timer = window.setTimeout(() => void revalidate(), 0);
    return () => window.clearTimeout(timer);
  }, [revalidate]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => !needle || [row.name, row.fullName, row.phone, row.email].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [query, rows]);

  function beginCreate() { setSelected(null); setForm(EMPTY); setOpen(true); }
  function beginEdit(row: Record) {
    setSelected(row);
    setForm({ name: String(row.name || row.fullName || ''), phone: String(row.phone || ''), email: String(row.email || ''), address: String(row.address || ''), is_active: row.is_active !== false });
    setOpen(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      if (selected) await api.update(selected.id, form); else await api.create(form);
      accountingToast(`${singular[0].toUpperCase()}${singular.slice(1)} ${selected ? 'updated' : 'created'} successfully`);
      setOpen(false);
      await revalidate();
    } catch (error) { accountingToast(message(error), 'error'); } finally { setSaving(false); }
  }
  async function remove(row: Record) {
    if (!window.confirm(`Delete ${row.name || row.fullName || singular}?`)) return;
    try { await api.remove(row.id); accountingToast(`${singular[0].toUpperCase()}${singular.slice(1)} deleted successfully`); await revalidate(); }
    catch (error) { accountingToast(message(error), 'error'); }
  }
  const columns: DashboardTableColumn<Record>[] = [
    { key: 'id', header: 'ID', cell: (row) => <span className="font-bold text-primary">#{row.id}</span> },
    { key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name || row.fullName}</span> },
    { key: 'phone', header: 'Phone', cell: (row) => row.phone || '—' },
    { key: 'email', header: 'Email', cell: (row) => row.email || '—' },
    ...(kind === 'customer' ? [
      { key: 'currency', header: 'Currency', align: 'center' as const, cell: (row: Record) => row.currency || '—' },
      { key: 'balance', header: 'Balance', align: 'right' as const, cell: (row: Record) => Number(row.receivable_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    ] : []),
    ...(kind === 'vendor' ? [
      { key: 'payable', header: 'Payable', align: 'right' as const, cell: (row: Record) => Number(row.payable_balance || 0).toFixed(2) },
      { key: 'advance', header: 'Advance', align: 'right' as const, cell: (row: Record) => Number(row.advance_balance || 0).toFixed(2) },
      { key: 'balance', header: 'Vendor Balance', align: 'right' as const, cell: (row: Record) => Number(row.vendor_balance || 0).toFixed(2) },
    ] : []),
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <span className={`${dashboardStatusBadgeClass} ${row.is_active === false ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{row.is_active === false ? 'Inactive' : 'Active'}</span> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1">{canEdit && <button onClick={() => beginEdit(row)} aria-label="Edit" className={actionBtnEdit}><SquarePen className="size-4" /></button>}{canDelete && <button onClick={() => void remove(row)} aria-label="Delete" className={actionBtnDelete}><Trash2 className="size-4" /></button>}</div> },
  ];

  const body = (
    <>
    <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search ${plural}...`} emptyText={`No ${plural} found`} minWidth="800px" action={canAdd ? <button onClick={beginCreate} className={btnCreatePage}><Plus className="size-4" /> Add {singular}</button> : undefined} filters={<button onClick={() => void revalidate()} aria-label="Refresh" className="flex size-[42px] items-center justify-center rounded-md border border-zinc-200 bg-white"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>} />
    <AccountingFormDialog open={open} onOpenChange={setOpen} saving={saving} onSubmit={submit} title={`${selected ? 'Edit' : 'Add'} ${singular}`} description="This record is available across accounting workflows." submitLabel={selected ? 'Save changes' : `Add ${singular}`}>
      <AccountingFieldLabel label="Name *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={accountingFormFieldClass} /></AccountingFieldLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountingFieldLabel label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={accountingFormFieldClass} /></AccountingFieldLabel>
        <AccountingFieldLabel label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={accountingFormFieldClass} /></AccountingFieldLabel>
      </div>
      <AccountingFieldLabel label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={accountingFormFieldClass} /></AccountingFieldLabel>
      <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
    </AccountingFormDialog>
    </>
  );

  if (embedded) return body;

  return (
    <AccountingPageShell
      section={kind === 'customer' ? 'Customers' : 'Payables'}
      title={title}
      description={kind === 'customer' ? 'Accounting customers used for invoices, receipts, and quotations.' : undefined}
    >
      {body}
    </AccountingPageShell>
  );
}
