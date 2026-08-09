"use client";

import { AuthSession } from "@/lib/types";
import { ROUTES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardAccessGuard({
  session,
  children,
}: {
  session: AuthSession | null | undefined;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      window.location.replace(ROUTES.login);
    }
  }, [session]);

  if (!session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 text-sm font-medium text-zinc-500">
        Redirecting to login...
      </div>
    );
  }

  return <>{children}</>;
}
