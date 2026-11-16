export const PROJECT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const PROJECT_TYPE_OPTIONS = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONE_TIME", label: "One-Time" },
] as const;
