import { Task } from "@/lib/types";
import { getTaskLane, TaskLane } from "@/lib/my-task-workflow";

export const BOARD_LANES: TaskLane[] = ["todo", "processing", "review", "completed"];

export function emptyLaneOrder(): Record<TaskLane, string[]> {
  return { todo: [], processing: [], review: [], completed: [] };
}

export function groupTasksByLane(tasks: Task[]): Record<TaskLane, Task[]> {
  const grouped = emptyLaneOrder();
  for (const task of tasks) {
    grouped[getTaskLane(task)].push(task);
  }
  return grouped;
}

export function laneOrderFromTasks(tasks: Task[]): Record<TaskLane, string[]> {
  const grouped = groupTasksByLane(tasks);
  return {
    todo: grouped.todo.map((t) => String(t.id)),
    processing: grouped.processing.map((t) => String(t.id)),
    review: grouped.review.map((t) => String(t.id)),
    completed: grouped.completed.map((t) => String(t.id)),
  };
}

export function reorderLaneOrder(
  order: Record<TaskLane, string[]>,
  taskId: string,
  fromLane: TaskLane,
  toLane: TaskLane,
  toIndex: number,
): Record<TaskLane, string[]> {
  const next: Record<TaskLane, string[]> = {
    todo: [...order.todo],
    processing: [...order.processing],
    review: [...order.review],
    completed: [...order.completed],
  };

  for (const lane of BOARD_LANES) {
    next[lane] = next[lane].filter((id) => id !== taskId);
  }

  const target = [...next[toLane]];
  const clampedIndex = Math.max(0, Math.min(toIndex, target.length));
  target.splice(clampedIndex, 0, taskId);
  next[toLane] = target;

  if (fromLane !== toLane) {
    next[fromLane] = next[fromLane].filter((id) => id !== taskId);
  }

  return next;
}

export function syncLaneOrderWithFilter(
  order: Record<TaskLane, string[]>,
  filtered: Task[],
): Record<TaskLane, string[]> {
  const filteredIds = new Set(filtered.map((task) => String(task.id)));
  const placed = new Set<string>();
  const next = emptyLaneOrder();

  for (const lane of BOARD_LANES) {
    for (const id of order[lane] ?? []) {
      if (!filteredIds.has(id) || placed.has(id)) continue;
      next[lane].push(id);
      placed.add(id);
    }
  }

  for (const task of filtered) {
    const id = String(task.id);
    if (placed.has(id)) continue;
    next[getTaskLane(task)].push(id);
    placed.add(id);
  }

  return next;
}

/** Each task appears in exactly one column — supports unlimited tasks per column */
export function normalizeLaneOrder(
  order: Record<TaskLane, string[]>,
  taskMap: Map<string, Task>,
): Record<TaskLane, string[]> {
  const placed = new Set<string>();
  const next = emptyLaneOrder();

  for (const lane of BOARD_LANES) {
    for (const id of order[lane] ?? []) {
      if (placed.has(id) || !taskMap.has(id)) continue;
      next[lane].push(id);
      placed.add(id);
    }
  }

  for (const [id, task] of taskMap) {
    if (placed.has(id)) continue;
    next[getTaskLane(task)].push(id);
    placed.add(id);
  }

  return next;
}

export function findLaneForTaskId(
  order: Record<TaskLane, string[]>,
  taskId: string,
): TaskLane | null {
  for (const lane of BOARD_LANES) {
    if (order[lane].includes(taskId)) return lane;
  }
  return null;
}

export function resolveLaneTasks(
  lane: TaskLane,
  order: Record<TaskLane, string[]>,
  taskMap: Map<string, Task>,
): Task[] {
  return order[lane]
    .map((id) => taskMap.get(id))
    .filter((task): task is Task => Boolean(task));
}
