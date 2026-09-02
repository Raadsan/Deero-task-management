"use client";

import Loader from "@/components/Shared/Loader";
import {
  configCompactInputClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
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
import { formatStatusLabel } from "@/lib/dashboard-ui";
import { taskTitle } from "@/lib/my-task-filters";
import { Task } from "@/lib/types";
import { cn, formatTaskDeadline, getTaskTableLabels, resolveTaskDisplayStatus } from "@/lib/utils";
import { Clock, Lock, Sparkles } from "lucide-react";
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

function formatExtraTimeText(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `+${h}h ${m}m`;
  if (h > 0) return `+${h} hrs`;
  return `+${m} mins`;
}

function formatLastDueDate(deadline: Date | string, extraMinutes: number = 0) {
  const baseMs = new Date(deadline).getTime();
  if (Number.isNaN(baseMs)) return "N/A";
  const updatedDate = new Date(baseMs + Math.max(0, extraMinutes) * 60_000);
  return updatedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const isOverdue = task ? resolveTaskDisplayStatus(task) === "overdue" : false;
  const extraMinutes = Number(task?.extraTimeMinutes ?? 0);
  const hasExtraTime = extraMinutes > 0;

  // Accurately parse and separate task name, client/company name, and service name
  const labels = task
    ? getTaskTableLabels(task)
    : { taskName: "Untitled Task", clientName: "Internal", serviceName: "General", description: "" };
  const taskName = labels.taskName;
  const clientName = labels.clientName;
  const serviceInfo = labels.serviceName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl sm:max-w-xl md:max-w-2xl flex flex-col"
        onInteractOutside={preventConfigDialogClose}
        onEscapeKeyDown={preventConfigDialogClose}
      >
        <DialogHeader className={cn(configDialogHeaderClass, "bg-zinc-50/70")}>
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            {isCompleted ? "Complete Task" : "Update Task Progress"}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Review the task details and update the completion progress.
          </DialogDescription>
        </DialogHeader>

        {task ? (
          <div className={cn(configDialogBodyClass, "min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm")}>
            {/* Task Information Card */}
            <div className="space-y-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4">
              {/* Task Name */}
              <DetailRow label="Task Name" value={taskName} isTitle />

              {/* Service & Client separated clearly */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-zinc-200/60">
                <DetailRow label="Service" value={serviceInfo} />
                <DetailRow label="Client / Institution" value={clientName} />
              </div>

              {/* Description */}
              {labels.description ? (
                <div className="pt-2 border-t border-zinc-200/60">
                  <DetailRow
                    label="Description"
                    value={labels.description}
                    multiline
                  />
                </div>
              ) : null}

              {/* Task ID, Priority, Department */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 border-t border-zinc-200/60">
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
              </div>

              {/* Assignee (with image) & Supervisor */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-zinc-200/60 items-center">
                <AssigneeDetail assignee={task.assignedTo} />
                <DetailRow
                  label="Supervisor"
                  value={task.supervisor || "N/A"}
                />
              </div>

              {/* Deadline & Status */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-zinc-200/60">
                <DetailRow
                  label="Deadline"
                  value={formatTaskDeadline(task.deadline, {
                    status: task.status,
                    progress,
                    extraTimeMinutes: task.extraTimeMinutes,
                  })}
                />
                <DetailRow
                  label="Current Status"
                  value={formatStatusLabel(displayStatus)}
                  capitalize
                />
              </div>
            </div>

            {/* Extra Time Highlight Banner */}
            {hasExtraTime ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-amber-900">
                <Clock className="size-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <div className="font-semibold text-amber-800 flex items-center gap-1.5">
                    <span>Extra time added:</span>
                    <span className="inline-flex items-center rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                      {formatExtraTimeText(extraMinutes)}
                    </span>
                  </div>
                  <div className="mt-1 text-amber-700 font-medium">
                    Last Due Date:{" "}
                    <strong className="text-amber-950 font-bold">
                      {task.deadline ? formatLastDueDate(task.deadline, extraMinutes) : "N/A"}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Overdue Warning */}
            {isOverdue ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                <Lock className="size-4 shrink-0 text-red-600" />
                <span>
                  Task is overdue and deadline has ended. Progress updates are locked until extra time is added by your manager.
                </span>
              </div>
            ) : null}

            {/* Progress Slider Card */}
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  Completion Progress
                </label>
                <span className="text-base font-bold text-primary">
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
                  disabled={loading || isOverdue}
                  style={{
                    background: `linear-gradient(to right, #7b1512 0%, #7b1512 ${progress}%, #e4e4e7 ${progress}%, #e4e4e7 100%)`,
                  }}
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
                  disabled={loading || isOverdue}
                  className={cn(configCompactInputClass, "w-20 text-center font-bold text-zinc-800")}
                />
              </div>
            </div>

            {/* Notes / Message Section */}
            <div className="space-y-1.5">
              <label htmlFor="progress-notes" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Notes / Message <span className="font-normal normal-case text-zinc-400">(Optional)</span>
              </label>
              <textarea
                id="progress-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write a message or progress note for this task..."
                rows={3}
                disabled={loading}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
              />
            </div>
          </div>
        ) : null}

        <div className={cn(configDialogFooterClass, "items-center justify-end gap-3 bg-zinc-50/80 px-6 py-4 border-t border-zinc-100")}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-10 px-5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm(isOverdue ? Number(task.progress ?? 0) : progress, notes)}
            disabled={loading || !task || (isOverdue && !notes.trim())}
            className={cn(
              "h-10 min-w-[130px] px-6 text-xs font-bold text-white shadow-sm transition-all",
              isCompleted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primary/90",
              (loading || !task || (isOverdue && !notes.trim())) && "cursor-not-allowed opacity-50",
            )}
          >
            {loading ? (
              <Loader />
            ) : isOverdue ? (
              "Send Message"
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
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
  const imageSrc = assignee?.image?.trim() || null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [imageSrc]);

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Assigned To
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        {imageSrc && !imageFailed ? (
          <img
            src={imageSrc}
            alt={name}
            onError={() => setImageFailed(true)}
            className="size-9 rounded-full object-cover ring-2 ring-white shadow-xs"
          />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-[#651210] text-xs font-bold text-white shadow-xs">
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <strong className="block truncate text-xs font-semibold text-zinc-800">
            {name}
          </strong>
          <small className="block truncate text-[11px] text-zinc-500">
            {assignee?.jobTitle || "Team Member"}
          </small>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
  capitalize = false,
  isTitle = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  capitalize?: boolean;
  isTitle?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5",
          isTitle ? "text-sm font-semibold text-zinc-900" : "text-xs font-medium text-zinc-800",
          multiline ? "whitespace-pre-wrap leading-relaxed" : "truncate",
          capitalize && "capitalize",
        )}
      >
        {value || "N/A"}
      </p>
    </div>
  );
}
