import api from '../../axios';
import { accountingApiPath, createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';

export type ReceiptAllocation = {
  id?: number;
  invoice_id: number;
  allocated_amount: number;
  customer_invoices?: {
    id: number;
    invoice_number?: string;
    amount_total: number;
    amount_due: number;
    installment_id?: string | null;
    notes?: string | null;
    customer_reference?: string | null;
  };
};

export type ContractPaymentScheduleRow = {
  installment_number: number;
  milestone_label: string;
  percentage: number | null;
  amount: number;
  due_date: string | null;
  status: string;
  is_current?: boolean;
};

export type ContractPaymentSchedule = {
  available: boolean;
  message?: string;
  contract_id?: string;
  contract_number?: string | null;
  payment_terms?: string | null;
  contract_amount?: number;
  highlighted_installment_number?: number | null;
  linked_invoice_id?: number;
  installments?: ContractPaymentScheduleRow[];
};

export type CustomerReceipt = AccountingRecord & {
  receipt_number?: string;
  customer_id: number;
  journal_id: number;
  payment_method_id: number;
  receipt_date: string;
  currency_id: number;
  exchange_rate: number;
  amount: number;
  unallocated_amount: number;
  reference?: string | null;
  memo?: string | null;
  state: string;
  customers?: {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    client?: {
      contactPerson?: string;
      phone?: string;
      email?: string;
      institution?: string;
    };
  };
  currencies?: { id: number; code: string; symbol?: string };
  journals?: { id: number; name: string; code: string };
  payment_methods?: { id: number; name: string; code: string };
  receipt_allocations?: ReceiptAllocation[];
  contract_payment_schedule?: ContractPaymentSchedule | null;
  journal_entries?: {
    journal_items?: Array<{ account_id: number; chart_of_accounts?: { id: number; code: string; name: string } }>;
  };
};

const crud = createAccountingCrudApi<CustomerReceipt>('/accounting/customer-receipts');
export const customerReceiptApi = {
  ...crud,
  options: async (params: { customer_id: number; payment_method_id: number; currency_id?: number }) => {
    const response = await api.get(accountingApiPath('/accounting/customer-receipts/options'), { params });
    return response.data.data as {
      channel: string; company_currency_id: number; currency_id: number; selected_account_id?: number | null;
      accounts: Array<{ id: number; code: string; name: string; account_name: string; journal_id: number; journal_name: string; journal_code: string }>;
    };
  },
  outstandingInvoices: async (customerId: number) => {
    const response = await api.get(accountingApiPath('/accounting/customer-receipts/outstanding-invoices'), {
      params: { customer_id: customerId },
    });
    return response.data.data as Array<import('./customerInvoiceApi').CustomerInvoice & {
      advance_paid?: number;
      previously_paid?: number;
      remaining_balance?: number;
    }>;
  },
  availableAdvances: async (customerId: number, currencyId?: number) => {
    const response = await api.get(accountingApiPath('/accounting/customer-receipts/advances/available'), {
      params: { customer_id: customerId, ...(currencyId ? { currency_id: currencyId } : {}) },
    });
    return response.data as {
      success: boolean;
      data: CustomerReceipt[];
      summary: { advance_balance: number };
    };
  },
  post: async (id: number): Promise<CustomerReceipt> => {
    const response = await api.patch(accountingApiPath(`/accounting/customer-receipts/${id}/post`));
    return response.data.data;
  },
};
