"use client";

import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/constants";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

interface Props {
  userId: string;
}
export default function SettingAndLogoutMenu({ userId }: Props) {
  const [transition, startTransition] = useTransition();
  const router = useRouter();

  function hanldeSigOut() {
    startTransition(async () => {
      await authClient.signOut({
        fetchOptions: {
          onError(context) {
            toast.error(context.error.message);
          },
          onSuccess() {
            toast.success("Successfully Logged out");
            router.push(ROUTES.login);
          },
        },
      });
    });
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem
        key={"setting"}
        className={`bg-foreground w-full py-[4px] pl-[26px] font-medium text-white`}
      >
        <SidebarMenuButton disabled={transition} asChild>
          <Link href={ROUTES.profile}>
            <Button
              disabled={transition}
              className="flex w-full cursor-pointer items-center justify-start rounded-none bg-inherit"
            >
              <Settings className="scale-[1.4]" />
              Setting
            </Button>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem
        key={"logout"}
        className={`bg-foreground w-full py-[4px] pl-[26px] font-medium text-white`}
      >
        <SidebarMenuButton asChild>
          <Button
            onClick={hanldeSigOut}
            className="flex w-full cursor-pointer items-center justify-start rounded-none bg-inherit"
          >
            <LogOut className="scale-[1.4]" />
            <span>Logout</span>
          </Button>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
