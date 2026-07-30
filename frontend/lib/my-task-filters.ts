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
  const value = task.deadline || (task as Task & { createdAt?: string | Date }).createdAt;
  if (!value) return false;
  const d = new Date(value);
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
