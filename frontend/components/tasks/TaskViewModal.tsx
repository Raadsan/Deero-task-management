"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAllTasksClient } from "@/lib/apis/readApi";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import { editTask } from "@/lib/apis/taskApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import TaskHoldPanel from "@/components/tasks/TaskHoldControls";
import TaskReviewActions from "@/components/tasks/TaskReviewActions";
import TaskTransferModal from "@/components/tasks/TaskTransferModal";
import { getBackendSessionClient } from "@/lib/apis/readApi";
import { authClient } from "@/lib/auth-client";
import { canTransferTaskForUser, originalAssigneeName } from "@/lib/task-transfer";
import { formatStatusLabel } from "@/lib/dashboard-ui";
import { getTaskDetailScheduleDisplay } from "@/lib/task-detail-schedule";
import { formatScheduledTask, getTaskTableLabels, markTaskNotesSeen, resolveTaskDisplayStatus } from "@/lib/utils";
import { btnFormSubmit } from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import {
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  Clock,
  GitBranch,
  MessageSquareText,
  Tag,
  User,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-800" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-800" },
  pending_review: { bg: "bg-sky-100", text: "text-sky-800" },
  overdue: { bg: "bg-red-100", text: "text-red-800" },
  on_hold: { bg: "bg-violet-100", text: "text-violet-800" },
  completed: { bg: "bg-green-100", text: "text-green-800" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  normal: { bg: "bg-blue-100", text: "text-blue-800" },
  medium: { bg: "bg-orange-100", text: "text-orange-800" },
  urgent: { bg: "bg-red-100", text: "text-red-800" },
};

export default function TaskViewModal({ open, onOpenChange, task }: Props) {
  const { mutate } = useSWRConfig();
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const session = authClient.useSession();
  const { data: backendSession } = useSWR(open ? "task-view-session" : null, getBackendSessionClient);
  const { data: branchOptionsRes } = useSWR(
    open && task ? "task-view-portfolios" : null,
    getTaskFormBranchOptions,
  );

  const { data: tasksRes } = useSWR(
    open ? SWR_CACH_KEYS.tasks.key : null,
    getAllTasksClient,
    { refreshInterval: 3000 },
  );

  const currentTask = useMemo(() => {
    if (!task) return null;
    const found = tasksRes?.data?.find((t: any) => String(t.id) === String(task.id));
    return found || task;
  }, [tasksRes?.data, task]);

  useEffect(() => {
    if (open && currentTask?.id) {
      markTaskNotesSeen(currentTask.id);
    }
  }, [open, currentTask?.id]);

  const scheduleDisplay = useMemo(
    () =>
      currentTask
        ? getTaskDetailScheduleDisplay(currentTask)
        : {
            originalDueDate: "N/A",
            updatedEndingDueDate: "N/A",
            extraTimeAdded: "0 minutes",
            reason: "N/A",
          },
    [currentTask],
  );

  const transferHistory = useMemo(() => {
    const list = Array.isArray((currentTask as Task & { transferHistory?: unknown[] })?.transferHistory)
      ? [...((currentTask as Task & { transferHistory: unknown[] }).transferHistory)]
      : [];
    return list.sort(
      (a, b) =>
        new Date(String((a as { createdAt?: string }).createdAt)).getTime() -
        new Date(String((b as { createdAt?: string }).createdAt)).getTime(),
    );
  }, [currentTask]);

  const actor = (backendSession?.data?.user ?? session.data?.user) as
    | { id?: string; name?: string; role?: string }
    | undefined;

  const allowTransfer = task
    ? canTransferTaskForUser(task, actor)
    : false;

  async function saveNote() {
    const text = newNote.trim();
    if (!task || !text || savingNote) return;
    setSavingNote(true);
    try {
      const result = await editTask({ taskId: task.id, status: task.status, progress: task.progress, notes: text });
      if (!result.success) { toast.error(result.errors?.message || "Failed to save note"); return; }
      setNewNote("");
      await Promise.all([mutate(SWR_CACH_KEYS.tasks.key), mutate(SWR_CACH_KEYS.myTasksList.key)]);
      toast.success("Task note saved");
      onOpenChange(false);
    } finally { setSavingNote(false); }
  }

  if (!task || !currentTask) return null;
  const assignedBranchName =
    branchOptionsRes?.data?.portfolios?.find(
      (portfolio: { id: string; name: string }) =>
        String(portfolio.id) === String(currentTask.assignedTo?.portfolioId ?? ""),
    )?.name ?? "";

  const displayStatus = resolveTaskDisplayStatus(currentTask);
  const statusColor =
    STATUS_COLORS[displayStatus] ?? { bg: "bg-gray-100", text: "text-gray-800" };
  const priorityColor =
    PRIORITY_COLORS[currentTask.priority] ?? { bg: "bg-gray-100", text: "text-gray-800" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            Task Details
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            View task assignment, progress, and status.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-zinc-400">ID: {currentTask.id}</div>
            <div className="text-xs font-medium text-zinc-500">
              Assigned Portfolio:{" "}
              <span className="font-semibold text-zinc-700">
                {assignedBranchName ||
                  (currentTask.assignedTo?.portfolioId
                    ? `Portfolio ${currentTask.assignedTo.portfolioId}`
                    : "N/A")}
              </span>
            </div>
          </div>

          {/* Task Name Box */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Task Name
            </p>
            <h4 className="text-base font-semibold text-zinc-900 leading-snug">
              {getTaskTableLabels(currentTask).taskName}
            </h4>
          </div>

          {/* Client & Service Information */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Client / Company
                </p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-800">
                  {getTaskTableLabels(currentTask).clientName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Service
                </p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-800">
                  {getTaskTableLabels(currentTask).serviceName}
                </p>
              </div>
            </div>
          </div>

          {/* Separate Description Box */}
          {getTaskTableLabels(currentTask).description ? (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Description
              </p>
              <p className="text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
                {getTaskTableLabels(currentTask).description}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Completion Progress
              </p>
              <span className="text-sm font-bold text-primary">
                {currentTask.progress || 0}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-zinc-200">
              <div
                className="h-2.5 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${currentTask.progress || 0}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Assigned To with Avatar / Image */}
            <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              {currentTask.assignedTo?.image ? (
                <img
                  src={currentTask.assignedTo.image}
                  alt={currentTask.assignedTo.name}
                  className="size-9 rounded-full object-cover ring-2 ring-white shadow-xs"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#651210] text-xs font-bold text-white shadow-xs">
                  {currentTask.assignedTo?.name
                    ? currentTask.assignedTo.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0] || "")
                        .join("")
                        .toUpperCase()
                    : "U"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Assigned To
                </p>
                <p className="truncate text-xs font-semibold text-zinc-800">
                  {currentTask.assignedTo?.name || "Unassigned"}
                </p>
                {currentTask.assignedTo?.jobTitle ? (
                  <p className="truncate text-[10px] text-zinc-500">
                    {currentTask.assignedTo.jobTitle}
                  </p>
                ) : null}
              </div>
            </div>

            <InfoItem
              icon={Users}
              label="Supervisor"
              value={currentTask.supervisor?.trim() || "N/A"}
            />
            <InfoItem
              icon={GitBranch}
              label="Assignee Portfolio"
              value={
                assignedBranchName ||
                (currentTask.assignedTo?.portfolioId
                  ? `Portfolio ${currentTask.assignedTo.portfolioId}`
                  : "N/A")
              }
            />
            {formatScheduledTask(currentTask) ? (
              <>
                <InfoItem icon={Calendar} label="Scheduled Date" value={formatScheduledTask(currentTask)?.date || "N/A"} />
                <InfoItem icon={Clock} label="Start Time" value={String(formatScheduledTask(currentTask)?.time || "").split("–")[0]?.trim() || "N/A"} />
                <InfoItem icon={Clock} label="End Time" value={String(formatScheduledTask(currentTask)?.time || "").split("–")[1]?.trim() || "N/A"} />
              </>
            ) : (
              <InfoItem
                icon={Calendar}
                label="Start Date"
                value={
                  currentTask.startDate
                    ? new Date(currentTask.startDate).toLocaleString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"
                }
              />
            )}
            <InfoItem
              icon={Calendar}
              label="Original Due Date"
              value={scheduleDisplay.originalDueDate}
            />
            <InfoItem
              icon={Clock}
              label="Extra Time Added"
              value={scheduleDisplay.extraTimeAdded}
            />
            <InfoItem
              icon={Calendar}
              label="Updated Ending Due Date"
              value={scheduleDisplay.updatedEndingDueDate}
            />
          </div>

          <InfoItem
            icon={MessageSquareText}
            label="Reason"
            value={scheduleDisplay.reason}
            multiline
            className="w-full"
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-zinc-400" />
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColor.bg} ${statusColor.text}`}
              >
                {formatStatusLabel(displayStatus)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-zinc-400" />
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${priorityColor.bg} ${priorityColor.text}`}
              >
                {currentTask.priority}
              </span>
            </div>
          </div>

          <TaskReviewActions
            task={currentTask}
            onDone={async () => {
              await Promise.all([mutate(SWR_CACH_KEYS.tasks.key), mutate(SWR_CACH_KEYS.myTasksList.key)]);
            }}
          />

          <TaskHoldPanel task={currentTask} />

          {currentTask.progressNotes?.length ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquareText className="size-4 text-[#7b1512]" />
                <p className="text-xs font-bold uppercase tracking-wide text-[#7b1512]">
                  Progress Notes / Messages ({currentTask.progressNotes.length})
                </p>
              </div>
              <div className="space-y-3">
                {[...currentTask.progressNotes].reverse().map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                      {note.text}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span>
                        <strong className="text-zinc-700">{note.authorName}</strong> ·{" "}
                        {String(note.authorRole).replace(/[_-]+/g, " ")}
                      </span>
                      <span>
                        {note.progress}% ·{" "}
                        {new Date(note.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ArrowRightLeft className="size-4 text-indigo-600" />
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                Assignment History
              </p>
            </div>
            <div className="mb-4 grid gap-2 rounded-lg border border-indigo-200/60 bg-white p-3 text-xs sm:grid-cols-2">
              <p>
                <span className="font-semibold text-zinc-500">Original assignee: </span>
                <span className="font-semibold text-indigo-800">
                  {originalAssigneeName(currentTask, transferHistory as Array<{ fromAssignee?: { name?: string } }>)}
                </span>
              </p>
              <p>
                <span className="font-semibold text-zinc-500">Current assignee: </span>
                <span className="font-semibold text-indigo-800">
                  {currentTask.assignedTo?.name || "Unassigned"}
                </span>
              </p>
            </div>
            {transferHistory.length ? (
              <div className="space-y-3">
                {transferHistory.map((transfer, idx) => {
                  const row = transfer as {
                    id?: string;
                    fromAssignee?: { name?: string };
                    toAssignee?: { name?: string };
                    reason?: string;
                    note?: string;
                    progressAtTransfer?: number;
                    createdAt?: string;
                    transferredBy?: { name?: string };
                  };
                  return (
                    <div
                      key={row.id ?? idx}
                      className="relative flex items-start gap-3 rounded-lg border border-indigo-200/60 bg-white p-3"
                    >
                      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-800">
                          <span className="text-indigo-700">{row.fromAssignee?.name ?? "Unknown"}</span>
                          {" → "}
                          <span className="text-indigo-700">{row.toAssignee?.name ?? "Unknown"}</span>
                        </p>
                        {row.reason ? (
                          <p className="text-xs text-zinc-700">
                            <span className="font-semibold text-zinc-500">Reason: </span>
                            {row.reason}
                          </p>
                        ) : null}
                        {row.note ? (
                          <p className="text-xs text-zinc-600">
                            <span className="font-semibold text-zinc-500">Notes: </span>
                            {row.note}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                          <span>
                            Progress at transfer:{" "}
                            <strong className="text-slate-700">{row.progressAtTransfer ?? 0}%</strong>
                          </span>
                          <span>
                            Date:{" "}
                            <strong className="text-slate-700">
                              {row.createdAt
                                ? new Date(row.createdAt).toLocaleString("en-US", {
                                    month: "short",
                                    day: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </strong>
                          </span>
                          {row.transferredBy?.name ? (
                            <span>
                              By: <strong className="text-slate-700">{row.transferredBy.name}</strong>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No transfers recorded for this task.</p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-6 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            {allowTransfer ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransferOpen(true)}
                className="h-10 border-indigo-200 text-xs font-semibold text-indigo-800"
              >
                <ArrowRightLeft className="mr-2 size-4" />
                Transfer Task
              </Button>
            ) : null}
            <Button type="button" onClick={() => onOpenChange(false)} className={btnFormSubmit}>
              Close
            </Button>
          </div>
        </div>

        <TaskTransferModal
          open={transferOpen}
          onOpenChange={setTransferOpen}
          task={currentTask}
        />
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  multiline,
  className,
}: {
  icon: typeof User;
  label: string;
  value: string;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 ${className || ""}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <p
          className={`text-sm font-medium text-zinc-800 ${
            multiline ? "whitespace-pre-wrap break-words" : "truncate"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
