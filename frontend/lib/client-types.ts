export type ClientType =
  | "ONE_TIME"
  | "MANAGED_ON_DEMAND"
  | "MANAGED_RECURRING";

export type ContentType =
  | "VIDEO"
  | "GRAPHIC_DESIGN"
  | "PHOTOGRAPHY"
  | "SOCIAL_MEDIA_POST"
  | "MARKETING_CAMPAIGN"
  | "OTHER";

export const CONTRACT_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "RENEWED", label: "Renewed" },
] as const;

export type ContractStatus = (typeof CONTRACT_STATUS_OPTIONS)[number]["value"];

export type RecurrenceType = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

export const CLIENT_TYPE_OPTIONS: Array<{
  value: ClientType;
  title: string;
  description: string;
  shortLabel: string;
}> = [
  {
    value: "ONE_TIME",
    title: "Single Job",
    shortLabel: "Single Job",
    description: "Hal shaqo oo keliya — logo, video, website, sawir.",
  },
  {
    value: "MANAGED_ON_DEMAND",
    title: "Regular Client",
    shortLabel: "Regular",
    description: "Macmiil joogto ah — shaqo cusub marka uu codsado.",
  },
  {
    value: "MANAGED_RECURRING",
    title: "Scheduled Client",
    shortLabel: "Scheduled",
    description: "Jadwal go'an — content bille ama usbuucii.",
  },
];

export const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: "VIDEO", label: "Video" },
  { value: "GRAPHIC_DESIGN", label: "Graphic Design" },
  { value: "PHOTOGRAPHY", label: "Photography" },
  { value: "SOCIAL_MEDIA_POST", label: "Social Media Post" },
  { value: "MARKETING_CAMPAIGN", label: "Marketing Campaign" },
  { value: "OTHER", label: "Other" },
];

export const RECURRENCE_TYPE_OPTIONS: Array<{ value: RecurrenceType; label: string }> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "DAILY", label: "Daily" },
  { value: "CUSTOM", label: "Custom" },
];

export const WEEKDAY_OPTIONS = [
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

export const DEFAULT_WEEKLY_SCHEDULE_STEPS = [
  { dayOfWeek: 1, label: "Video Shoot", contentType: "VIDEO" as ContentType, stepOrder: 1 },
  { dayOfWeek: 2, label: "Editing", contentType: "VIDEO" as ContentType, stepOrder: 2 },
  { dayOfWeek: 3, label: "Review", contentType: "VIDEO" as ContentType, stepOrder: 3 },
  { dayOfWeek: 4, label: "Approval", contentType: "VIDEO" as ContentType, stepOrder: 4 },
  {
    dayOfWeek: 5,
    label: "Publishing",
    contentType: "SOCIAL_MEDIA_POST" as ContentType,
    stepOrder: 5,
  },
];

export function clientTypeLabel(type?: string | null) {
  return CLIENT_TYPE_OPTIONS.find((o) => o.value === type)?.title ?? "Single Job";
}
