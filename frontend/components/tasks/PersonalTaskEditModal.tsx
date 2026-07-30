"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { patchMyTask } from "@/lib/apis/myTasksApi";
import { configCompactInputClass, configDialogBodyClass, configDialogFooterClass, configDialogHeaderClass, configDialogShellClass, configTextareaClass, preventConfigDialogClose } from "@/components/config/config-dialog-styles";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { taskTitle } from "@/lib/my-task-filters";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; task: Task | null };

function datetimeLocal(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function PersonalTaskEditModal({ open, onOpenChange, task }: Props) {
  const { mutate } = useSWRConfig();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [deadline, setDeadline] = useState("");
  const [extraHours, setExtraHours] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setName(taskTitle(task));
    setDescription(task.description ?? "");
    setPriority(String(task.priority ?? "Normal"));
    setDeadline(datetimeLocal(task.deadline));
    setExtraHours(String(Number(task.extraTimeMinutes ?? 0) / 60));
  }, [open, task]);

  async function save() {
    if (!task?.id || !name.trim()) return;
    setSaving(true);
    try {
      await patchMyTask(String(task.id), {
        serviceInformation: name.trim(),
        description: description.trim() || name.trim(),
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        extraTimeMinutes: Math.max(0, Math.round(Number(extraHours || 0) * 60)),
      });
      await Promise.all([
        mutate(SWR_CACH_KEYS.myTasksBoard.key),
        mutate(SWR_CACH_KEYS.myTasksList.key),
        mutate(SWR_CACH_KEYS.myTasksToday.key),
      ]);
      toast.success("Task details updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={configDialogShellClass} onInteractOutside={preventConfigDialogClose} onEscapeKeyDown={preventConfigDialogClose}>
      <DialogHeader className={configDialogHeaderClass}><DialogTitle>Edit Task</DialogTitle><DialogDescription>Edit task information. Progress is updated from the separate Progress action.</DialogDescription></DialogHeader>
      <div className={cn(configDialogBodyClass, "space-y-4")}>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600">Task name</span><input value={name} onChange={(event) => setName(event.target.value)} className={configCompactInputClass} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600">Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className={configTextareaClass} /></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600">Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)} className={configCompactInputClass}><option value="Low">Low</option><option value="Normal">Normal</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600">Deadline</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={configCompactInputClass} /></label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600">Extra time (hours)</span><input type="number" min={0} step={0.5} value={extraHours} onChange={(event) => setExtraHours(event.target.value)} className={configCompactInputClass} /><span className="mt-1 block text-xs text-zinc-500">For overdue tasks, add enough time to move the effective deadline into the future. Progress will then unlock.</span></label>
      </div>
      <div className={configDialogFooterClass}><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button type="button" onClick={() => void save()} disabled={saving || !task || !name.trim()}>{saving ? "Saving..." : "Save Changes"}</Button></div>
    </DialogContent>
  </Dialog>;
}
