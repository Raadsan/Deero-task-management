import { Task } from "@/lib/types";
import { resolveTaskDisplayStatus } from "@/lib/utils";

export type TaskLane = "todo" | "processing" | "review" | "completed";

export function getTaskLane(task: Task): TaskLane {
  const displayStatus = resolveTaskDisplayStatus(task);
  const progress = Number(task.progress ?? 0);
  if (displayStatus === "completed" || progress >= 100) return "completed";
  if (progress >= 80) return "review";
  if (progress > 0) return "processing";
  return "todo";
}

export function laneLabel(lane: TaskLane) {
  if (lane === "todo") return "To-do";
  if (lane === "processing") return "In progress";
  if (lane === "review") return "In review";
  return "Complete";
}

export function laneDotClass(lane: TaskLane) {
  if (lane === "todo") return "bg-violet-500";
  if (lane === "processing") return "bg-amber-500";
  if (lane === "review") return "bg-sky-500";
  return "bg-emerald-500";
}

export function progressForLane(lane: TaskLane, current = 0) {
  if (lane === "completed") return 100;
  if (lane === "review") return Math.max(80, current || 80);
  if (lane === "processing") return Math.max(20, current || 20);
  return 0;
}

export function statusForLane(lane: TaskLane) {
  return lane === "completed" ? "completed" : "pending";
}
