import api from "./axios";

export type TemplatePlaceholder = {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  width: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  isTable?: boolean;
};

export interface DocumentTemplate {
  id: number;
  name: string;
  type: "quotation" | "invoice";
  file_url?: string | null;
  html_content?: string | null;
  is_default: boolean;
  placeholders?: TemplatePlaceholder[] | null;
  created_at: string;
  updated_at: string;
}

export const documentTemplateApi = {
  getAll: async (type?: string): Promise<DocumentTemplate[]> => {
    const res = await api.get("/document-templates", { params: type ? { type } : {} });
    return res.data.data || [];
  },

  getById: async (id: number): Promise<DocumentTemplate> => {
    const res = await api.get(`/document-templates/${id}`);
    return res.data.data;
  },

  uploadBackground: async (dataUrl: string, fileName?: string): Promise<{ file_url: string }> => {
    const res = await api.post("/document-templates/upload", { dataUrl, fileName });
    return res.data.data;
  },

  create: async (data: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
    const res = await api.post("/document-templates", data);
    return res.data.data;
  },

  update: async (id: number, data: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
    const res = await api.put(`/document-templates/${id}`, data);
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/document-templates/${id}`);
  },

  getQuotationRenderUrl: (id: number) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
    return `${baseUrl}/api/document-templates/render/quotation/${id}`;
  },

  getInvoiceRenderUrl: (id: number) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
    return `${baseUrl}/api/document-templates/render/invoice/${id}`;
  },
};
