"use server";

import { revalidatePath } from "next/cache";
import api from "@/lib/apis/axios";
import { ROUTES } from "@/lib/constants";
import { handleError } from "@/lib/error/handle-error";
import {
  ActionResponse,
  ErrorResponse,
  Task,
  TaskNotification,
} from "@/lib/types";
import { getUserSession } from "./authApi";

function mapAssignedTo(
  user:
    | {
        id?: string;
        name?: string;
        portfolioId?: string | null;
      }
    | null
    | undefined,
) {
  if (!user?.id) {
    return { id: "", name: "Unassigned", portfolioId: null };
  }
  return {
    id: user.id,
    name: user.name ?? "Unassigned",
    portfolioId: user.portfolioId ?? null,
  };
}

export async function createTask(task: any): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/tasks", task);
    if (response.data.success) {
      if (task?.isPersonal) {
        revalidatePath(ROUTES["my-tasks-board"]);
      } else {
        revalidatePath(ROUTES.tasks);
        revalidatePath(ROUTES["my-tasks"]);
        revalidatePath(ROUTES["my-tasks-board"]);
        revalidatePath(ROUTES["my-tasks-today"]);
      }
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getTaskById(
  taskId: string,
): Promise<ActionResponse<Task>> {
  try {
    const response = await api.get(`/api/tasks/${taskId}`);
    if (response.data.success) {
      const task = response.data.data;
      return {
        success: true,
        data: {
          ...task,
          assignedTo: mapAssignedTo(task.user),
          institutions: task.clientTask.map((ct: any) => ({
            ...ct.Client,
            services:
              ct.Client?.clientSubService
                ?.map((css: any) => css.subService?.name)
                .filter(Boolean) || [],
          })),
        } as unknown as Task,
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
      revalidatePath(ROUTES["my-tasks"]);
      revalidatePath(ROUTES["my-tasks-board"]);
      revalidatePath(ROUTES["my-tasks-today"]);
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
        assignedTo: mapAssignedTo(task.user),
        isPersonal: Boolean(task.isPersonal),
        institutions: task.clientTask.map((ct: any) => ({
          ...ct.Client,
          services:
            ct.Client?.clientSubService
              ?.map((css: any) => css.subService?.name)
              .filter(Boolean) || [],
        })),
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
    const response = await api.get("/api/tasks/assigned/me?scope=all");
    if (response.data.success) {
      const tasks = response.data.data.map((task: any) => ({
        ...task,
        assignedTo: mapAssignedTo(task.user),
        isAssignedToCurrentUser: true,
        isPersonal: Boolean(task.isPersonal),
        institutions: task.clientTask.map((ct: any) => ({
          ...ct.Client,
          services: [],
        })),
      }));
      return { success: true, data: tasks as unknown as Task[] };
    }
    return {
      success: false,
      errors: { message: response.data.error ?? "Failed to fetch assigned tasks" },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getMyAssignedTasks(): Promise<Task[]> {
  const result = await getAssginedTasks();
  if (!result.success) {
    // Return empty array but log error — don't throw so SWR shows fallback
    console.error("[getMyAssignedTasks] Failed:", result.errors?.message);
    return [];
  }
  return result.data ?? [];
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
    const response = await api.get(
      `/api/tasks/graph/monthly?${params.toString()}`,
    );
    if (response.data.success)
      return { success: true, data: response.data.data };
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
    const response = await api.get(
      `/api/tasks/graph/yearly?${params.toString()}`,
    );
    if (response.data.success)
      return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getDashboardMetricData({
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
    const response = await api.get(`/api/tasks/metrics?${params.toString()}`);
    if (response.data.success)
      return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
export async function getTasksReport({
  userIdForTaskReport,
  startDate,
  endDate,
}: {
  userIdForTaskReport: string;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const params = new URLSearchParams();
    params.set("userIdForTaskReport", userIdForTaskReport);
    if (startDate) params.set("startDate", startDate.toISOString());
    if (endDate) params.set("endDate", endDate.toISOString());

    const response = await api.get(
      `/api/tasks/report/data?${params.toString()}`,
    );
    if (response.data.success)
      return { success: true, data: response.data.data };
    return { success: false, data: { meta: {}, tasks: [] } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
export async function getTaskNotifications(
  userId?: string,
): Promise<ActionResponse<TaskNotification[]>> {
  try {
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const session = await getUserSession();
      effectiveUserId = session.data?.user.id;
    }
    if (!effectiveUserId) return { success: true, data: [] };

    const response = await api.get(
      `/api/notifications?userId=${effectiveUserId}`,
    );
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { success: false, data: [] };
  }
}

export async function markNotificationAsSeen(
  notificationId: string,
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/notifications/${notificationId}/seen`);
    if (response.data.success) {
      return { success: true };
    }
    return { success: false };
  } catch (error) {
    return { success: false };
  }
}

export async function updateTaskProgress(
  taskId: string,
  progress: number,
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/tasks/${taskId}`, { progress });
    if (response.data.success) {
      revalidatePath(ROUTES.tasks);
      revalidatePath(ROUTES["my-tasks"]);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
