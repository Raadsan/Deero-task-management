"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTaskById } from "@/lib/actions/task.action";
import TaskForm from "./TaskForm";
import useSWR from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  taskId?: string;
  variant?: "default" | "own";
  initialData?: any;
}

async function loadTaskFormData(
  mode: "create" | "edit",
  taskId?: string,
) {
  if (mode === "create") {
    return { currentTask: undefined };
  }

  const taskResult = await getTaskById(taskId!);
  if (!taskResult.success || !taskResult.data) {
    throw new Error(taskResult.errors?.message ?? "Failed to load task");
  }
  return {
    currentTask: taskResult.data,
  };
}

export default function TaskFormModal({
  open,
  onOpenChange,
  mode,
  taskId,
  variant = "default",
  initialData,
}: Props) {
  const { data, isLoading, isValidating, error } = useSWR(
    open ? ["task-form-modal", mode, taskId ?? "new", variant] : null,
    () => loadTaskFormData(mode, taskId),
    {
      revalidateOnMount: true,
      dedupingInterval: 0,
    },
  );

  const formType =
    variant === "own" && mode === "edit"
      ? "own:edit"
      : mode === "create"
        ? "create"
        : "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            {mode === "create" ? "Create Task" : "Edit Task"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {mode === "create"
              ? "Add a new task and assign it to a team member."
              : variant === "own"
                ? "Update your task progress and status."
                : "Update task details, status, and deadline."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {open && (
            isLoading || isValidating ? (
              <div className="space-y-4 animate-pulse px-6 py-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-zinc-100" />
                ))}
              </div>
            ) : error ? (
              <div className="px-6 py-10 text-center text-sm text-red-600">
                {error instanceof Error ? error.message : "Failed to load task"}
              </div>
            ) : (
              <TaskForm
                key={mode === "create" ? "create-task-form" : (data?.currentTask?.id ?? `edit-${taskId}`)}
                formType={formType}
                currentTask={data?.currentTask}
                initialData={initialData}
                onSuccess={() => onOpenChange(false)}
                onCancel={() => onOpenChange(false)}
              />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
