"use server";

import api from "../api";
import { ActionResponse, AuthSession, ErrorResponse } from "../types";
import { handleError } from "../error/handle-error";

export async function signUpWithEmial(params: any): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/users", params);
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

import { cookies, headers } from "next/headers";

export async function getUserSession(): Promise<ActionResponse<AuthSession | null>> {
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
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
