"use client";

import Loader from "@/components/Shared/Loader";
import {
  configCompactInputClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  preventConfigDialogClose,
} from "@/components/config/config-dialog-styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  btnFormCancel,
  btnFormSubmit,
  formatStatusLabel,
} from "@/lib/dashboard-ui";
import { taskTitle } from "@/lib/my-task-filters";
import { Task } from "@/lib/types";
import { cn, formatTaskDeadline, resolveTaskDisplayStatus } from "@/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  loading?: boolean;
  onConfirm: (progress: number) => void | Promise<void>;
};

function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export default function ProcessTaskConfirmModal({
  open,
  onOpenChange,
  task,
  loading = false,
  onConfirm,
}: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open || !task) return;
    setProgress(clampProgress(Number(task.progress ?? 0)));
  }, [open, task]);

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
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            {isCompleted ? "Complete task" : "Update task progress"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Review the task details and enter the progress percentage.
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
              <DetailRow
                label="Current Status"
                value={formatStatusLabel(displayStatus)}
                capitalize
              />
            </div>

            <div className="rounded-lg border border-zinc-100 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-xs font-bold tracking-wide text-zinc-600 uppercase">
                  Progress
                </label>
                <span className="text-primary text-sm font-bold">
                  {progress}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(event) =>
                    setProgress(clampProgress(Number(event.target.value)))
                  }
                  disabled={loading}
                  className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(event) =>
                    setProgress(clampProgress(Number(event.target.value)))
                  }
                  disabled={loading}
                  className={cn(configCompactInputClass, "w-20 text-center")}
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
            disabled={loading}
            className={btnFormCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm(progress)}
            disabled={loading || !task}
            className={cn(
              btnFormSubmit,
              isCompleted && "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            {loading ? (
              <Loader />
            ) : isCompleted ? (
              "Complete & Save"
            ) : (
              "Save Progress"
            )}
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
