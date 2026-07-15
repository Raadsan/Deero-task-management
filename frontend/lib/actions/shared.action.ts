"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "../constants";
import { handleError } from "../error/handle-error";
import api from "../api";
import { ActionResponse, ErrorResponse, Client, User } from "../types";
import { getUserSession } from "./auth.action";
import { getAllBranches, getBranchById, BranchRecord } from "./portfolio.action";
import { seesAllBranchesForUser } from "../portfolio-access";

export type TaskFormClientOption = {
  id: string;
  institution: string;
  pendingServices: Array<{
    agreementId: string;
    label: string;
    serviceName: string;
    subServiceName: string;
  }>;
};

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

export async function getTaskFormClientsByBranch(
  portfolioId: string,
): Promise<ActionResponse<TaskFormClientOption[]>> {
  try {
    if (!portfolioId) {
      return { success: true, data: [] };
    }

    const response = await api.get("/api/clients");
    if (!response.data.success) {
      return { success: false, errors: { message: "Failed to fetch clients" } };
    }

    const clients = (response.data.data as any[])
      .map((client) => {
        const pendingServices = (client.serviceAgreements ?? [])
          .map((agreement: any) => {
            const service = resolveAgreementService(client, agreement);
            const subService = resolveAgreementSubService(client, agreement);
            const agreementBranchId =
              service?.portfolioId ?? service?.portfolio?.id ?? null;
            const serviceStatus = agreement.serviceStatus ?? "pending";

            if (serviceStatus === "completed") return null;
            if (agreementBranchId !== portfolioId) return null;

            const serviceName = service?.serviceName ?? "";
            const subServiceName = subService?.name ?? "";
            if (!serviceName) return null;

            const label = subServiceName
              ? `${serviceName} — ${subServiceName}`
              : serviceName;

            return {
              agreementId: agreement.id,
              label,
              serviceName,
              subServiceName,
            };
          })
          .filter(Boolean) as TaskFormClientOption["pendingServices"];

        if (!pendingServices.length) return null;

        return {
          id: String(client.id),
          institution: client.institution,
          pendingServices,
        };
      })
      .filter(Boolean) as TaskFormClientOption[];

    return { success: true, data: clients };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getTaskFormBranchOptions(): Promise<
  ActionResponse<{
    portfolios: Array<{ id: string; name: string }>;
    defaultBranchId: string;
    singleBranch: boolean;
  }>
> {
  try {
    const session = await getUserSession();
    if (!session.data) {
      return { success: false, errors: { message: "Unauthorized" } };
    }

    const user = session.data.user as {
      portfolioId?: string | null;
      role?: string | null;
    };
    const branchesRes = await getAllBranches();
    const activeBranches = (branchesRes.data ?? []).filter(
      (portfolio) => portfolio.isActive !== false,
    );

    let userBranch: BranchRecord | null =
      activeBranches.find((portfolio) => portfolio.id === user.portfolioId) ?? null;

    if (!userBranch && user.portfolioId) {
      const branchResult = await getBranchById(user.portfolioId);
      if (branchResult.success && branchResult.data) {
        userBranch = branchResult.data;
      }
    }

    const seesAllBranches = seesAllBranchesForUser(
      user.role,
      userBranch,
      user.portfolioId,
    );
    const portfolios = seesAllBranches
      ? activeBranches
      : user.portfolioId
        ? activeBranches.filter((portfolio) => portfolio.id === user.portfolioId)
        : activeBranches;

    const defaultBranchId =
      user.portfolioId && portfolios.some((portfolio) => portfolio.id === user.portfolioId)
        ? user.portfolioId
        : (portfolios.find((portfolio) => portfolio.usesRootLogin)?.id ?? portfolios[0]?.id ?? "");

    return {
      success: true,
      data: {
        portfolios: portfolios.map((portfolio) => ({
          id: portfolio.id,
          name: portfolio.name,
        })),
        defaultBranchId,
        singleBranch: portfolios.length <= 1,
      },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function GetAssigneesAndInstitutions({
  ownAssigned,
  portfolioId,
}: {
  ownAssigned?: boolean;
  portfolioId?: string;
}): Promise<
  ActionResponse<{
    institutions: Pick<Client, "id" | "institution">[] | undefined;
    assignees: Pick<User, "name" | "id" | "email" | "role" | "department">[] | undefined;
  }>
> {
  try {
    const [institutionsRes, assigneesRes] = await Promise.all([
      getAllInstitutions(),
      getAllAssignees({ ownAssigned, portfolioId }),
    ]);

    return {
      success: true,
      data: {
        institutions: institutionsRes.data,
        assignees: assigneesRes.data,
      },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAllInstitutions(): Promise<
  ActionResponse<Pick<Client, "id" | "institution">[]>
> {
  try {
    const response = await api.get("/api/clients");
    if (response.data.success) {
      const data = response.data.data.map((c: any) => ({
        id: c.id,
        institution: c.institution,
      }));
      return { success: true, data };
    }
    return { success: false, errors: { message: "Failed to fetch institutions" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAllAssignees({
  ownAssigned,
  portfolioId,
}: {
  ownAssigned?: boolean;
  portfolioId?: string;
}): Promise<ActionResponse<Pick<User, "name" | "email" | "id" | "role" | "department">[]>> {
  try {
    const session = await getUserSession();
    if (!session.data) return { success: false, errors: { message: "Unauthorized" } };

    const currentUserId = session.data.user.id;
    const currentUserRole = session.data.user.role;

    if (ownAssigned) {
      return {
        success: true,
        data: [{ id: currentUserId, name: session.data.user.name, email: session.data.user.email, role: currentUserRole, department: session.data.user.department }],
      };
    }

    const response = await api.get("/api/staffs");
    if (response.data.success) {
      let users = response.data.data;

      if (portfolioId) {
        users = users.filter((u: { portfolioId?: string | null }) => u.portfolioId === portfolioId);
      }

      if (currentUserRole === "admin") {
        users = users.filter((u: { role?: string }) => u.role !== "superadmin");
      } else if (currentUserRole === "user") {
        users = users.filter((u: { id: string }) => u.id === currentUserId);
      }

      const data = users.map((u: {
        id: string;
        name: string;
        email: string;
        role: string;
        department?: string | null;
      }) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
      }));
      return { success: true, data };
    }
    return { success: false, errors: { message: "Failed to fetch assignees" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function generateCustomId(params: {
  entityTybe: string;
}): Promise<ActionResponse<string>> {
  try {
    const response = await api.get(`/api/utils/generate-id?type=${params.entityTybe}`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
