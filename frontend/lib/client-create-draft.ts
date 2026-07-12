const STORAGE_KEY = "deero-client-create-draft";

export type ClientCreateDraftState = {
  clientType: string;
  institution: string;
  phone: string;
  email: string;
  source: string;
  branchId: string;
  includeService: boolean;
  serviceName: string;
  subServiceName: string;
  customSubService: string;
  base: string;
  discount: string;
  serviceDescription: string;
  includeContract: boolean;
  contractStartDate: string;
  contractEndDate: string;
  monthlyBudget: string;
  includeSchedule: boolean;
  scheduleName: string;
  recurrenceType: string;
  scheduleStartDate: string;
  draftClientId?: string;
  step: number;
};

export function readClientCreateDraft(): ClientCreateDraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientCreateDraftState;
  } catch {
    return null;
  }
}

export function writeClientCreateDraft(state: ClientCreateDraftState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearClientCreateDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
