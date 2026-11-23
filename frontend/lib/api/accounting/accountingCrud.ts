import api from '../axios';

export interface AccountingRecord {
  id: number;
  [key: string]: unknown;
}

/** Browser uses same-origin `/api/*` rewrites; paths must not hit Next page routes. */
export function accountingApiPath(path: string) {
  if (path.startsWith('/api/')) return path;
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

export function createAccountingCrudApi<T extends AccountingRecord = AccountingRecord>(resource: string) {
  const base = accountingApiPath(resource);
  return {
    getAll: async (): Promise<T[]> => {
      const response = await api.get(base);
      return response.data.data || [];
    },
    getById: async (id: number): Promise<T> => {
      const response = await api.get(`${base}/${id}`);
      return response.data.data;
    },
    create: async (data: Omit<Partial<T>, 'id'>): Promise<T> => {
      const response = await api.post(base, data);
      return response.data.data;
    },
    update: async (id: number, data: Partial<T>): Promise<T> => {
      const response = await api.put(`${base}/${id}`, data);
      return response.data.data;
    },
    remove: async (id: number): Promise<{ message?: string }> => {
      const response = await api.delete(`${base}/${id}`);
      return response.data;
    },
  };
}
