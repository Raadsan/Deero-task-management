"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBackendSessionClient } from "@/lib/apis/readApi";
import { holdTask, resumeTask } from "@/lib/apis/taskApi";
import { authClient } from "@/lib/auth-client";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormSubmit } from "@/lib/dashboard-ui";
import {
  APP_TIMEZONE,
  formatHoldDuration,
  holdSnapshot,
  isScheduleManager,
} from "@/lib/scheduled-task-window";
import { useNow } from "@/lib/use-now";
import { resolveTaskDisplayStatus } from "@/lib/utils";
import { useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

type HoldTask = {
  id: string;
  status?: string;
  progress?: number | null;
  features?: unknown;
};

function clockLabel(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return "";
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function whenLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TaskHoldPanel({ task }: { task: HoldTask }) {
  const { mutate } = useSWRConfig();
  const now = useNow();
  const session = authClient.useSession();
  const { data: backendSession } = useSWR("hold-actor-session", getBackendSessionClient);
  const clientRole = (session.data?.user as { role?: string } | undefined)?.role;
  const backendRole = backendSession?.data?.user?.role;
  const canManage = isScheduleManager(backendRole) || isScheduleManager(clientRole);
  const hold = holdSnapshot(task.features, now);
  const statusKey = resolveTaskDisplayStatus(task, undefined, now).toLowerCase().replace(/\s+/g, "_");
  const onHold = statusKey === "on_hold" && hold.active;
  const showResume = canManage && onHold;
  const showHoldButton = canManage && statusKey === "in_progress" && !onHold;
  const finishedHolds = hold.history.filter((event) => event.action === "RESUME" || Boolean(event.resumeAt));
  const historyRows = onHold ? finishedHolds : (finishedHolds.length ? finishedHolds : hold.history);
  const showCard = onHold || hold.history.length > 0;
  const [open, setOpen] = useState<"hold" | "resume" | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!showCard && !showHoldButton) return null;

  async function refresh() {
    await Promise.all([
      mutate(SWR_CACH_KEYS.tasks.key),
      mutate(SWR_CACH_KEYS.myTasks.key),
      mutate(SWR_CACH_KEYS.myTasksList.key),
      mutate(SWR_CACH_KEYS.myTasksToday.key),
      mutate(SWR_CACH_KEYS.myTasksCompany.key),
      mutate(SWR_CACH_KEYS.myTasksBoard.key),
    ]);
  }

  async function confirmHold() {
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    setSaving(true);
    const result = await holdTask(task.id, reason.trim());
    setSaving(false);
    if (!result.success) {
      toast.error(result.errors?.message || "Could not put the task on hold");
      return;
    }
    setOpen(null);
    setReason("");
    await refresh();
    toast.success("Task put on hold");
  }

  async function confirmResume() {
    setSaving(true);
    const result = await resumeTask(task.id);
    setSaving(false);
    if (!result.success) {
      toast.error(result.errors?.message || "Could not resume the task");
      return;
    }
    setOpen(null);
    await refresh();
    toast.success("Task resumed");
  }

  return (
    <>
    {showCard ? (
    <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet-800">{onHold ? "On Hold" : "Hold History"}</p>
          <div className="mt-1 space-y-0.5 text-sm text-zinc-700">
            {onHold && hold.reason ? <p>Reason: {hold.reason}</p> : null}
            {onHold && hold.startedAt ? <p>Hold Started: {whenLabel(hold.startedAt)}</p> : null}
            {onHold ? <p>Current Hold Duration: {formatHoldDuration(hold.currentHoldMs)}</p> : null}
            {hold.originalEndTime ? <p>Original End: {clockLabel(hold.originalEndTime)}</p> : null}
            {hold.totalHoldMs ? <p>Total Hold Duration: {formatHoldDuration(hold.totalHoldMs)}</p> : null}
            {hold.adjustedEndTime ? (
              <p>{onHold ? "Projected Adjusted End" : "Adjusted End"}: {clockLabel(hold.adjustedEndTime)}</p>
            ) : null}
          </div>
        </div>
        {showHoldButton ? (
          <Button type="button" size="sm" variant="outline" onClick={() => { setReason(""); setOpen("hold"); }}>Put On Hold</Button>
        ) : null}
      </div>
      {showResume ? (
        <Button type="button" size="sm" className={`${btnFormSubmit} mt-3`} onClick={() => setOpen("resume")}>
          Resume
        </Button>
      ) : null}
      {historyRows.length ? (
        <ul className="mt-3 space-y-2">
          {historyRows.map((event, index) => (
            <li key={`${event.action}-${event.holdStart}-${event.resumeAt || ""}-${index}`} className="rounded-md border border-violet-100 bg-white px-3 py-2 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-800">{event.resumeAt ? "Hold" : "Put on hold"}</span>
              {event.userName ? ` · ${event.userName}` : ""}
              {event.holdStart ? ` · ${whenLabel(event.holdStart)}` : ""}
              {event.resumeAt ? ` to ${whenLabel(event.resumeAt)}` : ""}
              {event.reason ? ` · ${event.reason}` : ""}
              {event.holdDurationMs ? ` · ${formatHoldDuration(event.holdDurationMs)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
    ) : showHoldButton ? (
      <Button type="button" size="sm" variant="outline" onClick={() => { setReason(""); setOpen("hold"); }}>Put On Hold</Button>
    ) : null}

      <Dialog open={open === "hold"} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="border-zinc-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Put this task on hold?</DialogTitle>
            <DialogDescription>Progress stays as it is. The employee cannot update it until you resume the task.</DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-24 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Reason for putting the task on hold"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button type="button" className={btnFormSubmit} disabled={saving} onClick={confirmHold}>
              {saving ? "Saving…" : "Put On Hold"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "resume"} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="border-zinc-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resume this task?</DialogTitle>
            <DialogDescription>
              The time it was on hold is added to the original end time. The scheduled date, start time, progress, and employee stay the same.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button type="button" className={btnFormSubmit} disabled={saving} onClick={confirmResume}>
              {saving ? "Saving…" : "Resume"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
