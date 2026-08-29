"use client";

import TaskManagementDashboard from "@/components/tasks/TaskManagementDashboard";
import { authClient } from "@/lib/auth-client";
import { isBranchScopedRole, normalizeRoleName } from "@/lib/portfolio-access";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import useSWR from "swr";
import { useEffect, useState } from "react";

export default function TasksDashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const session = authClient.useSession();
  const user = session.data?.user as
    | { id?: string; role?: string; portfolioId?: string | null }
    | undefined;
  const normalizedRole = normalizeRoleName(user?.role);
  const isBranchDashboard = isBranchScopedRole(normalizedRole);

  const { data: branchOptionsRes } = useSWR(
    mounted && isBranchDashboard && user?.portfolioId && !session.isPending
      ? ["dashboard-portfolio", user.portfolioId]
      : null,
    getTaskFormBranchOptions,
  );
  const branchName =
    branchOptionsRes?.data?.portfolios?.find(
      (p: { id: string; name: string }) => String(p.id) === String(user?.portfolioId ?? ""),
    )?.name ?? "";

  if (!mounted || session.isPending) {
    return (
      <div className="space-y-8 animate-pulse px-1">
        <div className="h-20 rounded-xl bg-muted/20" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TaskManagementDashboard
      userId={user?.id ?? ""}
      portfolioId={user?.portfolioId}
      branchName={branchName}
      isBranchDashboard={isBranchDashboard}
      userName={(user as any)?.name || "Super Admin"}
    />
  );
}
