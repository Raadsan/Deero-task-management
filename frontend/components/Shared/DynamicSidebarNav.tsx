"use client";

import type { NavMenuItem } from "@/lib/apis/configApi";
import { usePermissions } from "@/context/PermissionContext";
import { normalizeRoleName } from "@/lib/portfolio-access";
import { getLucideIcon } from "@/lib/lucide-icons";
import { isLegacySidebarRole } from "@/lib/role-options";
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
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import SideBarItem from "./SidebarItem";
import SidebarCollapsibleNavItem from "./SidebarCollapsibleNavItem";
import { useSidebarAccordion } from "./SidebarAccordionContext";

type Props = {
  data?: AuthSession | null;
  fallback: React.ReactNode;
  fallbackMenus?: Array<{
    id: string;
    href: string;
    items?: Array<{ href: string }>;
  }>;
};

export default function DynamicSidebarNav({
  data,
  fallback,
  fallbackMenus = [],
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenId } = useSidebarAccordion();
  const { menus, loading } = usePermissions();
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
        { id: "acc-quotes-list", title: "Customer Quotations", url: "/accounting/quotations" },
        { id: "acc-cust-invoices", title: "Customer Invoices", url: "/accounting/customer-invoices" },
        { id: "acc-cust-receipts", title: "Customer Receipts", url: "/accounting/customer-receipts" },
        { id: "acc-cust-credit-notes", title: "Credit Notes", url: "/accounting/credit-notes" },
      ],
    },
    {
      id: "acc-vendors",
      title: "Vendors",
      icon: Handshake,
      items: [
        { id: "acc-vend-list", title: "Vendors", url: "/accounting/vendors" },
        { id: "acc-vend-bills", title: "Vendor Bills", url: "/accounting/vendor-bills" },
        { id: "acc-vend-payments", title: "Vendor Payments", url: "/accounting/vendor-payments" },
        { id: "acc-vend-refunds", title: "Vendor Refunds", url: "/accounting/vendor-refunds" },
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
        { id: "task-my-list", title: "My Tasks", url: "/tasks/my-tasks" },
        { id: "task-my-board", title: "My Board", url: "/tasks/my-tasks/board" },
        { id: "task-my-today", title: "Today Tasks", url: "/tasks/my-tasks/today" },
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

  // If inside a Submodule, show "< Back to Modules" header (Bloom_cafe style)
  return (
    <div className="space-y-1">
      {isSuperadmin && isSubmoduleActive && (
        <div className="mb-2 px-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-4" />
            <span>Back to Modules</span>
          </Link>
        </div>
      )}

      {/* Render Module specific navigation */}
      {isAccountingModule ? (
        accountingMenus.map((item) => {
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
        configMenus.map((item) => {
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
        taskMenus.map((item) => {
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
