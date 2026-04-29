"use client";
import { UserRole } from "@/lib/schema";
import { SidebarItem } from "@/lib/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export default function SideBarItem({
  href,
  role,
  currentRole,
  name,
  icon,
}: SidebarItem & {
  currentRole?: UserRole;
}) {
  const pathName = usePathname();
  const currentUserRole = currentRole;

  const isCurrentPath =
    (href.length === 1 && pathName.length === 1) ||
    (pathName.length > 1 && href.includes(pathName));
  const canManageSee = role?.includes(UserRole.superadmin);
  const canAdminSee = role?.includes(UserRole.admin);
  const canUserSee = role?.includes(UserRole.user);
  const item = (
    <SidebarMenuItem
      key={name}
      className={`w-full px-[10px] py-[6px] font-medium text-white ${isCurrentPath ? "bg-foreground" : ""}`}
    >
      <SidebarMenuButton asChild>
        <Link
          href={href}
          className="mx-auto flex w-full max-w-[150px] items-center justify-start gap-[10px] font-medium"
        >
          {icon}
          <span> {name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
  if (canManageSee && currentUserRole === "superadmin") {
    return item;
  } else if (canAdminSee && currentUserRole === "admin") {
    return item;
  } else if (canUserSee && currentUserRole === "user") {
    return item;
  }
  return null;
}
