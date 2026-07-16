"use server";

import api from "../api";
import { ActionResponse, ErrorResponse } from "../types";
import { handleError } from "../error/handle-error";

export type ServiceRecord = {
  id: string;
  serviceName: string;
  description?: string | null;
  iconUrl?: string | null;
  source?: "CUSTOM" | "ADVERT";
  serviceType?: "ONE_TIME" | "SUBSCRIPTION";
  portfolioId?: string | null;
  portfolio?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  subService?: SubServiceRecord[];
  _count?: { subService: number };
};

export type SubServiceRecord = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  features?: string[];
  categoryId: string;
  service?: {
    id: string;
    serviceName: string;
  };
};

export async function getAllServices(params?: {
  portfolioId?: string;
}): Promise<ActionResponse<ServiceRecord[]>> {
  try {
    const query = params?.portfolioId
      ? `?portfolioId=${encodeURIComponent(params.portfolioId)}`
      : "";
    const response = await api.get(`/api/services${query}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export type SubServiceInput = {
  id?: string;
  name: string;
  price?: number | null;
  currency?: string;
  features?: string[];
};

export async function syncAdvertServices(): Promise<ActionResponse<{ synced: number; portfolio: string }>> {
  try {
    const response = await api.post("/api/services/sync-advert");
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getServiceById(
  id: string,
): Promise<ActionResponse<ServiceRecord>> {
  try {
    const response = await api.get(`/api/services/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Service not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createService(data: {
  serviceName: string;
  description?: string;
  portfolioId: string;
  serviceType?: "ONE_TIME" | "SUBSCRIPTION";
  subServices?: SubServiceInput[] | string[];
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/services", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateService(
  id: string,
  data: {
    serviceName: string;
    description?: string;
    portfolioId: string;
    serviceType?: "ONE_TIME" | "SUBSCRIPTION";
    subServices?: SubServiceInput[];
  },
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/services/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteService(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/services/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createSubService(data: {
  name: string;
  categoryId: string;
  description?: string;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/services/sub", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateSubService(
  id: string,
  data: { name: string; categoryId?: string; description?: string },
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/services/sub/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteSubService(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/services/sub/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
