"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import { editTask } from "@/lib/apis/taskApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { resolveTaskDisplayStatus } from "@/lib/utils";
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
import { useState } from "react";
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
  overdue: { bg: "bg-red-100", text: "text-red-800" },
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
  const { data: branchOptionsRes } = useSWR(
    open && task ? "task-view-portfolios" : null,
    getTaskFormBranchOptions,
  );

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

  if (!task) return null;
  const assignedBranchName =
    branchOptionsRes?.data?.portfolios?.find(
      (portfolio: { id: string; name: string }) =>
        String(portfolio.id) === String(task.assignedTo?.portfolioId ?? ""),
    )?.name ?? "";

  const displayStatus = resolveTaskDisplayStatus(task);
  const statusColor =
    STATUS_COLORS[displayStatus] ?? { bg: "bg-gray-100", text: "text-gray-800" };
  const priorityColor =
    PRIORITY_COLORS[task.priority] ?? { bg: "bg-gray-100", text: "text-gray-800" };

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
            <div className="text-xs font-mono text-zinc-400">ID: {task.id}</div>
            <div className="text-xs font-medium text-zinc-500">
              Assigned Portfolio:{" "}
              <span className="font-semibold text-zinc-700">
                {assignedBranchName ||
                  (task.assignedTo?.portfolioId
                    ? `Portfolio ${task.assignedTo.portfolioId}`
                    : "â€”")}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Description
            </p>
            <p className="text-sm leading-relaxed text-zinc-800">
              {task.description}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Completion Progress
              </p>
              <span className="text-sm font-bold text-primary">
                {task.progress || 0}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-zinc-200">
              <div
                className="h-2.5 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${task.progress || 0}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoItem
              icon={User}
              label="Assigned To"
              value={task.assignedTo?.name ?? "â€”"}
            />
            <InfoItem
              icon={Users}
              label="Supervisor"
              value={task.supervisor || "â€”"}
            />
            <InfoItem
              icon={GitBranch}
              label="Assignee Portfolio"
              value={
                assignedBranchName ||
                (task.assignedTo?.portfolioId
                  ? `Portfolio ${task.assignedTo.portfolioId}`
                  : "â€”")
              }
            />
            <InfoItem
              icon={Calendar}
              label="Start Date"
              value={
                task.startDate
                  ? new Date(task.startDate).toLocaleString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "N/A"
              }
            />
            <InfoItem
              icon={Calendar}
              label="Original Due Date"
              value={
                task.originalDeadline || task.deadline
                  ? new Date(task.originalDeadline ?? task.deadline!).toLocaleString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "N/A"
              }
            />
            <InfoItem
              icon={Clock}
              label="Extra Time Added"
              value={
                Number(task.extraTimeMinutes) > 0
                  ? `${Math.floor(Number(task.extraTimeMinutes) / 60)}h ${Number(task.extraTimeMinutes) % 60}m`
                  : "No extra time"
              }
            />
            <InfoItem
              icon={Calendar}
              label="Updated Ending Due Date"
              value={
                Number(task.extraTimeMinutes) > 0 && task.deadline
                  ? new Date(new Date(task.deadline).getTime() + Number(task.extraTimeMinutes) * 60_000).toLocaleString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "N/A"
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-zinc-400" />
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColor.bg} ${statusColor.text}`}
              >
                {displayStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-zinc-400" />
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${priorityColor.bg} ${priorityColor.text}`}
              >
                {task.priority}
              </span>
            </div>
          </div>

          {task.institutions?.length > 0 && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Clients
              </p>
              <div className="flex flex-wrap gap-2">
                {task.institutions.map(({ id, institution }) => (
                  <span
                    key={id}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {institution}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-white p-4"><label htmlFor="task-view-note" className="text-xs font-bold uppercase tracking-wide text-zinc-500">Add Note</label><textarea id="task-view-note" value={newNote} onChange={(event) => setNewNote(event.target.value)} maxLength={2000} rows={3} placeholder="Write a task progress note..." className="mt-2 w-full resize-none rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /><div className="mt-2 flex justify-end"><Button type="button" onClick={() => void saveNote()} disabled={!newNote.trim() || savingNote} className="bg-[#651210] text-white hover:bg-[#7b1512]">{savingNote ? "Saving..." : "Save Note"}</Button></div></div>

          {task.progressNotes?.length ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-4">
              <div className="mb-3 flex items-center gap-2"><MessageSquareText className="size-4 text-[#7b1512]" /><p className="text-xs font-bold uppercase tracking-wide text-[#7b1512]">Progress Notes</p></div>
              <div className="space-y-3">{[...task.progressNotes].reverse().map((note) => (
                <div key={note.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"><p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{note.text}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500"><span><strong className="text-zinc-700">{note.authorName}</strong> · {String(note.authorRole).replace(/[_-]+/g, " ")}</span><span>{note.progress}% · {new Date(note.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div></div>
              ))}</div>
            </div>
          ) : null}

          {(task as any).transferHistory?.length > 0 && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ArrowRightLeft className="size-4 text-indigo-600" />
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                  Transfer History
                </p>
              </div>
              <div className="space-y-3">
                {(task as any).transferHistory.map((transfer: any, idx: number) => (
                  <div
                    key={transfer.id ?? idx}
                    className="relative flex items-start gap-3 rounded-lg border border-indigo-200/60 bg-white p-3"
                  >
                    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-semibold text-slate-800">
                        <span className="text-indigo-700">{transfer.fromAssignee?.name ?? "Unknown"}</span>
                        {" â†’ "}
                        <span className="text-indigo-700">{transfer.toAssignee?.name ?? "Unknown"}</span>
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                        <span>
                          Progress at transfer:{" "}
                          <strong className="text-slate-700">{transfer.progressAtTransfer ?? 0}%</strong>
                        </span>
                        <span>
                          Date:{" "}
                          <strong className="text-slate-700">
                            {new Date(transfer.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </strong>
                        </span>
                        {transfer.transferredBy?.name && (
                          <span>
                            By: <strong className="text-slate-700">{transfer.transferredBy.name}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-6 py-4">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className={btnFormSubmit}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-zinc-800">{value}</p>
      </div>
    </div>
  );
}
