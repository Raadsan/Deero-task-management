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
  useSidebar,
} from "../ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useSidebarAccordion } from "./SidebarAccordionContext";

type SubItem = { id: string; name: string; href: string };

function isSubNavActive(pathname: string, href: string) {
  return pathname === href;
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
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { isOpen, toggle } = useSidebarAccordion();
  const { state: sidebarState, isMobile } = useSidebar();
  const open = isOpen(id);

  useEffect(() => setPendingHref(null), [pathname]);
  useEffect(() => {
    const handler = (event: Event) => setPendingHref((event as CustomEvent<string>).detail);
    window.addEventListener("sidebar-navigation-start", handler);
    return () => window.removeEventListener("sidebar-navigation-start", handler);
  }, []);

  const canManageSee = role?.includes(UserRole.superadmin);
  const canAdminSee = role?.includes(UserRole.admin);
  const canUserSee = role?.includes(UserRole.user);

  const visible =
    (canManageSee && currentRole === "superadmin") ||
    (canAdminSee && currentRole === "admin") ||
    (canUserSee && currentRole === "user") ||
    !role;

  if (!visible) return null;

  const isCollapsed = sidebarState === "collapsed" && !isMobile;

  const subMenuLinks = items.map((sub) => {
    const subActive = pendingHref !== null
      ? pendingHref === sub.href
      : isSubNavActive(pathname, sub.href);

    return (
      <Link
        key={sub.id}
        href={sub.href}
        prefetch
        onClick={() => {
          setPendingHref(sub.href);
          if (isCollapsed && open) toggle(id);
          window.dispatchEvent(
            new CustomEvent("sidebar-navigation-start", { detail: sub.href }),
          );
        }}
        className={cn(
          "flex h-9 w-full items-center rounded-lg px-3 text-[14px] font-medium transition-colors",
          subActive
            ? "!bg-white/15 !text-white"
            : "!bg-transparent !text-white hover:!bg-white/[0.07]",
        )}
      >
        {sub.name}
      </Link>
    );
  });

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="w-full">
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            if (nextOpen !== open) toggle(id);
          }}
        >
          <PopoverTrigger asChild>
            <SidebarMenuButton
              type="button"
              aria-label={name}
              className={cn(
                "!mx-auto !flex !h-10 !w-10 !items-center !justify-center !rounded-xl !p-0",
                open
                  ? "sidebar-brand-active !text-white"
                  : "!text-white/90 hover:!bg-white/10 hover:!text-white",
              )}
            >
              <span className="text-white [&_svg]:text-white">{icon}</span>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={10}
            className="sidebar-brand w-52 rounded-xl border-white/10 p-2 text-white shadow-xl"
          >
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/60">
              {name}
            </p>
            <div className="space-y-1">{subMenuLinks}</div>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem className="w-full">
      <div className="flex w-full flex-col">
        <SidebarMenuButton
          type="button"
          onClick={() => toggle(id)}
          tooltip={name}
          className={cn(
            "h-11 w-full rounded-xl px-4 text-[15px] font-medium transition-all",
            open
              ? "sidebar-brand-active !text-white shadow-sm"
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
          <SidebarMenuSub className="mt-1 ml-6 gap-1.5 border-white/15 pl-2">
            {subMenuLinks.map((link, index) => (
              <SidebarMenuSubItem key={items[index].id}>
                <SidebarMenuSubButton asChild className="h-9 rounded-lg p-0">
                  {link}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        )}
      </div>
    </SidebarMenuItem>
  );
}
