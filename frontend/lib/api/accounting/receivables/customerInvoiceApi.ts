import { accountingApiPath, createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type CustomerInvoiceLine = {
  id?: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_id?: number | null;
  income_account_id?: number;
  subtotal?: number;
  products?: { id: number; name: string; sku?: string };
  taxes?: { id: number; name: string; rate_percent: number; price_includes_tax: boolean };
};
export type CustomerInvoice = AccountingRecord & {
  invoice_number?: string;
  customer_id: number;
  invoice_date: string;
  due_date?: string | null;
  state: string;
  payment_state: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  paid_amount: number;
  amount_due: number;
  advance_credit_applied?: number;
  previous_outstanding_balance?: number;
  contract_installment_amount?: number;
  invoice_amount?: number;
  cash_paid?: number;
  net_amount?: number;
  display_status?: string;
  contract_id?: string | null;
  contract_number?: string | null;
  contract_title?: string | null;
  contract_duration?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  contract_amount?: number | null;
  contract_payment_terms?: string | null;
  project_name?: string | null;
  installment_number?: number | string | null;
  installment_percentage?: number | null;
  installment_milestone?: string | null;
  installment_due_date?: string | null;
  installment_label?: string | null;
  payment_history?: Array<{ date?: string; receipt_number?: string | null; method?: string | null; amount?: number; reference?: string | null }>;
  client?: { institution?: string; companyName?: string; contactPerson?: string; phone?: string; email?: string; address?: string };
  advance_paid?: number;
  previously_paid?: number;
  remaining_balance?: number;
  currency_id?: number;
  customer_reference?: string | null;
  notes?: string | null;
  customers?: { id: number; name: string; phone?: string; email?: string; client?: CustomerInvoice['client'] };
  currencies?: { id: number; code: string; symbol?: string };
  customer_invoice_lines?: CustomerInvoiceLine[];
};
const crud = createAccountingCrudApi<CustomerInvoice>('/accounting/customer-invoices');
export const customerInvoiceApi = {
  ...crud,
  post: async (id: number): Promise<CustomerInvoice> => {
    const response = await (await import('../../axios')).default.post(
      accountingApiPath(`/accounting/customer-invoices/${id}/post`),
    );
    return response.data.data;
  },
};
