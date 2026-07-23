"use client";

import HeaderUserMenu from "@/components/dashboard/HeaderUserMenu";
import TaskNotifications from "@/components/tasks/TaskNotifications";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/staff") return "Staff";
  const segment = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

type DashboardUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  image?: string | null;
};

export default function DashboardTopBar({ user }: { user: DashboardUser | null }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="z-30 shrink-0 border-b border-zinc-200 bg-white">
      <div className="flex h-14 items-center gap-4 px-4 lg:h-16 lg:px-6">
        <div className="flex shrink-0 items-center gap-3">
          <SidebarTrigger className="hover:text-primary size-9 shrink-0 rounded-md text-zinc-600 hover:bg-zinc-100 focus-visible:ring-0" />
          <h1 className="truncate text-base font-bold tracking-tight text-zinc-900">
            {pageTitle}
          </h1>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex lg:px-8">
          <div className="group relative w-full max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-600" />
            <input
              type="search"
              placeholder="Search anything... (Ctrl + K)"
              aria-label="Search"
              className={cn(
                "h-9 w-full rounded-full border-0 bg-zinc-100 pr-4 pl-10 text-sm text-zinc-800 transition-all outline-none",
                "placeholder:text-zinc-400 focus:bg-zinc-50 focus:ring-2 focus:ring-zinc-200",
              )}
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <TaskNotifications userId={user?.id} />
          <span
            className="hidden h-5 w-px shrink-0 bg-zinc-200 sm:block"
            aria-hidden="true"
          />
          <HeaderUserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
