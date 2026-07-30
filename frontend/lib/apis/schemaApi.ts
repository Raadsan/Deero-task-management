"use server";

import api from "./axios";

export interface ClientSchemaRecord {
  id: string;
  clientId: string;
  portfolioId?: string | null;
  saturday?: string | null;
  sunday?: string | null;
  monday?: string | null;
  tuesday?: string | null;
  wednesday?: string | null;
  thursday?: string | null;
  friday?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    institution: string;
    companyName?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    clientType?: string | null;
    portfolioId?: string | null;
  };
  portfolio?: {
    id: string;
    name: string;
  };
}

export async function getAllSchemas(): Promise<{ success: boolean; data?: ClientSchemaRecord[]; errors?: { message: string } }> {
  try {
    const response = await api.get("/api/contracts/schemas");
    return response.data;
  } catch (err: any) {
    return { success: false, errors: { message: err.message || "Failed to fetch schemas" } };
  }
}

export async function createOrUpdateSchema(payload: {
  id?: string;
  clientId: string;
  saturday?: string;
  sunday?: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: ClientSchemaRecord; errors?: { message: string } }> {
  try {
    const response = await api.post("/api/contracts/schemas", payload);
    return response.data;
  } catch (err: any) {
    return { success: false, errors: { message: err.message || "Failed to save schema" } };
  }
}

export async function deleteSchema(id: string): Promise<{ success: boolean; message?: string; errors?: { message: string } }> {
  try {
    const response = await api.delete(`/api/contracts/schemas/${id}`);
    return response.data;
  } catch (err: any) {
    return { success: false, errors: { message: err.message || "Failed to delete schema" } };
  }
}
