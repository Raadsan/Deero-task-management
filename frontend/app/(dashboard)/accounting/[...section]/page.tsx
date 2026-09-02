import { Landmark } from 'lucide-react';
import { redirect } from 'next/navigation';
import ConfigurationCrudPage from '@/components/accounting/ConfigurationCrudPage';
import AccountingServicesPage from '@/components/accounting/AccountingServicesPage';
import AccountingProductsPage from '@/components/accounting/AccountingProductsPage';
import ChartOfAccountsPage from '@/components/accounting/ChartOfAccountsPage';
import FiscalManagementPage from '@/components/accounting/FiscalManagementPage';
import GeneralLedgerPage from '@/components/accounting/GeneralLedgerPage';
import PartnerMasterDataPage from '@/components/Shared/PartnerMasterDataPage';
import CustomerInvoicesPage from '@/components/accounting/CustomerInvoicesPage';
import CustomerReceiptsPage from '@/components/accounting/CustomerReceiptsPage';
import CreditNotesPage from '@/components/accounting/CreditNotesPage';
import VendorBillsPage from '@/components/accounting/VendorBillsPage';
import VendorPaymentsPage from '@/components/accounting/VendorPaymentsPage';
import BankingSetupPage from '@/components/accounting/BankingSetupPage';
import CashTransactionsPage from '@/components/accounting/CashTransactionsPage';
import FinancialReportsPage, { type FinancialReportKind } from '@/components/accounting/FinancialReportsPage';

const CONFIGURATION_SECTIONS = new Set([
  'account-types', 'currencies', 'companies', 'payment-methods',
  'payment-terms', 'taxes',
]);

const TITLES: Record<string, string> = {
  'account-types': 'Account Types',
  currencies: 'Currencies',
  companies: 'Companies',
  'payment-methods': 'Payment Methods',
  'payment-terms': 'Payment Terms',
  taxes: 'Taxes',
  'product-categories': 'Service Categories',
  configuration: 'Accounting Configuration',
  'chart-of-accounts': 'Chart of Accounts',
  fiscal: 'Fiscal Management',
  'fiscal-years': 'Fiscal Years',
  'fiscal-periods': 'Fiscal Periods',
  ledger: 'General Ledger',
  journals: 'Journals',
  'journal-entries': 'Journal Entries',
  receivables: 'Receivables',
  customers: 'Customers',
  'customer-invoices': 'Customer Invoices',
  'customer-receipts': 'Customer Receipts',
  'credit-notes': 'Credit Notes',
  payables: 'Payables',
  vendors: 'Vendors',
  'vendor-bills': 'Vendor Bills',
  'vendor-payments': 'Vendor Payments',
  'vendor-refunds': 'Vendor Refunds',
  banking: 'Banking',
  'bank-accounts': 'Bank Accounts',
  'cash-transactions': 'Cash Transactions',
  products: 'Services & Sub-Services Catalog',
  reports: 'Financial Reports',
  'general-ledger': 'General Ledger Report',
  'trial-balance': 'Trial Balance',
  'profit-and-loss': 'Profit & Loss',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow',
  'journal-report': 'Journal Report',
};

interface Props {
  params: Promise<{
    section?: string[];
  }>;
}

export default async function AccountingDynamicSectionPage({ params }: Props) {
  const resolved = await params;
  const sections = resolved.section || [];
  const key = sections.join('/') || sections[0] || 'dashboard';
  const title = TITLES[key] || 'Accounting Workspace';

  if (key === 'product-categories') {
    return <AccountingServicesPage />;
  }

  if (key === 'products') {
    return <AccountingProductsPage />;
  }

  if (CONFIGURATION_SECTIONS.has(key)) {
    return <ConfigurationCrudPage section={key} />;
  }

  if (key === 'configuration') {
    return <ConfigurationCrudPage section="account-types" />;
  }

  if (key === 'chart-of-accounts') {
    return <ChartOfAccountsPage />;
  }

  if (key === 'fiscal' || key === 'fiscal-management' || key === 'fiscal-years' || key === 'fiscal-periods') {
    const fiscalKind = key === 'fiscal-periods' ? 'fiscal-periods' : 'fiscal-years';
    return <FiscalManagementPage kind={fiscalKind as 'fiscal-years' | 'fiscal-periods'} />;
  }

  if (key === 'ledger' || key === 'journals' || key === 'journal-entries') {
    const ledgerKind = key === 'journals' ? 'journals' : 'journal-entries';
    return <GeneralLedgerPage kind={ledgerKind as 'journals' | 'journal-entries'} />;
  }

  if (key === 'customers') {
    return <PartnerMasterDataPage kind="customer" />;
  }

  if (key === 'receivables') {
    return <PartnerMasterDataPage kind="customer" />;
  }

  if (key === 'vendors' || key === 'payables') {
    return <PartnerMasterDataPage kind="vendor" />;
  }

  if (key === 'customer-invoices') {
    return <CustomerInvoicesPage />;
  }

  if (key === 'customer-receipts') {
    return <CustomerReceiptsPage />;
  }

  if (key === 'credit-notes') {
    return <CreditNotesPage />;
  }

  if (key === 'vendor-bills') {
    return <VendorBillsPage />;
  }

  if (key === 'vendor-payments') {
    return <VendorPaymentsPage />;
  }

  if (key === 'vendor-refunds') {
    return <VendorBillsPage kind="refund" />;
  }

  if (key === 'bank-accounts' || key === 'banking' || key === 'banks') {
    return <BankingSetupPage />;
  }

  if (key === 'cash-transactions') {
    return <CashTransactionsPage />;
  }

  if (['reports', 'general-ledger', 'trial-balance', 'profit-and-loss', 'balance-sheet', 'cash-flow', 'journal-report'].includes(key)) {
    const reportKind = key === 'reports' ? 'general-ledger' : key;
    return <FinancialReportsPage kind={reportKind as FinancialReportKind} />;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Landmark className="size-6" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary">Accounting Workspace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1e293b]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          This module is connected to the Accounting sidebar and its backend services.
        </p>
      </div>
    </div>
  );
}
