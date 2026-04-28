"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { ICONS, ROUTES } from "@/lib/constants";
import { UserRole } from "@/lib/generated/prisma";
import { AuthSession, SidebarItem } from "@/lib/types";
import {
  BriefcaseBusiness,
  Handshake,
  LayoutDashboard,
  ShoppingBag,
  Users,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import SettingAndLogoutMenu from "./SettingAndLogoutMenu";
import SideBarItem from "./SidebarItem";

const NAVIGATION_LINKS: SidebarItem[] = [
  {
    name: "Dashboard",
    href: ROUTES.dashboard,
    icon: <LayoutDashboard className="scale-[1.4]" />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Tasks",
    href: ROUTES.tasks,
    icon: <BriefcaseBusiness className="scale-[1.4]" />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "My Tasks",
    href: ROUTES["my-tasks"] || "/my-tasks",
    icon: <ShoppingBag className="scale-[1.4]" />,
    role: [UserRole.user, UserRole.admin],
  },
  {
    name: "Clients",
    href: ROUTES.clients,
    icon: <Handshake className="scale-[1.4]" />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Users",
    href: ROUTES.users,
    icon: <Users className="scale-[1.4]" />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Payment",
    href: ROUTES.payments,
    icon: <WalletCards className="scale-[1.4]" />,
    role: [UserRole.admin, UserRole.superadmin],
  },
];

interface Props {
  data?: AuthSession | null;
}

export function AppSidebar({ data }: Props) {
  return (
    <Sidebar className="gradientBg flex h-full w-full max-w-[200px] min-w-[100px] shrink-0 flex-col">
      <SidebarHeader>
        <div className="m-0 flex h-[92.81px] w-full items-center justify-center border-b border-white/10">
          <Image
            src={ICONS.logoPng1}
            width={100}
            height={100}
            alt="logo"
            className="size-[100px] rounded-full"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="min-h-fit">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="flex w-full flex-col items-start gap-[20px] pt-[40.2px]">
              {NAVIGATION_LINKS.map(({ href, role, icon, name }, index) => {
                const currentRole = data?.user.role;
                return (
                  <SideBarItem
                    key={index}
                    role={role}
                    icon={icon}
                    currentRole={currentRole as UserRole}
                    href={href}
                    name={name}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pb-[30px]">
        <SettingAndLogoutMenu userId={data?.user.id!} />
      </SidebarFooter>
    </Sidebar>
  );
}
