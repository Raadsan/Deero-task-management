"use server";

import { revalidatePath } from "next/cache";
import api from "../api";
import { ROUTES } from "../constants";
import { handleError } from "../error/handle-error";
import { ActionResponse, ErrorResponse, Task } from "../types";
import { getUserSession } from "./auth.action";

export async function createTask(task: any): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/tasks", task);
    if (response.data.success) {
      revalidatePath(ROUTES.tasks);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getTaskById(taskId: string): Promise<ActionResponse<Task>> {
  try {
    const response = await api.get(`/api/tasks/${taskId}`);
    if (response.data.success) {
      const task = response.data.data;
      return {
        success: true,
        data: {
          ...task,
          assignedTo: task.user,
          institutions: task.clientTask.map((ct: any) => ct.Client),
        } as unknown as Task
      };
    }
    return { success: false, errors: { message: "Task not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function editTask(params: any): Promise<ActionResponse> {
  try {
    const { taskId, ...data } = params;
    const response = await api.put(`/api/tasks/${taskId}`, data);
    if (response.data.success) {
      revalidatePath(ROUTES.tasks);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAllTasks(): Promise<ActionResponse<Task[]>> {
  try {
    const response = await api.get("/api/tasks");
    if (response.data.success) {
      const tasks = response.data.data.map((task: any) => ({
        ...task,
        assignedTo: task.user,
        institutions: task.clientTask.map((ct: any) => ct.Client),
      }));
      return { success: true, data: tasks as unknown as Task[] };
    }
    return { success: false, errors: { message: "Failed to fetch tasks" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteTask(taskId: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/tasks/${taskId}`);
    if (response.data.success) {
      revalidatePath(ROUTES.tasks);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAssginedTasks(): Promise<ActionResponse<Task[]>> {
  try {
    const session = await getUserSession();
    if (!session.data) return { success: false, errors: { message: "Unauthorized" } };
    
    const response = await api.get("/api/tasks");
    if (response.data.success) {
      const currentUserId = session.data.user.id;
      const tasks = response.data.data
        .filter((t: any) => t.assgineeId === currentUserId || t.supervisorId === currentUserId)
        .map((task: any) => ({
          ...task,
          assignedTo: task.user,
          isAssignedToCurrentUser: task.assgineeId === currentUserId,
          institutions: task.clientTask.map((ct: any) => ct.Client),
        }));
      return { success: true, data: tasks as unknown as Task[] };
    }
    return { success: false, errors: { message: "Failed to fetch assigned tasks" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getMonthlyDashbaordGraphData({
  startDate,
  endDate,
}: {
  startDate?: Date;
  endDate?: Date;
} = {}) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate.toISOString());
    if (endDate) params.set("endDate", endDate.toISOString());
    const response = await api.get(`/api/tasks/graph/monthly?${params.toString()}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getYearlyDashbaordGraph({
  startDate,
  endDate,
}: {
  startDate?: Date;
  endDate?: Date;
} = {}) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate.toISOString());
    if (endDate) params.set("endDate", endDate.toISOString());
    const response = await api.get(`/api/tasks/graph/yearly?${params.toString()}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getDashboardMetricData() { return { success: true, data: [] }; }
export async function getTasksReport() { return { success: true, data: { meta: {}, tasks: [] } }; }
export async function getTaskNotifications() { return { success: true, data: [] }; }
