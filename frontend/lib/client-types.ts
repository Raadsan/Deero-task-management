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

export const CONTRACT_REGISTRATION_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const CONTRACT_STATUS_OPTIONS = [
  ...CONTRACT_REGISTRATION_STATUS_OPTIONS,
  { value: "TERMINATED", label: "Cancelled" },
  { value: "RENEWED", label: "Renewed" },
] as const;

export const CONTRACT_DURATION_OPTIONS = [
  { value: "ONE_MONTH", label: "1 Month" },
  { value: "THREE_MONTHS", label: "3 Months" },
  { value: "SIX_MONTHS", label: "6 Months" },
  { value: "TWELVE_MONTHS", label: "12 Months" },
  { value: "ENDLESS", label: "Endless" },
] as const;

export const CONTRACT_TYPE_OPTIONS = [
  { value: "ONE_TIME", label: "One-time" },
  { value: "MONTHLY", label: "Monthly" },
] as const;

export const ONE_TIME_PAYMENT_TERM_OPTIONS = [
  { value: "ADVANCE_70_30", label: "70% Advance / 30% Completion" },
  { value: "ADVANCE_50_50", label: "50% Advance / 50% Completion" },
  { value: "FULL_ON_COMPLETION", label: "Full Payment on Completion" },
] as const;

export const MONTHLY_PAYMENT_TERM_OPTIONS = [
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUALLY", label: "Semi-Annual" },
  { value: "ANNUALLY", label: "Annual" },
  { value: "CUSTOM", label: "Custom percentage-based payments" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "FULL_PAYMENT", label: "Full Payment" },
] as const;

export const CONTRACT_PAYMENT_TERMS_OPTIONS = [
  ...ONE_TIME_PAYMENT_TERM_OPTIONS,
  ...MONTHLY_PAYMENT_TERM_OPTIONS,
] as const;

export type ContractDuration = (typeof CONTRACT_DURATION_OPTIONS)[number]["value"];

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
