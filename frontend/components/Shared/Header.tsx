"use client";

import * as React from "react";
import { Search, Bell, Settings, LogOut, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { AuthSession } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export default function Header({ session }: { session: AuthSession | null }) {
  const pathname = usePathname();
  const paths = pathname.split("/").filter(Boolean);
  const title = paths.length > 0
    ? paths[paths.length - 1].charAt(0).toUpperCase() + paths[paths.length - 1].slice(1).replace(/-/g, " ")
    : "Dashboard";

  const userInitial = session?.user.name?.charAt(0).toUpperCase() || "A";

  return (
    <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white px-8 transition-all">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">
          {title === "Dashboard" ? "System Dashboard" : title}
        </h1>
      </div>

      <div className="flex-1 max-w-xl hidden lg:block mx-8">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 group-focus-within:text-[#5D0B0B] transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-transparent rounded-full focus:ring-2 focus:ring-[#5D0B0B]/5 focus:bg-white focus:border-[#5D0B0B]/10 transition-all text-sm outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer hover:bg-gray-50 p-2 rounded-full transition-all group">
          <Bell className="h-5 w-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-[#E64A19] rounded-full border-2 border-white"></span>
        </div>

        <div className="flex items-center gap-3 border-l border-gray-100 pl-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="h-9 w-9 rounded-full bg-[#5D0B0B] flex items-center justify-center text-white text-xs font-black shadow-md">
                  {userInitial}
                </div>
                <div className="flex flex-col items-start hidden sm:flex">
                  <span className="text-sm font-bold text-gray-900 leading-none">
                    {session?.user.name || "Administrator"}
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      {session?.user.role || "SUPERADMIN"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                  </div>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 mt-2 rounded-xl shadow-xl border-gray-100 p-2">
              <div className="flex flex-col space-y-1 p-3 mb-1 bg-gray-50 rounded-lg">
                <p className="text-sm font-bold text-gray-900 leading-none">
                  {session?.user.name || "Administrator"}
                </p>
                <p className="text-xs font-medium text-gray-500 truncate">
                  {session?.user.email || "admin@deero.com"}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-gray-100 my-1" />
              <DropdownMenuItem className="p-0">
                <Link href={ROUTES.settings || "#"} className="flex items-center gap-3 w-full py-2.5 px-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Settings className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-700">Profile Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-100 my-1" />
              <DropdownMenuItem className="rounded-lg gap-3 py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="h-4 w-4" />
                <Link href="/api/auth/sign-out" className="font-medium">Sign Out</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
