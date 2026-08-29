import fs from 'fs';
import path from 'path';

const root = path.resolve('components');
const files = [
  'accounting/ChartOfAccountsPage.tsx',
  'accounting/GeneralLedgerPage.tsx',
  'accounting/FiscalManagementPage.tsx',
  'accounting/FinancialReportsPage.tsx',
  'accounting/CustomerReceiptsPage.tsx',
  'accounting/CustomerInvoicesPage.tsx',
  'accounting/CreditNotesPage.tsx',
  'accounting/VendorBillsPage.tsx',
  'accounting/VendorPaymentsPage.tsx',
  'accounting/CashTransactionsPage.tsx',
  '../components/quotations/QuotationModal.tsx',
  '../components/quotations/QuotationViewModal.tsx',
].map((f) => path.join(root, f.replace('../components/', '')));

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log('skip missing', file);
    continue;
  }
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;

  c = c.replace(/import \{ useToast \} from ['"]@\/components\/ui\/toast['"];\n?/g, '');
  c = c.replace(/const \{ showToast \} = useToast\(\);\n?/g, '');
  c = c.replace(/showToast\(([^,]+),\s*['"]error['"]\)/g, 'accountingToast($1, \'error\')');
  c = c.replace(/showToast\(([^,]+),\s*['"]success['"]\)/g, 'accountingToast($1)');
  c = c.replace(/showToast\(([^)]+)\)/g, 'accountingToast($1)');
  c = c.replace(/,\s*showToast/g, '');
  c = c.replace(/\[\s*showToast\s*\]/g, '[]');

  if (!c.includes("accountingToast") && orig.includes('showToast')) {
    console.log('WARN: showToast remains in', file);
  }

  if (c.includes('accountingToast') && !c.includes("from '@/lib/accounting-ui'") && !c.includes('from "@/lib/accounting-ui"')) {
    const importLine = "import { accountingToast } from '@/lib/accounting-ui';\n";
    const useClient = c.match(/^['"]use client['"];\n\n/);
    if (useClient) c = c.replace(useClient[0], useClient[0] + importLine);
    else c = importLine + c;
  }

  if (c !== orig) {
    fs.writeFileSync(file, c);
    console.log('updated', path.relative(process.cwd(), file));
  }
}
