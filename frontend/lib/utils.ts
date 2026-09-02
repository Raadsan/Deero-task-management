import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEEERO_SERVICE_SUBCATEGORIES, ROUTES } from "./constants";

import { v4 as uuid } from "uuid";
import { TaskStatus, UserRole } from "./schema";
import {
  DashboardViewMetric,
  PrefixType,
  StatusColorConfig,
  TableType,
} from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function computeFontSize(fontSizeInPixel: number) {
  return `${fontSizeInPixel / 16}rem`;
}

export function deleteQueryParams(keys: Array<string>) {
  const querySearchParams = new URLSearchParams(
    new URL(window.location.href).search,
  );
  keys.map((each) => {
    querySearchParams.delete(each);
  });
  return `${window.location.pathname}?${querySearchParams.toString()}`;
}

// update search Params
export function updateUrlWithQueryParams({
  maps,
}: {
  maps: Array<{ key: string; value: string }>;
}) {
  const queryParams = new URLSearchParams(new URL(window.location.href).search);

  if (maps) {
    maps.forEach(({ key, value }) => {
      if (value) {
        queryParams.set(key, value);
      } else {
        queryParams.delete(key);
      }
    });
  }

  return `${window.location.pathname}?${queryParams.toString()}`;
}

interface Props {
  completed: StatusColorConfig;
  pending: StatusColorConfig;
  active: StatusColorConfig;
  overdue: StatusColorConfig;
}
export function getColorAndBgColorStatus(data: Props, columnId: string) {
  const keys = Object.entries(data);
  if (keys.some(([key]) => key === columnId)) {
    const status = keys.find(([key]) => {
      return key === columnId;
    });

    return {
      color: status ? status.at(-1).color : "white",
      bgColor: status ? status.at(-1).bgColor : "green",
    };
  }
  return {
    color: "white",
    bgColor: "green",
  };
}

export function formatDate(date: Date | string, longform?: boolean) {
  if (typeof date === "string" && !date.length) return undefined;
  const d = new Date(date);

  if (longform) {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function isTaskPastDeadline(deadline: Date | string, extraTimeMinutes: number = 0) {
  const deadlineMs = new Date(deadline).getTime();
  const extraMs = Math.max(0, Number(extraTimeMinutes || 0)) * 60_000;
  return (deadlineMs + extraMs) < Date.now();
}

export function resolveTaskDisplayStatus(
  task: {
    status?: string;
    deadline?: Date | string | null;
    extraTimeMinutes?: number | null;
    extraTimeHours?: number | null;
    progress?: number;
    assgineeId?: string;
    assignedToId?: string;
    assignedTo?: { id: string };
    transferHistory?: Array<{ fromAssigneeId?: string }>;
    startDate?: Date | string | null;
  },
  currentUserId?: string,
) {
  const currentAssigneeId = task.assgineeId ?? task.assignedToId ?? task.assignedTo?.id;
  if (
    currentUserId &&
    currentAssigneeId &&
    currentAssigneeId !== currentUserId &&
    task.transferHistory?.some((h) => h.fromAssigneeId === currentUserId)
  ) {
    return "transferred";
  }

  if (task.status === "transferred") return "transferred";
  const progress = Number(task.progress ?? 0);
  if (task.status === "completed" || progress >= 100) return "completed";
  const extraMinutes = Number(task.extraTimeMinutes ?? (Number(task.extraTimeHours ?? 0) * 60));
  if (task.deadline && isTaskPastDeadline(task.deadline, extraMinutes)) return "overdue";

  if (task.status === "overdue") {
    return task.startDate && new Date(task.startDate).getTime() > Date.now()
      ? "pending"
      : "in_progress";
  }

  // If start date is reached, display as in_progress
  if (task.startDate && new Date(task.startDate).getTime() <= Date.now()) {
    return "in_progress";
  }

  return task.status || "pending";
}

export function formatTaskDeadline(
  deadline: Date | string | null | undefined,
  context?: {
    status?: string;
    progress?: number;
    startDate?: Date | string | null;
    extraTimeMinutes?: number | null;
    extraTimeHours?: number | null;
    assgineeId?: string;
    assignedToId?: string;
    assignedTo?: { id: string };
    transferHistory?: Array<{ fromAssigneeId?: string }>;
  },
) {
  if (!deadline) return "No due date";

  const parsedDeadline = new Date(deadline);
  if (Number.isNaN(parsedDeadline.getTime())) return String(deadline);

  const extraMinutes = Number(
    context?.extraTimeMinutes ?? (Number(context?.extraTimeHours ?? 0) * 60),
  );
  const effectiveDeadlineMs =
    parsedDeadline.getTime() + Math.max(0, extraMinutes) * 60_000;
  const effectiveDeadline = new Date(effectiveDeadlineMs);

  const dateLabel = effectiveDeadline.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeLabel = effectiveDeadline
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s+/g, "");

  const displayStatus = context
    ? resolveTaskDisplayStatus({ ...context, deadline })
    : isTaskPastDeadline(deadline)
      ? "overdue"
      : "pending";

  if (displayStatus === "completed") {
    return `Completed (${dateLabel})`;
  }

  if (displayStatus === "overdue") {
    return `Overdue by ${timeLabel}`;
  }

  const now = new Date();
  const startDateMs = context?.startDate ? new Date(context.startDate).getTime() : 0;
  const isPendingStart = displayStatus === "pending" && startDateMs > now.getTime();

  const targetMs = isPendingStart ? startDateMs : effectiveDeadlineMs;
  const diffMs = Math.max(0, targetMs - now.getTime());
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remainingHours = totalHours % 24;

  let durationLabel = "Less than 1 min";
  if (days >= 1) {
    const dayLabel = days === 1 ? "1 day" : `${days} days`;
    durationLabel = remainingHours > 0
      ? `${dayLabel} ${remainingHours === 1 ? "1 hr" : `${remainingHours} hrs`}`
      : dayLabel;
  } else if (totalHours >= 1) {
    durationLabel = totalHours === 1 ? "1 hr" : `${totalHours} hrs`;
  } else if (totalMinutes >= 1) {
    durationLabel = totalMinutes === 1 ? "1 min" : `${totalMinutes} mins`;
  }

  if (isPendingStart) {
    return `Starts in ${durationLabel}`;
  }

  return durationLabel;
}

export function taskDeadlineDate(task: {
  deadline?: Date | string | null;
  status?: string;
  completedAt?: Date | string | null;
  extraTimeMinutes?: number | null;
  extraTimeHours?: number | null;
}) {
  if (!task.deadline) return "No due date";
  const baseDate = task.status === "completed" && task.completedAt
    ? new Date(task.completedAt)
    : new Date(task.deadline);
  const extraMinutes = task.status === "completed"
    ? 0
    : Number(task.extraTimeMinutes ?? (Number(task.extraTimeHours ?? 0) * 60));
  const effectiveDate = new Date(baseDate.getTime() + Math.max(0, extraMinutes) * 60_000);

  if (Number.isNaN(effectiveDate.getTime())) return "No due date";
  return effectiveDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getTaskTableLabels(task: {
  serviceInformation?: string | null;
  description?: string | null;
  institutions?: Array<{ institution?: string; id?: string }> | null;
  department?: string | null;
}) {
  const combined = String(task.serviceInformation ?? "").trim();
  const linkedClient = String(task.institutions?.[0]?.institution ?? "").trim();

  // Split by " - "
  const parts = combined
    ? combined.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean)
    : [];

  let clientName = linkedClient && linkedClient !== "Internal" ? linkedClient : "";
  let remainingParts = [...parts];

  if (parts.length > 1) {
    if (!clientName) {
      clientName = parts[0];
      remainingParts = parts.slice(1);
    } else if (parts[0]?.toLowerCase() === clientName.toLowerCase()) {
      remainingParts = parts.slice(1);
    }
  } else if (parts.length === 1 && clientName && parts[0]?.toLowerCase() === clientName.toLowerCase()) {
    remainingParts = [];
  }

  if (!clientName) {
    clientName = linkedClient || "Internal";
  }

  // Ensure client name is never retained inside remainingParts
  if (
    remainingParts.length > 0 &&
    clientName &&
    clientName !== "Internal" &&
    remainingParts[0]?.toLowerCase() === clientName.toLowerCase()
  ) {
    remainingParts = remainingParts.slice(1);
  }

  // Also check if remainingParts[0] starts with clientName prefix
  if (
    remainingParts.length > 0 &&
    clientName &&
    clientName !== "Internal" &&
    remainingParts[0]?.toLowerCase().startsWith(clientName.toLowerCase())
  ) {
    remainingParts[0] = remainingParts[0]
      .slice(clientName.length)
      .replace(/^[\s—\-–]+/, "")
      .trim();
    if (!remainingParts[0]) {
      remainingParts = remainingParts.slice(1);
    }
  }

  let serviceName = "General";
  let extractedTaskName = "";

  if (remainingParts.length >= 2) {
    // e.g. ["Digital Marketing — Baahiye Package", "hh"]
    // Service is the middle part(s), Task Name is the last part!
    serviceName = remainingParts.slice(0, -1).join(" — ");
    extractedTaskName = remainingParts[remainingParts.length - 1];
  } else if (remainingParts.length === 1) {
    serviceName = remainingParts[0];
    extractedTaskName = remainingParts[0];
  } else if (task.department) {
    serviceName = task.department;
    extractedTaskName = "Task";
  }

  // Fallback cleanup if serviceName accidentally still has clientName prefix
  if (
    clientName &&
    clientName !== "Internal" &&
    serviceName.toLowerCase().startsWith(clientName.toLowerCase())
  ) {
    serviceName =
      serviceName
        .slice(clientName.length)
        .replace(/^[\s—\-–]+/, "")
        .trim() || "General";
  }

  const taskName = extractedTaskName || combined || "Untitled Task";
  const description = task.description?.trim() || "";

  return { taskName, clientName, serviceName, description };
}

// Track seen task notes in localStorage to clear Eye icon badge upon opening modal
export function getSeenTaskNoteIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("seen_task_note_ids");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markTaskNotesSeen(taskId: string | number) {
  if (typeof window === "undefined" || !taskId) return;
  try {
    const set = getSeenTaskNoteIds();
    set.add(String(taskId));
    localStorage.setItem("seen_task_note_ids", JSON.stringify(Array.from(set)));
    window.dispatchEvent(new Event("task-notes-seen-updated"));
  } catch {}
}

export function isTaskNotesUnseen(taskId: string | number, count: number): boolean {
  if (!count || count <= 0) return false;
  const set = getSeenTaskNoteIds();
  return !set.has(String(taskId));
}

type Params = {
  type: TableType;
  formatType: "diaglog" | "description" | "delete";
};
export function formatTexts({ type, formatType }: Params) {
  if (type === "users") {
    switch (formatType) {
      case "description":
        return "Are you sure to delete This User";
      case "diaglog":
        return "Delete The User";
      case "delete":
        return "Delete User";
    }
  } else if (type === "clients") {
    switch (formatType) {
      case "description":
        return "Are you sure to delete This Client";
      case "diaglog":
        return "Delete The Client";
      case "delete":
        return "Delete Client";
    }
  } else if (type === "contracts") {
    switch (formatType) {
      case "description":
        return "Are you sure you want to delete this contract and all uploaded documents?";
      case "diaglog":
        return "Delete Contract";
      case "delete":
        return "Delete Contract";
    }
  } else if (type == "expenses") {
    switch (formatType) {
      case "description":
        return "Are you sure to delete This Expense Transaction";
      case "diaglog":
        return "Delete The Expense Transaction";
      case "delete":
        return "Delete Transaction";
    }
  } else if (type == "incomes") {
    switch (formatType) {
      case "description":
        return "Are you sure to delete This Income Transaction";
      case "diaglog":
        return "Delete The Income Transaction";
      case "delete":
        return "Delete Transaction";
    }
  } else {
    switch (formatType) {
      case "description":
        return "Are you sure to delete This Task";
      case "diaglog":
        return "Delete The Task";
      case "delete":
        return "Delete Task";
    }
  }
}

export function dateDifferenceInMilliSeconds(date: Date | string | null | undefined) {
  if (!date) return "0";

  const currentDate = new Date();
  const givenDate = new Date(date);
  const timeDifference = currentDate.getTime() - givenDate.getTime();
  const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  return String(daysDifference);
}

export function capitalizeName(name: string) {
  const splitName = name.split(" ");
  return splitName
    .map((each) => {
      const firstCharacter = each.substring(0, 1).toUpperCase();
      const restOfName = each.substring(1).toLowerCase();
      return firstCharacter + restOfName;
    })
    .join(" ");
}

export function isUserAdminOrManager({
  currentUserRole,
  renderedUserRole,
}: {
  currentUserRole: UserRole;
  renderedUserRole: UserRole;
}) {
  if (currentUserRole === "superadmin") return true;
  else if (currentUserRole === "admin") {
    if (renderedUserRole === "admin" || renderedUserRole === "superadmin") {
      return false;
    }
    return true;
  }
}

export function getPageToEdit(tableType: TableType, id: string) {
  switch (tableType) {
    case "clients":
      return ROUTES.viewClient(id);
    case "users":
      return ROUTES.editUser(id);
    case "tasks":
      return ROUTES.editTask(id);
    case "my-tasks":
      return ROUTES["my-tasks-edit"](id);
  }
}

export function formatPhoneNumber(
  phoneNumber: string,
  format: "addCountryKey" | "removeCountryKey",
) {
  if (!phoneNumber.length) return "";
  else if (format === "addCountryKey") {
    return `+252${phoneNumber}`;
  } else {
    return phoneNumber.substring(4);
  }
}

export function normalizeClientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("252") && digits.length > 9) {
    return digits.slice(3);
  }
  return digits;
}

export function getTaskStatus(
  taskFormType: "edit" | "create" | "add" | "own:edit",
) {
  switch (taskFormType) {
    case "create":
      return Object.values(TaskStatus);
    case "edit":
      return Object.values(TaskStatus);
    case "own:edit":
      return Object.values(TaskStatus);
    case "add":
      return Object.values(TaskStatus).filter(
        (each: TaskStatus) => each === "pending",
      );
  }
}

export function getSubServices(categoryName: string): Array<string> {
  const category = DEEERO_SERVICE_SUBCATEGORIES.find(
    (cat) => categoryName in cat,
  );
  return category ? Object.values(category)[0] : [];
}

export function getPrefix(data: PrefixType) {
  switch (data) {
    case "clients":
      return "DCL";
    case "users":
      return "DUS";
    case "tasks":
      return "DTA";
    case "services":
      return "DSE";
    case "subservices":
      return "DSS";
    case "payments":
      return "DPA";
    case "invoice":
      return "DINV-";
    case "tax":
      return "DTX";
  }
}

export function fitlerDashboardMetric(
  type: "total" | "pending" | "completed",
): DashboardViewMetric {
  switch (type) {
    case "total":
      return {
        title: "Total Tasks",
        totalTasks: 1234,
      };
    case "pending":
      return {
        title: "Processing Tasks",
        totalTasks: 88,
      };
    case "completed":
      return {
        title: "Completed Tasks",
        totalTasks: 100,
      };
  }
}

export function getRandomUUID() {
  return uuid();
}

export function validateDate(date: Date) {
  const result = isNaN(date.getTime());
  return result ? undefined : date;
}

export function getFromToDateDescription({
  fromDate,
  toDate,
}: {
  fromDate?: Date;
  toDate?: Date;
}) {
  let dateDescription = "All Dates";
  const formatFrom = formatDate(fromDate ?? "");
  const formatToDate = formatDate(toDate ?? "");

  if (formatFrom && formatToDate) {
    dateDescription = `From ${formatFrom} to  ${formatToDate}`;
  } else if (formatFrom) {
    dateDescription = `From ${formatFrom} to Today `;
  } else if (formatToDate) {
    dateDescription = `From very beggining to  ${formatToDate}`;
  }

  return dateDescription;
}

export function sortStaffByCode<T extends { staffCode?: string | null; createdAt?: string | Date | null }>(
  a: T,
  b: T,
): number {
  const codeA = String(a?.staffCode ?? "").trim();
  const codeB = String(b?.staffCode ?? "").trim();

  if (!codeA && !codeB) {
    const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  }
  if (!codeA) return 1;
  if (!codeB) return -1;

  const regex = /^([A-Za-z]+)(\d{2})[#\-\s]?(\d+)$/;
  const matchA = codeA.match(regex);
  const matchB = codeB.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1].toUpperCase();
    const prefixB = matchB[1].toUpperCase();

    // 1. Sort by Prefix alphabetically (e.g. DAA before RT -> D before R)
    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB);
    }

    // 2. Sort by Year ascending (e.g. 19 before 20 before 24)
    const yearA = parseInt(matchA[2], 10);
    const yearB = parseInt(matchB[2], 10);
    if (yearA !== yearB) {
      return yearA - yearB;
    }

    // 3. Sort by Number ascending (e.g. 01 before 02 before 03)
    const numA = parseInt(matchA[3], 10);
    const numB = parseInt(matchB[3], 10);
    if (numA !== numB) {
      return numA - numB;
    }
  }

  return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
}
