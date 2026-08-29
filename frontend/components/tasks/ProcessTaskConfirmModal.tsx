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
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  loading?: boolean;
  onConfirm: (progress: number, notes: string) => void | Promise<void>;
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
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !task) return;
    setProgress(clampProgress(Number(task.progress ?? 0)));
    setNotes("");
  }, [open, task]);

  const displayStatus = task
    ? resolveTaskDisplayStatus({ ...task, progress })
    : "";
  const isCompleted = progress >= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-transparent" className={cn(configDialogShellClass, "!top-[72px] !right-0 !left-auto !h-[calc(100dvh-72px)] !max-w-[470px] !translate-x-0 !translate-y-0 !rounded-none !border-y-0 !p-0 gap-0 shadow-[-12px_0_32px_rgba(15,23,42,0.10)] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right")}
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
          <div className={cn(configDialogBodyClass, "min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm")}>
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
                <AssigneeDetail assignee={task.assignedTo} />
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

            {resolveTaskDisplayStatus(task) === "overdue" ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <Lock className="size-4 shrink-0 text-red-600" />
                <span>Task is overdue and deadline has ended. Progress updates are locked until extra time is added by your manager.</span>
              </div>
            ) : null}

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
                  disabled={loading || resolveTaskDisplayStatus(task) === "overdue"}
                  style={{ background: `linear-gradient(to right, #7b1512 0%, #7b1512 ${progress}%, #e4e4e7 ${progress}%, #e4e4e7 100%)` }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[#7b1512] disabled:cursor-not-allowed"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(event) =>
                    setProgress(clampProgress(Number(event.target.value)))
                  }
                  disabled={loading || resolveTaskDisplayStatus(task) === "overdue"}
                  className={cn(configCompactInputClass, "w-20 text-center")}
                />
              </div>
            </div>

            <div className="space-y-2"><label htmlFor="progress-notes" className="text-[11px] font-semibold text-zinc-500 uppercase">Notes <span className="font-normal normal-case text-zinc-400">(Optional)</span></label><textarea id="progress-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a note about the progress..." rows={4} disabled={loading} className="w-full resize-none rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" /></div>
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
            onClick={() => void onConfirm(progress, notes)}
            disabled={loading || !task || resolveTaskDisplayStatus(task) === "overdue"}
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

function AssigneeDetail({ assignee }: { assignee?: Task["assignedTo"] }) {
  const name = assignee?.name || "Unassigned";
  const initials = name.split(" ").slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const imageSrc = assignee?.image?.trim() || null;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageSrc]);
  return (
    <div className="min-w-0"><p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Assigned To</p><div className="mt-1.5 flex items-center gap-2.5">{imageSrc && !imageFailed ? <img src={imageSrc} alt={name} onError={() => setImageFailed(true)} className="size-9 rounded-full object-cover ring-2 ring-white shadow-sm" /> : <span className="flex size-9 items-center justify-center rounded-full bg-[#651210] text-xs font-bold text-white">{initials}</span>}<span className="min-w-0"><strong className="block truncate text-sm text-zinc-800">{name}</strong><small className="block truncate text-[11px] text-zinc-500">{assignee?.jobTitle || "Team member"}</small></span></div></div>
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
