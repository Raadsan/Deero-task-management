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
  configTextareaClass,
  preventConfigDialogClose,
} from "@/components/config/config-dialog-styles";
import { taskTitle } from "@/lib/my-task-filters";
import { Task } from "@/lib/types";
import { resolveTaskDisplayStatus } from "@/lib/utils";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
};

function toDateTimeLocal(value?: string | Date) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MyTaskQuickEditModal({ open, onOpenChange, task }: Props) {
  const { mutate } = useSWRConfig();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setName(task.serviceInformation?.trim() || taskTitle(task));
    setDescription(task.description?.trim() ?? "");
    setDeadline(toDateTimeLocal(task.deadline));
    setProgress(Number(task.progress ?? 0));
  }, [task]);

  async function handleSave() {
    if (!task?.id) return;
    if (!name.trim()) {
      toast.error("Task name is required");
      return;
    }

    setSaving(true);
    try {
      const nextProgress = Math.min(100, Math.max(0, Number(progress)));
      const displayStatus = resolveTaskDisplayStatus({
        ...task,
        progress: nextProgress,
      });
      const result = await editTask({
        taskId: task.id,
        serviceInformation: name.trim(),
        description: description.trim() || name.trim(),
        deadline: deadline ? new Date(deadline) : null,
        progress: nextProgress,
        status: nextProgress >= 100 ? "completed" : displayStatus === "overdue" ? "overdue" : "pending",
      });
      if (result.success) {
        toast.success("Task updated");
        await mutate(SWR_CACH_KEYS.myTasks.key);
        await mutate(SWR_CACH_KEYS.myTasksBoard.key);
        await mutate(SWR_CACH_KEYS.tasks.key);
        onOpenChange(false);
      } else {
        toast.error(result.errors?.message ?? "Failed to update task");
      }
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
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task name, description, deadline, and progress.
          </DialogDescription>
        </DialogHeader>
        <div className={configDialogBodyClass}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">
              Task name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={configCompactInputClass}
              placeholder="Task name"
              disabled={saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={configTextareaClass}
              placeholder="Task details..."
              disabled={saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={configCompactInputClass}
              disabled={saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">
              Progress (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
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
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
