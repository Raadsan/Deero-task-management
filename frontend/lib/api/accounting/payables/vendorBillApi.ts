import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type VendorBillLine = {
  id?: number;
  product_id?: number | null;
  line_type?: 'product' | 'expense';
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_id?: number | null;
  expense_account_id?: number | null;
  amount?: number;
  subtotal?: number;
};
export type VendorBill = AccountingRecord & {
  bill_number?: string;
  vendorBillNo?: string;
  vendor_id: number;
  vendor_reference?: string | null;
  currency_id: number;
  exchange_rate?: number;
  reversed_bill_id?: number | null;
  bill_date: string;
  received_date?: string | null;
  due_date?: string | null;
  payment_term_id?: number | null;
  state: string;
  payment_state: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  amount_paid?: number;
  amount_due: number;
  display_status?: string;
  notes_text?: string | null;
  refund_type?: 'full' | 'partial' | null;
  refund_reason?: string | null;
  receive_payment?: {
    enabled?: boolean;
    payment_method_id?: number | null;
    bank_account_id?: number | null;
    payment_reference?: string | null;
    receive_account_id?: number | null;
  } | null;
  pending_payment?: {
    enabled?: boolean;
    payment_method_id?: number | null;
    bank_account_id?: number | null;
    amount?: number;
    payment_reference?: string | null;
    advance_amount?: number;
  } | null;
  vendors?: { id: number; name: string; phone?: string; email?: string; vendor_code?: string };
  currencies?: { id: number; code: string; symbol?: string };
  payment_terms?: { id: number; name: string };
  vendor_bill_lines?: VendorBillLine[];
};
export type VendorRefundable = {
  bill_id: number;
  bill_number?: string;
  original_total: number;
  amount_paid: number;
  previously_refunded: number;
  max_refundable: number;
};
const bills = createAccountingCrudApi<VendorBill>('/accounting/vendor-bills');
export const vendorBillApi = {
  ...bills,
  post: async (id: number, payment: { advance_amount?: number; pay_vendor_now?: boolean; payment_method_id?: number; bank_account_id?: number; amount_paid?: number; payment_reference?: string } = {}): Promise<VendorBill> => {
    const response = await (await import('../../axios')).default.post(`/accounting/vendor-bills/${id}/post`, payment);
    return response.data.data;
  },
};
const refunds = createAccountingCrudApi<VendorBill>('/accounting/vendor-bills/refunds');
export const vendorRefundApi = {
  ...refunds,
  getRefundable: async (billId: number, excludeRefundId?: number): Promise<VendorRefundable> => {
    const response = await (await import('../../axios')).default.get(`/accounting/vendor-bills/refunds/refundable/${billId}`, {
      params: excludeRefundId ? { exclude_refund_id: excludeRefundId } : undefined,
    });
    return response.data.data;
  },
  post: async (id: number): Promise<VendorBill> => {
    const response = await (await import('../../axios')).default.post(`/accounting/vendor-bills/refunds/${id}/post`);
    return response.data.data;
  },
};
