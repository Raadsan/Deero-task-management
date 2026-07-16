"use client";

import { UserRole } from "@/lib/schema";
import { SidebarItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

/** Sibling routes under the same prefix — only exact path is active */
const SIDEBAR_EXACT_PATHS = new Set([
  "/my-tasks",
  "/my-tasks/board",
  "/my-tasks/today",
]);

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/$/, "") || "/";
}

function isNavActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  const link = normalizePath(href);

  if (link === "/") {
    return path === "/";
  }
  if (SIDEBAR_EXACT_PATHS.has(link)) {
    return path === link;
  }
  if (path === link) {
    return true;
  }
  return path.startsWith(`${link}/`);
}

export default function SideBarItem({
  href,
  role,
  currentRole,
  name,
  icon,
}: SidebarItem & {
  currentRole?: UserRole;
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const isActive = pendingHref !== null
    ? normalizePath(pendingHref) === normalizePath(href)
    : isNavActive(pathname, href);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    const handleNavigationStart = (event: Event) => {
      setPendingHref((event as CustomEvent<string>).detail);
    };
    window.addEventListener("sidebar-navigation-start", handleNavigationStart);
    return () => window.removeEventListener("sidebar-navigation-start", handleNavigationStart);
  }, []);

  const canManageSee = role?.includes(UserRole.superadmin);
  const canAdminSee = role?.includes(UserRole.admin);
  const canUserSee = role?.includes(UserRole.user);

  const item = (
    <SidebarMenuItem className="w-full">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={name}
        className={cn(
          "h-11 w-full rounded-xl px-4 text-[15px] font-medium transition-all",
          isActive
            ? "sidebar-brand-active !text-white shadow-sm hover:opacity-90 data-[active=true]:sidebar-brand-active data-[active=true]:!text-white"
            : "!text-white/90 hover:!bg-white/10 hover:!text-white data-[active=true]:!bg-transparent",
          "group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!flex group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!items-center group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!px-0",
        )}
      >
        <Link
          href={href}
          prefetch
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("sidebar-navigation-start", { detail: href }),
            );
          }}
          className="flex w-full items-center justify-start group-data-[collapsible=icon]:justify-center"
        >
          <span className="shrink-0 text-white [&_svg]:text-white">
            {icon}
          </span>
          <span className="ml-3 flex-1 overflow-hidden text-ellipsis whitespace-nowrap group-data-[collapsible=icon]:hidden">
            {name}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  if (!role?.length) {
    return item;
  }

  if (canManageSee && currentRole === "superadmin") {
    return item;
  }
  if (canAdminSee && currentRole === "admin") {
    return item;
  }
  if (canUserSee && currentRole === "user") {
    return item;
  }
  return null;
}
