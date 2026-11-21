"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllUsersClient } from "@/lib/apis/readApi";
import { transferTask } from "@/lib/apis/taskApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { configCompactInputClass, configDialogFooterClass } from "@/components/config/config-dialog-styles";
import { btnFormSubmit } from "@/lib/dashboard-ui";
import { getTaskTableLabels } from "@/lib/utils";
import { Task } from "@/lib/types";
import { useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
};

export default function TaskTransferModal({ open, onOpenChange, task }: Props) {
  const { mutate } = useSWRConfig();
  const { data: usersRes } = useSWR(open ? "task-transfer-staff" : null, getAllUsersClient);
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const staffOptions = useMemo(() => {
    const rows = usersRes?.success && Array.isArray(usersRes.data) ? usersRes.data : [];
    return rows.filter((row: { id?: string; banned?: boolean }) => row.id && !row.banned);
  }, [usersRes]);

  const currentId = String(task?.assignedTo?.id ?? (task as Task & { assgineeId?: string })?.assgineeId ?? "");
  const currentName = task?.assignedTo?.name || "Unassigned";
  const taskName = task ? getTaskTableLabels(task).taskName : "—";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!task?.id || saving) return;
    if (!newAssigneeId) {
      toast.error("Select the new assignee");
      return;
    }
    if (newAssigneeId === currentId) {
      toast.error("Choose a different employee");
      return;
    }
    if (!reason.trim()) {
      toast.error("Transfer reason is required");
      return;
    }

    setSaving(true);
    try {
      const result = await transferTask(String(task.id), {
        assigneeId: newAssigneeId,
        reason: reason.trim(),
        note: note.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.errors?.message || "Transfer failed");
        return;
      }
      toast.success("Task transferred successfully");
      await Promise.all([
        mutate(SWR_CACH_KEYS.tasks.key),
        mutate(SWR_CACH_KEYS.myTasks.key),
        mutate(SWR_CACH_KEYS.myTasksList.key),
        mutate(SWR_CACH_KEYS.myTasksToday.key),
        mutate(SWR_CACH_KEYS.myTasksBoard.key),
      ]);
      setNewAssigneeId("");
      setReason("");
      setNote("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setNewAssigneeId("");
          setReason("");
          setNote("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg rounded-2xl border border-zinc-200 bg-white p-0">
        <DialogHeader className="border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-lg font-bold text-[#1e293b]">Transfer Task</DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Reassign this task to another employee. The same task ID and history are kept.
          </DialogDescription>
        </DialogHeader>

        {task ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5">
            <Field label="Task ID" value={String(task.id)} readOnly />
            <Field label="Task Name" value={taskName} readOnly />
            <Field label="Current Assigned Employee" value={currentName} readOnly />

            <label className="block text-xs font-semibold text-zinc-600">
              New Assigned Employee *
              <select
                required
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className={`${configCompactInputClass} mt-1.5 w-full`}
              >
                <option value="">Select employee</option>
                {staffOptions.map((row: { id: string; name: string }) => (
                  <option key={row.id} value={row.id} disabled={row.id === currentId}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-zinc-600">
              Transfer Reason *
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why is this task being reassigned?"
                className={`${configCompactInputClass} mt-1.5 w-full resize-none`}
              />
            </label>

            <label className="block text-xs font-semibold text-zinc-600">
              Optional Notes
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={`${configCompactInputClass} mt-1.5 w-full resize-none`}
              />
            </label>

            <p className="text-[11px] text-zinc-500">
              Transfer date and time are recorded automatically when you confirm.
            </p>

            <div className={configDialogFooterClass}>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={btnFormSubmit}>
                {saving ? "Transferring…" : "Confirm Transfer"}
              </button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-zinc-600">
      {label}
      <input
        readOnly={readOnly}
        value={value}
        className={`${configCompactInputClass} mt-1.5 w-full ${readOnly ? "bg-zinc-50 text-zinc-700" : ""}`}
      />
    </label>
  );
}