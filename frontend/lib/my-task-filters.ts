import { Task } from "@/lib/types";

export type BoardView = "company" | "own" | "timeline" | "table";

export const BOARD_ONLY_FEATURE_NAME = "__board_only__";

export function isBoardOnlyTask(task: Task): boolean {
  return Array.isArray(task.features) && task.features.some((feature) => feature?.name === BOARD_ONLY_FEATURE_NAME);
}

export function isOwnTask(task: Task): boolean {
  return Boolean(task.isPersonal);
}

export function isCompanyTask(task: Task): boolean {
  return !task.isPersonal;
}

export function normalizeMyTasksList(input: unknown): Task[] {
  if (Array.isArray(input)) return input as Task[];
  if (
    input &&
    typeof input === "object" &&
    "data" in input &&
    Array.isArray((input as { data: unknown }).data)
  ) {
    return (input as { data: Task[] }).data;
  }
  return [];
}

function filterBoardTasksBase(
  tasks: unknown,
  view: BoardView,
  search: string,
): Task[] {
  let list = normalizeMyTasksList(tasks);

  if (view === "company") {
    list = list.filter(isCompanyTask);
  } else if (view === "own" || view === "table") {
    list = list.filter(isOwnTask);
  }

  const query = search.trim().toLowerCase();
  if (query) {
    list = list.filter((task) => {
      const title = (task.serviceInformation || task.description || "").toLowerCase();
      const id = String(task.id ?? "").toLowerCase();
      return title.includes(query) || id.includes(query);
    });
  }

  return list;
}

/** Kanban columns — lane is the status; do not hide tasks when status changes on drag */
export function filterBoardTasksForLanes(
  tasks: unknown,
  view: BoardView,
  search: string,
): Task[] {
  return filterBoardTasksBase(tasks, view, search);
}

export function filterBoardTasks(
  tasks: unknown,
  view: BoardView,
  search: string,
  statusFilter: string,
  resolveStatus: (task: Task) => string,
): Task[] {
  let list = filterBoardTasksBase(tasks, view, search);

  if (statusFilter !== "all") {
    list = list.filter(
      (task) => resolveStatus(task).toLowerCase() === statusFilter.toLowerCase(),
    );
  }

  return list;
}

export function taskOnDate(task: Task, date: Date): boolean {
  const features = task.features && typeof task.features === "object" && !Array.isArray(task.features)
    ? (task.features as { scheduledDate?: string; projectTask?: boolean })
    : null;
  const scheduled = String(features?.scheduledDate || "").slice(0, 10);
  const scheduledDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduled);
  const value = scheduledDate
    ? new Date(Number(scheduledDate[1]), Number(scheduledDate[2]) - 1, Number(scheduledDate[3]))
    : features?.projectTask && task.startDate
      ? new Date(task.startDate)
      : task.deadline || (task as Task & { createdAt?: string | Date }).createdAt;
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

export function taskTitle(task: Task) {
  return task.serviceInformation || task.description || "Untitled task";
}

export type MyTaskTypeFilter = "all" | "project" | "standalone";

export const MY_TASK_TYPE_FILTER_OPTIONS: { value: MyTaskTypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "project", label: "Project Task" },
  { value: "standalone", label: "Standalone Task" },
];

export function resolveMyTaskType(task: Task): "project" | "standalone" {
  const features =
    task.features && typeof task.features === "object" && !Array.isArray(task.features)
      ? (task.features as { projectTask?: boolean })
      : null;
  if (
    task.projectId ||
    features?.projectTask ||
    (task as Task & { taskType?: string }).taskType === "project"
  ) {
    return "project";
  }
  return "standalone";
}

export function matchesMyTaskTypeFilter(task: Task, filter: MyTaskTypeFilter): boolean {
  if (filter === "all") return true;
  return resolveMyTaskType(task) === filter;
}
