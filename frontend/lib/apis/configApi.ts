"use server";

import api from "@/lib/apis/axios";
import { ActionResponse, ErrorResponse } from "@/lib/types";
import { handleError } from "@/lib/error/handle-error";

export type ConfigRole = {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  canViewSalary?: boolean;
  _count?: { users: number };
};

export type MenuPermission = {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type NavSubMenuItem = {
  id: string;
  title: string;
  url: string;
  order: number;
  isActive?: boolean;
  permissions?: MenuPermission;
};

export type NavMenuItem = {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
  order: number;
  isActive?: boolean;
  items?: NavSubMenuItem[];
  subMenus?: NavSubMenuItem[];
  permissions?: MenuPermission;
};

export type AuditLogRecord = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
};

export async function getConfigRoles(): Promise<ActionResponse<ConfigRole[]>> {
  try {
    const response = await api.get("/api/roles");
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createConfigRole(data: {
  name: string;
  description?: string;
  isActive?: boolean;
  canViewSalary?: boolean;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/roles", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateConfigRole(
  id: string,
  data: { name?: string; description?: string; isActive?: boolean; canViewSalary?: boolean },
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/roles/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteConfigRole(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/roles/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAllNavMenus(): Promise<ActionResponse<NavMenuItem[]>> {
  try {
    const response = await api.get("/api/nav-menus");
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getRolePermissionMatrix(
  roleId: string,
): Promise<ActionResponse<NavMenuItem[]>> {
  try {
    const response = await api.get(`/api/nav-menus/permissions-matrix/${roleId}`);
    if (response.data.success) {
      return { success: true, data: response.data.data ?? [] };
    }
  } catch {
    // Fall through to legacy merge when matrix route is unavailable
  }

  try {
    const [menusResponse, roleMenusResponse] = await Promise.all([
      api.get("/api/nav-menus"),
      api.get(`/api/nav-menus/role/${roleId}`),
    ]);

    const allMenus = (menusResponse.data?.data ?? []) as NavMenuItem[];
    const roleMenus = (roleMenusResponse.data?.data ?? []) as NavMenuItem[];

    const data = allMenus
      .filter((menu) => menu.isActive !== false)
      .map((menu) => {
        const roleMenu = roleMenus.find((item) => item.id === menu.id);
        const items = menu.items || menu.subMenus || [];
        return {
          ...menu,
          permissions: roleMenu?.permissions ?? {
            canView: false,
            canAdd: false,
            canEdit: false,
            canDelete: false,
          },
          items: items.map((sub) => {
            const roleSub = roleMenu?.items?.find((item) => item.id === sub.id);
            return {
              ...sub,
              permissions: roleSub?.permissions ?? {
                canView: false,
                canAdd: false,
                canEdit: false,
                canDelete: false,
              },
            };
          }),
        };
      });

    return { success: true, data };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getNavMenusByRole(
  roleId: string,
): Promise<ActionResponse<NavMenuItem[]>> {
  try {
    const response = await api.get(`/api/nav-menus/role/${roleId}`);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function seedNavMenus(): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/nav-menus/seed");
    if (response.data.success) return { success: true, data: response.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createNavMenu(data: {
  title: string;
  url: string;
  icon?: string;
  order?: number;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/nav-menus", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateNavMenu(
  id: string,
  data: Partial<{
    title: string;
    url: string;
    icon: string;
    order: number;
    isActive: boolean;
  }>,
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/nav-menus/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteNavMenu(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/nav-menus/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createNavSubMenu(data: {
  menuId: string;
  title: string;
  url: string;
  order?: number;
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/nav-menus/sub", data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateNavSubMenu(
  id: string,
  data: Partial<{ title: string; url: string; order: number; isActive: boolean }>,
): Promise<ActionResponse> {
  try {
    const response = await api.put(`/api/nav-menus/sub/${id}`, data);
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function deleteNavSubMenu(id: string): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/nav-menus/sub/${id}`);
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function updateRolePermissions(
  roleId: string,
  permissions: Array<{
    menuId: string;
    canView: boolean;
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
    submenus: Array<{
      subMenuId: string;
      canView: boolean;
      canAdd: boolean;
      canEdit: boolean;
      canDelete: boolean;
    }>;
  }>,
): Promise<ActionResponse> {
  try {
    const response = await api.post(`/api/nav-menus/permissions/${roleId}`, {
      permissions,
    });
    if (response.data.success) return { success: true };
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAuditLogs(): Promise<ActionResponse<AuditLogRecord[]>> {
  try {
    const response = await api.get("/api/tracking/all");
    if (response.data.success) return { success: true, data: response.data.data };
    return { success: false, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
