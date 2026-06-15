"use client";

import { getTaskNotifications, markNotificationAsSeen } from "@/lib/actions/task.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { TaskNotification } from "@/lib/types";
import { formatTaskDeadline } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const notificationLabels: Record<TaskNotification["type"], string> = {
  "new-assignment":
    "You are assigned to do this task and complete it by deadline.",
  "deadline-soon":
    "Reminder: you are assigned to do this task and complete it by deadline.",
  "supervisor-assignment":
    "You are supervisor for this task. See the details below.",
  "task-completed": "Your assigned user completed this task.",
  "task-updated": "A user updated the status or progress of this task.",
  "user-login": "A user logged into the system.",
};

function getNotificationDetails(notification: TaskNotification) {
  if (notification.type === "user-login") {
    return {
      primary: notification.taskName,
      secondary: notification.assigneeName,
      metaLabel: "Logged in",
      metaValue: formatTaskDeadline(notification.deadline),
    };
  }

  if (
    notification.type === "supervisor-assignment" ||
    notification.type === "task-completed" ||
    notification.type === "task-updated"
  ) {
    return {
      primary:
        notification.type === "task-updated"
          ? `Updated by: ${notification.assigneeName}`
          : `Assigned user: ${notification.assigneeName}`,
      secondary: notification.taskName,
      metaLabel: "Deadline",
      metaValue: formatTaskDeadline(notification.deadline),
    };
  }

  return {
    primary: "You are the assigned user",
    secondary: notification.taskName,
    metaLabel: "Deadline",
    metaValue: formatTaskDeadline(notification.deadline),
  };
}

export default function TaskNotifications() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: notificationsResponse, mutate } = useSWR(
    SWR_CACH_KEYS.taskNotifications.key,
    getTaskNotifications,
    {
      refreshInterval: 60_000,
    },
  );

  const unreadNotifications = notificationsResponse?.data ?? [];
  const hasNotifications = unreadNotifications.length > 0;

  const markAsRead = async (idsToMark: string[]) => {
    if (!idsToMark.length) return;

    await Promise.all(idsToMark.map((id) => markNotificationAsSeen(id)));
    await mutate();
  };

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      className="relative size-8 rounded-full text-zinc-700 hover:bg-zinc-100"
    >
      <Bell className="size-4" strokeWidth={1.75} />
      {hasNotifications ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-none text-white">
          {unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}
        </span>
      ) : null}
    </Button>
  );

  if (!mounted) {
    return triggerButton;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          markAsRead(unreadNotifications.map((notification) => notification.id));
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] border-zinc-200 bg-white p-0"
      >
        <div className="border-b border-zinc-200 px-4 py-3">
          <h4 className="text-sm font-semibold text-zinc-900">Notifications</h4>
        </div>

        {hasNotifications ? (
          <div className="max-h-[360px] space-y-3 overflow-y-auto px-4 py-3">
            {unreadNotifications.map((notification) => {
              const details = getNotificationDetails(notification);

              return (
                <div
                  key={notification.id}
                  className="space-y-1 rounded-md border border-zinc-200 p-2.5"
                >
                  <p className="text-xs font-medium text-zinc-600">
                    {notificationLabels[notification.type]}
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {details.primary}
                  </p>
                  <p
                    className={cn(
                      "text-xs text-zinc-700",
                      notification.type === "user-login" ? "" : "line-clamp-2",
                    )}
                  >
                    {notification.type === "user-login"
                      ? `Email: ${details.secondary}`
                      : `Description: ${details.secondary}`}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {details.metaLabel}: {details.metaValue}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No new notifications.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
