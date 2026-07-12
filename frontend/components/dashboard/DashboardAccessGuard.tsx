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
      router.replace(ROUTES.login);
    }
  }, [session, router]);

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
