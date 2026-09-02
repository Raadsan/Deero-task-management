"use client";

import { usePermissions } from "@/context/PermissionContext";
import { getLucideIcon } from "@/lib/lucide-icons";
import { normalizeRoleName } from "@/lib/portfolio-access";
import { AuthSession } from "@/lib/types";
import {
  CalendarDays,
  ChevronLeft,
  LayoutDashboard,
  LayoutGrid,
  ShoppingBag,
  BriefcaseBusiness,
  Calculator,
  Settings2,
  Handshake,
  Users,
  Layers,
  Building2,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import SideBarItem from "./SidebarItem";
import SidebarCollapsibleNavItem from "./SidebarCollapsibleNavItem";
import { useSidebar } from "../ui/sidebar";

type Props = {
  data?: AuthSession | null;
  fallback: React.ReactNode;
  fallbackMenus?: Array<{
    id: string;
    href: string;
    items?: Array<{ href: string }>;
  }>;
};

export default function DynamicSidebarNav({ data }: Props) {
  const pathname = usePathname();
  const { menus, canView } = usePermissions();
  const { state: sidebarState, isMobile } = useSidebar();
  const isCollapsed = sidebarState === "collapsed" && !isMobile;
  const userRole = data?.user?.role ?? "";
  const normalizedRole = normalizeRoleName(userRole);
  const isSuperadmin = normalizedRole === "superadmin" || normalizedRole === "admin";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine current active module context
  const isAccountingModule =
    pathname.startsWith("/accounting") ||
    pathname.startsWith("/accounting/quotations") ||
    pathname.startsWith("/accounting/templates");

  const isTaskModule =
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/tasks/my-tasks") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/contracts") ||
    pathname.startsWith("/tasks/recurring-schedules") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/portfolios") ||
    pathname.startsWith("/reports");

  const isConfigModule =
    pathname.startsWith("/config") && !pathname.startsWith("/accounting/templates");

  const isSubmoduleActive = isAccountingModule || isTaskModule || isConfigModule;

  // Render Root High-Level Hub Navigation (Bloom_cafe pattern)
  const rootModules = useMemo(() => [
    {
      id: "root-dashboard",
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      id: "root-tasks",
      title: "Task Management",
      url: "/tasks/dashboard",
      icon: BriefcaseBusiness,
      active: isTaskModule,
    },
    {
      id: "root-accounting",
      title: "Accounting",
      url: "/accounting/dashboard",
      icon: Calculator,
      active: isAccountingModule,
    },
    {
      id: "root-config",
      title: "Configurations",
      url: "/config/roles",
      icon: Settings2,
      active: isConfigModule,
    },
  ], [pathname, isTaskModule, isAccountingModule, isConfigModule]);

  // Accounting Submodule Menus
  const accountingMenus = useMemo(() => [
    {
      id: "acc-dash",
      title: "Dashboard",
      url: "/accounting/dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "acc-config",
      title: "Configuration",
      icon: Settings2,
      items: [
        { id: "acc-cfg-acc-types", title: "Account Types", url: "/accounting/account-types" },
        { id: "acc-cfg-currencies", title: "Currencies", url: "/accounting/currencies" },
        { id: "acc-cfg-companies", title: "Companies", url: "/accounting/companies" },
        { id: "acc-cfg-taxes", title: "Taxes", url: "/accounting/taxes" },
        { id: "acc-cfg-pay-terms", title: "Payment Terms", url: "/accounting/payment-terms" },
        { id: "acc-cfg-pay-methods", title: "Payment Methods", url: "/accounting/payment-methods" },
        { id: "acc-cfg-prod-categories", title: "Service Categories", url: "/accounting/product-categories" },
        { id: "acc-cfg-products", title: "Services / Products", url: "/accounting/products" },
        { id: "acc-cfg-templates", title: "Templates", url: "/accounting/templates" },
      ],
    },
    {
      id: "acc-coa",
      title: "Chart of Accounts",
      url: "/accounting/chart-of-accounts",
      icon: Layers,
    },
    {
      id: "acc-fiscal",
      title: "Fiscal Management",
      icon: CalendarDays,
      items: [
        { id: "acc-fisc-years", title: "Fiscal Years", url: "/accounting/fiscal-years" },
        { id: "acc-fisc-periods", title: "Fiscal Periods", url: "/accounting/fiscal-periods" },
      ],
    },
    {
      id: "acc-ledger",
      title: "Ledger",
      icon: BookOpenIcon,
      items: [
        { id: "acc-ledg-journals", title: "Journals", url: "/accounting/journals" },
        { id: "acc-ledg-entries", title: "Journal Entries", url: "/accounting/journal-entries" },
      ],
    },
    {
      id: "acc-customers",
      title: "Customers",
      icon: FileSpreadsheet,
      items: [
        { id: "acc-cust-list", title: "Customers", url: "/accounting/customers" },
        { id: "acc-quotes-list", title: "Quotations", url: "/accounting/quotations" },
        { id: "acc-cust-invoices", title: "Invoices", url: "/accounting/customer-invoices" },
        { id: "acc-cust-receipts", title: "Receipts", url: "/accounting/customer-receipts" },
        { id: "acc-cust-credit-notes", title: "Credit Notes", url: "/accounting/credit-notes" },
      ],
    },
    {
      id: "acc-vendors",
      title: "Vendors",
      icon: Handshake,
      items: [
        { id: "acc-vend-list", title: "Vendors", url: "/accounting/vendors" },
        { id: "acc-vend-bills", title: "Bills", url: "/accounting/vendor-bills" },
        { id: "acc-vend-payments", title: "Payments", url: "/accounting/vendor-payments" },
        { id: "acc-vend-refunds", title: "Refunds", url: "/accounting/vendor-refunds" },
      ],
    },
    {
      id: "acc-banking",
      title: "Banking",
      icon: Building2,
      items: [
        { id: "acc-bank-accounts", title: "Bank Accounts", url: "/accounting/banks" },
        { id: "acc-bank-cash", title: "Cash Transactions", url: "/accounting/cash-transactions" },
      ],
    },
    {
      id: "acc-reports",
      title: "Financial Reports",
      url: "/accounting/reports",
      icon: BarChart3,
    },
  ], []);

  // Task Management Submodule Menus
  const taskMenus = useMemo(() => [
    {
      id: "task-dash",
      title: "Dashboard",
      url: "/tasks/dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "task-all",
      title: "Tasks",
      url: "/tasks",
      icon: BriefcaseBusiness,
    },
    {
      id: "task-my",
      title: "My Tasks",
      icon: ShoppingBag,
      items: [
        { id: "task-my-list", title: "My Tasks", url: "/tasks/my-tasks", icon: ShoppingBag },
        { id: "task-my-board", title: "My Board", url: "/tasks/my-tasks/board", icon: LayoutGrid },
        { id: "task-my-today", title: "Today Tasks", url: "/tasks/my-tasks/today", icon: CalendarDays },
      ],
    },
    {
      id: "task-clients",
      title: "Client Management",
      icon: Handshake,
      items: [
        { id: "task-cl-list", title: "Clients", url: "/clients" },
        { id: "task-cl-contracts", title: "Contracts", url: "/contracts" },
        { id: "task-cl-schedules", title: "Schedules", url: "/tasks/recurring-schedules" },
      ],
    },
    {
      id: "task-staff",
      title: "Staff",
      url: "/staff",
      icon: Users,
    },
    {
      id: "task-services",
      title: "Services",
      url: "/services",
      icon: Layers,
    },
    {
      id: "task-portfolios",
      title: "Portfolios",
      url: "/portfolios",
      icon: Building2,
    },
    {
      id: "task-reports",
      title: "Reports",
      icon: BarChart3,
      items: [
        { id: "rep-employees", title: "Employees Report", url: "/reports/users" },
        { id: "rep-clients", title: "Client Report", url: "/reports/clients" },
        { id: "rep-tasks", title: "Tasks Report", url: "/reports/tasks" },
        { id: "rep-my", title: "My Report", url: "/reports/my-report" },
      ],
    },
    {
      id: "task-config",
      title: "Configuration",
      icon: Settings2,
      items: [
        { id: "cfg-roles", title: "Roles", url: "/config/roles" },
        { id: "cfg-permissions", title: "Permissions", url: "/config/permissions" },
        { id: "cfg-menus", title: "Sidebar Menus", url: "/config/menus" },
        { id: "cfg-tracking", title: "Tracking", url: "/config/tracking" },
      ],
    },
  ], []);

  // Configuration Submodule Menus
  const configMenus = useMemo(() => [
    {
      id: "cfg-sub-roles",
      title: "Roles",
      url: "/config/roles",
      icon: Users,
    },
    {
      id: "cfg-sub-perms",
      title: "Permissions",
      url: "/config/permissions",
      icon: Settings2,
    },
    {
      id: "cfg-sub-menus",
      title: "Sidebar Menus",
      url: "/config/menus",
      icon: Layers,
    },
    {
      id: "cfg-sub-templates",
      title: "Templates",
      url: "/accounting/templates",
      icon: FileSpreadsheet,
    },
    {
      id: "cfg-sub-tracking",
      title: "Tracking",
      url: "/config/tracking",
      icon: BarChart3,
    },
  ], []);

  // Some saved permission records use legacy URLs while the live routes now sit
  // below /tasks or /accounting. Check both so old permissions still work.
  const permissionUrlAliases: Record<string, string[]> = {
    "/tasks/dashboard": ["/"],
    "/tasks/my-tasks": ["/my-tasks"],
    "/tasks/my-tasks/board": ["/my-tasks/board"],
    "/tasks/my-tasks/today": ["/my-tasks/today"],
    "/tasks/recurring-schedules": ["/recurring-schedules"],
    "/accounting/quotations": ["/quotations"],
    "/reports/my-report": ["/reports/tasks", "/reports/users"],
  };

  const mayViewUrl = (url: string) => {
    if (isSuperadmin) return true;
    return [url, ...(permissionUrlAliases[url] ?? [])].some((candidate) =>
      canView(candidate),
    );
  };

  type StaticSidebarItem = {
    id: string;
    title: string;
    url?: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    items?: Array<{
      id: string;
      title: string;
      url: string;
      icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    }>;
  };

  const filterMenusByPermission = (
    menuItems: StaticSidebarItem[],
    flattenChildren = false,
  ): StaticSidebarItem[] =>
    menuItems.flatMap((item): StaticSidebarItem[] => {
      if (item.items?.length) {
        const allowedItems = item.items.filter((sub) => mayViewUrl(sub.url));

        if (flattenChildren && !isSuperadmin) {
          return allowedItems.map((sub) => ({
            id: sub.id,
            title: sub.title,
            url: sub.url,
            icon: sub.icon ?? item.icon,
          }));
        }

        const parentAllowed = item.url ? mayViewUrl(item.url) : false;
        return parentAllowed || allowedItems.length
          ? [{ ...item, items: allowedItems }]
          : [];
      }

      if (!item.url || !mayViewUrl(item.url)) return [];

      return [
        {
          ...item,
          url: !isSuperadmin && item.url === "/tasks/dashboard" ? "/" : item.url,
        },
      ];
    });

  const visibleAccountingMenus = filterMenusByPermission(accountingMenus);
  const visibleTaskMenus = filterMenusByPermission(taskMenus);
  const visibleConfigMenus = filterMenusByPermission(configMenus);

  const routeAliases: Record<string, string> = {
    "/my-tasks": "/tasks/my-tasks",
    "/my-tasks/board": "/tasks/my-tasks/board",
    "/my-tasks/today": "/tasks/my-tasks/today",
    "/recurring-schedules": "/tasks/recurring-schedules",
    "/quotations": "/accounting/quotations",
  };

  const toAppRoute = (url?: string | null) => {
    if (!url) return "#";
    return routeAliases[url] ?? url;
  };

  const roleMenus = menus.map((menu) => {
    const Icon = getLucideIcon(menu.icon);
    return {
      id: menu.id,
      title: menu.title,
      url: menu.url === "/tasks/dashboard" ? "/" : toAppRoute(menu.url),
      icon: Icon,
      items: (menu.items ?? []).map((sub) => ({
        id: sub.id,
        title: sub.title,
        url: toAppRoute(sub.url),
      })),
    };
  });

  const staffTaskLinks = [
    { id: "staff-my-tasks", title: "My Tasks", url: "/tasks/my-tasks", icon: ShoppingBag },
    { id: "staff-my-board", title: "My Board", url: "/tasks/my-tasks/board", icon: LayoutGrid },
    { id: "staff-today-tasks", title: "Today Tasks", url: "/tasks/my-tasks/today", icon: CalendarDays },
  ];

  const staffReportLinks = [
    { id: "staff-my-report", title: "My Report", url: "/reports/my-report", icon: BarChart3 },
  ];
  if (!mounted) {
    return null;
  }

  // If user is superadmin and on Main Dashboard (/), show high-level root modules
  if (isSuperadmin && pathname === "/") {
    return (
      <div className="space-y-1">
        {rootModules.map((item) => {
          const Icon = item.icon;
          return (
            <SideBarItem
              key={item.id}
              href={item.url}
              name={item.title}
              icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            />
          );
        })}
      </div>
    );
  }

  if (!isSuperadmin) {
    const renderedStaffUrls = new Set<string>();
    const renderRoleItem = (item: (typeof roleMenus)[number]) => {
      const Icon = item.icon;
      const isStaffTaskGroup = normalizedRole === "staff" && (item.title === "My Tasks" || item.title === "Tasks" || item.url.includes("/my-tasks") || item.url.includes("/tasks"));

      if (isStaffTaskGroup) {
        const links = item.items.length > 0 ? item.items : staffTaskLinks;
        links.forEach((sub) => renderedStaffUrls.add(sub.url));
        return links.map((sub) => {
          return (
            <SideBarItem
              key={sub.id}
              href={sub.url}
              name={sub.title}
              icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            />
          );
        });
      }

      if (item.items.length > 1) {
        item.items.forEach((sub) => renderedStaffUrls.add(sub.url));
        return (
          <SidebarCollapsibleNavItem
            key={item.id}
            id={item.id}
            name={item.title}
            icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            items={item.items.map((sub) => ({
              id: sub.id,
              name: sub.title,
              href: sub.url,
            }))}
          />
        );
      }

      const href = item.items.length === 1 ? item.items[0].url : item.url;
      const name = item.items.length === 1 ? item.items[0].title : item.title;
      renderedStaffUrls.add(href);

      return (
        <SideBarItem
          key={item.id}
          href={href}
          name={name}
          icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
        />
      );
    };

    return (
      <div className="space-y-1">
        {roleMenus.map(renderRoleItem)}
        {normalizedRole === "staff" &&
          canView("/my-tasks") &&
          staffTaskLinks
            .filter((item) => !renderedStaffUrls.has(item.url))
            .map((item) => {
              const Icon = item.icon;
              return (
                <SideBarItem
                  key={item.id}
                  href={item.url}
                  name={item.title}
                  icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
                />
              );
            })}
        {normalizedRole === "staff" &&
          staffReportLinks
            .filter((item) => (mayViewUrl(item.url) || canView("/my-tasks")) && !renderedStaffUrls.has(item.url))
            .map((item) => {
              const Icon = item.icon;
              return (
                <SideBarItem
                  key={item.id}
                  href={item.url}
                  name={item.title}
                  icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
                />
              );
            })}
      </div>
    );
  }
  // If inside a Submodule, show "< Back to Modules" header (Bloom_cafe style)
  return (
    <div className="space-y-1">
      {isSuperadmin && isSubmoduleActive && (
        <div className="mb-2 px-1">
          <Link
            href="/"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white ${
              isCollapsed ? "justify-center" : ""
            }`}
            title="Back to Modules"
          >
            <ChevronLeft className="size-4 shrink-0" />
            {!isCollapsed && <span>Back to Modules</span>}
          </Link>
        </div>
      )}

      {/* Render Module specific navigation */}
      {isAccountingModule ? (
        visibleAccountingMenus.map((item) => {
          const Icon = item.icon || Layers;
          if (item.items?.length) {
            return (
              <SidebarCollapsibleNavItem
                key={item.id}
                id={item.id}
                name={item.title}
                icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
                items={item.items.map((sub) => ({
                  id: sub.id,
                  name: sub.title,
                  href: sub.url,
                }))}
              />
            );
          }
          return (
            <SideBarItem
              key={item.id}
              href={item.url!}
              name={item.title}
              icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            />
          );
        })
      ) : isConfigModule ? (
        visibleConfigMenus.map((item) => {
          const Icon = item.icon;
          return (
            <SideBarItem
              key={item.id}
              href={item.url}
              name={item.title}
              icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            />
          );
        })
      ) : (
        visibleTaskMenus.map((item) => {
          const Icon = item.icon;
          if (item.items?.length) {
            return (
              <SidebarCollapsibleNavItem
                key={item.id}
                id={item.id}
                name={item.title}
                icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
                items={item.items.map((sub) => ({
                  id: sub.id,
                  name: sub.title,
                  href: sub.url,
                }))}
              />
            );
          }
          return (
            <SideBarItem
              key={item.id}
              href={item.url!}
              name={item.title}
              icon={<Icon className="size-[18px] shrink-0" strokeWidth={2} />}
            />
          );
        })
      )}
    </div>
  );
}

function BookOpenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}




