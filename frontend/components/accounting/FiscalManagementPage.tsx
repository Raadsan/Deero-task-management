'use client';

import { accountingToast } from '@/lib/accounting-ui';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarDays, Check, SquarePen, Eye, LockKeyhole, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { fiscalYearApi } from '@/lib/api/accounting/ledger/fiscalYearApi';
import { fiscalPeriodApi } from '@/lib/api/accounting/ledger/fiscalPeriodApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';
import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardCardClass, dashboardSelectClass, dashboardStatusBadgeClass } from '@/lib/dashboard-ui';

type Row = { id: number; [key: string]: unknown };
type Kind = 'fiscal-years' | 'fiscal-periods';
type FormState = Record<string, string | boolean>;

const emptyYear: FormState = { company_id: '', name: '', start_date: '', end_date: '', state: 'open' };
const emptyPeriod: FormState = { fiscal_year_id: '', name: '', period_number: '1', start_date: '', end_date: '', state: 'open', is_closing_period: false };

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message;
  return error instanceof Error ? error.message : 'Something went wrong';
}

function dateInput(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function apiDate(value: string | boolean) {
  return new Date(`${String(value)}T00:00:00.000Z`).toISOString();
}

function prettyDate(value: unknown) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(value)));
}

export default function FiscalManagementPage({ kind }: { kind: Kind }) {
  const isYears = kind === 'fiscal-years';
  const currentApi = isYears ? fiscalYearApi : fiscalPeriodApi;
  
  const [rows, setRows] = useState<Row[]>([]);
  const [years, setYears] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [relationFilter, setRelationFilter] = useState('all');
  const [selected, setSelected] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [form, setForm] = useState<FormState>(isYears ? emptyYear : emptyPeriod);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [records, fiscalYears, companyRows] = await Promise.all([
        currentApi.getAll(), fiscalYearApi.getAll(), companyApi.getAll(),
      ]);
      setRows(records); setYears(fiscalYears); setCompanies(companyRows);
    } catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setLoading(false); }
  }, [currentApi]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const companyMap = useMemo(() => new Map(companies.map((row) => [row.id, String(row.name)])), [companies]);
  const yearMap = useMemo(() => new Map(years.map((row) => [row.id, row])), [years]);
  const filtered = useMemo(() => rows.filter((row) => stateFilter === 'all' || row.state === stateFilter)
    .filter((row) => relationFilter === 'all' || String(row[isYears ? 'company_id' : 'fiscal_year_id']) === relationFilter)
    .filter((row) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      const relation = isYears ? companyMap.get(Number(row.company_id)) : yearMap.get(Number(row.fiscal_year_id))?.name;
      return [row.name, row.period_number, relation].some((value) => String(value ?? '').toLowerCase().includes(needle));
    }).sort((a, b) => isYears ? String(b.start_date).localeCompare(String(a.start_date)) : Number(a.period_number) - Number(b.period_number)),
  [companyMap, isYears, query, relationFilter, rows, stateFilter, yearMap]);

  const openCount = rows.filter((row) => row.state === 'open').length;
  const closedCount = rows.filter((row) => row.state === 'closed').length;
  const closingCount = isYears ? 0 : rows.filter((row) => row.is_closing_period).length;

  function openCreate() {
    setSelected(null);
    if (isYears) setForm({ ...emptyYear, company_id: relationFilter !== 'all' ? relationFilter : companies.length === 1 ? String(companies[0].id) : '' });
    else setForm({ ...emptyPeriod, fiscal_year_id: relationFilter !== 'all' ? relationFilter : years.length === 1 ? String(years[0].id) : '' });
    setFormOpen(true);
  }

  function openEdit(row: Row) {
    setSelected(row);
    setForm(isYears ? {
      company_id: String(row.company_id), name: String(row.name), start_date: dateInput(row.start_date), end_date: dateInput(row.end_date), state: String(row.state),
    } : {
      fiscal_year_id: String(row.fiscal_year_id), name: String(row.name), period_number: String(row.period_number),
      start_date: dateInput(row.start_date), end_date: dateInput(row.end_date), state: String(row.state), is_closing_period: Boolean(row.is_closing_period),
    });
    setFormOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (String(form.end_date) < String(form.start_date)) { accountingToast('End date must be on or after the start date', 'error'); return; }
    setSaving(true);
    const payload = isYears ? {
      company_id: Number(form.company_id), name: String(form.name).trim(), start_date: apiDate(form.start_date), end_date: apiDate(form.end_date), state: form.state,
    } : {
      fiscal_year_id: Number(form.fiscal_year_id), name: String(form.name).trim(), period_number: Number(form.period_number),
      start_date: apiDate(form.start_date), end_date: apiDate(form.end_date), state: form.state, is_closing_period: Boolean(form.is_closing_period),
    };
    try {
      if (selected) await currentApi.update(selected.id, payload); else await currentApi.create(payload);
      accountingToast(`${isYears ? 'Fiscal year' : 'Fiscal period'} ${selected ? 'updated' : 'created'} successfully`);
      setFormOpen(false); await loadData();
    } catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!selected) return; setSaving(true);
    try {
      await currentApi.remove(selected.id); accountingToast(`${isYears ? 'Fiscal year' : 'Fiscal period'} deleted successfully`);
      setDeleteOpen(false); setSelected(null); await loadData();
    } catch (error) { accountingToast(errorMessage(error), 'error'); }
    finally { setSaving(false); }
  }
  const columns: DashboardTableColumn<Row>[] = [
    { key: 'name', header: isYears ? 'Fiscal Year' : 'Period', cell: (row) => <div><p className="font-semibold">{String(row.name)}</p>{!isYears && <p className="text-[10px] text-muted-foreground">Period {String(row.period_number).padStart(2, '0')}</p>}</div> },
    { key: 'relation', header: isYears ? 'Company' : 'Fiscal Year', cell: (row) => isYears ? companyMap.get(Number(row.company_id)) || '—' : String(yearMap.get(Number(row.fiscal_year_id))?.name || '—') },
    { key: 'start', header: 'Start Date', cell: (row) => prettyDate(row.start_date) },
    { key: 'end', header: 'End Date', cell: (row) => prettyDate(row.end_date) },
    ...(!isYears ? [{ key: 'type', header: 'Type', cell: (row: Row) => row.is_closing_period ? 'Closing' : 'Regular' } as DashboardTableColumn<Row>] : []),
    { key: 'state', header: 'State', align: 'center', cell: (row) => <StateBadge state={String(row.state)} /> },
    { key: 'actions', header: 'Actions', align: 'right', cell: (row) => <div className="flex justify-end gap-1"><button type="button" title="View" onClick={() => { setSelected(row); setViewOpen(true); }} className={actionBtnView}><Eye className="size-4" /></button><button type="button" title="Edit" onClick={() => openEdit(row)} className={actionBtnEdit}><SquarePen className="size-4" /></button><button onClick={() => { setSelected(row); setDeleteOpen(true); }} className={actionBtnDelete}><Trash2 className="size-4" /></button></div> },
  ];

  return (
    <AccountingPageShell section="Fiscal Management" title={isYears ? 'Fiscal Years' : 'Fiscal Periods'} description={isYears ? 'Define your company accounting years and control when they are open or closed.' : 'Manage the posting periods within each fiscal year.'}>
      <div className={`mb-5 grid gap-3 sm:grid-cols-2 ${isYears ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
        <Summary label={isYears ? 'Total Fiscal Years' : 'Total Periods'} value={rows.length} hint="All configured records" />
        <Summary label="Open" value={openCount} hint="Accepting new postings" />
        <Summary label="Closed" value={closedCount} hint="Locked from new postings" closed />
        {!isYears && <Summary label="Closing Periods" value={closingCount} hint="Year-end adjustment periods" />}
      </div>

      <DashboardDataTable rows={filtered} columns={columns} loading={loading} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search ${isYears ? 'fiscal years' : 'periods'}...`} emptyText={`No ${isYears ? 'fiscal years' : 'periods'} found`} minWidth="900px" action={<button type="button" onClick={openCreate} className={btnCreatePage}><Plus className="size-4" /> Add {isYears ? 'Fiscal Year' : 'Period'}</button>} filters={<><select value={relationFilter} onChange={(event) => setRelationFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All {isYears ? 'companies' : 'fiscal years'}</option>{(isYears ? companies : years).map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className={dashboardSelectClass}><option value="all">All states</option><option value="open">Open</option><option value="closed">Closed</option></select><button onClick={() => void loadData()} disabled={loading} className="flex size-[42px] items-center justify-center rounded-md border"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />
      <section className="hidden">
        <div className="grid gap-3 border-b p-4 lg:grid-cols-[minmax(240px,1fr)_200px_150px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${isYears ? 'fiscal years' : 'periods'}...`} className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></div>
          <select value={relationFilter} onChange={(event) => setRelationFilter(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-xs outline-none focus:border-primary"><option value="all">All {isYears ? 'companies' : 'fiscal years'}</option>{(isYears ? companies : years).map((row) => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-xs outline-none focus:border-primary"><option value="all">All states</option><option value="open">Open</option><option value="closed">Closed</option></select>
          <div className="flex items-center justify-between gap-3 lg:justify-end"><span className="whitespace-nowrap text-xs text-muted-foreground">{filtered.length} records</span><button onClick={() => void loadData()} disabled={loading} className="rounded-lg border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{isYears ? <><th className="px-5 py-3 font-semibold">Fiscal Year</th><th className="px-4 py-3 font-semibold">Company</th></> : <><th className="px-5 py-3 font-semibold">Period</th><th className="px-4 py-3 font-semibold">Fiscal Year</th></>}<th className="px-4 py-3 font-semibold">Start Date</th><th className="px-4 py-3 font-semibold">End Date</th>{!isYears && <th className="px-4 py-3 font-semibold">Type</th>}<th className="px-4 py-3 font-semibold">State</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y">
          {loading ? Array.from({ length: 4 }, (_, index) => <tr key={index}>{Array.from({ length: isYears ? 6 : 7 }, (__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-muted" /></td>)}</tr>) : filtered.map((row) => <tr key={row.id} className="transition hover:bg-muted/30"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary"><CalendarDays className="size-4" /></span><div><p className="font-semibold">{String(row.name)}</p>{!isYears && <p className="mt-0.5 text-[10px] text-muted-foreground">Period {String(row.period_number).padStart(2, '0')}</p>}</div></div></td><td className="px-4 py-4 text-muted-foreground">{isYears ? companyMap.get(Number(row.company_id)) || '—' : String(yearMap.get(Number(row.fiscal_year_id))?.name || '—')}</td><td className="px-4 py-4 tabular-nums">{prettyDate(row.start_date)}</td><td className="px-4 py-4 tabular-nums">{prettyDate(row.end_date)}</td>{!isYears && <td className="px-4 py-4">{row.is_closing_period ? <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-[10px] font-semibold text-secondary ">Closing</span> : <span className="text-muted-foreground">Regular</span>}</td>}<td className="px-4 py-4"><StateBadge state={String(row.state)} /></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" title="View" onClick={() => { setSelected(row); setViewOpen(true); }} className={actionBtnView}><Eye className="size-4" /></button><button type="button" title="Edit" onClick={() => openEdit(row)} className="rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"><SquarePen className="size-4" /></button><button onClick={() => { setSelected(row); setDeleteOpen(true); }} className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></button></div></td></tr>)}
        </tbody></table>{!loading && filtered.length === 0 && <div className="flex flex-col items-center px-6 py-16 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/8 text-primary"><CalendarDays className="size-5" /></span><h3 className="mt-4 text-sm font-semibold">No {isYears ? 'fiscal years' : 'periods'} found</h3><p className="mt-1 text-xs text-muted-foreground">Add your first record or change the filters.</p></div>}</div>
      </section>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{String(selected?.name || (isYears ? 'Fiscal year' : 'Fiscal period'))}</DialogTitle><DialogDescription>Review this fiscal management record.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><FiscalDetail label={isYears ? 'Company' : 'Fiscal Year'} value={isYears ? companyMap.get(Number(selected?.company_id)) || '—' : String(yearMap.get(Number(selected?.fiscal_year_id))?.name || '—')} /><FiscalDetail label="State" value={String(selected?.state || '—')} /><FiscalDetail label="Start Date" value={prettyDate(selected?.start_date)} /><FiscalDetail label="End Date" value={prettyDate(selected?.end_date)} />{!isYears && <><FiscalDetail label="Period Number" value={String(selected?.period_number || '—')} /><FiscalDetail label="Type" value={selected?.is_closing_period ? 'Closing' : 'Regular'} /></>}</div><DialogFooter><button type="button" onClick={() => setViewOpen(false)} className="h-10 rounded-md border border-zinc-200 px-5 text-sm font-semibold">Close</button>{selected && <button type="button" onClick={() => { setViewOpen(false); openEdit(selected); }} className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-white">Edit</button>}</DialogFooter></DialogContent></Dialog>
      <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{selected ? 'Edit' : 'Add'} {isYears ? 'Fiscal Year' : 'Fiscal Period'}</DialogTitle><DialogDescription>{isYears ? 'Set the company, date range, and accounting state.' : 'Assign this period to a fiscal year and define its posting dates.'}</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
        {isYears ? <Select label="Company" value={String(form.company_id)} onChange={(value) => setForm((current) => ({ ...current, company_id: value }))} options={companies.map((row) => ({ value: String(row.id), label: String(row.name) }))} /> : <Select label="Fiscal Year" value={String(form.fiscal_year_id)} onChange={(value) => setForm((current) => ({ ...current, fiscal_year_id: value }))} options={years.map((row) => ({ value: String(row.id), label: `${String(row.name)} — ${companyMap.get(Number(row.company_id)) || ''}` }))} />}
        <Field label={isYears ? 'Fiscal Year Name' : 'Period Name'} value={String(form.name)} placeholder={isYears ? 'e.g. FY 2026' : 'e.g. January 2026'} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
        {!isYears && <Field label="Period Number" value={String(form.period_number)} type="number" min="1" max="255" onChange={(value) => setForm((current) => ({ ...current, period_number: value }))} />}
        <Field label="Start Date" value={String(form.start_date)} type="date" onChange={(value) => setForm((current) => ({ ...current, start_date: value }))} />
        <Field label="End Date" value={String(form.end_date)} type="date" onChange={(value) => setForm((current) => ({ ...current, end_date: value }))} />
        <Select label="State" value={String(form.state)} onChange={(value) => setForm((current) => ({ ...current, state: value }))} options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]} />
        {!isYears && <Toggle label="Closing Period" hint="Use this period for year-end adjustment entries" checked={Boolean(form.is_closing_period)} onChange={(checked) => setForm((current) => ({ ...current, is_closing_period: checked }))} />}
      </div><DialogFooter><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="h-10 rounded-xl border px-5 text-xs font-semibold hover:bg-muted">Cancel</button><button disabled={saving} className="h-10 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? 'Saving...' : selected ? 'Save Changes' : `Add ${isYears ? 'Fiscal Year' : 'Period'}`}</button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !saving && setDeleteOpen(open)}><DialogContent className="sm:max-w-md"><DialogHeader><div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Trash2 className="size-5" /></div><DialogTitle>Delete {isYears ? 'fiscal year' : 'fiscal period'}?</DialogTitle><DialogDescription>This permanently deletes {selected ? String(selected.name) : 'this record'}. Linked accounting entries may prevent deletion.</DialogDescription></DialogHeader><DialogFooter><button onClick={() => setDeleteOpen(false)} disabled={saving} className="h-10 rounded-xl border px-5 text-xs font-semibold hover:bg-muted">Cancel</button><button onClick={() => void remove()} disabled={saving} className="h-10 rounded-xl bg-rose-600 px-5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{saving ? 'Deleting...' : 'Delete Record'}</button></DialogFooter></DialogContent></Dialog>
    </AccountingPageShell>
  );
}

function FiscalDetail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p><p className="mt-1 text-sm font-medium capitalize text-zinc-700">{value}</p></div>; }
function Summary({ label, value, hint, closed }: { label: string; value: number; hint: string; closed?: boolean }) { return <article className={`${dashboardCardClass} p-4`}><div className="flex items-center justify-between"><span className="text-xs font-medium text-zinc-500">{label}</span><span className={`flex size-8 items-center justify-center rounded-lg ${closed ? 'bg-zinc-100 text-zinc-600' : 'bg-primary/8 text-primary'}`}>{closed ? <LockKeyhole className="size-4" /> : <CalendarDays className="size-4" />}</span></div><p className="mt-3 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-zinc-500">{hint}</p></article>; }
function StateBadge({ state }: { state: string }) { const open = state === 'open'; return <span className={`${dashboardStatusBadgeClass} ${open ? 'bg-emerald-600 text-white' : 'bg-zinc-600 text-white'}`}>{open ? 'Open' : 'Closed'}</span>; }
function Field({ label, value, onChange, type = 'text', placeholder, min, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; min?: string; max?: string }) { return <label><span className="text-xs font-semibold">{label}<span className="ml-0.5 text-rose-500">*</span></span><input required type={type} value={value} min={min} max={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label><span className="text-xs font-semibold">{label}<span className="ml-0.5 text-rose-500">*</span></span><select required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3 sm:col-span-2"><div><span className="text-xs font-semibold">{label}</span><p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button></label>; }
