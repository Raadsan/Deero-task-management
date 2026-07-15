"use server";

import api from "../api";
import { ActionResponse, ErrorResponse, Task } from "../types";
import { handleError } from "../error/handle-error";

function mapAssignedTo(user: {
  id?: string;
  name?: string;
  portfolioId?: string | null;
} | null | undefined) {
  if (!user?.id) {
    return { id: "", name: "Unassigned", portfolioId: null };
  }
  return {
    id: user.id,
    name: user.name ?? "Unassigned",
    portfolioId: user.portfolioId ?? null,
  };
}

function mapTask(task: {
  user?: { id?: string; name?: string; portfolioId?: string | null };
  clientTask?: Array<{ Client?: { id?: string; institution?: string } }>;
  [key: string]: unknown;
}) {
  return {
    ...task,
    assignedTo: mapAssignedTo(task.user),
    institutions: (task.clientTask ?? []).map((ct) => ({
      ...ct.Client,
    })),
  } as Task;
}

export type AdminDashboardBundle = {
  metrics: unknown[];
  chart: unknown[];
  sources: unknown[];
  payment: unknown[];
  tasks: unknown[];
};

export async function getAdminDashboardBundle(): Promise<
  ActionResponse<AdminDashboardBundle>
> {
  try {
    const [metricsRes, chartRes, sourcesRes, paymentRes, tasksRes] =
      await Promise.all([
        api.get("/api/tasks/metrics"),
        api.get("/api/tasks/graph/monthly"),
        api.get("/api/clients/sources/info"),
        api.get("/api/transactions/monthly-data", {
          params: { startDate: "", endDate: "" },
        }),
        api.get("/api/tasks"),
      ]);

    return {
      success: true,
      data: {
        metrics: metricsRes.data?.success ? metricsRes.data.data : [],
        chart: chartRes.data?.success ? chartRes.data.data : [],
        sources: sourcesRes.data?.success ? sourcesRes.data.data : [],
        payment: paymentRes.data?.success ? paymentRes.data.data : [],
        tasks: tasksRes.data?.success
          ? tasksRes.data.data.map((task: unknown) => mapTask(task as Parameters<typeof mapTask>[0]))
          : [],
      },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
