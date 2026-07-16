import type { ActionResponse, AllClients } from "./types";
import { formatDate, formatPhoneNumber } from "./utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";

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
      phone: formatPhoneNumber(client.phone, "addCountryKey"),
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
