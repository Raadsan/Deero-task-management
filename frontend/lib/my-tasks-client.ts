import { Task } from "@/lib/types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003").replace(/['\"]/g, "");



export type MyTasksScope = "personal" | "company" | "all";

function mapMyTask(task: Record<string, unknown>): Task {
  const user = task.user as {
    id?: string;
    name?: string;
    portfolioId?: string | null;
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
  // Must use the full backend URL — /api/my-tasks does NOT exist in Next.js routes
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
