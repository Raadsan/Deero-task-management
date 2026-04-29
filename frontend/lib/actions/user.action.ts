"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "../constants";
import { handleError } from "../error/handle-error";
import api from "../api";
import { ActionResponse, ErrorResponse, User } from "../types";
import { formatDate } from "../utils";

export async function getAllUsers(): Promise<ActionResponse<any[]>> {
  try {
    const response = await api.get("/api/users");
    const result = response.data;

    if (result.success) {
      return {
        success: true,
        data: result.data.map((each) => ({
          ...each,
          createdAt: formatDate(each.createdAt),
          salary: `$ ${each.salary || 0}`,
        })),
      };
    }
    return { success: false, errors: { message: "Failed to fetch users" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createUser(params: any): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/users", params);
    if (response.data.success) {
      revalidatePath(ROUTES.users);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getUserById(userId: string): Promise<ActionResponse> {
  try {
    const response = await api.get(`/api/users/${userId}`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteUserById({
  userId,
}: {
  userId: string;
}): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/users/${userId}`);
    if (response.data.success) {
      revalidatePath(ROUTES.users);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateUserData(params: {
  id: string;
  [key: string]: any;
}): Promise<ActionResponse> {
  try {
    const { id, ...data } = params;
    const response = await api.put(`/api/users/${id}`, data);
    if (response.data.success) {
      revalidatePath(ROUTES.users);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getUserUploadedFiles(userId: string): Promise<ActionResponse<any[]>> {
  try {
    const response = await api.get(`/api/users/${userId}/files`);
    return { success: true, data: response.data.data || [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteUserFileById({ fileId, userId }: { fileId: string; userId: string }): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/users/${userId}/files/${fileId}`);
    return { success: true };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function saveUserFiles({ userId, files }: { userId: string; files: any[] }): Promise<ActionResponse> {
  try {
    const response = await api.post(`/api/users/${userId}/files`, { files });
    return { success: true };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function listCurrentUserSessions(): Promise<ActionResponse<any[]>> {
  try {
    const response = await api.get("/api/auth/sessions");
    return { success: true, data: response.data || [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
export async function getUsersSalariesReport(params: any): Promise<ActionResponse<any>> { return { success: true, data: [] }; }
