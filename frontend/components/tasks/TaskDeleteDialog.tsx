"use client";

import { deleteTask } from "@/lib/apis/taskApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { Task } from "@/lib/types";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";
import { cn } from "@/lib/utils";
import { actionBtnDelete } from "@/lib/dashboard-ui";

interface Sibling {
  id: string;
  assgineeId: string;
  user?: { id?: string; name?: string };
}

interface Props {
  task: Task & { siblings?: Sibling[] };
  triggerClassNames?: string;
}

export default function TaskDeleteDialog({ task, triggerClassNames }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<"all" | "one" | null>(null);
  const { mutate } = useSWRConfig();

  const siblings: Sibling[] = (task as any).siblings ?? [];
  const hasSiblings = siblings.length > 1;

  // Format all assignee names in one string
  const allAssigneeNames = hasSiblings
    ? siblings
        .map((s) => s.user?.name)
        .filter(Boolean)
        .join(", ")
    : task.assignedTo?.name ?? "Unassigned";

  function refreshAll() {
    mutate(SWR_CACH_KEYS.tasks.key);
    mutate(SWR_CACH_KEYS.myTasks.key);
    mutate(SWR_CACH_KEYS.myTasksBoard.key);
    mutate(
      (key) =>
        (typeof key === "string" && (key.includes("dashboard") || key.includes("task"))) ||
        (Array.isArray(key) && (String(key[0]).includes("dashboard") || String(key[0]).includes("task"))),
      undefined,
      { revalidate: true },
    );
  }

  async function handleDeleteOne() {
    setDeleting("one");
    const result = await deleteTask(String(task.id));
    setDeleting(null);
    if (result.success) {
      toast.success("Task deleted successfully.");
      refreshAll();
      setOpen(false);
    } else {
      toast.error(result.errors?.message ?? "Failed to delete task.");
    }
  }

  async function handleDeleteAll() {
    setDeleting("all");
    const ids = hasSiblings ? siblings.map((s) => s.id) : [String(task.id)];
    let failed = 0;
    for (const id of ids) {
      const result = await deleteTask(id);
      if (!result.success) failed++;
    }
    setDeleting(null);
    if (failed === 0) {
      toast.success(`All ${ids.length} task assignees deleted.`);
    } else {
      toast.error(`${failed} deletion(s) failed.`);
    }
    refreshAll();
    setOpen(false);
  }

  const isLoading = deleting !== null;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center justify-center", triggerClassNames ?? actionBtnDelete)}
        title="Delete task"
      >
        <Trash2 className="size-4" />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => !isLoading && setOpen(false)}
          />

          {/* Dialog card */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl bg-white p-6 shadow-xl border border-zinc-200 text-left">
            {/* Close Button Top Right */}
            <button
              type="button"
              onClick={() => !isLoading && setOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
            >
              <X className="size-5" />
            </button>

            {/* Header with Alert Icon & Title */}
            <div className="border-b border-zinc-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500 shrink-0" />
                <h3 className="text-lg font-bold text-zinc-900">
                  Delete Task
                </h3>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                {hasSiblings
                  ? `This task has ${siblings.length} assignees. Choose whether to delete only this one or for all assignees.`
                  : "Are you sure you want to delete this task? This action cannot be undone."}
              </p>
            </div>

            {/* Body Info */}
            <div className="space-y-4">
              {/* Task Details Card */}
              <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 text-xs space-y-1.5 text-left">
                <p className="font-semibold text-zinc-800 text-sm">
                  {task.serviceInformation || task.description || "Task Details"}
                </p>
                <div className="text-zinc-600 flex items-start gap-1">
                  <span className="font-semibold text-zinc-700 shrink-0">Assigned to:</span>
                  <span className="font-medium text-zinc-900 leading-snug">{allAssigneeNames}</span>
                </div>
              </div>

              {/* Action Buttons Side by Side */}
              {hasSiblings ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* Secondary Color Button: Delete Only */}
                  <button
                    type="button"
                    onClick={handleDeleteOne}
                    disabled={isLoading}
                    className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {deleting === "one" ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      `Delete Only (${task.assignedTo?.name?.split(" ")[0] ?? "This"})`
                    )}
                  </button>

                  {/* Primary Color Button: Delete All */}
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={isLoading}
                    className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:opacity-95 text-white font-semibold text-xs sm:text-sm transition-opacity disabled:opacity-50 shadow-sm"
                  >
                    {deleting === "all" ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      `Delete All (${siblings.length})`
                    )}
                  </button>
                </div>
              ) : (
                /* Single assignee confirm buttons */
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isLoading}
                    className="h-9 px-4 rounded-md border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteOne}
                    disabled={isLoading}
                    className="h-9 px-5 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {deleting === "one" ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      "Confirm"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
