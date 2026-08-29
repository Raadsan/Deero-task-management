"use client";

/* eslint-disable @next/next/no-img-element */

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
import { ROUTES } from "@/lib/constants";
import { signOutAndRedirect } from "@/lib/logout";
import { UserRole } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";

function UserAvatar({
  image,
  name,
  sizeClass,
}: {
  image?: string | null;
  name?: string | null;
  sizeClass: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  return (
    <div
      className={cn(
        "bg-primary flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white",
        sizeClass,
      )}
    >
      {image && !imageFailed ? (
        <img
          src={image}
          alt={`${name || "User"} profile`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        name?.charAt(0)?.toUpperCase() || "U"
      )}
    </div>
  );
}
interface Props {
  className?: string;
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    image?: string | null;
  } | null;
}

export default function HeaderUserMenu({ className, user }: Props) {
  const [mounted, setMounted] = useState(false);
  const [transition, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSignOut() {
    if (transition) return;
    startTransition(async () => {
      try {
        await signOutAndRedirect();
      } catch {
        toast.error("Logout failed. Please try again.");
        return;
      }
    });
  }

  if (!mounted || !user) {
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
          <UserAvatar
            image={user.image}
            name={user.name}
            sizeClass="size-7 text-xs"
          />
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-[13px] leading-tight font-bold tracking-tight text-zinc-900">
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
            <UserAvatar
              image={user.image}
              name={user.name}
              sizeClass="size-9 text-sm"
            />
            <div className="grid min-w-0 flex-1 text-left">
              <span className="text-foreground truncate text-sm font-semibold">
                {user.name}
              </span>
              <span className="text-muted-foreground truncate text-xs">
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
          className="text-destructive focus:text-destructive cursor-pointer rounded-md focus:bg-red-50"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
