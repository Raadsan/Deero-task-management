import api from '../../axios';
import { accountingApiPath, createAccountingCrudApi, type AccountingRecord } from '../accountingCrud';
export type JournalEntry = AccountingRecord;
const crud = createAccountingCrudApi<JournalEntry>('/accounting/journal-entries');
export const journalEntryApi = {
  ...crud,
  post: async (id: number): Promise<JournalEntry> => {
    const response = await api.patch(accountingApiPath(`/accounting/journal-entries/${id}/post`));
    return response.data.data;
  },
};
