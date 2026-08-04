import type { ActionResponse, AllClients, Task, TaskNotification } from "@/lib/types";
import { formatDate, formatPhoneNumber } from "@/lib/utils";

import { API_URL } from "./config";

export async function getAllTasksClient(): Promise<ActionResponse<Task[]>> {
  try {
    const response = await fetch(`${API_URL}/api/tasks`, {
      credentials: "include",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      return { success: false, errors: { message: result.error || "Failed to fetch tasks" } };
    }

    return {
      success: true,
      data: result.data.map((task: any) => ({
        ...task,
        assignedTo: task.user?.id
          ? {
              id: task.user.id,
              name: task.user.name ?? "Unassigned",
              portfolioId: task.user.portfolioId ?? null,
            }
          : { id: "", name: "Unassigned", portfolioId: null },
        isPersonal: Boolean(task.isPersonal),
        institutions: (task.clientTask ?? []).map((item: any) => ({
          ...item.Client,
          services:
            item.Client?.clientSubService
              ?.map((entry: any) => entry.subService?.name)
              .filter(Boolean) ?? [],
        })),
      })),
    };
  } catch {
    return { success: false, errors: { message: "Failed to fetch tasks" } };
  }
}

export async function getAllUsersClient(): Promise<ActionResponse<any[]>> {
  try {
    const response = await fetch(`${API_URL}/api/staffs`, {
      credentials: "include",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      return { success: false, errors: { message: result.error || "Failed to fetch users" } };
    }
    return {
      success: true,
      data: result.data.map((user: any) => ({
        ...user,
        createdAt: formatDate(user.createdAt),
      })),
    };
  } catch {
    return { success: false, errors: { message: "Failed to fetch users" } };
  }
}

export async function getTaskNotificationsClient(
  userId: string,
): Promise<ActionResponse<TaskNotification[]>> {
  try {
    const response = await fetch(
      `${API_URL}/api/notifications?userId=${encodeURIComponent(userId)}`,
      { credentials: "include", cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok || !result.success) return { success: false, data: [] };
    return { success: true, data: result.data ?? [] };
  } catch {
    return { success: false, data: [] };
  }
}

export async function getAllClientsClient(): Promise<ActionResponse<AllClients[]>> {
  try {
    const response = await fetch(`${API_URL}/api/clients`, {
      credentials: "include",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      return { success: false, errors: { message: result.error || "Failed to fetch clients" } };
    }

    const data = result.data.map((client: any) => ({
      ...client,
      clientType: client.clientType ?? "ONE_TIME",
      isDraft: client.isDraft === true,
      createdAt: formatDate(client.createdAt),
      email: (() => {
        const email = String(client.email ?? "").trim();
        return !email || email.includes("@deero.internal") || /^client-\d+@deero\.so$/i.test(email)
          ? ""
          : email;
      })(),
      phone: String(client.phone ?? "").startsWith("NO_PHONE_")
        ? ""
        : formatPhoneNumber(client.phone, "addCountryKey"),
      serviceAgreements: (client.serviceAgreements ?? []).map((agreement: any) => {
        const service = agreement.service ??
          client.clientService?.find((item: any) => item.serviceId === agreement.serviceId)?.service;
        return {
          agreementId: agreement.id,
          serviceName: service?.serviceName ?? "",
          subServiceName: agreement.subService?.name ?? "",
          serviceStatus: agreement.serviceStatus ?? "pending",
          portfolioId: service?.portfolioId ?? service?.portfolio?.id ?? null,
          branchName: service?.portfolio?.name ?? "",
          base: agreement.base,
          description: agreement.description,
          discount: agreement.discount,
          finalAmount:
            Number(agreement.finalAmount) > 0
              ? Number(agreement.finalAmount)
              : Number(agreement.base ?? 0) * (1 - Number(agreement.discount ?? 0)),
          vatAmount: Number(agreement.packageSnapshot?.vatAmount ?? 0),
          createdAt: formatDate(agreement.createdAt ?? ""),
          rawCreatedAt: agreement.createdAt,
        };
      }),
      service: {
        service: client.clientService?.map((item: any) => item.service) || [],
        subServices: [],
      },
    }));
    return { success: true, data };
  } catch {
    return { success: false, errors: { message: "Failed to fetch clients" } };
  }
}
