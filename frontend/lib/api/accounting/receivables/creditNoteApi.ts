import api from '../../axios';
import { accountingApiPath, createAccountingCrudApi } from '../accountingCrud';
import type { CustomerInvoice } from './customerInvoiceApi';

export type CreditNote = CustomerInvoice & {
  reversed_invoice_id: number;
  customer_reference?: string | null;
  notes?: string | null;
  reason?: string | null;
  line_meta?: Array<{
    original_line_id: number;
    quantity: number;
    description?: string;
    unit_price?: number;
    discount_percent?: number;
    tax_id?: number | null;
    income_account_id?: number;
  }>;
  settlement?: {
    applied_to_ar?: number;
    customer_credit?: number;
    refund_payable?: number;
    original_outstanding_before?: number;
    settlement_method?: string;
  } | null;
  settlement_method?: 'customer_credit' | 'cash_refund';
  refund_status?: 'not_refunded' | 'partially_refunded' | 'refunded';
  refund_payable?: number;
  refund_paid?: number;
  refund_payments?: Array<{
    id: number;
    amount: number;
    payment_date?: string;
    reference?: string | null;
    notes?: string | null;
    journal_entry_id?: number;
    payment_method_id?: number;
  }>;
  customer_credit?: number;
  customer_credit_status?: 'available' | 'partially_applied' | 'fully_applied' | null;
  display_state?: string;
  customer_invoices?: {
    id: number; invoice_number?: string; invoice_date: string;
    amount_total: number; amount_due: number; payment_state: string;
  };
};

export type CreditableInvoiceLine = {
  original_line_id: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  credited_quantity: number;
  remaining_quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_id?: number | null;
  income_account_id: number;
  tax_rate: number;
  price_includes_tax: boolean;
};

export type CreditableInvoicePayload = {
  invoice: {
    id: number;
    invoice_number?: string;
    invoice_date: string;
    amount_total: number;
    amount_due: number;
    paid_amount: number;
    payment_state: string;
    customer_id: number;
    customers?: { id: number; name: string };
    currencies?: { id: number; code?: string; symbol?: string };
  };
  creditable_amount: number;
  credited_amount: number;
  lines: CreditableInvoiceLine[];
};

const crud = createAccountingCrudApi<CreditNote>('/accounting/credit-notes');
export const creditNoteApi = {
  ...crud,
  getCreditableInvoice: async (invoiceId: number, excludeCreditId?: number): Promise<CreditableInvoicePayload> => {
    const response = await api.get(accountingApiPath(`/accounting/credit-notes/creditable-invoices/${invoiceId}`), {
      params: excludeCreditId ? { exclude_credit_id: excludeCreditId } : undefined,
    });
    return response.data.data;
  },
  post: async (id: number): Promise<CreditNote> => {
    const response = await api.patch(accountingApiPath(`/accounting/credit-notes/${id}/post`));
    return response.data.data;
  },
  cancel: async (id: number): Promise<CreditNote> => {
    const response = await api.patch(accountingApiPath(`/accounting/credit-notes/${id}/cancel`));
    return response.data.data;
  },
  recordRefund: async (
    id: number,
    payload: { amount: number; payment_date: string; payment_method_id: number; reference?: string; notes?: string }
  ): Promise<CreditNote> => {
    const response = await api.post(accountingApiPath(`/accounting/credit-notes/${id}/refund`), payload);
    return response.data.data;
  },
};
