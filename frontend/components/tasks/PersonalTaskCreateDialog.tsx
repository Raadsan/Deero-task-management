"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SWR_CACH_KEYS } from "@/lib/constants";
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
import { authClient } from "@/lib/auth-client";
import { createPersonalTask } from "@/lib/apis/myTasksApi";
import { useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function PersonalTaskCreateDialog({ open, onOpenChange }: Props) {
  const session = authClient.useSession();
  const { mutate } = useSWRConfig();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const userId = session.data?.user?.id;
    if (!userId) {
      toast.error("Session not found");
      return;
    }
    if (!name.trim()) {
      toast.error("Task name is required");
      return;
    }

    setSaving(true);
    try {
      await createPersonalTask({
        assgineeId: userId,
        description: description.trim() || name.trim(),
        serviceInformation: name.trim(),
        priority,
        deadline: dueAt ? new Date(dueAt).toISOString() : null,
      });

      toast.success("Task created");
      setName("");
      setDescription("");
      setPriority("Normal");
      setDueAt("");
      onOpenChange(false);
      void mutate(SWR_CACH_KEYS.myTasks.key);
      void mutate(SWR_CACH_KEYS.myTasksBoard.key);
      void mutate(SWR_CACH_KEYS.tasks.key);
    } catch {
      toast.error("Failed to create task. Please try again.");
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
          <DialogTitle>Create Personal Task</DialogTitle>
          <DialogDescription>
            Add a personal task assigned to you. It is saved in the database.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className={configDialogBodyClass}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">
                Task name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={configCompactInputClass}
                placeholder="e.g. Prepare weekly report"
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={configCompactSelectClass}
                  disabled={saving}
                >
                  <option value="Normal">Normal</option>
                  <option value="Medium">Medium</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
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
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
