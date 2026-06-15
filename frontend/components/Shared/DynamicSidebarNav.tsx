"use client";

import { getNavMenusByRole, NavMenuItem } from "@/lib/actions/config.action";
import { getLucideIcon } from "@/lib/lucide-icons";
import { AuthSession } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import SideBarItem from "./SidebarItem";
import SidebarCollapsibleNavItem from "./SidebarCollapsibleNavItem";
import { UserRole } from "@/lib/schema";

type Props = {
  data?: AuthSession | null;
  fallback: React.ReactNode;
};

export default function DynamicSidebarNav({ data, fallback }: Props) {
  const [menus, setMenus] = useState<NavMenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const roleId = (data?.user as { roleId?: string })?.roleId;

  const loadMenus = useCallback(async () => {
    if (!roleId) {
      setMenus([]);
      setLoaded(true);
      return;
    }

    try {
      const res = await getNavMenusByRole(roleId);
      if (res.success && res.data?.length) {
        setMenus(res.data);
      } else {
        setMenus([]);
      }
    } finally {
      setLoaded(true);
    }
  }, [roleId]);

  useEffect(() => {
    setLoaded(false);
    loadMenus();
    const onUpdate = () => {
      setLoaded(false);
      void loadMenus();
    };
    window.addEventListener("sidebar-menu-updated", onUpdate);
    return () => window.removeEventListener("sidebar-menu-updated", onUpdate);
  }, [loadMenus]);

  if (!loaded || !menus.length) {
    return <>{fallback}</>;
  }

  return (
    <>
      {menus.map((menu) => {
        const Icon = getLucideIcon(menu.icon);
        const items = menu.items || menu.subMenus || [];

        if (!items.length) {
          return (
            <SideBarItem
              key={menu.id}
              href={menu.url}
              name={menu.title}
              icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
              currentRole={data?.user.role as UserRole}
              role={[UserRole.admin, UserRole.superadmin, UserRole.user]}
            />
          );
        }

        return (
          <SidebarCollapsibleNavItem
            key={menu.id}
            id={menu.id}
            name={menu.title}
            icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            items={items.map((sub) => ({
              id: sub.id,
              name: sub.title,
              href: sub.url,
            }))}
            currentRole={data?.user.role as UserRole}
            role={[UserRole.admin, UserRole.superadmin, UserRole.user]}
          />
        );
      })}
    </>
  );
}
