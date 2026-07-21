"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { editTask } from "@/lib/actions/task.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  configCompactInputClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  preventConfigDialogClose,
} from "@/components/config/config-dialog-styles";
import { formatStatusLabel } from "@/lib/dashboard-ui";
import { taskTitle } from "@/lib/my-task-filters";
import { Task } from "@/lib/types";
import { cn, formatTaskDeadline, resolveTaskDisplayStatus } from "@/lib/utils";
import { ArrowRightLeft, Clock, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
};

function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export default function MyTaskQuickEditModal({
  open,
  onOpenChange,
  task,
}: Props) {
  const { mutate } = useSWRConfig();
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setProgress(clampProgress(Number(task.progress ?? 0)));
  }, [open, task]);

  async function handleSave() {
    if (!task?.id) return;

    setSaving(true);
    try {
      const nextProgress = clampProgress(Number(progress));
      const isCompleted = nextProgress >= 100;

      const result = await editTask({
        taskId: task.id,
        progress: nextProgress,
        status: isCompleted ? "completed" : "pending",
      });

      if (result.success) {
        toast.success(isCompleted ? "Task completed" : "Task progress saved");
        await mutate(SWR_CACH_KEYS.myTasks.key);
        await mutate(SWR_CACH_KEYS.myTasksList.key);
        await mutate(SWR_CACH_KEYS.myTasksToday.key);
        await mutate(SWR_CACH_KEYS.myTasksBoard.key);
        await mutate(SWR_CACH_KEYS.tasks.key);
        await mutate(
          (key) =>
            (typeof key === "string" && (key.includes("dashboard") || key.includes("task"))) ||
            (Array.isArray(key) && (String(key[0]).includes("dashboard") || String(key[0]).includes("task"))),
          undefined,
          { revalidate: true },
        );
        onOpenChange(false);
      } else {
        toast.error(result.errors?.message ?? "Failed to update task");
      }
    } finally {
      setSaving(false);
    }
  }

  const displayStatus = task
    ? resolveTaskDisplayStatus({ ...task, progress })
    : "";
  const isCompleted = progress >= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={configDialogShellClass}
        onInteractOutside={preventConfigDialogClose}
        onEscapeKeyDown={preventConfigDialogClose}
      >
        <DialogHeader className={configDialogHeaderClass}>
          <DialogTitle>
            {isCompleted ? "Complete task" : "Update task progress"}
          </DialogTitle>
          <DialogDescription>
            Review the assigned task details and update your progress.
          </DialogDescription>
        </DialogHeader>

        {task ? (
          <div className={cn(configDialogBodyClass, "space-y-4 text-sm")}>
            <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <DetailRow label="Task Name" value={taskTitle(task)} />
              <DetailRow
                label="Description"
                value={task.description || "No description provided"}
                multiline
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow label="Task ID" value={String(task.id ?? "N/A")} />
                <DetailRow
                  label="Priority"
                  value={task.priority || "Normal"}
                  capitalize
                />
                <DetailRow
                  label="Department"
                  value={task.department || "General"}
                />
                <DetailRow
                  label="Assigned To"
                  value={task.assignedTo?.name || "Unassigned"}
                />
                <DetailRow
                  label="Supervisor"
                  value={task.supervisor || "N/A"}
                />
                <DetailRow
                  label="Deadline"
                  value={formatTaskDeadline(task.deadline, {
                    status: task.status,
                    progress,
                  })}
                />
                <DetailRow
                  label="Created"
                  value={formatTaskDeadline(
                    (task as Task & { createdAt?: string | Date }).createdAt,
                    { status: task.status, progress },
                  )}
                />
                <DetailRow
                  label="Status"
                  value={formatStatusLabel(displayStatus)}
                  capitalize
                />
              </div>
              {task.institutions?.length ? (
                <DetailRow
                  label="Client / Institution"
                  value={task.institutions
                    .map((item) => item.institution)
                    .filter(Boolean)
                    .join(", ")}
                />
              ) : null}
              {task.serviceInformation ? (
                <DetailRow
                  label="Service Information"
                  value={task.serviceInformation}
                  multiline
                />
              ) : null}
            </div>

            {resolveTaskDisplayStatus(task) === "overdue" ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <Lock className="size-4 shrink-0 text-red-600" />
                <span>Task is overdue and deadline has ended. Progress updates are locked until extra time is added by your manager.</span>
              </div>
            ) : Number(task.extraTimeMinutes) > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                <Clock className="size-4 shrink-0 text-emerald-600" />
                <span>Extra time has been added to this task! Updated deadline: {task.deadline ? new Date(new Date(task.deadline).getTime() + Number(task.extraTimeMinutes) * 60_000).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
              </div>
            ) : null}

            {Number(task.transferredFromProgress) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-900">
                <ArrowRightLeft className="size-4 shrink-0 text-indigo-600" />
                <span>Task was transferred! Previous assignee completed {task.transferredFromProgress}%. You can update progress from {task.transferredFromProgress}% to 100%.</span>
              </div>
            )}

            <div className="rounded-lg border border-zinc-100 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold tracking-wide text-zinc-600 uppercase">
                  Progress Percentage {Number(task.transferredFromProgress) > 0 ? `(Min: ${task.transferredFromProgress}%)` : ""}
                </label>
                <span className="text-primary text-sm font-bold">
                  {progress}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={Number(task.transferredFromProgress) || 0}
                  max={100}
                  value={progress}
                  onChange={(event) => {
                    const val = clampProgress(Number(event.target.value));
                    const minVal = Number(task.transferredFromProgress) || 0;
                    setProgress(Math.max(minVal, val));
                  }}
                  className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={saving || resolveTaskDisplayStatus(task) === "overdue"}
                />
                <input
                  type="number"
                  min={Number(task.transferredFromProgress) || 0}
                  max={100}
                  value={progress}
                  onChange={(event) => {
                    const val = clampProgress(Number(event.target.value));
                    const minVal = Number(task.transferredFromProgress) || 0;
                    setProgress(Math.max(minVal, val));
                  }}
                  className={cn(configCompactInputClass, "w-20 text-center disabled:opacity-40")}
                  disabled={saving || resolveTaskDisplayStatus(task) === "overdue"}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className={configDialogFooterClass}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !task || resolveTaskDisplayStatus(task) === "overdue"}
            className={cn(
              isCompleted && "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            {saving
              ? "Saving..."
              : isCompleted
                ? "Complete & Save"
                : "Save Progress"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
  capitalize = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-medium text-zinc-800",
          multiline ? "leading-relaxed whitespace-pre-wrap" : "truncate",
          capitalize && "capitalize",
        )}
      >
        {value || "N/A"}
      </p>
    </div>
  );
}
