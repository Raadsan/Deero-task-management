"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "../constants";
import { handleError } from "../error/handle-error";
import api from "../api";
import { ActionResponse, ErrorResponse, Client, User } from "../types";
import { getUserSession } from "./auth.action";
import { getAllBranches, getBranchById, BranchRecord } from "./branch.action";
import { seesAllBranchesForUser } from "../branch-access";

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
  branchId: string,
): Promise<ActionResponse<TaskFormClientOption[]>> {
  try {
    if (!branchId) {
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
              service?.branchId ?? service?.branch?.id ?? null;
            const serviceStatus = agreement.serviceStatus ?? "pending";

            if (serviceStatus === "completed") return null;
            if (agreementBranchId !== branchId) return null;

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
    branches: Array<{ id: string; name: string }>;
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
      branchId?: string | null;
      role?: string | null;
    };
    const branchesRes = await getAllBranches();
    const activeBranches = (branchesRes.data ?? []).filter(
      (branch) => branch.isActive !== false,
    );

    let userBranch: BranchRecord | null =
      activeBranches.find((branch) => branch.id === user.branchId) ?? null;

    if (!userBranch && user.branchId) {
      const branchResult = await getBranchById(user.branchId);
      if (branchResult.success && branchResult.data) {
        userBranch = branchResult.data;
      }
    }

    const seesAllBranches = seesAllBranchesForUser(
      user.role,
      userBranch,
      user.branchId,
    );
    const branches = seesAllBranches
      ? activeBranches
      : user.branchId
        ? activeBranches.filter((branch) => branch.id === user.branchId)
        : activeBranches;

    const defaultBranchId =
      user.branchId && branches.some((branch) => branch.id === user.branchId)
        ? user.branchId
        : (branches.find((branch) => branch.usesRootLogin)?.id ?? branches[0]?.id ?? "");

    return {
      success: true,
      data: {
        branches: branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
        })),
        defaultBranchId,
        singleBranch: branches.length <= 1,
      },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function GetAssigneesAndInstitutions({
  ownAssigned,
  branchId,
}: {
  ownAssigned?: boolean;
  branchId?: string;
}): Promise<
  ActionResponse<{
    institutions: Pick<Client, "id" | "institution">[] | undefined;
    assignees: Pick<User, "name" | "id" | "email" | "role" | "department">[] | undefined;
  }>
> {
  try {
    const [institutionsRes, assigneesRes] = await Promise.all([
      getAllInstitutions(),
      getAllAssignees({ ownAssigned, branchId }),
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
  branchId,
}: {
  ownAssigned?: boolean;
  branchId?: string;
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

    const response = await api.get("/api/users");
    if (response.data.success) {
      let users = response.data.data;

      if (branchId) {
        users = users.filter((u: { branchId?: string | null }) => u.branchId === branchId);
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
