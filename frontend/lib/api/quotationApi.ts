import api from "./axios";

export interface QuotationLine {
  id?: number;
  sequence?: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_id?: number | null;
  subtotal?: number;
  products?: { id: number; name: string; sku?: string };
  taxes?: { id: number; name: string; rate_percent: number };
}

export interface Quotation {
  id: number;
  company_id?: number;
  quotation_number: string;
  client_id?: string | null;
  customer_id?: number | null;
  date: string;
  valid_until?: string | null;
  currency_id?: number;
  currencies?: { id: number; code: string; symbol?: string | null };
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED";
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  notes?: string | null;
  terms?: string | null;
  converted_invoice_id?: number | null;
  created_at: string;
  updated_at: string;
  client?: { id: string; institution: string; email?: string; phone?: string };
  customer?: { id: number; name: string; email?: string; phone?: string };
  lines?: QuotationLine[];
  converted_invoice?: {
    id: number;
    invoice_number: string;
    state: string;
    payment_state: string;
    amount_total: number;
  };
}

export const quotationApi = {
  getAll: async (params?: Record<string, any>): Promise<Quotation[]> => {
    const res = await api.get("/accounting/quotations", { params });
    return res.data.data || [];
  },

  getById: async (id: number): Promise<Quotation> => {
    const res = await api.get(`/accounting/quotations/${id}`);
    return res.data.data;
  },

  create: async (data: Partial<Quotation> & { lines: QuotationLine[] }): Promise<Quotation> => {
    const res = await api.post("/accounting/quotations", data);
    return res.data.data;
  },

  update: async (id: number, data: Partial<Quotation> & { lines?: QuotationLine[] }): Promise<Quotation> => {
    const res = await api.put(`/accounting/quotations/${id}`, data);
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/accounting/quotations/${id}`);
  },

  convertToInvoice: async (id: number): Promise<{ quotation: Quotation; invoice: any; journalEntry: any }> => {
    const res = await api.post(`/accounting/quotations/${id}/convert-to-invoice`);
    return res.data.data;
  },
};
