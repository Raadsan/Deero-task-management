import { Task } from "@/lib/types";

import { API_URL } from "./config";



export type MyTasksScope = "personal" | "company" | "all";

function mapMyTask(task: Record<string, unknown>): Task {
  const user = task.user as {
    id?: string;
    name?: string;
    portfolioId?: string | null;
    image?: string | null;
    jobTitle?: string | null;
  } | null;
  const clientTask =
    (task.clientTask as Array<{
      Client?: { id?: string; institution?: string };
    }>) ?? [];

  return {
    ...(task as unknown as Task),
    assignedTo: {
      id: user?.id ?? "",
      name: user?.name ?? "Unassigned",
      portfolioId: user?.portfolioId ?? null,
      image: user?.image ?? null,
      jobTitle: user?.jobTitle ?? null,
    },
    isAssignedToCurrentUser: true,
    isPersonal: Boolean(task.isPersonal),
    institutions: clientTask.map((ct) => ({
      id: ct.Client?.id ?? "",
      institution: ct.Client?.institution ?? "",
      services: [],
    })),
  };
}

async function fetchMyTasksByScope(scope: MyTasksScope): Promise<Task[]> {
  // API_URL may be the same public domain; Nginx routes /api to the backend.
  const url = `${API_URL}/api/tasks/assigned/me?scope=${scope}`;

  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to load tasks (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    message?: string;
    data?: Record<string, unknown>[];
  };

  if (!data.success || !data.data) {
    throw new Error(data.error || data.message || "Failed to load tasks");
  }

  return data.data.map(mapMyTask);
}

/** Personal tasks only — My Tasks list / today */
export async function fetchMyPersonalTasks(): Promise<Task[]> {
  return fetchMyTasksByScope("personal");
}

/** Company tasks assigned to me — My Board company view */
export async function fetchMyCompanyTasks(): Promise<Task[]> {
  return fetchMyTasksByScope("company");
}

/** All assigned tasks — My Board (own + company tabs) */
export async function fetchMyTasks(): Promise<Task[]> {
  return fetchMyTasksByScope("all");
}


export async function patchMyTask(
  taskId: string,
  body: {
    progress?: number;
    status?: string;
    deadline?: string | null;
    description?: string;
    serviceInformation?: string;
    priority?: string;
    extraTimeMinutes?: number;
  },
): Promise<void> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    message?: string;
  };

  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || "Failed to update task");
  }
}
export type CreatePersonalTaskInput = {
  assgineeId: string;
  description: string;
  serviceInformation: string;
  priority: string;
  deadline: string | null;
};

export async function createPersonalTask(input: CreatePersonalTaskInput) {
  const response = await fetch(`${API_URL}/api/tasks`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, status: "pending", department: "General", supervisor: "", progress: 0, isPersonal: true, features: [{ name: "__board_only__", done: false }] }),
  });
  const data = (await response.json()) as { success?: boolean; error?: string; message?: string };
  if (!response.ok || !data.success) throw new Error(data.error || data.message || "Failed to create task");
  return data;
}
export async function proxyAssignedTasks(scope: MyTasksScope, cookie: string) {
  const response = await fetch(
    `${API_URL}/api/tasks/assigned/me?scope=${scope}`,
    { headers: { cookie }, cache: "no-store" },
  );
  return {
    body: await response.json(),
    status: response.status,
  };
}
