"use client";

import { getConfigRoles, NavMenuItem } from "@/lib/apis/configApi";
import { clearNavMenuClientCache, getNavMenusByRoleClient } from "@/lib/apis/navigationApi";
import { getUserSession } from "@/lib/apis/authApi";
import { resolveConfigRoleId } from "@/lib/role-options";
import { createContext, useContext, useEffect, useState } from "react";

type PermissionContextType = {
  menus: NavMenuItem[];
  loading: boolean;
  isPrivileged: boolean;
  canView: (url: string) => boolean;
  canAdd: (url: string) => boolean;
  canEdit: (url: string) => boolean;
  canDelete: (url: string) => boolean;
  refresh: () => Promise<void>;
};

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

function findPerm(menus: NavMenuItem[], url: string) {
  let best: NavMenuItem["permissions"] | null = null;
  let bestLen = 0;

  for (const menu of menus) {
    if (menu.url === url && menu.permissions) return menu.permissions;
    if (
      menu.url &&
      url.startsWith(menu.url) &&
      menu.url.length > bestLen &&
      menu.permissions
    ) {
      best = menu.permissions;
      bestLen = menu.url.length;
    }
    for (const sub of menu.items || []) {
      if (sub.url === url && sub.permissions) return sub.permissions;
      if (
        sub.url &&
        url.startsWith(sub.url) &&
        sub.url.length > bestLen &&
        sub.permissions
      ) {
        best = sub.permissions;
        bestLen = sub.url.length;
      }
    }
  }
  return best;
}

type PermissionProviderProps = {
  children: React.ReactNode;
  initialRoleId?: string | null;
  initialRole?: string | null;
};

export function PermissionProvider({
  children,
  initialRoleId,
  initialRole,
}: PermissionProviderProps) {
  const [menus, setMenus] = useState<NavMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrivileged, setIsPrivileged] = useState(
    initialRole === "superadmin",
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const session = await getUserSession();
      const user = session.data?.user as
        | { role?: string; roleId?: string }
        | undefined;
      let roleId = user?.roleId ?? null;
      const role = user?.role ?? null;

      if (!roleId && role) {
        const rolesRes = await getConfigRoles();
        roleId = resolveConfigRoleId(rolesRes?.data, role) ?? null;
      }

      const privileged = role === "superadmin";
      setIsPrivileged(!!privileged);

      if (roleId) {
        const res = await getNavMenusByRoleClient(roleId, true);
        if (res.success) setMenus(res.data ?? []);
      } else {
        setMenus([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadInitial() {
      if (initialRoleId) {
        setLoading(true);
        try {
          const privileged = initialRole === "superadmin";
          setIsPrivileged(!!privileged);
          const res = await getNavMenusByRoleClient(initialRoleId);
          if (res.success) setMenus(res.data ?? []);
        } finally {
          setLoading(false);
        }
        return;
      }
      await refresh();
    }

    loadInitial();
    const handler = () => {
      clearNavMenuClientCache();
      localStorage.setItem("deero-sidebar-menu-version", String(Date.now()));
      void refresh();
    };
    const storageHandler = (event: StorageEvent) => {
      if (event.key !== "deero-sidebar-menu-version") return;
      clearNavMenuClientCache();
      void refresh();
    };
    window.addEventListener("sidebar-menu-updated", handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("sidebar-menu-updated", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const check = (
    url: string,
    type: "canView" | "canAdd" | "canEdit" | "canDelete",
  ) => {
    if (isPrivileged) return true;
    const perm = findPerm(menus, url);
    return !!perm?.[type];
  };

  return (
    <PermissionContext.Provider
      value={{
        menus,
        loading,
        isPrivileged,
        canView: (url) => check(url, "canView"),
        canAdd: (url) => check(url, "canAdd"),
        canEdit: (url) => check(url, "canEdit"),
        canDelete: (url) => check(url, "canDelete"),
        refresh,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermissions must be used within PermissionProvider");
  }
  return ctx;
}
