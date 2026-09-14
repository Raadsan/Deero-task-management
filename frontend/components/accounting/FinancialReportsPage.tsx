'use client';

import { accountingToast } from '@/lib/accounting-ui';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Download,
  Printer,
  RefreshCw,
  BookOpen,
  Scale,
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

export type FinancialReportKind = 'general-ledger' | 'trial-balance' | 'profit-and-loss' | 'balance-sheet' | 'cash-flow' | 'journal-report';
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
  'cash-flow': 'Track cash and bank inflows, outflows, and closing balances.',
  'journal-report': 'Audit posted journal entries and their balanced accounting lines.',
};

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const dateValue = (value: unknown) => (value ? new Date(String(value)).toISOString().slice(0, 10) : '');
const money = (value: unknown) => Number(value || 0).toFixed(2);
const message = (error: unknown) =>
  axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Unable to load report';

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
          ? await accountingReportApi.getGeneralLedger({ ...filters, accountId: accountId ? Number(accountId) : undefined })
          : kind === 'trial-balance'
          ? await accountingReportApi.getTrialBalance(filters)
          : kind === 'profit-and-loss'
          ? await accountingReportApi.getProfitAndLoss(filters)
          : kind === 'balance-sheet'
          ? await accountingReportApi.getBalanceSheet(Number(companyId), endDate)
          : kind === 'cash-flow'
          ? await accountingReportApi.getCashFlow(filters)
          : await accountingReportApi.getJournalReport({ ...filters, journalId: journalId ? Number(journalId) : undefined });
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
    (period) => Number(years.find((year) => year.id === Number(period.fiscal_year_id))?.company_id) === Number(companyId)
  );
  const companyAccounts = accounts.filter((row) => Number(row.company_id) === Number(companyId));
  const companyJournals = journals.filter((row) => Number(row.company_id) === Number(companyId));
  const exportRows = useMemo(() => flattenForExport(kind, data), [data, kind]);

  function exportCsv() {
    if (!exportRows.length) return;
    const keys = Object.keys(exportRows[0]);
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [keys.map(escape).join(','), ...exportRows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\r\n');
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
        {/* Top KPI Metric Boxes ("box yada leh") */}
        {data ? <ReportMetrics kind={kind} data={data} /> : null}

        {/* Unified Table Box with Integrated Filter Toolbar */}
        <section className={cn(dashboardCardClass, 'overflow-hidden print:border-0 print:shadow-none')}>
          {/* Integrated Filter Toolbar inside the card header */}
          <div className="border-b border-zinc-200/80 bg-zinc-50/60 p-4 print:hidden">
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

          {/* Body Content inside the Box */}
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
    const rows = (data as Row[]) || [];
    const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit || 0), 0);
    const net = totalDebit - totalCredit;

    return (
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Debits"
          value={totalDebit}
          icon={ArrowUpRight}
          color="bg-blue-50 text-blue-600 border border-blue-100"
        />
        <MetricCard
          label="Total Credits"
          value={totalCredit}
          icon={ArrowDownRight}
          color="bg-purple-50 text-purple-600 border border-purple-100"
        />
        <MetricCard
          label="Net Movement"
          value={Math.abs(net)}
          prefix={net < 0 ? '-$' : '$'}
          tone={net > 0 ? 'positive' : net < 0 ? 'negative' : 'neutral'}
          icon={TrendingUp}
          color={net >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
          badge={net >= 0 ? 'Debit Heavy' : 'Credit Heavy'}
          badgeType={net >= 0 ? 'info' : 'warning'}
        />
        <MetricCard
          label="Total Entries Count"
          value={rows.length}
          prefix=""
          suffix="lines"
          icon={FileText}
          color="bg-amber-50 text-amber-600 border border-amber-100"
        />
      </div>
    );
  }

  if (kind === 'trial-balance') {
    const rows = (data as Row[]) || [];
    const debit = rows.reduce((sum, row) => sum + Number(row.total_debit || 0), 0);
    const credit = rows.reduce((sum, row) => sum + Number(row.total_credit || 0), 0);
    const diff = Math.abs(debit - credit);
    const isBalanced = diff < 0.01;

    return (
      <div className="grid gap-3.5 sm:grid-cols-3">
        <MetricCard
          label="Total Debits"
          value={debit}
          icon={ArrowUpRight}
          color="bg-blue-50 text-blue-600 border border-blue-100"
        />
        <MetricCard
          label="Total Credits"
          value={credit}
          icon={ArrowDownRight}
          color="bg-purple-50 text-purple-600 border border-purple-100"
        />
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
    const report = data as {
      income: { total: number };
      expense: { total: number };
      net_income: number;
    };
    const incomeTotal = Number(report.income?.total || 0);
    const expenseTotal = Number(report.expense?.total || 0);
    const netIncome = Number(report.net_income || 0);
    const margin = incomeTotal > 0 ? ((netIncome / incomeTotal) * 100).toFixed(1) : '0.0';

    return (
      <div className="grid gap-3.5 sm:grid-cols-3">
        <MetricCard
          label="Operating Revenue"
          value={incomeTotal}
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600 border border-emerald-100"
          tone="positive"
          badge="Operating"
          badgeType="success"
        />
        <MetricCard
          label="Operating Expenses"
          value={expenseTotal}
          icon={ArrowDownRight}
          color="bg-rose-50 text-rose-600 border border-rose-100"
          tone="negative"
          badge="Expenditure"
          badgeType="danger"
        />
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
    };
    const totalAssets = Number(report.assets?.total || 0);
    const totalLiab = Number(report.liabilities?.total || 0);
    const totalEq = Number(report.equity?.total || 0);
    const liabPlusEq = totalLiab + totalEq;
    const diff = Math.abs(totalAssets - liabPlusEq);
    const isBalanced = diff < 0.01;

    return (
      <div className="grid gap-3.5 sm:grid-cols-4">
        <MetricCard
          label="Total Assets"
          value={totalAssets}
          icon={Landmark}
          color="bg-blue-50 text-blue-600 border border-blue-100"
          tone="positive"
        />
        <MetricCard
          label="Total Liabilities"
          value={totalLiab}
          icon={AlertCircle}
          color="bg-amber-50 text-amber-600 border border-amber-100"
        />
        <MetricCard
          label="Total Equity"
          value={totalEq}
          icon={Wallet}
          color="bg-purple-50 text-purple-600 border border-purple-100"
        />
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
        <MetricCard
          label="Opening Balance"
          value={report.opening_balance}
          icon={Wallet}
          color="bg-zinc-100 text-zinc-700 border border-zinc-200"
        />
        <MetricCard
          label="Total Inflows"
          value={report.inflows}
          icon={ArrowUpRight}
          color="bg-emerald-50 text-emerald-600 border border-emerald-100"
          tone="positive"
          badge="Received"
          badgeType="success"
        />
        <MetricCard
          label="Total Outflows"
          value={report.outflows}
          icon={ArrowDownRight}
          color="bg-rose-50 text-rose-600 border border-rose-100"
          tone="negative"
          badge="Disbursed"
          badgeType="danger"
        />
        <MetricCard
          label="Net Cash Movement"
          value={Math.abs(report.net_change)}
          prefix={report.net_change < 0 ? '-$' : '$'}
          icon={TrendingUp}
          color={report.net_change >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
          tone={report.net_change >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Closing Balance"
          value={report.closing_balance}
          icon={Banknote}
          color="bg-blue-50 text-blue-600 border border-blue-100"
          tone="positive"
        />
      </div>
    );
  }

  const entries = (data as Row[]) || [];
  const totalEntries = entries.length;
  const totalDebit = entries.reduce((s, e) => s + Number(e.total_debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);
  const totalLines = entries.reduce((s, e) => s + ((e.journal_items as Row[]) || []).length, 0);

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Journal Entries"
        value={totalEntries}
        prefix=""
        suffix="entries"
        icon={FileText}
        color="bg-blue-50 text-blue-600 border border-blue-100"
      />
      <MetricCard
        label="Total Journal Lines"
        value={totalLines}
        prefix=""
        suffix="lines"
        icon={Layers}
        color="bg-purple-50 text-purple-600 border border-purple-100"
      />
      <MetricCard
        label="Total Debited"
        value={totalDebit}
        icon={ArrowUpRight}
        color="bg-emerald-50 text-emerald-600 border border-emerald-100"
      />
      <MetricCard
        label="Total Credited"
        value={totalCredit}
        icon={ArrowDownRight}
        color="bg-rose-50 text-rose-600 border border-rose-100"
      />
    </div>
  );
}

function ReportContent({ kind, data }: { kind: FinancialReportKind; data: unknown }) {
  if (kind === 'general-ledger') {
    const rows = (data as Row[]) || [];
    const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit || 0), 0);

    const mapped = rows.reduce<{ balance: number; rows: unknown[][] }>(
      (result, row) => {
        const balance = result.balance + Number(row.debit || 0) - Number(row.credit || 0);
        const entry = row.journal_entries as Row;
        const account = row.chart_of_accounts as Row;
        return {
          balance,
          rows: [
            ...result.rows,
            [
              dateValue(entry?.entry_date),
              entry?.entry_number,
              `${account?.code || ''} — ${account?.name || ''}`,
              entry?.reference || '—',
              row.label || entry?.narration || '—',
              money(row.debit),
              money(row.credit),
              money(balance),
            ],
          ],
        };
      },
      { balance: 0, rows: [] }
    );

    return (
      <ReportTable
        headers={['Date', 'Entry #', 'Account', 'Reference', 'Description', 'Debit', 'Credit', 'Running Balance']}
        rows={mapped.rows}
        footer={['', '', '', '', 'Totals', money(totalDebit), money(totalCredit), money(mapped.balance)]}
      />
    );
  }

  if (kind === 'trial-balance') {
    const rows = (data as Row[]) || [];
    const debit = rows.reduce((sum, row) => sum + Number(row.total_debit || 0), 0);
    const credit = rows.reduce((sum, row) => sum + Number(row.total_credit || 0), 0);

    return (
      <ReportTable
        headers={['Code', 'Account Name', 'Debit', 'Credit', 'Balance']}
        rows={rows.map((row) => [
          row.account_code,
          row.account_name,
          money(row.total_debit),
          money(row.total_credit),
          money(row.balance),
        ])}
        footer={['', 'Totals', money(debit), money(credit), money(debit - credit)]}
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
            <Statement title="Operating & Service Revenue" rows={report.income?.accounts || []} total={incomeTotal} />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
            <Statement title="Cost of Sales & Operating Expenses" rows={report.expense?.accounts || []} total={expenseTotal} />
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
    };
    const totalAssets = Number(report.assets?.total || 0);
    const totalLiab = Number(report.liabilities?.total || 0);
    const totalEq = Number(report.equity?.total || 0);
    const liabPlusEq = totalLiab + totalEq;
    const diff = Math.abs(totalAssets - liabPlusEq);
    const isBalanced = diff < 0.01;

    return (
      <div className="p-5 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
            <Statement title="Assets (Current & Non-Current)" rows={report.assets?.accounts || []} total={totalAssets} />
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
              <Statement title="Liabilities" rows={report.liabilities?.accounts || []} total={totalLiab} />
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
              <Statement title="Owner's Equity" rows={report.equity?.accounts || []} total={totalEq} />
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
    };
    return (
      <ReportTable
        headers={['Account', 'Account Number', 'Currency', 'Opening', 'Inflows', 'Outflows', 'Net Change', 'Closing']}
        rows={(report.accounts || []).map((row) => [
          row.account_name,
          row.account_number || '—',
          row.currency,
          money(row.opening_balance),
          money(row.inflows),
          money(row.outflows),
          money(row.net_change),
          money(row.closing_balance),
        ])}
      />
    );
  }

  const entries = (data as Row[]) || [];
  return (
    <div className="p-5 space-y-4">
      {entries.map((entry) => (
        <div key={String(entry.id)} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-zinc-100 pb-3">
            <div>
              <span className="font-bold text-base text-primary">{String(entry.entry_number || `#${entry.id}`)}</span>
              <span className="ml-3 text-xs text-muted-foreground">
                {dateValue(entry.entry_date)} · {String((entry.journals as Row)?.name || '')}
              </span>
            </div>
            <span className="text-xs font-medium text-zinc-600 bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200">
              {String(entry.reference || entry.narration || 'No reference')}
            </span>
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
function ReportTable({ headers, rows, footer, compact }: { headers: string[]; rows: unknown[][]; footer?: unknown[]; compact?: boolean }) {
  const [search, setSearch] = useState('');
  const tableRows = useMemo<ReportTableRow[]>(() => rows.map((values, index) => ({ id: index + 1, values })), [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? tableRows.filter((row) => row.values.some((value) => String(value ?? '').toLowerCase().includes(query))) : tableRows;
  }, [search, tableRows]);
  const columns = useMemo<DashboardTableColumn<ReportTableRow>[]>(() => headers.map((header, index) => ({
    key: `${header}-${index}`,
    header,
    align: index >= headers.length - 3 ? 'right' : 'left',
    className: compact ? 'text-[11px]' : undefined,
    cell: (row) => String(row.values[index] ?? '—'),
  })), [compact, headers]);
  const footerContent = footer ? <tfoot className="border-t-2 bg-muted/30 font-bold"><tr>{footer.map((value, index) => <td key={index} className={`px-4 py-3 ${index >= footer.length - 3 ? 'text-right' : ''}`}>{String(value ?? '')}</td>)}</tr></tfoot> : undefined;
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
function Statement({ title, rows, total }: { title: string; rows: Row[]; total: number }) { return <section className="mb-5"><h3 className="border-b pb-2 font-bold">{title}</h3>{rows.map((row) => <div key={String(row.account_id)} className="flex justify-between border-b border-dashed py-2 text-sm"><span>{String(row.account_code)} — {String(row.account_name)}</span><span className="tabular-nums">{money(row.balance)}</span></div>)}<div className="mt-2 flex justify-between rounded-lg bg-muted px-3 py-2 font-bold"><span>Total {title}</span><span>{money(total)}</span></div></section>; }

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
              tone === 'positive'
                ? 'text-emerald-600'
                : tone === 'negative'
                ? 'text-rose-600'
                : 'text-zinc-900'
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
function Empty({ text }: { text: string }) { return <div className="p-16 text-center text-sm text-muted-foreground">{text}</div>; }
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) { return <label className="text-xs font-semibold">{label}<input type="date" value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3" /></label>; }
function Select({ label, value, set, rows, optional, account }: { label: string; value: string; set: (value: string) => void; rows: Row[]; optional?: boolean; account?: boolean }) { return <label className="text-xs font-semibold">{label}{!optional && ' *'}<select required={!optional} value={value} onChange={(event) => set(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3"><option value="">{optional ? `All ${label.toLowerCase()}s` : `Select ${label.toLowerCase()}`}</option>{rows.map((row) => <option key={row.id} value={row.id}>{account ? `${String(row.code || '')} — ${String(row.name || '')}` : String(row.name || '')}</option>)}</select></label>; }
function flattenForExport(kind: FinancialReportKind, data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (kind === 'general-ledger') return (data as Row[]).map((row) => ({ date: dateValue((row.journal_entries as Row)?.entry_date), entry: (row.journal_entries as Row)?.entry_number, account: `${String((row.chart_of_accounts as Row)?.code || '')} ${String((row.chart_of_accounts as Row)?.name || '')}`, description: row.label, debit: row.debit, credit: row.credit }));
    if (kind === 'journal-report') return (data as Row[]).flatMap((entry) => ((entry.journal_items as Row[]) || []).map((line) => ({ date: dateValue(entry.entry_date), entry: entry.entry_number, journal: (entry.journals as Row)?.name, account: (line.chart_of_accounts as Row)?.code, label: line.label, debit: line.debit, credit: line.credit })));
    return data as Record<string, unknown>[];
  }
  const report = data as Record<string, unknown>;
  if (kind === 'profit-and-loss') return ['income', 'expense'].flatMap((group) => (((report[group] as { accounts: Row[] })?.accounts) || []).map((row) => ({ group, code: row.account_code, account: row.account_name, balance: row.balance })));
  if (kind === 'balance-sheet') return ['assets', 'liabilities', 'equity'].flatMap((group) => (((report[group] as { accounts: Row[] })?.accounts) || []).map((row) => ({ group, code: row.account_code, account: row.account_name, balance: row.balance })));
  if (kind === 'cash-flow') return (report.accounts as Record<string, unknown>[]) || [];
  return [];
}
