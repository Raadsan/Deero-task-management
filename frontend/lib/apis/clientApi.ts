"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/constants";
import { handleError } from "@/lib/error/handle-error";
import api from "@/lib/apis/axios";
import {
  ActionResponse,
  AllClients,
  Client,
  ErrorResponse,
} from "@/lib/types";
import { formatDate, formatPhoneNumber, normalizeClientPhone } from "@/lib/utils";

function visibleClientPhone(phone: unknown) {
  const value = String(phone ?? "").trim();
  return value.startsWith("NO_PHONE_") || value.startsWith("DRAFT") ? "" : value;
}

function visibleClientEmail(email: unknown) {
  const value = String(email ?? "").trim();
  if (!value || value.includes("@deero.internal") || /^client-\d+@deero\.so$/i.test(value)) {
    return "";
  }
  return value;
}

function resolveAgreementService(client: any, agreement: any) {
  return (
    agreement.service ??
    client.clientService?.find(
      (item: any) => item.serviceId === agreement.serviceId,
    )?.service
  );
}

function resolveAgreementSubService(client: any, agreement: any) {
  return (
    agreement.subService ??
    client.clientSubService?.find(
      (item: any) => item.subServiceId === agreement.subServiceId,
    )?.subService
  );
}

function mapServiceAgreements(client: any) {
  return (
    client.serviceAgreements?.map((agreement: any) => {
      const service = resolveAgreementService(client, agreement);
      const subService = resolveAgreementSubService(client, agreement);

      let features: any[] = [];
      const rawFeatures = agreement.contractFeatures ?? subService?.features ?? [];
      if (Array.isArray(rawFeatures)) {
        features = rawFeatures;
      } else if (typeof rawFeatures === "string") {
        try {
          features = JSON.parse(rawFeatures);
        } catch {}
      }

      return {
        agreementId: agreement.id,
        serviceName: service?.serviceName ?? "",
        subServiceName: subService?.name ?? "",
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
        vatPercentage: agreement.packageSnapshot?.vatPercentage ?? 0,
        vatAmount: agreement.packageSnapshot?.vatAmount ?? 0,
        createdAt: formatDate(agreement.createdAt ?? ""),
        rawCreatedAt: agreement.createdAt,
        features,
      };
    }) ?? []
  );
}

export async function getClientsForForm(): Promise<
  ActionResponse<Pick<Client, "id" | "institution" | "phone" | "email">[]>
> {
  try {
    const response = await api.get("/api/clients/basic");
    if (response.data.success) {
      const clients = response.data.data.map((client: any) => ({
        id: client.id,
        institution: client.institution,
        phone: visibleClientPhone(client.phone),
        email: visibleClientEmail(client.email),
      }));
      return { success: true, data: clients };
    }
    return { success: false, errors: { message: "Failed to fetch clients" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createClient(data: {
  institution: string;
  phone: string;
  email?: string;
  source: string;
  companyName?: string;
  contactPerson?: string;
  address?: string;
  clientType?: "ONE_TIME" | "MANAGED_ON_DEMAND" | "MANAGED_RECURRING";
  contractStartDate?: string | Date;
  contractEndDate?: string | Date;
  monthlyBudget?: number;
  notes?: string;
  portfolioId?: string;
  accountManagerId?: string;
  autoGenerateTasks?: boolean;
  serviceName?: string;
  subServiceName?: string;
  base?: number;
  description?: string;
  discount?: number;
  discountType?: "PERCENTAGE" | "FIXED";
  finalAmount?: number;
  vatPercentage?: number;
  contractFeatures?: Array<{ name: string; quantity: number; frequency: string; description: string }>;
  createdAt?: Date;
  serviceStatus?: "pending" | "completed";
  project?: {
    name: string;
    description?: string;
    projectType?: string;
    priority?: string;
    dueDate?: string | Date;
    startDate?: string | Date;
    status?: string;
  };
  schedule?: {
    name?: string;
    recurrenceType?: string;
    contentType?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    steps?: Array<{
      dayOfWeek?: number;
      dayOfMonth?: number;
      label: string;
      contentType?: string;
      stepOrder?: number;
      department?: string;
    }>;
  };
  isDraft?: boolean;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/clients", data);
    if (response.data.success) {
      revalidatePath(ROUTES.clients);
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

// get all clients
export async function getAllClients(): Promise<ActionResponse<AllClients[]>> {
  try {
    const response = await api.get("/api/clients");
    const result = response.data;

    if (result.success) {
      const transformed = result.data.map((client: any) => ({
        ...client,
        clientType: client.clientType ?? "ONE_TIME",
        isDraft: client.isDraft === true,
        createdAt: formatDate(client.createdAt),
        email: visibleClientEmail(client.email),
        phone: visibleClientPhone(client.phone)
          ? formatPhoneNumber(client.phone, "addCountryKey")
          : "",
        serviceAgreements: mapServiceAgreements(client),
        service: {
          service: client.clientService?.map((each: any) => each.service) || [],
          subServices: client.clientSubService?.map((each: any) => ({
            ...each.subService,
            count: each.count,
          })) || [],
        },
      }));
      return { success: true, data: transformed };
    }
    return { success: false, errors: { message: "Failed to fetch clients" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

// get Client by Id
export async function getClientById(id: string): Promise<ActionResponse<Client>> {
  try {
    const response = await api.get(`/api/clients/${id}`);
    const result = response.data;

    if (result.success) {
      const client = result.data;
      const transformed = {
        ...client,
        phone: visibleClientPhone(client.phone)
          ? normalizeClientPhone(client.phone)
          : "",
        email: visibleClientEmail(client.email),
        discount: client.serviceAgreements?.[0]?.discount ?? 0,
        service:
          client.clientService?.map((each: any) => ({
            ...each.service,
            portfolio: each.service?.portfolio,
          })) || [],
        serviceAgreements: mapServiceAgreements(client),
        subServices:
          client.serviceAgreements?.map((eachAgrement: any) => {
            const subService = client.clientSubService?.find(
              (eachOne: any) => eachOne.subService.id === eachAgrement.subServiceId,
            );
            const service = resolveAgreementService(client, eachAgrement);
            return {
              ...subService?.subService,
              agreementId: eachAgrement.id,
              count: subService?.count || 1,
              base: eachAgrement.base,
              description: eachAgrement.description,
              createdAt: formatDate(eachAgrement.createdAt ?? ""),
              serviceStatus: eachAgrement.serviceStatus ?? "pending",
              portfolioId: service?.portfolioId ?? service?.portfolio?.id ?? null,
              branchName: service?.portfolio?.name ?? "",
            };
          }) || [],
      };
      return { success: true, data: transformed as Client };
    }
    return { success: false, errors: { message: "Client not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

// delete client by id
export async function deleteClientById(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/clients/${id}`);
    if (response.data.success) {
      revalidatePath(ROUTES.clients);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function editBasicClientInfo({
  newData,
  clientId,
}: {
  newData?: any;
  clientId: string;
}): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/clients/${clientId}`, newData);
    if (response.data.success) {
      revalidatePath(ROUTES.viewClient(clientId), "page");
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getClientSourcesInfo(): Promise<ActionResponse<any>> {
  try {
    const response = await api.get("/api/clients/sources/info");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Failed to fetch source info" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getCustomSubServices(serviceId: string): Promise<ActionResponse<any[]>> {
  try {
    const response = await api.get(`/api/services/${serviceId}/subservices`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Failed to fetch subservices" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

// Placeholder for remaining complex actions to satisfy imports
export async function addAnotherService(params: {
  clientId: string;
  newService: string;
  newSubService: string;
  base: number;
  description?: string;
  discount?: number;
  discountType?: "PERCENTAGE" | "FIXED";
  finalAmount?: number;
  vatPercentage?: number;
  contractFeatures?: Array<{ name: string; quantity: number; frequency: string; description: string }>;
  portfolioId?: string;
  createdAt?: Date;
  serviceStatus?: "pending" | "completed";
}): Promise<ActionResponse> {
  try {
    const { clientId, newService, newSubService, ...rest } = params;
    const response = await api.post(`/api/clients/${clientId}/services`, {
      serviceName: newService,
      subServiceName: newSubService,
      base: rest.base,
      description: rest.description,
      discount: rest.discount,
      finalAmount: rest.finalAmount,
      vatPercentage: rest.vatPercentage,
      discountType: rest.discountType,
      contractFeatures: rest.contractFeatures,
      portfolioId: rest.portfolioId,
      createdAt: rest.createdAt,
      serviceStatus: rest.serviceStatus,
    });
    if (response.data.success) {
      revalidatePath(ROUTES.clients);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
export async function updateClientServiceStatus(params: {
  agreementId: string;
  serviceStatus: "pending" | "completed";
}): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/clients/agreement/${params.agreementId}`, {
      serviceStatus: params.serviceStatus,
    });
    if (response.data.success) {
      revalidatePath(ROUTES.clients);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function editClientService(params: {
  agreementId: string;
  clientId: string;
  serviceName?: string;
  subServiceName: string;
  portfolioId?: string;
  base: number;
  description?: string;
  discount?: number;
  finalAmount?: number;
  vatPercentage?: number;
  contractFeatures?: Array<{ name: string; quantity: number; frequency: string; description: string }>;
  serviceStatus?: "pending" | "completed";
  createdAt?: Date;
}): Promise<ActionResponse> {
  try {
    const { agreementId, clientId, createdAt, ...data } = params;
    const response = await api.put(`/api/clients/agreement/${agreementId}`, {
      ...data,
      ...(createdAt ? { createdAt } : {}),
    });
    if (response.data.success) {
      revalidatePath(ROUTES.clients);
      revalidatePath(ROUTES.viewClient(clientId), "page");
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteClientAgreement(params: {
  agreementId: string;
  clientId: string;
}): Promise<ActionResponse> {
  try {
    const { agreementId, clientId } = params;
    const response = await api.delete(`/api/clients/agreement/${agreementId}`);
    if (response.data.success) {
      revalidatePath(ROUTES.viewClient(clientId), "page");
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
export async function getPaymentClients(params: {
  page: number;
  pageSize: number;
}): Promise<ActionResponse<Pick<Client, "id" | "institution" | "phone">[]>> {
  try {
    const response = await api.get("/api/clients/basic");
    if (response.data.success) {
      // For now, return all since backend might not support pagination for this specific list yet
      const clients = response.data.data.map((c: any) => ({
        id: c.id,
        institution: c.institution,
        phone: c.phone,
      }));
      return { success: true, data: clients };
    }
    return { success: false, errors: { message: "Failed to fetch payment clients" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getInsitutionsbyId({ id }: { id: string }): Promise<ActionResponse<any>> {
  try {
    if (!id) return { success: true, data: null };
    const response = await api.get(`/api/clients/${id}`);
    if (response.data.success) {
      const client = response.data.data;
      // Transform into the format expected by IncomeForm
      const transformed = {
        ...client,
        services: client.clientService?.map((cs: any) => cs.service) || [],
        subServices: client.clientSubService?.map((css: any) => ({
          ...css.subService,
          categoryId: css.subService.categoryId, // Corrected from serviceId to categoryId
        })) || [],
      };
      return { success: true, data: transformed };
    }
    return { success: false, errors: { message: "Institution not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
export async function getClientReport(params?: any): Promise<ActionResponse<any>> { return { success: true, data: [] }; }
