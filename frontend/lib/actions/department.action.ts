"use server";

import api from "../api";
import { handleError } from "../error/handle-error";
import { ActionResponse, ErrorResponse } from "../types";

export type DepartmentRecord = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  portfolioId: string;
  portfolio?: { id: string; name: string };
  createdAt?: string;
  updatedAt?: string;
};

export async function getAllDepartments(params?: {
  portfolioId?: string;
  activeOnly?: boolean;
}): Promise<ActionResponse<DepartmentRecord[]>> {
  try {
    const search = new URLSearchParams();
    if (params?.portfolioId) search.set("portfolioId", params.portfolioId);
    if (params?.activeOnly) search.set("activeOnly", "true");
    const query = search.toString();
    const response = await api.get(`/api/departments${query ? `?${query}` : ""}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getDepartmentById(
  id: string,
): Promise<ActionResponse<DepartmentRecord>> {
  try {
    const response = await api.get(`/api/departments/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Department not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createDepartment(data: {
  name: string;
  description?: string;
  isActive?: boolean;
  portfolioId: string;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/departments", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateDepartment(
  id: string,
  data: {
    name: string;
    description?: string;
    isActive?: boolean;
    portfolioId: string;
  },
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/departments/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteDepartment(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/departments/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
