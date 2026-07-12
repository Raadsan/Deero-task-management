"use client";

import {
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  configTextareaClass,
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
import { authClient } from "@/lib/auth-client";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { taskTitle } from "@/lib/my-task-filters";
import { patchMyTask } from "@/lib/my-tasks-client";
import { Task } from "@/lib/types";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  tasks: Task[];
};

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:00`;
}

export default function TimelineDayDialog({ open, onOpenChange, date, tasks }: Props) {
  const session = authClient.useSession();
  const { mutate } = useSWRConfig();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [saving, setSaving] = useState(false);

  const isLinkMode = linkedTaskId !== "";

  useEffect(() => {
    if (!open || !date) return;
    setTitle("");
    setNotes("");
    setDueAt(toDatetimeLocalValue(date));
    setLinkedTaskId("");
  }, [open, date]);

  async function refreshTasks() {
    await Promise.all([
      mutate(SWR_CACH_KEYS.myTasks.key),
      mutate(SWR_CACH_KEYS.myTasksBoard.key),
      mutate(SWR_CACH_KEYS.tasks.key),
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;

    const deadlineIso = dueAt ? new Date(dueAt).toISOString() : new Date(date).toISOString();

    setSaving(true);
    try {
      if (isLinkMode) {
        await patchMyTask(linkedTaskId, { deadline: deadlineIso });
        toast.success("Task scheduled for this date");
      } else {
        const userId = session.data?.user?.id;
        if (!userId) {
          toast.error("Session not found");
          return;
        }
        if (!title.trim() && !notes.trim()) {
          toast.error("Write a title or note");
          return;
        }

        const response = await fetch(`${API_URL}/api/tasks`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assgineeId: userId,
            description: notes.trim() || title.trim(),
            serviceInformation: title.trim() || notes.trim().slice(0, 80),
            status: "pending",
            department: "General",
            priority: "Normal",
            supervisor: "",
            deadline: deadlineIso,
            progress: 0,
            isPersonal: true,
          }),
        });

        const data = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !data.success) {
          toast.error(data.error ?? "Failed to create task");
          return;
        }
        toast.success("Task added for this date");
      }

      onOpenChange(false);
      await refreshTasks();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={configDialogShellClass}
        onInteractOutside={preventConfigDialogClose}
        onEscapeKeyDown={preventConfigDialogClose}
      >
        <DialogHeader className={configDialogHeaderClass}>
          <DialogTitle>
            {date ? format(date, "EEEE, MMMM d, yyyy") : "Schedule"}
          </DialogTitle>
          <DialogDescription>
            Write a new task for this day, or link an existing task to this date.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className={configDialogBodyClass}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">
                Link existing task (optional)
              </label>
              <select
                value={linkedTaskId}
                onChange={(e) => setLinkedTaskId(e.target.value)}
                className={configCompactSelectClass}
                disabled={saving}
              >
                <option value="">— Create new task —</option>
                {tasks.map((task) => (
                  <option key={task.id} value={String(task.id)}>
                    {taskTitle(task)}
                  </option>
                ))}
              </select>
            </div>

            {!isLinkMode ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">
                    Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={configCompactInputClass}
                    placeholder="What do you want to do?"
                    disabled={saving}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={configTextareaClass}
                    placeholder="More details..."
                    disabled={saving}
                  />
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                The selected task will be moved to this date on the calendar.
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">
                Date & time
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className={configCompactInputClass}
                disabled={saving}
              />
            </div>
          </div>

          <div className={configDialogFooterClass}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isLinkMode ? "Assign to date" : "Add task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
