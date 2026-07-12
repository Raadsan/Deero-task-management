"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { clearLoginBranchCookie } from "@/lib/actions/branch.action";
import { ROUTES } from "@/lib/constants";
import { UserRole } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import toast from "react-hot-toast";

interface Props {
  className?: string;
}

export default function HeaderUserMenu({ className }: Props) {
  const [transition, startTransition] = useTransition();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  async function handleSignOut() {
    if (transition) return;
    startTransition(async () => {
      try {
        await Promise.all([authClient.signOut(), clearLoginBranchCookie()]);
      } catch {
        toast.error("Logout failed. Please try again.");
        return;
      }
      window.location.assign(ROUTES.login);
    });
  }

  if (isPending || !user) {
    return (
      <div
        className={cn(
          "h-8 w-24 animate-pulse rounded-lg bg-zinc-100",
          className,
        )}
      />
    );
  }

  const displayName = user.name?.split(" ")[0]?.toUpperCase() ?? "USER";
  const displayRole = String(user.role ?? "USER").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={transition}
          aria-label="Open user menu"
          className={cn(
            "h-auto gap-2 rounded-lg px-1 py-0.5 hover:bg-zinc-100 focus-visible:ring-0 sm:px-1.5",
            className,
          )}
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-[13px] font-bold leading-tight tracking-tight text-zinc-900">
              {displayName}
            </p>
            <p className="truncate text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
              {displayRole}
            </p>
          </div>
          <ChevronDown className="hidden size-3.5 shrink-0 text-zinc-400 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-64 rounded-lg border border-zinc-200 bg-white p-1 shadow-md outline-none"
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="grid min-w-0 flex-1 text-left">
              <span className="truncate text-sm font-semibold text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-200" />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link
              href={ROUTES.profile}
              className="cursor-pointer rounded-md focus:bg-zinc-100"
            >
              <UserIcon className="size-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          {(user.role === UserRole.admin ||
            user.role === UserRole.superadmin) && (
            <DropdownMenuItem asChild>
              <Link
                href={ROUTES.profile}
                className="cursor-pointer rounded-md focus:bg-zinc-100"
              >
                <Settings className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-zinc-200" />
        <DropdownMenuItem
          disabled={transition}
          className="cursor-pointer rounded-md text-destructive focus:bg-red-50 focus:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
