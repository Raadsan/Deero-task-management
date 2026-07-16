"use client";

import type { NavMenuItem } from "@/lib/actions/config.action";
import { usePermissions } from "@/context/PermissionContext";
import { normalizeRoleName } from "@/lib/portfolio-access";
import { getLucideIcon } from "@/lib/lucide-icons";
import { isLegacySidebarRole } from "@/lib/role-options";
import { AuthSession } from "@/lib/types";
import { CalendarDays, LayoutGrid, ShoppingBag } from "lucide-react";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  return role === "superadmin" || role === "portfolio admin";
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
  const router = useRouter();
  const { setOpenId } = useSidebarAccordion();
  const { menus, loading } = usePermissions();
  const userRole = data?.user?.role ?? "";
  const normalizedRole = normalizeRoleName(userRole);

  const sortedMenus = useMemo(() => {
    return dedupeMenus([...menus]).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
  }, [menus]);

  useEffect(() => {
    for (const menu of sortedMenus) {
      if (menu.url) router.prefetch(menu.url);
      for (const sub of menu.items || menu.subMenus || []) {
        if (sub.url) router.prefetch(sub.url);
      }
    }
  }, [router, sortedMenus]);

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

  if (loading) {
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
