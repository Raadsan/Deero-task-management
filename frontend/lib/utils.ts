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

export function isTaskPastDeadline(deadline: Date | string) {
  return new Date(deadline).getTime() < Date.now();
}

export function resolveTaskDisplayStatus(
  task: {
    status?: string;
    deadline?: Date | string | null;
    progress?: number;
    assgineeId?: string;
    assignedToId?: string;
    assignedTo?: { id: string };
    transferHistory?: Array<{ fromAssigneeId?: string }>;
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
  if (task.deadline && isTaskPastDeadline(task.deadline)) return "overdue";
  return task.status || "pending";
}

export function formatTaskDeadline(
  deadline: Date | string | null | undefined,
  context?: {
    status?: string;
    progress?: number;
  },
) {
  if (!deadline) return "No due date";

  const parsedDeadline = new Date(deadline);
  if (Number.isNaN(parsedDeadline.getTime())) return String(deadline);

  const dateLabel = parsedDeadline.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const displayStatus = context
    ? resolveTaskDisplayStatus({ ...context, deadline })
    : isTaskPastDeadline(deadline)
      ? "overdue"
      : "pending";

  if (displayStatus === "completed") {
    return `Completed (${dateLabel})`;
  }

  if (displayStatus === "overdue") {
    return `Overdue by (${dateLabel})`;
  }

  const now = new Date();
  const diffMs = Math.max(0, parsedDeadline.getTime() - now.getTime());
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remainingHours = totalHours % 24;

  if (days >= 1) {
    const dayLabel = days === 1 ? "1 day" : `${days} days`;
    if (remainingHours > 0) {
      const hourLabel =
        remainingHours === 1 ? "1 hr" : `${remainingHours} hrs`;
      return `${dayLabel} ${hourLabel}`;
    }
    return dayLabel;
  }

  if (totalHours >= 1) {
    return totalHours === 1 ? "1 hr" : `${totalHours} hrs`;
  }

  if (totalMinutes >= 1) {
    return totalMinutes === 1 ? "1 min" : `${totalMinutes} mins`;
  }

  return "Less than 1 min";
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
      return Object.values(TaskStatus).filter(
        (each: TaskStatus) => each === "pending",
      );
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

export function resolveApiUploadUrl(fileUrl: string) {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
  return `${base}${fileUrl}`;
}
