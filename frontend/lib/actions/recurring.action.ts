"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "../constants";
import { handleError } from "../error/handle-error";
import api from "../api";
import { ActionResponse } from "../types";
import type { RecurrenceType } from "../client-types";

export type RecurringScheduleStep = {
  id: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  intervalDays?: number | null;
  stepOrder: number;
  label: string;
  contentType?: string | null;
  department?: string | null;
  supervisor?: string;
  assigneeId?: string | null;
};

export type RecurringScheduleRecord = {
  id: string;
  name: string;
  recurrenceType: RecurrenceType;
  customRule?: string | null;
  contentType: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  autoGenerateTasks: boolean;
  clientId: string;
  client?: { id: string; institution: string; accountManagerId?: string | null };
  portfolio?: { id: string; name: string } | null;
  steps?: RecurringScheduleStep[];
  _count?: { cycles: number };
};

export type RecurringOccurrence = {
  id: string;
  scheduledDate: string;
  scheduleStep?: { id: string; label: string; dayOfWeek?: number | null };
  task?: {
    id: string;
    description: string;
    status: string;
    deadline?: string | null;
    user?: { id: string; name: string };
  };
};

export async function getAllRecurringSchedules(): Promise<
  ActionResponse<RecurringScheduleRecord[]>
> {
  try {
    const response = await api.get("/api/recurring-schedules");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return {
      success: false,
      errors: { message: response.data.error ?? "Failed to load schedules" },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function getRecurringScheduleById(
  id: string,
): Promise<ActionResponse<RecurringScheduleRecord>> {
  try {
    const response = await api.get(`/api/recurring-schedules/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Schedule not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function toggleRecurringSchedule(
  id: string,
): Promise<ActionResponse<RecurringScheduleRecord>> {
  try {
    const response = await api.patch(`/api/recurring-schedules/${id}/toggle`);
    if (response.data.success) {
      revalidatePath(ROUTES.recurringSchedules);
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Toggle failed" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function getRecurringOccurrences(
  scheduleId: string,
  limit = 100,
): Promise<ActionResponse<RecurringOccurrence[]>> {
  try {
    const response = await api.get(
      `/api/recurring-schedules/${scheduleId}/occurrences?limit=${limit}`,
    );
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Failed to load history" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}

export async function runRecurringDailyGeneration(
  scheduleId: string,
): Promise<ActionResponse<{ created: number; skipped: number }>> {
  try {
    const response = await api.post(
      `/api/recurring-schedules/${scheduleId}/run-daily`,
      {},
    );
    if (response.data.success) {
      revalidatePath(ROUTES.recurringSchedules);
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error ?? "Generation failed" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as any;
  }
}
