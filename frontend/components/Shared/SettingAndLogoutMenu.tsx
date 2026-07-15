"use client";

import { authClient } from "@/lib/auth-client";
import { clearLoginBranchCookie } from "@/lib/actions/portfolio.action";
import { ROUTES } from "@/lib/constants";
import { LogOut } from "lucide-react";
import { useTransition } from "react";
import toast from "react-hot-toast";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

export default function SettingAndLogoutMenu() {
  const [transition, startTransition] = useTransition();

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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          type="button"
          disabled={transition}
          onClick={handleSignOut}
          className="h-10 gap-3 rounded-lg !text-white/90 hover:!bg-white/10 active:!bg-white/10 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0"
        >
          <LogOut className="size-[18px] shrink-0" strokeWidth={2} />
          <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
            Logout
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
