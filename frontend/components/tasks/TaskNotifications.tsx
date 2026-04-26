"use client";

import { getTaskNotifications } from "@/lib/actions/task.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { TaskNotification } from "@/lib/types";
import { formatTaskDeadline } from "@/lib/utils";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const TASK_NOTIFICATIONS_SEEN_STORAGE_KEY = "task-notifications-seen-ids";

const notificationLabels: Record<TaskNotification["type"], string> = {
  "new-assignment":
    "You are assigned to do this task and complete it by deadline.",
  "deadline-soon":
    "Reminder: you are assigned to do this task and complete it by deadline.",
  "supervisor-assignment":
    "You are supervisor for this task. See the details below.",
  "task-completed": "Your assigned user completed this task.",
};

export default function TaskNotifications() {
  const [open, setOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([]);

  const { data: notificationsResponse } = useSWR(
    SWR_CACH_KEYS.taskNotifications.key,
    getTaskNotifications,
    {
      refreshInterval: 60_000,
    },
  );

  const notifications = notificationsResponse?.data ?? [];
  const unreadNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => !seenNotificationIds.includes(notification.id),
      ),
    [notifications, seenNotificationIds],
  );
  const hasNotifications = unreadNotifications.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedValue = localStorage.getItem(
      TASK_NOTIFICATIONS_SEEN_STORAGE_KEY,
    );
    if (!cachedValue) return;
    try {
      const parsed = JSON.parse(cachedValue);
      if (Array.isArray(parsed)) {
        setSeenNotificationIds(
          parsed.filter((item) => typeof item === "string"),
        );
      }
    } catch {
      setSeenNotificationIds([]);
    }
  }, []);

  const markAsRead = (idsToMark: string[]) => {
    if (!idsToMark.length) return;
    const nextSeenIds = Array.from(
      new Set([...seenNotificationIds, ...idsToMark]),
    );
    setSeenNotificationIds(nextSeenIds);

    if (typeof window !== "undefined") {
      localStorage.setItem(
        TASK_NOTIFICATIONS_SEEN_STORAGE_KEY,
        JSON.stringify(nextSeenIds),
      );
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          // Mark current unread items as seen only after user closes popover.
          markAsRead(
            unreadNotifications.map((notification) => notification.id),
          );
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="relative h-10 w-10 rounded-full border-black/20 p-0"
          aria-label="Task notifications"
        >
          <Bell className="h-5 w-5" />
          {hasNotifications ? (
            <span className="bg-secondary-100 absolute -top-1.5 -right-1.5 flex h-7 min-w-7 animate-pulse items-center justify-center rounded-full px-1.5 text-sm font-bold text-white shadow-md">
              {unreadNotifications.length > 9
                ? "9+"
                : unreadNotifications.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="border-secondary-100 w-[360px] bg-white p-0 opacity-100"
      >
        <div className="border-b border-black/10 px-4 py-3">
          <h4 className="text-sm font-semibold">Task Notifications</h4>
        </div>

        {hasNotifications ? (
          <div className="max-h-[360px] space-y-3 overflow-y-auto px-4 py-3">
            {unreadNotifications.map((notification) => (
              <div
                key={notification.id}
                className="space-y-1 rounded-md border border-black/10 p-2.5"
              >
                <p className="text-xs font-medium text-black/75">
                  {notificationLabels[notification.type]}
                </p>
                <p className="text-sm font-semibold">
                  {notification.type === "supervisor-assignment" ||
                  notification.type === "task-completed"
                    ? `Assigned user: ${notification.assigneeName}`
                    : "You are the assigned user"}
                </p>
                <p className="text-xs text-black/80">
                  Description: {notification.taskName}
                </p>
                <p className="text-xs text-black/80">
                  Deadline: {formatTaskDeadline(notification.deadline)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-black/60">
            No new notifications.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
