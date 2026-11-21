"use client";

import { approveTask, rejectTask } from "@/lib/apis/taskApi";
import { authClient } from "@/lib/auth-client";
import { btnFormSubmit } from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  task: Task;
  onDone?: () => void | Promise<void>;
};

function canReview(role?: string | null, supervisor?: string, userId?: string, userName?: string) {
  const normalized = String(role || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (normalized === "admin" || normalized === "superadmin" || normalized.includes("manager")) return true;
  const sup = String(supervisor || "").trim();
  if (!sup || !userId) return false;
  return sup === userId || sup === userName;
}

export default function TaskReviewActions({ task, onDone }: Props) {
  const session = authClient.useSession();
  const user = session.data?.user as { id?: string; name?: string; role?: string } | undefined;
  const [comments, setComments] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  if (String(task.status).toLowerCase() !== "pending_review") return null;
  if (!canReview(user?.role, task.supervisor, user?.id, user?.name)) return null;

  async function handleApprove() {
    setBusy("approve");
    try {
      const result = await approveTask(String(task.id), comments.trim() || undefined);
      if (!result.success) {
        toast.error(result.errors?.message || "Could not approve task");
        return;
      }
      toast.success("Task approved and completed");
      setComments("");
      await onDone?.();
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    if (!comments.trim()) {
      toast.error("Revision comments are required");
      return;
    }
    setBusy("reject");
    try {
      const grant = Math.max(0, Number(extraMinutes) || 0);
      const result = await rejectTask(String(task.id), {
        comments: comments.trim(),
        extraTimeMinutes: grant > 0 ? grant : undefined,
      });
      if (!result.success) {
        toast.error(result.errors?.message || "Could not reject submission");
        return;
      }
      toast.success(grant > 0 ? "Submission rejected; extra time granted" : "Submission rejected; task returned to in progress");
      setComments("");
      setExtraMinutes("");
      await onDone?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 space-y-3">
      <p className="text-sm font-semibold text-sky-900">Pending review — manager action</p>
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Review comments (required for rejection)"
        rows={3}
        className="w-full resize-none rounded-lg border border-sky-200 bg-white p-2 text-xs"
      />
      <label className="flex flex-col gap-1 text-xs text-sky-900">
        Optional extra time (minutes)
        <input
          type="number"
          min={0}
          value={extraMinutes}
          onChange={(e) => setExtraMinutes(e.target.value)}
          className="h-9 rounded-lg border border-sky-200 bg-white px-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleApprove()}
          className={btnFormSubmit}
        >
          {busy === "approve" ? "Approving…" : "Approve & Complete"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleReject()}
          className="h-10 rounded-lg border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          {busy === "reject" ? "Rejecting…" : "Reject & return to in progress"}
        </button>
      </div>
    </div>
  );
}