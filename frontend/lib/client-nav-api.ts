import type { ActionResponse } from "./types";
import type { NavMenuItem } from "./actions/config.action";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
const CACHE_MS = 5 * 60 * 1000;

export function clearNavMenuClientCache(roleId?: string) {
  if (roleId) {
    sessionStorage.removeItem(`deero-nav-menus:${roleId}`);
    return;
  }
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index);
    if (key?.startsWith("deero-nav-menus:")) sessionStorage.removeItem(key);
  }
}

export async function getNavMenusByRoleClient(
  roleId: string,
  force = false,
): Promise<ActionResponse<NavMenuItem[]>> {
  const key = `deero-nav-menus:${roleId}`;
  if (!force) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
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
      sessionStorage.setItem(key, JSON.stringify({ createdAt: Date.now(), data }));
      return { success: true, data };
    }
    return { success: false, data: [] };
  } catch {
    return { success: false, data: [] };
  }
}
