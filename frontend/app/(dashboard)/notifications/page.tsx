"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import {
  configCompactInputClass,
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
import { getTaskNotifications, markNotificationAsSeen } from "@/lib/actions/task.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { TaskNotification } from "@/lib/types";
import { formatTaskDeadline } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import toast from "react-hot-toast";

function readableType(type: TaskNotification["type"]) {
  if (type === "new-assignment") return "New Assignment";
  if (type === "deadline-soon") return "Deadline Reminder";
  if (type === "supervisor-assignment") return "Supervisor Assignment";
  if (type === "task-completed") return "Task Completed";
  if (type === "task-updated") return "Task Updated";
  return "User Login";
}

function detailLine(notification: TaskNotification) {
  if (notification.type === "user-login") {
    return `Email: ${notification.assigneeName}`;
  }
  return notification.taskName || "No description";
}

export default function NotificationsRoutePage() {
  const [busy, setBusy] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [activeNotification, setActiveNotification] = useState<TaskNotification | null>(null);
  const [openDetails, setOpenDetails] = useState(false);
  const { data, isLoading, mutate } = useSWR(
    SWR_CACH_KEYS.taskNotifications.key,
    getTaskNotifications,
    { refreshInterval: 60_000 },
  );

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !Boolean(Number(n.isSeen ?? 0))).length;

  async function markAllAsRead() {
    const unseen = notifications.filter((n) => !Boolean(Number(n.isSeen ?? 0)));
    if (!unseen.length) return;
    setBusy(true);
    try {
      await Promise.all(unseen.map((n) => markNotificationAsSeen(n.id)));
      await mutate();
      toast.success("All notifications marked as read");
    } finally {
      setBusy(false);
    }
  }

  function openNotification(notification: TaskNotification) {
    setActiveNotification(notification);
    setOpenDetails(true);
  }

  const selectedInitial = (activeNotification?.assigneeName || "U").charAt(0).toUpperCase();
  const selectedDate = activeNotification
    ? formatTaskDeadline(activeNotification.createdAt || activeNotification.deadline)
    : "";

  async function markActiveAsRead() {
    if (!activeNotification) return;
    setMarkingRead(true);
    try {
      await markNotificationAsSeen(activeNotification.id);
      await mutate();
      setOpenDetails(false);
      toast.success("Marked as read");
    } finally {
      setMarkingRead(false);
    }
  }

  const isActiveUnread = activeNotification
    ? !Boolean(Number(activeNotification.isSeen ?? 0))
    : false;

  return (
    <ManagementPageShell title="Notifications">
      <div className="mb-4 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Notifications</h2>
          <p className="text-xs text-zinc-500">
            Stored in database. Notifications stay visible until you mark them as read.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void markAllAsRead()}
          disabled={busy || unreadCount === 0}
        >
          {busy ? "Marking..." : "Mark all as read"}
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-100 bg-zinc-50" />
          ))
        ) : notifications.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-500">
            No new notifications.
          </p>
        ) : (
          notifications.map((notification) => {
            const isSeen = Boolean(Number(notification.isSeen ?? 0));
            const initial = (notification.assigneeName || "U").charAt(0).toUpperCase();
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-extrabold text-primary">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-base font-semibold text-zinc-900">
                        {notification.assigneeName || "Unknown user"}
                      </p>
                      <p className="shrink-0 text-[11px] font-medium text-zinc-500">
                        {formatTaskDeadline(notification.createdAt || notification.deadline)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {readableType(notification.type)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-700">{detailLine(notification)}</p>
                    {!isSeen ? (
                      <span className="mt-1 inline-flex rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        New
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent
          className={configDialogShellClass}
          onInteractOutside={preventConfigDialogClose}
          onEscapeKeyDown={preventConfigDialogClose}
        >
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>View full notification information.</DialogDescription>
          </DialogHeader>

          {activeNotification ? (
            <>
              <div className={configDialogBodyClass}>
                <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                    {selectedInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {activeNotification.assigneeName || "Unknown user"}
                    </p>
                    <p className="text-xs text-zinc-500">{selectedDate}</p>
                    {isActiveUnread ? (
                      <span className="mt-1 inline-flex rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Unread
                      </span>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">User</label>
                  <input
                    readOnly
                    value={activeNotification.assigneeName || "Unknown user"}
                    className={configCompactInputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Date</label>
                  <input readOnly value={selectedDate} className={configCompactInputClass} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Type</label>
                  <input
                    readOnly
                    value={readableType(activeNotification.type)}
                    className={configCompactInputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Message</label>
                  <textarea
                    readOnly
                    value={detailLine(activeNotification)}
                    className={configTextareaClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">
                    Task / details
                  </label>
                  <textarea
                    readOnly
                    value={activeNotification.taskName || "N/A"}
                    className={configTextareaClass}
                  />
                </div>
              </div>

              <div className={configDialogFooterClass}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenDetails(false)}
                  disabled={markingRead}
                >
                  Close
                </Button>
                {isActiveUnread ? (
                  <Button
                    type="button"
                    onClick={() => void markActiveAsRead()}
                    disabled={markingRead}
                  >
                    {markingRead ? "Saving..." : "Mark as read"}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </ManagementPageShell>
  );
}
