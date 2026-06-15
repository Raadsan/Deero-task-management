"use server";

import { cookies } from "next/headers";
import api from "../api";
import { ActionResponse, ErrorResponse } from "../types";
import { handleError } from "../error/handle-error";
import { BranchBranding } from "../branch-branding";
import {
  canSuperadminUseAnyLogin,
  formatBranchLoginPathFromRecord,
} from "../branch-login";
import { BRANCH_SLUG_COOKIE, LOGIN_BRANCH_ID_COOKIE } from "../constants";
import { getUserSession } from "./auth.action";

export type BranchRecord = BranchBranding & {
  description?: string | null;
  location?: string | null;
  phone?: string | null;
  isActive: boolean;
  isMain?: boolean;
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
    const response = await api.get("/api/branches");
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
    const response = await api.get(`/api/branches/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Branch not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getBranchBrandingById(
  id: string,
): Promise<ActionResponse<BranchBranding>> {
  try {
    const response = await api.get(`/api/branches/branding/${id}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Branch not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getPublicBranchBySlug(
  slug: string,
): Promise<ActionResponse<BranchBranding>> {
  try {
    const response = await api.get(`/api/branches/public/slug/${slug}`);
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Branch not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getMainBranchBranding(): Promise<ActionResponse<BranchBranding>> {
  try {
    const response = await api.get("/api/branches/public/main");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Main branch not found" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function validateUserLoginBranch(params: {
  userBranchId?: string | null;
  loginBranchId?: string | null;
  isRootLogin?: boolean;
  userRole?: string;
}): Promise<ActionResponse<{ branchId?: string; loginPath?: string }>> {
  const { userBranchId, loginBranchId, userRole } = params;

  if (canSuperadminUseAnyLogin({ role: userRole, branchId: userBranchId })) {
    return { success: true, data: { branchId: loginBranchId ?? undefined } };
  }

  if (!userBranchId) {
    return {
      success: false,
      errors: { message: "This account has no branch assigned" },
    };
  }

  if (!loginBranchId) {
    return {
      success: false,
      errors: { message: "Invalid login page" },
    };
  }

  if (loginBranchId === userBranchId) {
    return { success: true, data: { branchId: userBranchId } };
  }

  const branchResult = await getBranchById(userBranchId);
  const loginPath =
    branchResult.success && branchResult.data
      ? formatBranchLoginPathFromRecord(branchResult.data)
      : undefined;

  return {
    success: false,
    errors: {
      message: loginPath
        ? `Please sign in at ${loginPath}`
        : "This account does not belong to this branch login URL",
      loginPath,
    },
  };
}

export async function setLoginBranchCookie(branchId: string) {
  const store = await cookies();
  store.set(LOGIN_BRANCH_ID_COOKIE, branchId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
}

export async function clearLoginBranchCookie() {
  const store = await cookies();
  store.delete(LOGIN_BRANCH_ID_COOKIE);
}

export async function getDashboardSession() {
  const session = await getUserSession();
  const branding = await resolveSessionBranding(session.data?.user);
  const user = session.data?.user;
  return {
    session: session.data,
    branding,
    roleId: user?.roleId ?? null,
    role: user?.role ?? null,
  };
}

export async function resolveSessionBranding(
  user?: { branchId?: string | null; role?: string } | null,
): Promise<BranchBranding | null> {
  if (user?.branchId) {
    const result = await getBranchBrandingById(user.branchId);
    if (result.success && result.data) return result.data;
  }

  const slug = (await cookies()).get(BRANCH_SLUG_COOKIE)?.value;
  if (slug) {
    const result = await getPublicBranchBySlug(slug);
    if (result.success && result.data) return result.data;
  }

  if (user?.role === "superadmin") {
    const result = await getMainBranchBranding();
    if (result.success && result.data) return result.data;
  }

  if (user) {
    const result = await getMainBranchBranding();
    if (result.success && result.data) return result.data;
  }

  return null;
}

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
  isMain?: boolean;
  useRootLogin?: boolean;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/branches", data);
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
    isMain?: boolean;
    clearSlug?: boolean;
    useRootLogin?: boolean;
  },
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/branches/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteBranch(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/branches/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
