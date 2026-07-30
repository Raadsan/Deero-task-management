"use server";

import api from "@/lib/apis/axios";
import { ActionResponse, ErrorResponse, Task } from "@/lib/types";
import { handleError } from "@/lib/error/handle-error";

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
  clients: unknown[];
};

export async function getAdminDashboardBundle(): Promise<
  ActionResponse<AdminDashboardBundle>
> {
  try {
    const [metricsRes, chartRes, tasksRes, clientsRes] = await Promise.all([
      api.get("/api/tasks/metrics"),
      api.get("/api/tasks/graph/monthly"),
      api.get("/api/tasks"),
      api.get("/api/clients"),
    ]);

    return {
      success: true,
      data: {
        metrics: metricsRes.data?.success ? metricsRes.data.data : [],
        chart: chartRes.data?.success ? chartRes.data.data : [],
        sources: [],
        payment: [],
        tasks: tasksRes.data?.success
          ? tasksRes.data.data.map((task: unknown) =>
              mapTask(task as Parameters<typeof mapTask>[0]),
            )
          : [],
        clients: clientsRes.data?.success ? clientsRes.data.data : [],
      },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

// --- Staff personal dashboard ---
export type MyDashboardBundle = {
  tasks: Task[];
};

export async function getMyDashboardBundle(): Promise<
  ActionResponse<MyDashboardBundle>
> {
  try {
    const res = await api.get("/api/tasks/assigned/me?scope=all");
    const tasks: Task[] = res.data?.success
      ? (res.data.data as Parameters<typeof mapTask>[0][]).map(mapTask)
      : [];
    return { success: true, data: { tasks } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

// --- Manager dashboard ---
export type ManagerDashboardBundle = {
  myTasks: Task[];
  allTasks: Task[];
  chart: unknown[];
};

export async function getManagerDashboardBundle(): Promise<
  ActionResponse<ManagerDashboardBundle>
> {
  try {
    const [myRes, allRes, chartRes] = await Promise.all([
      api.get("/api/tasks/assigned/me?scope=all"),
      api.get("/api/tasks"),
      api.get("/api/tasks/graph/monthly"),
    ]);
    const myTasks: Task[] = myRes.data?.success
      ? (myRes.data.data as Parameters<typeof mapTask>[0][]).map(mapTask)
      : [];
    const allTasks: Task[] = allRes.data?.success
      ? (allRes.data.data as Parameters<typeof mapTask>[0][]).map(mapTask)
      : [];
    return {
      success: true,
      data: {
        myTasks,
        allTasks,
        chart: chartRes.data?.success ? chartRes.data.data : [],
      },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
