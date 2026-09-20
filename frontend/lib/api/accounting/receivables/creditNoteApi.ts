import api from '../../axios';
import { createAccountingCrudApi } from '../accountingCrud';
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
    original_outstanding_before?: number;
  } | null;
  customer_credit?: number;
  customer_invoices?: {
    id: number; invoice_number?: string; invoice_date: string;
    amount_total: number; amount_due: number; payment_state: string;
  };
};

const crud = createAccountingCrudApi<CreditNote>('/accounting/credit-notes');
export const creditNoteApi = {
  ...crud,
  post: async (id: number): Promise<CreditNote> => {
    const response = await api.patch(`/accounting/credit-notes/${id}/post`);
    return response.data.data;
  },
};
