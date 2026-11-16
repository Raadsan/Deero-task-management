"use server";

import api from "@/lib/apis/axios";
import { ActionResponse, ErrorResponse } from "@/lib/types";
import { handleError } from "@/lib/error/handle-error";

export type ServiceRecord = {
  id: string;
  serviceCode?: string | null;
  serviceName: string;
  description?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdById?: string | null;
  createdBy?: { id: string; name: string; email?: string } | null;
  iconUrl?: string | null;
  source?: "CUSTOM" | "ADVERT" | "LEGACY" | string;
  serviceType?: "ONE_TIME" | "SUBSCRIPTION";
  portfolioId?: string | null;
  portfolio?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  subService?: SubServiceRecord[];
  _count?: {
    subService?: number;
    clientService?: number;
    serviceAgreements?: number;
  };
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
  activeOnly?: boolean;
}): Promise<ActionResponse<ServiceRecord[]>> {
  try {
    const search = new URLSearchParams();
    if (params?.portfolioId) {
      search.set("portfolioId", params.portfolioId);
    }
    if (params?.activeOnly === true) {
      search.set("activeOnly", "true");
    }
    if (params?.activeOnly === false) {
      search.set("activeOnly", "false");
    }
    const query = search.toString() ? `?${search.toString()}` : "";
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

export type AdvertMainService = {
  externalId: string;
  serviceName: string;
  description?: string | null;
  iconUrl?: string | null;
  status: "Active" | "Inactive";
};

export async function getAdvertServicesCatalog(): Promise<
  ActionResponse<AdvertMainService[]>
> {
  try {
    const response = await api.get("/api/services/advert-catalog");
    if (response.data.success) {
      return { success: true, data: response.data.data ?? [] };
    }
    return {
      success: false,
      errors: { message: response.data.error ?? "Failed to load external services" },
      data: [],
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

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

export async function createMainService(data: {
  serviceName: string;
  description?: string;
  isActive?: boolean;
}): Promise<ActionResponse<ServiceRecord>> {
  try {
    const response = await api.post("/api/services", { ...data, mainOnly: true });
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateMainService(
  id: string,
  data: {
    serviceName: string;
    description?: string;
    isActive?: boolean;
  },
): Promise<ActionResponse<ServiceRecord>> {
  try {
    const response = await api.put(`/api/services/${id}`, { ...data, mainOnly: true });
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
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

export async function getAllSubServices(): Promise<ActionResponse<SubServiceRecord[]>> {
  try {
    const response = await api.get("/api/services/sub/all");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createSubService(data: {
  name: string;
  categoryId: string;
  description?: string;
  price?: number | null;
  currency?: string;
  features?: string[];
}): Promise<ActionResponse<SubServiceRecord>> {
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
  data: {
    name: string;
    categoryId?: string;
    description?: string;
    price?: number | null;
    currency?: string;
    features?: string[];
  },
): Promise<ActionResponse<SubServiceRecord>> {
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
