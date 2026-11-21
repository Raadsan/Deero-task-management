export const TASK_STATUS_VALUES = [
  "pending",
  "in_progress",
  "pending_review",
  "overdue",
  "on_hold",
  "completed",
] as const;

export type TaskStatusValue = (typeof TASK_STATUS_VALUES)[number];

export const TASK_STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_review", label: "Pending Review" },
  { value: "overdue", label: "Overdue" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];