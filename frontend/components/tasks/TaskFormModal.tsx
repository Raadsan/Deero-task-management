"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GetAssigneesAndInstitutions } from "@/lib/actions/shared.action";
import { getTaskById } from "@/lib/actions/task.action";
import { Task, Client } from "@/lib/types";
import useSWR from "swr";
import TaskForm from "./TaskForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  taskId?: string;
  variant?: "default" | "own";
}

async function loadTaskFormData(
  mode: "create" | "edit",
  taskId?: string,
  ownAssigned = false,
) {
  const shared = await GetAssigneesAndInstitutions({ ownAssigned });
  let currentTask: Task | undefined;

  if (mode === "edit" && taskId) {
    const taskResult = await getTaskById(taskId);
    currentTask = taskResult.data;
  }

  return {
    institutions: shared.data?.institutions,
    assignees: shared.data?.assignees,
    currentTask,
  };
}

export default function TaskFormModal({
  open,
  onOpenChange,
  mode,
  taskId,
  variant = "default",
}: Props) {
  const { data, isLoading } = useSWR(
    open ? ["task-form-modal", mode, taskId ?? "new", variant] : null,
    () => loadTaskFormData(mode, taskId, variant === "own"),
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
          {isLoading ? (
            <div className="space-y-4 animate-pulse px-6 py-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : (
            <TaskForm
              formType={formType}
              institutions={
                data?.institutions as Pick<Client, "id" | "institution">[] | undefined
              }
              currentTask={data?.currentTask}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
