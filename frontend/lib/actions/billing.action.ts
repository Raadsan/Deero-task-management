"use server";

import api from "../api";
import { ActionResponse, ErrorResponse } from "../types";
import { handleError } from "../error/handle-error";

export type ClientInstallmentRow = {
  id: string;
  clientId: string;
  clientName: string;
  contractId: string | null;
  contractNumber: string | null;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  balance: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  notes: string | null;
};

export type InstallmentSummary = {
  total: number;
  paid: number;
  unpaid: number;
  partial: number;
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
};

export async function getInstallments(params?: {
  tab?: "all" | "paid" | "unpaid" | "partial";
  clientId?: string;
  year?: string;
  month?: string;
}): Promise<
  ActionResponse<{ rows: ClientInstallmentRow[]; summary: InstallmentSummary }>
> {
  try {
    const search = new URLSearchParams();
    if (params?.tab && params.tab !== "all") search.set("tab", params.tab);
    if (params?.clientId) search.set("clientId", params.clientId);
    if (params?.year) search.set("year", params.year);
    if (params?.month) search.set("month", params.month);

    const qs = search.toString();
    const response = await api.get(
      `/api/billing/installments${qs ? `?${qs}` : ""}`,
    );

    if (response.data.success) {
      return {
        success: true,
        data: {
          rows: response.data.data,
          summary: response.data.summary,
        },
      };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getClientPaymentSummary(
  clientId: string,
): Promise<ActionResponse<{
  clientId: string;
  clientName: string | null;
  totalMonths: number;
  paidMonths: number;
  unpaidMonths: number;
  totalPaid: number;
  totalOutstanding: number;
  installments: ClientInstallmentRow[];
}>> {
  try {
    const response = await api.get(`/api/billing/clients/${clientId}/summary`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function recordInstallmentPayment(params: {
  installmentId: string;
  amount: number;
  notes?: string;
}): Promise<ActionResponse<ClientInstallmentRow>> {
  try {
    const response = await api.post(
      `/api/billing/installments/${params.installmentId}/record-payment`,
      { amount: params.amount, notes: params.notes },
    );
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getBillingReportData(params?: {
  tab?: string;
  year?: string;
  month?: string;
}): Promise<
  ActionResponse<{
    rows: ClientInstallmentRow[];
    chartByMonth: Array<{
      label: string;
      due: number;
      paid: number;
      balance: number;
      count: number;
    }>;
    summary: InstallmentSummary;
  }>
> {
  try {
    const search = new URLSearchParams();
    if (params?.tab) search.set("tab", params.tab);
    if (params?.year) search.set("year", params.year);
    if (params?.month) search.set("month", params.month);

    const qs = search.toString();
    const response = await api.get(
      `/api/billing/installments/report${qs ? `?${qs}` : ""}`,
    );

    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
