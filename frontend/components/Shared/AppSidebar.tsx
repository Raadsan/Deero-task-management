"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarGroup,
  SidebarGroupContent,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ICONS, ROUTES } from "@/lib/constants";
import {
  BranchBranding,
  getBranchThemeStyle,
  resolveBranchLogoUrl,
} from "@/lib/portfolio-branding";
import { UserRole } from "@/lib/schema";
import { AuthSession, SidebarItem } from "@/lib/types";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Handshake,
  LayoutDashboard,
  Layers,
  Settings2,
  ShoppingBag,
  Users,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import SettingAndLogoutMenu from "./SettingAndLogoutMenu";
import SideBarItem from "./SidebarItem";
import SidebarCollapsibleNavItem from "./SidebarCollapsibleNavItem";
import DynamicSidebarNav from "./DynamicSidebarNav";
import { SidebarAccordionProvider } from "./SidebarAccordionContext";

const NAVIGATION_LINKS: SidebarItem[] = [
  {
    name: "Dashboard",
    href: ROUTES.dashboard,
    icon: <LayoutDashboard className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Tasks",
    href: ROUTES.tasks,
    icon: (
      <BriefcaseBusiness className="size-[18px] shrink-0" strokeWidth={2} />
    ),
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "My Tasks",
    href: ROUTES["my-tasks"] || "/my-tasks",
    icon: <ShoppingBag className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.user, UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Client Management",
    href: ROUTES.clients,
    icon: <Handshake className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
    items: [
      { name: "Clients", href: ROUTES.clients },
      { name: "Contracts", href: ROUTES.contracts },
      { name: "Schedules", href: ROUTES.recurringSchedules },
    ],
  },
  {
    name: "Staff",
    href: ROUTES.users,
    icon: <Users className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Services",
    href: ROUTES.services,
    icon: <Layers className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Portfolios",
    href: ROUTES.portfolios,
    icon: <Building2 className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
  },
  {
    name: "Payment",
    href: ROUTES.paymentsRevenue,
    icon: <WalletCards className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
    items: [
      { name: "All Payments", href: ROUTES.paymentsRevenue },
      { name: "Paid", href: ROUTES.paymentsPaid },
    ],
  },
  {
    name: "Reports",
    href: ROUTES.reportsPayments,
    icon: <BarChart3 className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
    items: [
      { name: "Payment Report", href: ROUTES.reportsPayments },
      { name: "Users Report", href: ROUTES.reportsUsers },
      { name: "Client Report", href: ROUTES.reportsClients },
      { name: "Tasks Report", href: ROUTES.reportsTasks },
    ],
  },
  {
    name: "Configuration",
    href: ROUTES.configRoles,
    icon: <Settings2 className="size-[18px] shrink-0" strokeWidth={2} />,
    role: [UserRole.admin, UserRole.superadmin],
    items: [
      { name: "Roles", href: ROUTES.configRoles },
      { name: "Permissions", href: ROUTES.configPermissions },
      { name: "Sidebar Menus", href: ROUTES.configMenus },
      { name: "Tracking", href: ROUTES.configTracking },
    ],
  },
];
interface Props {
  data?: AuthSession | null;
  branding?: BranchBranding | null;
}

export function AppSidebar({ data, branding }: Props) {
  const expandedLogo =
    resolveBranchLogoUrl(branding?.logoUrl) || ICONS.logoPng1;
  const collapsedLogo =
    resolveBranchLogoUrl(branding?.iconLogoUrl) ||
    resolveBranchLogoUrl(branding?.logoUrl) ||
    ICONS.logoIconCollapsed;
  const brandName = branding?.name || "Deero";

  return (
    <Sidebar
      collapsible="icon"
      style={getBranchThemeStyle(branding)}
      className="sidebar-brand border-sidebar-border text-sidebar-foreground border-r shadow-none"
    >
      <SidebarHeader className="border-sidebar-border sidebar-brand !flex !h-[96px] !items-center !justify-center overflow-hidden border-b !p-0 group-data-[collapsible=icon]:!h-[56px]">
        <Link
          href={ROUTES.dashboard}
          className="flex h-full w-full items-center justify-center px-4 py-2 transition-opacity hover:opacity-90"
        >
          <Image
            src={expandedLogo}
            width={240}
            height={100}
            alt={`${brandName} logo`}
            className="h-[68px] w-auto max-w-[200px] object-contain group-data-[collapsible=icon]:hidden"
            priority
            unoptimized={expandedLogo.startsWith("http")}
          />
          <Image
            src={collapsedLogo}
            width={48}
            height={48}
            alt={`${brandName} icon`}
            className="hidden size-10 object-contain group-data-[collapsible=icon]:block"
            priority
            unoptimized={collapsedLogo.startsWith("http")}
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="sidebar-brand gap-0 px-3 pt-5 pb-4">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:px-0">
              <SidebarAccordionProvider userId={data?.user.id}>
                <DynamicSidebarNav
                  data={data}
                  fallbackMenus={NAVIGATION_LINKS.map((link) => ({
                    id: link.name,
                    href: link.href,
                    items: link.items?.map((item) => ({ href: item.href })),
                  }))}
                  fallback={NAVIGATION_LINKS.map((link, index) => {
                    const currentRole = data?.user.role;
                    if (link.items?.length) {
                      return (
                        <SidebarCollapsibleNavItem
                          key={link.name}
                          id={link.name}
                          name={link.name}
                          icon={link.icon}
                          items={link.items.map((sub, subIndex) => ({
                            id: `${link.name}-${subIndex}`,
                            name: sub.name,
                            href: sub.href,
                          }))}
                          role={link.role}
                          currentRole={currentRole as UserRole}
                        />
                      );
                    }
                    return (
                      <SideBarItem
                        key={index}
                        role={link.role}
                        icon={link.icon}
                        currentRole={currentRole as UserRole}
                        href={link.href}
                        name={link.name}
                      />
                    );
                  })}
                />
              </SidebarAccordionProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="sidebar-brand border-sidebar-border border-t px-3 py-4">
        {data?.user && <SettingAndLogoutMenu />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
