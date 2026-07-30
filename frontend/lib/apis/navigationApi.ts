import type { ActionResponse } from "@/lib/types";
import type { NavMenuItem } from "@/lib/apis/configApi";

import { API_URL } from "./config";
const CACHE_MS = 5 * 1000;

export function clearNavMenuClientCache(roleId?: string) {
  if (roleId) {
    localStorage.removeItem(`deero-nav-menus:${roleId}`);
    return;
  }
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key?.startsWith("deero-nav-menus:")) localStorage.removeItem(key);
  }
}

export async function getNavMenusByRoleClient(
  roleId: string,
  force = false,
): Promise<ActionResponse<NavMenuItem[]>> {
  const key = `deero-nav-menus:${roleId}`;
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      if (cached && Date.now() - cached.createdAt < CACHE_MS) {
        return { success: true, data: cached.data };
      }
    } catch {}
  }

  try {
    const response = await fetch(`${API_URL}/api/nav-menus/role/${roleId}`, {
      credentials: "include",
      cache: "no-store",
    });
    const result = await response.json();
    const data = (result.data ?? []) as NavMenuItem[];
    if (response.ok && result.success) {
      localStorage.setItem(key, JSON.stringify({ createdAt: Date.now(), data }));
      return { success: true, data };
    }
    return { success: false, data: [] };
  } catch {
    return { success: false, data: [] };
  }
}
