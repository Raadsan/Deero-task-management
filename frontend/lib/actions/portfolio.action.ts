"use server";

import api from "../api";
import { ActionResponse, ErrorResponse } from "../types";
import { handleError } from "../error/handle-error";
import { BranchBranding } from "../portfolio-branding";
import { getUserSession } from "./auth.action";
import { cache } from "react";

export type BranchRecord = BranchBranding & {
  description?: string | null;
  location?: string | null;
  phone?: string | null;
  isActive: boolean;
  usesRootLogin?: boolean;
  slugClearedOnce?: boolean;
  createdAt?: string;
  _count?: { users: number };
  users?: Array<{
    id: string;
    name: string;
    email: string;
    role?: string;
    department?: string;
  }>;
};

export async function getAllBranches(): Promise<ActionResponse<BranchRecord[]>> {
  try {
    const response = await api.get("/api/portfolios");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getBranchById(id: string): Promise<ActionResponse<BranchRecord>> {
  try {
    const response = await api.get(`/api/portfolios/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Portfolio not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getBranchBrandingById(
  id: string,
): Promise<ActionResponse<BranchBranding>> {
  try {
    const response = await api.get(`/api/portfolios/branding/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Portfolio not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getPublicBranchBySlug(
  slug: string,
): Promise<ActionResponse<BranchBranding>> {
  try {
    const response = await api.get(`/api/portfolios/public/slug/${slug}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Portfolio not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getRootLoginBranchBranding(): Promise<ActionResponse<BranchBranding>> {
  try {
    const response = await api.get("/api/portfolios/public/root-login");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Root login portfolio not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export const resolveSessionBranding = cache(
  async (
    user?: { portfolioId?: string | null; role?: string } | null,
  ): Promise<BranchBranding | null> => {
    if (user?.portfolioId) {
      const result = await getBranchBrandingById(user.portfolioId);
      if (result.success && result.data) return result.data;
    }

    const result = await getRootLoginBranchBranding();
    if (result.success && result.data) return result.data;

    return null;
  },
);

export async function clearLoginBranchCookie() {
  // Unified login at / — no per-portfolio login cookie.
}

export const getDashboardSession = cache(async () => {
  const session = await getUserSession();
  const branding = await resolveSessionBranding(session.data?.user);
  const user = session.data?.user;
  return {
    session: session.data,
    branding,
    roleId: user?.roleId ?? null,
    role: user?.role ?? null,
  };
});

export async function createBranch(data: {
  name: string;
  slug?: string;
  description?: string;
  location?: string;
  phone?: string;
  logoData?: string;
  iconLogoData?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
  useRootLogin?: boolean;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/portfolios", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateBranch(
  id: string,
  data: {
    name: string;
    slug?: string;
    description?: string;
    location?: string;
    phone?: string;
    logoData?: string;
    iconLogoData?: string;
    primaryColor?: string;
    secondaryColor?: string;
    isActive?: boolean;
    clearSlug?: boolean;
    useRootLogin?: boolean;
  },
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/portfolios/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteBranch(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/portfolios/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
