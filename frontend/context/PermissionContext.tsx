"use client";

import { getNavMenusByRole, NavMenuItem } from "@/lib/actions/config.action";
import { getUserSession } from "@/lib/actions/auth.action";
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
    initialRole === "admin" || initialRole === "superadmin",
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const session = await getUserSession();
      const user = session.data?.user as
        | { role?: string; roleId?: string }
        | undefined;
      const roleId = user?.roleId ?? null;
      const role = user?.role ?? null;

      const privileged = role === "admin" || role === "superadmin";
      setIsPrivileged(!!privileged);

      if (roleId) {
        const res = await getNavMenusByRole(roleId);
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
          const privileged =
            initialRole === "admin" || initialRole === "superadmin";
          setIsPrivileged(!!privileged);
          const res = await getNavMenusByRole(initialRoleId);
          if (res.success) setMenus(res.data ?? []);
        } finally {
          setLoading(false);
        }
        return;
      }
      await refresh();
    }

    loadInitial();
    const handler = () => refresh();
    window.addEventListener("sidebar-menu-updated", handler);
    return () => window.removeEventListener("sidebar-menu-updated", handler);
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
