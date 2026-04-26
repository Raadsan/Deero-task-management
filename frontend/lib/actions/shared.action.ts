"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "../constants";
import { handleError } from "../error/handle-error";
import api from "../api";
import { ActionResponse, ErrorResponse, Client, User } from "../types";
import { getUserSession } from "./auth.action";

export async function GetAssigneesAndInstitutions({
  ownAssigned,
}: {
  ownAssigned?: boolean;
}): Promise<
  ActionResponse<{
    institutions: Pick<Client, "id" | "institution">[] | undefined;
    assignees: Pick<User, "name" | "id" | "email" | "role">[] | undefined;
  }>
> {
  try {
    const [institutionsRes, assigneesRes] = await Promise.all([
      getAllInstitutions(),
      getAllAssignees({ ownAssigned }),
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
}: {
  ownAssigned?: boolean;
}): Promise<ActionResponse<Pick<User, "name" | "email" | "id" | "role">[]>> {
  try {
    const session = await getUserSession();
    if (!session.data) return { success: false, errors: { message: "Unauthorized" } };

    const currentUserId = session.data.user.id;
    const currentUserRole = session.data.user.role;

    if (ownAssigned) {
      return {
        success: true,
        data: [{ id: currentUserId, name: session.data.user.name, email: session.data.user.email, role: currentUserRole }],
      };
    }

    const response = await api.get("/api/users");
    if (response.data.success) {
      let users = response.data.data;

      if (currentUserRole === "superadmin") {
        users = users.filter((u: any) => u.id !== currentUserId);
      } else if (currentUserRole === "admin") {
        users = users.filter((u: any) => u.role !== "superadmin" && u.id !== currentUserId);
      } else {
        users = [];
      }

      const data = users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
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
