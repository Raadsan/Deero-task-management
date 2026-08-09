"use server";

import api from "@/lib/apis/axios";
import { ActionResponse, AuthSession, ErrorResponse } from "@/lib/types";
import { handleError } from "@/lib/error/handle-error";
import { cache } from "react";
import { headers } from "next/headers";

export async function signUpWithEmial(params: any): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/staffs", params);
    if (response.data.success) {
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function signInWithEmial(params: any): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/auth/sign-in/email", {
      ...params,
      rememberMe: true
    });
    return { success: true };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export const getUserSession = cache(
  async (): Promise<ActionResponse<AuthSession | null>> => {
    try {
      const cookieHeader = (await headers()).get("cookie") || "";
      const response = await api.get("/api/auth/get-session", {
        headers: {
          cookie: cookieHeader,
        },
      });
      return {
        data: response.data,
        success: true,
      };
    } catch {
      return { data: null, success: false };
    }
  },
);
