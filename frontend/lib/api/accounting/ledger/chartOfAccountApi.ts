import { createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
import api from '../../axios';

export type ChartOfAccount = AccountingRecord & {
  code?: string;
  name?: string;
  parent_id?: number | null;
  allow_manual_entry?: boolean;
  is_parent?: boolean;
  has_children?: boolean;
  allow_posting?: boolean;
  child_count?: number;
};

export const chartOfAccountApi = {
  ...createAccountingCrudApi<ChartOfAccount>('/accounting/chart-of-accounts'),
  remove: async (id: number): Promise<{ message?: string }> => {
    const response = await api.delete(`/accounting/chart-of-accounts/${id}`);
    return response.data;
  },
};
