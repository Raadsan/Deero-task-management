"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "../constants";
import { handleError } from "../error/handle-error";
import api from "../api";
import { ActionResponse } from "../types";

export type ContractDocument = {
  id: string;
  version: number;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
};

export type ContractRecord = {
  id: string;
  contractNumber: string;
  startDate?: string | null;
  endDate?: string | null;
  renewalDate?: string | null;
  totalAmount?: number | null;
  paymentTerms?: string | null;
  status: string;
  notes?: string | null;
  clientId: string;
  projectId?: string | null;
  portfolioId?: string | null;
  client?: { id: string; institution: string; companyName?: string | null };
  project?: { id: string; name: string } | null;
  portfolio?: { id: string; name: string } | null;
  documents?: ContractDocument[];
  createdAt?: string;
};

export type ContractFilePayload = {
  name: string;
  data: string;
  fileSize?: number;
};

export async function getAllContracts(): Promise<
  ActionResponse<ContractRecord[]>
> {
  try {
    const response = await api.get("/api/contracts");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Failed to load contracts" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function getContractById(
  id: string,
): Promise<ActionResponse<ContractRecord>> {
  try {
    const response = await api.get(`/api/contracts/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Contract not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function getProjectsForClient(
  clientId: string,
): Promise<ActionResponse<Array<{ id: string; name: string }>>> {
  try {
    const response = await api.get(`/api/projects?clientId=${clientId}`);
    if (response.data.success) {
      const projects = (response.data.data ?? []).map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
      }));
      return { success: true, data: projects };
    }
    return { success: false, errors: { message: response.data.error ?? "Failed to load projects" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function createContract(payload: {
  clientId: string;
  projectId?: string;
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  totalAmount?: number;
  monthlyAmount?: number;
  billingDay?: number;
  paymentTerms?: string;
  status?: string;
  notes?: string;
  file?: ContractFilePayload;
}): Promise<ActionResponse<ContractRecord>> {
  try {
    const response = await api.post("/api/contracts", payload);
    if (response.data.success) {
      revalidatePath(ROUTES.contracts);
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Failed to create contract" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function updateContract(
  id: string,
  payload: Partial<{
    contractNumber: string;
    startDate: string | null;
    endDate: string | null;
    renewalDate: string | null;
    totalAmount: number | null;
    monthlyAmount: number | null;
    billingDay: number | null;
    paymentTerms: string;
    status: string;
    notes: string;
    projectId: string | null;
  }>,
): Promise<ActionResponse<ContractRecord>> {
  try {
    const response = await api.put(`/api/contracts/${id}`, payload);
    if (response.data.success) {
      revalidatePath(ROUTES.contracts);
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Failed to update contract" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function deleteContractById(
  id: string,
): Promise<ActionResponse<null>> {
  try {
    const response = await api.delete(`/api/contracts/${id}`);
    if (response.data.success) {
      revalidatePath(ROUTES.contracts);
      return { success: true, data: null };
    }
    return { success: false, errors: { message: response.data.error ?? "Failed to delete contract" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function uploadContractDocument(
  contractId: string,
  file: ContractFilePayload,
): Promise<ActionResponse<ContractDocument>> {
  try {
    const response = await api.post(`/api/contracts/${contractId}/documents`, {
      file,
    });
    if (response.data.success) {
      revalidatePath(ROUTES.contracts);
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Upload failed" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}
