"use server";

import api from "@/lib/apis/axios";
import { handleError } from "@/lib/error/handle-error";
import { ActionResponse, ErrorResponse } from "@/lib/types";

export type ProjectTaskRecord = {
  id: string;
  description: string;
  status: string;
  priority?: string;
  startDate?: string | null;
  deadline?: string | null;
  progress?: number;
  assgineeId?: string;
  features?: Record<string, unknown> | null;
  user?: { id: string; name: string } | null;
  transferHistory?: Array<{
    id: string;
    createdAt: string;
    reason?: string | null;
    note?: string | null;
    fromAssignee?: { name?: string } | null;
    toAssignee?: { name?: string } | null;
    transferredBy?: { name?: string } | null;
  }>;
};

export type ProjectRecord = {
  id: string;
  projectCode?: string | null;
  name: string;
  description?: string | null;
  status: string;
  lifecycleStatus?: string | null;
  billingMode?: string | null;
  archived?: boolean;
  isDraft?: boolean;
  priority?: string;
  projectType?: string;
  startDate?: string | null;
  dueDate?: string | null;
  clientId: string;
  contractId?: string | null;
  portfolioId?: string | null;
  scheduleConfig?: Record<string, unknown> | null;
  createdAt?: string;
  client?: { id: string; institution: string } | null;
  primaryContract?: {
    id: string;
    contractNumber: string;
    title?: string | null;
    duration?: string | null;
    endDate?: string | null;
    status?: string;
  } | null;
  serviceLinks?: Array<{
    id: string;
    service?: { id: string; serviceName: string; serviceCode?: string | null };
    subServices?: Array<{
      id: string;
      name: string;
      description?: string | null;
      quantity: number;
      unit: string;
      targetQuantity: number;
      assigneeId?: string | null;
      assignee?: { id: string; name: string } | null;
    }>;
  }>;
  cycles?: Array<{ id: string; label: string; startDate: string; endDate: string }>;
  extraRequests?: Array<{
    id: string;
    quantity: number;
    description?: string | null;
    status: string;
    createdAt?: string;
    requestedBy?: { id: string; name: string } | null;
    subService?: {
      id: string;
      name: string;
      link?: { service?: { id: string; serviceName: string } | null } | null;
    } | null;
  }>;
  tasks?: ProjectTaskRecord[];
  portfolio?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  _count?: { tasks?: number; contentRequests?: number };
};

export type ProjectSummary = {
  total: number;
  active: number;
  monthly: number;
  oneTime: number;
  completed: number;
  onHold: number;
};

export async function getAllProjects(params?: {
  clientId?: string;
  status?: string;
}): Promise<ActionResponse<ProjectRecord[]>> {
  try {
    const search = new URLSearchParams();
    if (params?.clientId) search.set("clientId", params.clientId);
    if (params?.status) search.set("status", params.status);
    const query = search.toString() ? `?${search.toString()}` : "";
    const response = await api.get(`/api/projects${query}`);
    if (response.data.success) {
      return { success: true, data: response.data.data ?? [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getProjectById(
  id: string,
): Promise<ActionResponse<ProjectRecord>> {
  try {
    const response = await api.get(`/api/projects/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Project not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getProjectSummary(): Promise<ActionResponse<ProjectSummary>> {
  try {
    const response = await api.get("/api/projects/summary");
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function registerProject(data: Record<string, unknown>): Promise<ActionResponse<ProjectRecord>> {
  try {
    const response = await api.post("/api/projects/register", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function archiveProject(id: string): Promise<ActionResponse> {
  try {
    const response = await api.post(`/api/projects/${id}/archive`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteProject(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/projects/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error || "Could not delete project" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function reassignProjectTask(
  projectId: string,
  taskId: string,
  data: { assigneeId: string; reason: string; note?: string },
): Promise<ActionResponse> {
  try {
    const response = await api.post(`/api/projects/${projectId}/tasks/${taskId}/reassign`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createProjectExtra(
  projectId: string,
  data: { subServiceId: string; quantity: number; reason: string },
): Promise<ActionResponse> {
  try {
    const response = await api.post(`/api/projects/${projectId}/extra-requests`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function decideProjectExtra(
  projectId: string,
  requestId: string,
  data: {
    decision: "APPROVED" | "REJECTED";
    assigneeId?: string;
    scheduledDate?: string;
    startTime?: string;
    endTime?: string;
  },
): Promise<ActionResponse> {
  try {
    const response = await api.post(`/api/projects/${projectId}/extra-requests/${requestId}/decision`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function startProjectCycle(projectId: string): Promise<ActionResponse> {
  try {
    const response = await api.post(`/api/projects/${projectId}/cycles`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
