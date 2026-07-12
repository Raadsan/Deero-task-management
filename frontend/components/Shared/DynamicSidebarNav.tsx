"use client";

import {
  getConfigRoles,
  getNavMenusByRole,
  NavMenuItem,
} from "@/lib/actions/config.action";
import { normalizeRoleName } from "@/lib/branch-access";
import { getLucideIcon } from "@/lib/lucide-icons";
import {
  isLegacySidebarRole,
  resolveConfigRoleId,
} from "@/lib/role-options";
import { AuthSession } from "@/lib/types";
import { CalendarDays, LayoutGrid, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import SideBarItem from "./SidebarItem";
import SidebarCollapsibleNavItem from "./SidebarCollapsibleNavItem";
import { useSidebarAccordion } from "./SidebarAccordionContext";

type Props = {
  data?: AuthSession | null;
  fallback: React.ReactNode;
  /** Used for accordion open state when DB menus are empty (fallback nav). */
  fallbackMenus?: Array<{
    id: string;
    href: string;
    items?: Array<{ href: string }>;
  }>;
};

const DEFAULT_MY_TASK_SUBMENUS = [
  { id: "my-tasks-list", title: "My Tasks", url: "/my-tasks", order: 1 },
  { id: "my-tasks-board", title: "My Board", url: "/my-tasks/board", order: 2 },
  { id: "my-tasks-today", title: "Today Tasks", url: "/my-tasks/today", order: 3 },
];

function myTaskSubIcon(url: string) {
  if (url.includes("/board")) {
    return <LayoutGrid className="size-[18px] shrink-0" strokeWidth={2} />;
  }
  if (url.includes("/today")) {
    return <CalendarDays className="size-[18px] shrink-0" strokeWidth={2} />;
  }
  return <ShoppingBag className="size-[18px] shrink-0" strokeWidth={2} />;
}

function usesMyTasksDropdown(role: string) {
  return role === "superadmin" || role === "branch admin";
}

function menuPathActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(`${href}/`);
}

function dedupeMenus(menus: NavMenuItem[]) {
  const seen = new Set<string>();
  return menus.filter((menu) => {
    if (menu.isActive === false) return false;
    if (seen.has(menu.id)) return false;
    seen.add(menu.id);
    return true;
  });
}

export default function DynamicSidebarNav({ data, fallback, fallbackMenus = [] }: Props) {
  const pathname = usePathname();
  const { setOpenId } = useSidebarAccordion();
  const [menus, setMenus] = useState<NavMenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const userRole = data?.user?.role ?? "";
  const normalizedRole = normalizeRoleName(userRole);

  const loadMenus = useCallback(async () => {
    try {
      let roleId = (data?.user as { roleId?: string })?.roleId ?? null;

      if (!roleId && userRole) {
        const rolesRes = await getConfigRoles();
        roleId = resolveConfigRoleId(rolesRes?.data, userRole) ?? null;
      }

      if (!roleId) {
        setMenus([]);
        return;
      }

      const res = await getNavMenusByRole(roleId);
      if (res.success && res.data?.length) {
        setMenus(res.data);
      } else {
        setMenus([]);
      }
    } finally {
      setLoaded(true);
    }
  }, [data?.user, userRole]);

  useEffect(() => {
    setLoaded(false);
    void loadMenus();
    const onUpdate = () => {
      setLoaded(false);
      void loadMenus();
    };
    window.addEventListener("sidebar-menu-updated", onUpdate);
    return () => window.removeEventListener("sidebar-menu-updated", onUpdate);
  }, [loadMenus]);

  const sortedMenus = useMemo(() => {
    return dedupeMenus([...menus]).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
  }, [menus]);

  useEffect(() => {
    const menuRefs = sortedMenus.length
      ? sortedMenus.map((menu) => {
          const sourceItems = menu.items || menu.subMenus || [];
          const items = [...sourceItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          return {
            id: menu.id,
            href: menu.url,
            items: items.map((sub) => ({ href: sub.url })),
          };
        })
      : fallbackMenus;

    for (const menu of menuRefs) {
      const hrefs = menu.items?.length
        ? menu.items.map((sub) => sub.href)
        : [menu.href];
      if (hrefs.some((href) => menuPathActive(pathname, href))) {
        setOpenId(menu.id);
        return;
      }
    }
    setOpenId(null);
  }, [pathname, sortedMenus, fallbackMenus, setOpenId]);

  if (!loaded) {
    return null;
  }

  if (!menus.length) {
    if (isLegacySidebarRole(userRole)) {
      return <>{fallback}</>;
    }
    return null;
  }

  return (
    <>
      {sortedMenus.flatMap((menu) => {
        const Icon = getLucideIcon(menu.icon);
        const sourceItems = menu.items || menu.subMenus || [];
        const sortedSource = [...sourceItems].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        const isMyTasksMenu = menu.title.toLowerCase() === "my tasks";
        const dropdownMyTasks = isMyTasksMenu && usesMyTasksDropdown(normalizedRole);

        if (isMyTasksMenu && !dropdownMyTasks) {
          const flatItems = sortedSource.length
            ? sortedSource
            : [{ id: menu.id, title: menu.title, url: menu.url, order: menu.order ?? 0 }];

          return flatItems.map((sub) => (
            <SideBarItem
              key={sub.id}
              href={sub.url}
              name={sub.title}
              icon={myTaskSubIcon(sub.url)}
            />
          ));
        }

        const items = dropdownMyTasks
          ? sortedSource.length
            ? sortedSource
            : DEFAULT_MY_TASK_SUBMENUS
          : sortedSource;

        if (!items.length) {
          return [
            <SideBarItem
              key={menu.id}
              href={menu.url}
              name={menu.title}
              icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            />,
          ];
        }

        return [
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
          />,
        ];
      })}
    </>
  );
}
