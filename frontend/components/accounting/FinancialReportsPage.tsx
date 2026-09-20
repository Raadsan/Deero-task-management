'use client';

import { accountingToast } from '@/lib/accounting-ui';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  Landmark,
  Banknote,
  FileText,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  PieChart,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { accountingReportApi } from '@/lib/api/accounting/accountingReportApi';
import { companyApi } from '@/lib/api/accounting/configuration/companyApi';
import { chartOfAccountApi } from '@/lib/api/accounting/ledger/chartOfAccountApi';
import { fiscalPeriodApi } from '@/lib/api/accounting/ledger/fiscalPeriodApi';
import { fiscalYearApi } from '@/lib/api/accounting/ledger/fiscalYearApi';
import { accountingJournalApi } from '@/lib/api/accounting/ledger/journalApi';

import AccountingPageShell from '@/components/accounting/AccountingPageShell';
import { dashboardCardClass } from '@/lib/dashboard-ui';
import DashboardDataTable, { type DashboardTableColumn } from '@/components/Shared/DashboardDataTable';

export type FinancialReportKind =
  | 'general-ledger'
  | 'trial-balance'
  | 'profit-and-loss'
  | 'balance-sheet'
  | 'cash-flow'
  | 'journal-report';
type Row = { id?: number; [key: string]: unknown };

const titles: Record<FinancialReportKind, string> = {
  'general-ledger': 'General Ledger',
  'trial-balance': 'Trial Balance',
  'profit-and-loss': 'Profit & Loss',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow',
  'journal-report': 'Journal Report',
};

const descriptions: Record<FinancialReportKind, string> = {
  'general-ledger': 'Review every posted debit and credit by ledger account.',
  'trial-balance': 'Confirm that posted debit and credit totals remain balanced.',
  'profit-and-loss': 'Measure income, expenses, and net profit for the selected period.',
  'balance-sheet': 'Review assets, liabilities, and equity as of a selected date.',
  'cash-flow': 'Track cash, bank, and mobile-money inflows, outflows, and closing balances.',
  'journal-report': 'Audit posted journal entries and their balanced accounting lines.',
};

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const dateValue = (value: unknown) => (value ? new Date(String(value)).toISOString().slice(0, 10) : '');
const money = (value: unknown) => Number(value || 0).toFixed(2);
const message = (error: unknown) =>
  axios.isAxiosError(error)
    ? error.response?.data?.message || error.message
    : error instanceof Error
      ? error.message
      : 'Unable to load report';

type Warning = { code?: string; message?: string; difference?: number; entries?: unknown[] };

function asWarnings(data: unknown): Warning[] {
  if (!data || typeof data !== 'object') return [];
  const warnings = (data as { warnings?: Warning[] }).warnings;
  return Array.isArray(warnings) ? warnings : [];
}

export default function FinancialReportsPage({ kind }: { kind: FinancialReportKind }) {
  const [companies, setCompanies] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [periods, setPeriods] = useState<Row[]>([]);
  const [years, setYears] = useState<Row[]>([]);
  const [journals, setJournals] = useState<Row[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [periodId, setPeriodId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [journalId, setJournalId] = useState('');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      companyApi.getAll(),
      chartOfAccountApi.getAll(),
      fiscalPeriodApi.getAll(),
      fiscalYearApi.getAll(),
      accountingJournalApi.getAll(),
    ])
      .then(([companyRows, accountRows, periodRows, yearRows, journalRows]) => {
        setCompanies(companyRows);
        setAccounts(accountRows);
        setPeriods(periodRows);
        setYears(yearRows);
        setJournals(journalRows);
        if (companyRows.length > 0) {
          setCompanyId(String(companyRows[0].id));
        }
      })
      .catch((error) => accountingToast(message(error), 'error'));
  }, []);

  const load = useCallback(async () => {
    if (!companyId) {
      setData(null);
      return;
    }
    setLoading(true);
    const filters = {
      companyId: Number(companyId),
      startDate: periodId ? undefined : startDate,
      endDate: periodId ? undefined : endDate,
      periodId: periodId ? Number(periodId) : undefined,
    };
    try {
      const result =
        kind === 'general-ledger'
          ? await accountingReportApi.getGeneralLedger({
              ...filters,
              accountId: accountId ? Number(accountId) : undefined,
            })
          : kind === 'trial-balance'
            ? await accountingReportApi.getTrialBalance(filters)
            : kind === 'profit-and-loss'
              ? await accountingReportApi.getProfitAndLoss(filters)
              : kind === 'balance-sheet'
                ? await accountingReportApi.getBalanceSheet(Number(companyId), endDate)
                : kind === 'cash-flow'
                  ? await accountingReportApi.getCashFlow(filters)
                  : await accountingReportApi.getJournalReport({
                      ...filters,
                      journalId: journalId ? Number(journalId) : undefined,
                    });
      setData(result);
    } catch (error) {
      setData(null);
      accountingToast(message(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [accountId, companyId, endDate, journalId, kind, periodId, startDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const companyPeriods = periods.filter(
    (period) =>
      Number(years.find((year) => year.id === Number(period.fiscal_year_id))?.company_id) === Number(companyId)
  );
  const companyAccounts = accounts.filter((row) => Number(row.company_id) === Number(companyId));
  const companyJournals = journals.filter((row) => Number(row.company_id) === Number(companyId));
  const companyName = String(companies.find((row) => String(row.id) === companyId)?.name || '');
  const exportRows = useMemo(() => flattenForExport(kind, data), [data, kind]);
  const warnings = asWarnings(data);

  function exportCsv() {
    if (!exportRows.length) return;
    const keys = Object.keys(exportRows[0]);
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [keys.map(escape).join(','), ...exportRows.map((row) => keys.map((key) => escape(row[key])).join(','))].join(
      '\r\n'
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${kind}-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AccountingPageShell
      section="Financial Reports"
      title={titles[kind]}
      description={descriptions[kind]}
      className="print:border-0 print:shadow-none"
    >
      <div className="space-y-5">
        {data ? <ReportMetrics kind={kind} data={data} /> : null}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 space-y-1 print:border-rose-300">
            {warnings.map((warning, index) => (
              <div key={`${warning.code || 'warn'}-${index}`} className="flex gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{warning.message || warning.code}</span>
              </div>
            ))}
          </div>
        )}

        <section className={cn(dashboardCardClass, 'overflow-hidden print:border-0 print:shadow-none')}>
          <div className="border-b border-zinc-200/80 bg-zinc-50/60 p-4 print:hidden">
            <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-500">
              {companyName ? <span>Company: <strong className="text-zinc-800">{companyName}</strong></span> : null}
              <span>
                Period:{' '}
                <strong className="text-zinc-800">
                  {kind === 'balance-sheet' ? `As of ${endDate}` : periodId ? `Fiscal period #${periodId}` : `${startDate} → ${endDate}`}
                </strong>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <Select
                label="Company"
                value={companyId}
                set={(value) => {
                  setCompanyId(value);
                  setPeriodId('');
                  setAccountId('');
                  setJournalId('');
                }}
                rows={companies}
              />
              {kind !== 'balance-sheet' && (
                <Select label="Fiscal period" value={periodId} set={setPeriodId} rows={companyPeriods} optional />
              )}
              {kind !== 'balance-sheet' && !periodId && <Field label="From" value={startDate} set={setStartDate} />}
              {!periodId && <Field label={kind === 'balance-sheet' ? 'As of date' : 'To'} value={endDate} set={setEndDate} />}
              {kind === 'general-ledger' && (
                <Select label="Account" value={accountId} set={setAccountId} rows={companyAccounts} account optional />
              )}
              {kind === 'journal-report' && (
                <Select label="Journal" value={journalId} set={setJournalId} rows={companyJournals} account optional />
              )}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => void load()}
                  disabled={!companyId || loading}
                  className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50"
                >
                  <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Run
                </button>
                <button
                  title="Export CSV"
                  onClick={exportCsv}
                  disabled={!exportRows.length}
                  className="flex size-10 items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40"
                >
                  <Download className="size-4" />
                </button>
                <button
                  title="Print"
                  onClick={() => window.print()}
                  disabled={!data}
                  className="flex size-10 items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40"
                >
                  <Printer className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {!companyId ? (
            <Empty text="Select a company to generate this report." />
          ) : loading ? (
            <Empty text="Preparing report…" />
          ) : !data ? (
            <Empty text="No report data available." />
          ) : (
            <ReportContent kind={kind} data={data} />
          )}
        </section>
      </div>
    </AccountingPageShell>
  );
}

function ReportMetrics({ kind, data }: { kind: FinancialReportKind; data: unknown }) {
  if (kind === 'general-ledger') {
    const report = data as { totals?: { debit?: number; credit?: number }; accounts?: Row[]; lines?: Row[] };
    const rows = report.accounts || [];
    const totalDebit = Number(report.totals?.debit ?? rows.reduce((s, a) => s + Number(a.total_debit || 0), 0));
    const totalCredit = Number(report.totals?.credit ?? rows.reduce((s, a) => s + Number(a.total_credit || 0), 0));
    const lineCount = report.lines?.length ?? rows.reduce((s, a) => s + ((a.lines as Row[]) || []).length, 0);

    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Debits" value={totalDebit} icon={ArrowUpRight} color="bg-blue-50 text-blue-600 border border-blue-100" />
        <MetricCard label="Total Credits" value={totalCredit} icon={ArrowDownRight} color="bg-purple-50 text-purple-600 border border-purple-100" />
        <MetricCard label="Accounts" value={rows.length} prefix="" suffix="accounts" icon={Layers} color="bg-emerald-50 text-emerald-600 border border-emerald-100" />
        <MetricCard label="Posted Lines" value={lineCount} prefix="" suffix="lines" icon={FileText} color="bg-amber-50 text-amber-600 border border-amber-100" />
      </div>
    );
  }

  if (kind === 'trial-balance') {
    const report = data as {
      accounts?: Row[];
      totals?: { debit?: number; credit?: number; difference?: number };
      is_balanced?: boolean;
    };
    const rows = report.accounts || [];
    const debit = Number(report.totals?.debit ?? rows.reduce((s, r) => s + Number(r.debit ?? r.total_debit ?? 0), 0));
    const credit = Number(report.totals?.credit ?? rows.reduce((s, r) => s + Number(r.credit ?? r.total_credit ?? 0), 0));
    const diff = Math.abs(Number(report.totals?.difference ?? debit - credit));
    const isBalanced = report.is_balanced ?? diff < 0.01;

    return (
      <div className="grid gap-3.5 sm:grid-cols-3">
        <MetricCard label="Total Debits" value={debit} icon={ArrowUpRight} color="bg-blue-50 text-blue-600 border border-blue-100" />
        <MetricCard label="Total Credits" value={credit} icon={ArrowDownRight} color="bg-purple-50 text-purple-600 border border-purple-100" />
        <MetricCard
          label="Trial Balance Status"
          value={isBalanced ? 'Balanced' : money(diff)}
          prefix={isBalanced ? '' : 'Diff: $'}
          icon={isBalanced ? ShieldCheck : AlertCircle}
          color={isBalanced ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
          badge={isBalanced ? '✓ Perfect 0.00' : '⚠ Discrepancy'}
          badgeType={isBalanced ? 'success' : 'danger'}
          tone={isBalanced ? 'positive' : 'negative'}
        />
      </div>
    );
  }

  if (kind === 'profit-and-loss') {
    const report = data as { income: { total: number }; expense: { total: number }; net_income: number };
    const incomeTotal = Number(report.income?.total || 0);
    const expenseTotal = Number(report.expense?.total || 0);
    const netIncome = Number(report.net_income || 0);
    const margin = incomeTotal > 0 ? ((netIncome / incomeTotal) * 100).toFixed(1) : '0.0';

    return (
      <div className="grid gap-3.5 sm:grid-cols-3">
        <MetricCard label="Operating Revenue" value={incomeTotal} icon={TrendingUp} color="bg-emerald-50 text-emerald-600 border border-emerald-100" tone="positive" badge="Operating" badgeType="success" />
        <MetricCard label="Operating Expenses" value={expenseTotal} icon={ArrowDownRight} color="bg-rose-50 text-rose-600 border border-rose-100" tone="negative" badge="Expenditure" badgeType="danger" />
        <MetricCard
          label="Net Profit Margin"
          value={margin}
          prefix=""
          suffix="%"
          icon={PieChart}
          color={netIncome >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
          tone={netIncome >= 0 ? 'positive' : 'negative'}
          badge={netIncome >= 0 ? 'Profitable' : 'Deficit'}
          badgeType={netIncome >= 0 ? 'success' : 'danger'}
        />
      </div>
    );
  }

  if (kind === 'balance-sheet') {
    const report = data as {
      assets: { total: number };
      liabilities: { total: number };
      equity: { total: number };
      equation?: { is_balanced?: boolean; difference?: number };
    };
    const totalAssets = Number(report.assets?.total || 0);
    const totalLiab = Number(report.liabilities?.total || 0);
    const totalEq = Number(report.equity?.total || 0);
    const liabPlusEq = totalLiab + totalEq;
    const diff = Math.abs(Number(report.equation?.difference ?? totalAssets - liabPlusEq));
    const isBalanced = report.equation?.is_balanced ?? diff < 0.01;

    return (
      <div className="grid gap-3.5 sm:grid-cols-4">
        <MetricCard label="Total Assets" value={totalAssets} icon={Landmark} color="bg-blue-50 text-blue-600 border border-blue-100" tone="positive" />
        <MetricCard label="Total Liabilities" value={totalLiab} icon={AlertCircle} color="bg-amber-50 text-amber-600 border border-amber-100" />
        <MetricCard label="Total Equity" value={totalEq} icon={Wallet} color="bg-purple-50 text-purple-600 border border-purple-100" />
        <MetricCard
          label="Equation Balance"
          value={isBalanced ? 'Balanced' : money(diff)}
          prefix={isBalanced ? '' : 'Diff: $'}
          icon={isBalanced ? ShieldCheck : AlertCircle}
          color={isBalanced ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
          badge={isBalanced ? 'A = L + E' : 'Mismatch'}
          badgeType={isBalanced ? 'success' : 'danger'}
          tone={isBalanced ? 'positive' : 'negative'}
        />
      </div>
    );
  }

  if (kind === 'cash-flow') {
    const report = data as {
      opening_balance: number;
      inflows: number;
      outflows: number;
      net_change: number;
      closing_balance: number;
    };
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Opening Balance" value={report.opening_balance} icon={Wallet} color="bg-zinc-100 text-zinc-700 border border-zinc-200" />
        <MetricCard label="Total Inflows" value={report.inflows} icon={ArrowUpRight} color="bg-emerald-50 text-emerald-600 border border-emerald-100" tone="positive" badge="Received" badgeType="success" />
        <MetricCard label="Total Outflows" value={report.outflows} icon={ArrowDownRight} color="bg-rose-50 text-rose-600 border border-rose-100" tone="negative" badge="Disbursed" badgeType="danger" />
        <MetricCard
          label="Net Cash Movement"
          value={Math.abs(report.net_change)}
          prefix={report.net_change < 0 ? '-$' : '$'}
          icon={TrendingUp}
          color={report.net_change >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
          tone={report.net_change >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard label="Closing Balance" value={report.closing_balance} icon={Banknote} color="bg-blue-50 text-blue-600 border border-blue-100" tone="positive" />
      </div>
    );
  }

  const report = data as { entries?: Row[] };
  const entries = Array.isArray(data) ? (data as Row[]) : report.entries || [];
  const totalEntries = entries.length;
  const totalDebit = entries.reduce((s, e) => s + Number(e.total_debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);
  const totalLines = entries.reduce((s, e) => s + ((e.journal_items as Row[]) || []).length, 0);

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Total Journal Entries" value={totalEntries} prefix="" suffix="entries" icon={FileText} color="bg-blue-50 text-blue-600 border border-blue-100" />
      <MetricCard label="Total Journal Lines" value={totalLines} prefix="" suffix="lines" icon={Layers} color="bg-purple-50 text-purple-600 border border-purple-100" />
      <MetricCard label="Total Debited" value={totalDebit} icon={ArrowUpRight} color="bg-emerald-50 text-emerald-600 border border-emerald-100" />
      <MetricCard label="Total Credited" value={totalCredit} icon={ArrowDownRight} color="bg-rose-50 text-rose-600 border border-rose-100" />
    </div>
  );
}

function ReportContent({ kind, data }: { kind: FinancialReportKind; data: unknown }) {
  if (kind === 'general-ledger') {
    const report = data as {
      accounts?: Array<{
        account_code: string;
        account_name: string;
        opening_balance: number;
        closing_balance: number;
        total_debit: number;
        total_credit: number;
        lines: Array<{
          date: unknown;
          entry_number: unknown;
          journal: unknown;
          reference: unknown;
          description: unknown;
          debit: number;
          credit: number;
          running_balance: number;
        }>;
      }>;
      totals?: { debit: number; credit: number };
    };
    const accounts = report.accounts || [];

    if (!accounts.length) return <Empty text="No posted ledger activity for this selection." />;

    return (
      <div className="p-5 space-y-6">
        {accounts.map((account) => (
          <div key={account.account_code} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-zinc-50 px-4 py-3">
              <div className="font-bold text-sm">
                {account.account_code} — {account.account_name}
              </div>
              <div className="flex flex-wrap gap-4 text-xs tabular-nums text-zinc-600">
                <span>Opening ${money(account.opening_balance)}</span>
                <span>Debit ${money(account.total_debit)}</span>
                <span>Credit ${money(account.total_credit)}</span>
                <span className="font-semibold text-zinc-900">Closing ${money(account.closing_balance)}</span>
              </div>
            </div>
            <ReportTable
              compact
              headers={['Date', 'Journal', 'Entry #', 'Reference', 'Description', 'Debit', 'Credit', 'Running Balance']}
              rows={account.lines.map((line) => [
                dateValue(line.date),
                line.journal || '—',
                line.entry_number || '—',
                line.reference || '—',
                line.description || '—',
                money(line.debit),
                money(line.credit),
                money(line.running_balance),
              ])}
              footer={['', '', '', '', 'Account totals', money(account.total_debit), money(account.total_credit), money(account.closing_balance)]}
            />
          </div>
        ))}
        <div className="flex justify-end gap-6 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm font-bold">
          <span>Report Debits: ${money(report.totals?.debit)}</span>
          <span>Report Credits: ${money(report.totals?.credit)}</span>
        </div>
      </div>
    );
  }

  if (kind === 'trial-balance') {
    const report = data as {
      accounts?: Row[];
      totals?: { debit?: number; credit?: number };
      is_balanced?: boolean;
    };
    const rows = report.accounts || [];
    const debit = Number(report.totals?.debit ?? rows.reduce((s, row) => s + Number(row.debit ?? 0), 0));
    const credit = Number(report.totals?.credit ?? rows.reduce((s, row) => s + Number(row.credit ?? 0), 0));

    return (
      <ReportTable
        headers={['Code', 'Account Name', 'Account Type', 'Debit', 'Credit']}
        rows={rows.map((row) => [
          row.account_code,
          row.account_name,
          row.account_type || '—',
          money(row.debit ?? row.total_debit),
          money(row.credit ?? row.total_credit),
        ])}
        footer={['', 'Totals', '', money(debit), money(credit)]}
      />
    );
  }

  if (kind === 'profit-and-loss') {
    const report = data as {
      income: { total: number; accounts: Row[] };
      expense: { total: number; accounts: Row[] };
      net_income: number;
    };
    const incomeTotal = Number(report.income?.total || 0);
    const expenseTotal = Number(report.expense?.total || 0);
    const netIncome = Number(report.net_income || 0);

    return (
      <div className="p-5 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
            <Statement title="Revenue" rows={report.income?.accounts || []} total={incomeTotal} />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
            <Statement title="Expenses" rows={report.expense?.accounts || []} total={expenseTotal} />
          </div>
        </div>

        <div
          className={`flex justify-between items-center rounded-xl p-5 text-lg font-bold shadow-xs border ${
            netIncome >= 0
              ? 'bg-emerald-50/80 text-emerald-900 border-emerald-200'
              : 'bg-rose-50/80 text-rose-900 border-rose-200'
          }`}
        >
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Financial Performance</span>
            <span className="text-xl font-extrabold">Net Profit / (Loss)</span>
          </div>
          <span className="text-2xl font-black">{money(netIncome)}</span>
        </div>
      </div>
    );
  }

  if (kind === 'balance-sheet') {
    const report = data as {
      assets: { total: number; accounts: Row[] };
      liabilities: { total: number; accounts: Row[] };
      equity: { total: number; accounts: Row[] };
      current_year_earnings?: number;
      equation?: { is_balanced?: boolean; difference?: number; liabilities_plus_equity?: number };
    };
    const totalAssets = Number(report.assets?.total || 0);
    const totalLiab = Number(report.liabilities?.total || 0);
    const totalEq = Number(report.equity?.total || 0);
    const liabPlusEq = Number(report.equation?.liabilities_plus_equity ?? totalLiab + totalEq);
    const diff = Math.abs(Number(report.equation?.difference ?? totalAssets - liabPlusEq));
    const isBalanced = report.equation?.is_balanced ?? diff < 0.01;

    return (
      <div className="p-5 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
            <Statement title="Assets" rows={report.assets?.accounts || []} total={totalAssets} />
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
              <Statement title="Liabilities" rows={report.liabilities?.accounts || []} total={totalLiab} />
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
              <Statement title="Equity" rows={report.equity?.accounts || []} total={totalEq} />
              {typeof report.current_year_earnings === 'number' && Math.abs(report.current_year_earnings) > 0.005 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Includes Current Year Earnings of ${money(report.current_year_earnings)} (posted P&amp;L to date, not double-counted into Retained Earnings).
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center rounded-xl bg-zinc-50 border border-zinc-200 p-4 font-bold text-sm">
          <div>
            <span className="text-zinc-500">Total Liabilities + Equity: </span>
            <span className="text-base text-zinc-900 ml-1">${money(liabPlusEq)}</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isBalanced
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            {isBalanced ? '✓ Balanced (Assets = Liabilities + Equity)' : `Difference: $${money(diff)}`}
          </span>
        </div>
      </div>
    );
  }

  if (kind === 'cash-flow') {
    const report = data as {
      accounts: Row[];
      activities?: { operating?: number; investing?: number; financing?: number };
      opening_balance?: number;
      closing_balance?: number;
      net_change?: number;
    };
    return (
      <div className="space-y-4">
        {(report.activities && (
          <div className="grid gap-3 sm:grid-cols-3 p-4 border-b">
            <div className="rounded-lg border bg-white px-3 py-2 text-sm">
              <div className="text-[11px] uppercase text-zinc-500 font-semibold">Operating</div>
              <div className="font-bold tabular-nums">${money(report.activities.operating)}</div>
            </div>
            <div className="rounded-lg border bg-white px-3 py-2 text-sm">
              <div className="text-[11px] uppercase text-zinc-500 font-semibold">Investing</div>
              <div className="font-bold tabular-nums">${money(report.activities.investing)}</div>
            </div>
            <div className="rounded-lg border bg-white px-3 py-2 text-sm">
              <div className="text-[11px] uppercase text-zinc-500 font-semibold">Financing</div>
              <div className="font-bold tabular-nums">${money(report.activities.financing)}</div>
            </div>
          </div>
        )) || null}
        <ReportTable
          headers={['Code', 'Account', 'Account Number', 'Currency', 'Opening', 'Inflows', 'Outflows', 'Net Change', 'Closing']}
          rows={(report.accounts || []).map((row) => [
            row.account_code || '—',
            row.account_name,
            row.account_number || '—',
            row.currency || '—',
            money(row.opening_balance),
            money(row.inflows),
            money(row.outflows),
            money(row.net_change),
            money(row.closing_balance),
          ])}
          footer={[
            '',
            'Totals',
            '',
            '',
            money(report.opening_balance),
            money((report.accounts || []).reduce((s, r) => s + Number(r.inflows || 0), 0)),
            money((report.accounts || []).reduce((s, r) => s + Number(r.outflows || 0), 0)),
            money(report.net_change),
            money(report.closing_balance),
          ]}
        />
      </div>
    );
  }

  const report = data as { entries?: Row[] };
  const entries = Array.isArray(data) ? (data as Row[]) : report.entries || [];
  return (
    <div className="p-5 space-y-4">
      {entries.length === 0 ? <Empty text="No posted journal entries for this selection." /> : null}
      {entries.map((entry) => (
        <div key={String(entry.id)} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-zinc-100 pb-3">
            <div>
              <span className="font-bold text-base text-primary">{String(entry.entry_number || `#${entry.id}`)}</span>
              <span className="ml-3 text-xs text-muted-foreground">
                {dateValue(entry.entry_date)} · {String((entry.journals as Row)?.name || '')}
              </span>
              <div className="mt-1 text-xs text-zinc-500">
                Source: {String(entry.source || entry.source_type || '—')} · Status: {String(entry.state || 'posted')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!entry.is_balanced ? (
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                  Unbalanced ${money(entry.difference)}
                </span>
              ) : null}
              <span className="text-xs font-medium text-zinc-600 bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200">
                {String(entry.reference || entry.narration || 'No reference')}
              </span>
            </div>
          </div>
          <ReportTable
            compact
            headers={['Account', 'Line Label', 'Debit', 'Credit']}
            rows={((entry.journal_items as Row[]) || []).map((line) => [
              `${String((line.chart_of_accounts as Row)?.code || '')} — ${String((line.chart_of_accounts as Row)?.name || '')}`,
              line.label || '—',
              money(line.debit),
              money(line.credit),
            ])}
            footer={['', 'Totals', money(entry.total_debit), money(entry.total_credit)]}
          />
        </div>
      ))}
    </div>
  );
}

type ReportTableRow = { id: number; values: unknown[] };
function ReportTable({
  headers,
  rows,
  footer,
  compact,
}: {
  headers: string[];
  rows: unknown[][];
  footer?: unknown[];
  compact?: boolean;
}) {
  const [search, setSearch] = useState('');
  const tableRows = useMemo<ReportTableRow[]>(() => rows.map((values, index) => ({ id: index + 1, values })), [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? tableRows.filter((row) => row.values.some((value) => String(value ?? '').toLowerCase().includes(query)))
      : tableRows;
  }, [search, tableRows]);
  const columns = useMemo<DashboardTableColumn<ReportTableRow>[]>(
    () =>
      headers.map((header, index) => ({
        key: `${header}-${index}`,
        header,
        align: index >= headers.length - 3 ? 'right' : 'left',
        className: compact ? 'text-[11px]' : undefined,
        cell: (row) => String(row.values[index] ?? '—'),
      })),
    [compact, headers]
  );
  const footerContent = footer ? (
    <tfoot className="border-t-2 bg-muted/30 font-bold">
      <tr>
        {footer.map((value, index) => (
          <td key={index} className={`px-4 py-3 ${index >= footer.length - 3 ? 'text-right' : ''}`}>
            {String(value ?? '')}
          </td>
        ))}
      </tr>
    </tfoot>
  ) : undefined;
  return (
    <DashboardDataTable
      className="border-0 shadow-none rounded-none"
      rows={filteredRows}
      columns={columns}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search report..."
      emptyText="No posted activity for this selection."
      minWidth="720px"
      pageSizes={[10, 25, 50]}
      footer={footerContent}
    />
  );
}

function Statement({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <section className="mb-5">
      <h3 className="border-b pb-2 font-bold">{title}</h3>
      {rows.map((row) => (
        <div key={String(row.account_id ?? row.account_code)} className="flex justify-between border-b border-dashed py-2 text-sm">
          <span>
            {String(row.account_code)} — {String(row.account_name)}
          </span>
          <span className="tabular-nums">{money(row.balance)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between rounded-lg bg-muted px-3 py-2 font-bold">
        <span>Total {title}</span>
        <span>{money(total)}</span>
      </div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon?: typeof ArrowUpRight;
  color?: string;
  badge?: string;
  badgeType?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  tone?: 'positive' | 'negative' | 'neutral';
};

function MetricCard({
  label,
  value,
  prefix = '$',
  suffix,
  icon: Icon,
  color = 'bg-primary/10 text-primary border border-primary/20',
  badge,
  badgeType = 'neutral',
  tone,
}: MetricCardProps) {
  const formatted = typeof value === 'number' ? money(value) : value;

  return (
    <div className={cn(dashboardCardClass, 'flex flex-col justify-between p-4.5 transition-all hover:shadow-md')}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
        {Icon && (
          <div className={cn('flex size-9 items-center justify-center rounded-xl shrink-0', color)}>
            <Icon className="size-4.5" />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-auto">
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-sm font-semibold text-zinc-400">{prefix}</span>}
          <span
            className={cn(
              'text-2xl font-black tracking-tight',
              tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-600' : 'text-zinc-900'
            )}
          >
            {formatted}
          </span>
          {suffix && <span className="text-xs font-semibold text-zinc-400 ml-0.5">{suffix}</span>}
        </div>
        {badge && (
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              badgeType === 'success' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
              badgeType === 'danger' && 'bg-rose-50 text-rose-700 border border-rose-200',
              badgeType === 'warning' && 'bg-amber-50 text-amber-700 border border-amber-200',
              badgeType === 'info' && 'bg-blue-50 text-blue-700 border border-blue-200',
              badgeType === 'neutral' && 'bg-zinc-100 text-zinc-700 border border-zinc-200'
            )}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-16 text-center text-sm text-muted-foreground">{text}</div>;
}
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3"
      />
    </label>
  );
}
function Select({
  label,
  value,
  set,
  rows,
  optional,
  account,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  rows: Row[];
  optional?: boolean;
  account?: boolean;
}) {
  return (
    <label className="text-xs font-semibold">
      {label}
      {!optional && ' *'}
      <select
        required={!optional}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3"
      >
        <option value="">{optional ? `All ${label.toLowerCase()}s` : `Select ${label.toLowerCase()}`}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {account ? `${String(row.code || '')} — ${String(row.name || '')}` : String(row.name || '')}
          </option>
        ))}
      </select>
    </label>
  );
}

function flattenForExport(kind: FinancialReportKind, data: unknown): Record<string, unknown>[] {
  if (!data) return [];

  if (kind === 'general-ledger') {
    const report = data as { accounts?: Array<{ account_code: string; account_name: string; lines: Row[] }> };
    return (report.accounts || []).flatMap((account) =>
      (account.lines || []).map((line) => ({
        account_code: account.account_code,
        account_name: account.account_name,
        date: dateValue(line.date),
        journal: line.journal,
        entry: line.entry_number,
        reference: line.reference,
        description: line.description,
        debit: line.debit,
        credit: line.credit,
        running_balance: line.running_balance,
      }))
    );
  }

  if (kind === 'trial-balance') {
    const report = data as { accounts?: Row[] };
    return (report.accounts || []).map((row) => ({
      code: row.account_code,
      account: row.account_name,
      type: row.account_type,
      debit: row.debit,
      credit: row.credit,
    }));
  }

  if (kind === 'journal-report') {
    const report = data as { entries?: Row[] };
    const entries = Array.isArray(data) ? (data as Row[]) : report.entries || [];
    return entries.flatMap((entry) =>
      ((entry.journal_items as Row[]) || []).map((line) => ({
        date: dateValue(entry.entry_date),
        entry: entry.entry_number,
        journal: (entry.journals as Row)?.name,
        source: entry.source || entry.source_type,
        account: (line.chart_of_accounts as Row)?.code,
        label: line.label,
        debit: line.debit,
        credit: line.credit,
      }))
    );
  }

  if (kind === 'profit-and-loss') {
    const report = data as Record<string, unknown>;
    return ['income', 'expense'].flatMap((group) =>
      (((report[group] as { accounts: Row[] })?.accounts) || []).map((row) => ({
        group,
        code: row.account_code,
        account: row.account_name,
        balance: row.balance,
      }))
    );
  }

  if (kind === 'balance-sheet') {
    const report = data as Record<string, unknown>;
    return ['assets', 'liabilities', 'equity'].flatMap((group) =>
      (((report[group] as { accounts: Row[] })?.accounts) || []).map((row) => ({
        group,
        code: row.account_code,
        account: row.account_name,
        balance: row.balance,
      }))
    );
  }

  if (kind === 'cash-flow') {
    const report = data as { accounts?: Record<string, unknown>[] };
    return report.accounts || [];
  }

  return [];
}
