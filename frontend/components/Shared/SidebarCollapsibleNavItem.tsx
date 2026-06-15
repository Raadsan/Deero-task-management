"use client";

import { UserRole } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../ui/sidebar";

type SubItem = { id: string; name: string; href: string };

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  id: string;
  name: string;
  icon: React.ReactNode;
  items: SubItem[];
  role?: UserRole[];
  currentRole?: UserRole;
};

export default function SidebarCollapsibleNavItem({
  id,
  name,
  icon,
  items,
  role,
  currentRole,
}: Props) {
  const pathname = usePathname();
  const childActive = items.some((sub) => isNavActive(pathname, sub.href));
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive, pathname]);

  const canManageSee = role?.includes(UserRole.superadmin);
  const canAdminSee = role?.includes(UserRole.admin);
  const canUserSee = role?.includes(UserRole.user);

  const visible =
    (canManageSee && currentRole === "superadmin") ||
    (canAdminSee && currentRole === "admin") ||
    (canUserSee && currentRole === "user") ||
    !role;

  if (!visible) return null;

  return (
    <SidebarMenuItem className="w-full">
      <div className="flex w-full flex-col">
        <SidebarMenuButton
          type="button"
          onClick={() => setOpen((v) => !v)}
          tooltip={name}
          className={cn(
            "h-11 w-full rounded-xl px-4 text-[15px] font-medium transition-all",
            childActive || open
              ? "!bg-white/15 !text-white"
              : "!text-white/90 hover:!bg-white/10 hover:!text-white",
            "group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!flex group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!items-center group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0",
          )}
        >
          <span className="shrink-0 text-white [&_svg]:text-white">{icon}</span>
          <span className="ml-3 flex-1 overflow-hidden text-ellipsis whitespace-nowrap group-data-[collapsible=icon]:hidden">
            {name}
          </span>
          <ChevronRight
            className={cn(
              "ml-auto size-4 shrink-0 text-white/70 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
              open && "rotate-90",
            )}
          />
        </SidebarMenuButton>
        {open && (
          <SidebarMenuSub className="mt-1 ml-6 gap-1 border-white/20 pl-2">
            {items.map((sub) => {
              const subActive = isNavActive(pathname, sub.href);
              return (
                <SidebarMenuSubItem key={sub.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={subActive}
                    className={cn(
                      "h-9 rounded-lg px-3 text-[14px] font-medium",
                      subActive
                        ? "sidebar-brand-active !text-white"
                        : "!text-white/80 hover:!bg-white/10 hover:!text-white",
                    )}
                  >
                    <Link href={sub.href}>{sub.name}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </div>
    </SidebarMenuItem>
  );
}
