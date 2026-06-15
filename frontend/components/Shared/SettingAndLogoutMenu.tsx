"use client";

import { authClient } from "@/lib/auth-client";
import { clearLoginBranchCookie } from "@/lib/actions/branch.action";
import { ROUTES } from "@/lib/constants";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import toast from "react-hot-toast";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

export default function SettingAndLogoutMenu() {
  const [transition, startTransition] = useTransition();
  const router = useRouter();

  function handleSignOut() {
    startTransition(async () => {
      await clearLoginBranchCookie();
      await authClient.signOut({
        fetchOptions: {
          onError(context) {
            toast.error(context.error.message);
          },
          onSuccess() {
            toast.success("Successfully logged out");
            router.push(ROUTES.login);
          },
        },
      });
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
