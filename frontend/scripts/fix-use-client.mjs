import fs from 'fs';

const files = [
  'components/accounting/CreditNotesPage.tsx',
  'components/accounting/ChartOfAccountsPage.tsx',
  'components/accounting/GeneralLedgerPage.tsx',
  'components/accounting/CustomerReceiptsPage.tsx',
  'components/accounting/FiscalManagementPage.tsx',
  'components/accounting/VendorPaymentsPage.tsx',
  'components/accounting/CashTransactionsPage.tsx',
  'components/accounting/CustomerInvoicesPage.tsx',
  'components/accounting/FinancialReportsPage.tsx',
  'components/accounting/VendorBillsPage.tsx',
];

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  const bad = /^import \{ accountingToast \} from '@\/lib\/accounting-ui';\n'use client';\n\n/;
  if (bad.test(c)) {
    c = c.replace(bad, "'use client';\n\nimport { accountingToast } from '@/lib/accounting-ui';\n");
    fs.writeFileSync(f, c);
    console.log('fixed', f);
  }
}
